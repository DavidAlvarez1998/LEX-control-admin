"use client";

// Lista de prospectos — embudo de venta (vender Planes a despachos). ADMIN ve
// todos y asigna comercial; COMERCIAL ve solo los suyos. Ganar crea Empresa +
// Suscripción + Comisión. Se renderiza dentro del tab "Prospectos" de /comercial.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Field, inputCls, Modal, PageHeader, PlusIcon } from "@/components/ui";
import { useNotify } from "@/components/feedback";
import { getUser } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { DetalleProspecto } from "@/components/prospecto-detalle";
import {
  ventasApi, CANAL_ENTRADA, ESTADO_PROSPECTO,
  type ComercialMin, type PlanMin, type Prospecto,
} from "@/lib/ventas";

const humaniza = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

const ESTADO_BADGE: Record<string, string> = {
  NUEVO: "bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300",
  CONTACTADO: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300",
  COTIZADO: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300",
  NEGOCIACION: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  GANADO: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  PERDIDO: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};
const EMPTY = { nombreEmpresa: "", nombreContacto: "", email: "", telefono: "", numeroDocumento: "", cargo: "", canalEntrada: "DIRECTO", referidoPor: "", planInteresId: "", comercialId: "", notas: "" };

// Etiqueta legible por campo del formulario (para mostrar errores de validación).
const FIELD_LABEL: Record<string, string> = {
  nombreEmpresa: "Empresa", nombreContacto: "Nombre del contacto", email: "Email",
  telefono: "Teléfono", numeroDocumento: "NIT / Identificación", cargo: "Cargo", canalEntrada: "Canal de entrada",
  referidoPor: "Nombre del referido", planInteresId: "Plan de interés",
  comercialId: "Comercial asignado", notas: "Notas",
};

// Validación de email permisiva (solo si el usuario escribió algo en el campo opcional).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProspectosList({ onOpenComercial, openProspectoId }: { onOpenComercial?: (id: string) => void; openProspectoId?: string | null } = {}) {
  const notify = useNotify();
  const esAdmin = getUser()?.rol === "ADMIN";

  const [items, setItems] = useState<Prospecto[]>([]);
  const [planes, setPlanes] = useState<PlanMin[]>([]);
  const [comerciales, setComerciales] = useState<ComercialMin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fEstado, setFEstado] = useState("");
  const [fCanal, setFCanal] = useState("");
  const [fComercial, setFComercial] = useState("");
  const [fSinAsignar, setFSinAsignar] = useState(false);

  const [crear, setCrear] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const setF = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [detalle, setDetalle] = useState<Prospecto | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setItems(await ventasApi.prospectos({
        estado: fEstado || undefined, canal: fCanal || undefined,
        comercialId: esAdmin && fComercial ? fComercial : undefined,
        sinAsignar: fSinAsignar || undefined,
      }));
    } catch (err) {
      setError(errorMessage(err, "Error al cargar"));
    } finally { setLoading(false); }
  }, [fEstado, fCanal, fComercial, fSinAsignar, esAdmin]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    ventasApi.planes().then(setPlanes);
    if (esAdmin) ventasApi.comerciales().then(setComerciales);
  }, [esAdmin]);
  // Apertura directa desde la búsqueda global (?prospectoId=): trae ese prospecto
  // y abre su ficha (aunque los filtros actuales lo excluyan).
  useEffect(() => {
    if (!openProspectoId) return;
    ventasApi.prospecto(openProspectoId).then(setDetalle).catch(() => {});
  }, [openProspectoId]);

  const planNombre = useMemo(() => (id: string | null) => planes.find((p) => p.id === id)?.nombre ?? "—", [planes]);
  const comNombre = useMemo(() => (id: string | null) => comerciales.find((c) => c.id === id)?.nombre ?? (id ? "Asignado" : "—"), [comerciales]);

  async function guardarNuevo() {
    setFormError(null);
    if (!form.nombreEmpresa.trim() || !form.nombreContacto.trim()) { setFormError("Empresa y contacto son obligatorios."); return; }
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) { setFormError("El email no es válido. Déjalo en blanco si no lo tienes."); return; }
    if (form.canalEntrada === "REFERIDO" && !form.referidoPor.trim()) { setFormError("Indica el nombre del referido."); return; }
    setSaving(true);
    try {
      await ventasApi.crearProspecto({
        nombreEmpresa: form.nombreEmpresa.trim(), nombreContacto: form.nombreContacto.trim(),
        email: form.email.trim() || undefined, telefono: form.telefono.trim() || undefined,
        numeroDocumento: form.numeroDocumento.trim() || undefined,
        cargo: form.cargo.trim() || undefined, canalEntrada: form.canalEntrada,
        referidoPor: form.canalEntrada === "REFERIDO" && form.referidoPor.trim() ? form.referidoPor.trim() : undefined,
        planInteresId: form.planInteresId || undefined,
        comercialId: esAdmin && form.comercialId ? form.comercialId : undefined,
        notas: form.notas.trim() || undefined,
      });
      setCrear(false); setForm(EMPTY); await cargar();
    } catch (err) {
      setFormError(errorMessage(err, "Error al crear.", FIELD_LABEL));
    } finally { setSaving(false); }
  }

  // Un COMERCIAL toma un prospecto sin dueño (auto-asignación).
  async function tomar(id: string) {
    try {
      await ventasApi.tomarProspecto(id);
      notify({ variant: "success", title: "Prospecto tomado", message: "Quedó asignado a ti." });
      await cargar();
    } catch (err) {
      notify({ variant: "error", title: "No se pudo tomar", message: errorMessage(err, "Inténtalo de nuevo.") });
    }
  }

  return (
    <div>
      <PageHeader
        title="Prospectos"
        subtitle="Empresas interesadas en contratar LEX Control."
        action={<Button onClick={() => { setForm(EMPTY); setFormError(null); setCrear(true); }}><PlusIcon />Nuevo prospecto</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          {ESTADO_PROSPECTO.map((s) => <option key={s} value={s}>{humaniza(s)}</option>)}
        </select>
        <select value={fCanal} onChange={(e) => setFCanal(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm">
          <option value="">Todos los canales</option>
          {CANAL_ENTRADA.map((c) => <option key={c} value={c}>{humaniza(c)}</option>)}
        </select>
        {esAdmin && (
          <select value={fComercial} onChange={(e) => setFComercial(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm">
            <option value="">Todos los comerciales</option>
            {comerciales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm">
          <input type="checkbox" checked={fSinAsignar} onChange={(e) => setFSinAsignar(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 dark:border-slate-500" />
          Solo sin asignar
        </label>
      </div>

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
          {error} <button onClick={cargar} className="font-medium underline">reintentar</button>
        </Card>
      )}

      {loading ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>
      ) : items.length === 0 ? (
        <EmptyState title="Sin prospectos" description="Registra una empresa interesada para empezar el embudo de venta." />
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-600 text-left text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Empresa</th>
                <th className="px-5 py-3 font-medium">Contacto</th>
                <th className="px-5 py-3 font-medium">Canal</th>
                <th className="px-5 py-3 font-medium">Plan interés</th>
                {esAdmin && <th className="px-5 py-3 font-medium">Comercial</th>}
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-600 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{p.nombreEmpresa}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{p.nombreContacto}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{humaniza(p.canalEntrada)}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{planNombre(p.planInteresId)}</td>
                  {esAdmin && (
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {p.comercialId && onOpenComercial
                        ? <button onClick={() => onOpenComercial(p.comercialId!)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">{comNombre(p.comercialId)}</button>
                        : comNombre(p.comercialId)}
                    </td>
                  )}
                  <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_BADGE[p.estado] ?? ""}`}>{humaniza(p.estado)}</span></td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      {!esAdmin && !p.comercialId && (
                        <button onClick={() => tomar(p.id)} className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline">Tomar</button>
                      )}
                      <button onClick={() => setDetalle(p)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Abrir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Crear */}
      <Modal open={crear} onClose={() => !saving && setCrear(false)} title="Nuevo prospecto"
        footer={<><Button variant="ghost" onClick={() => setCrear(false)} disabled={saving}>Cancelar</Button><Button onClick={guardarNuevo} disabled={saving}>{saving ? "Guardando…" : "Crear"}</Button></>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Empresa" requerido><input value={form.nombreEmpresa} onChange={(e) => setF("nombreEmpresa", e.target.value)} className={inputCls} placeholder="Despacho…" /></Field>
          <Field label="Nombre del contacto" requerido><input value={form.nombreContacto} onChange={(e) => setF("nombreContacto", e.target.value)} className={inputCls} placeholder="Ej. Juan Pérez" /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Email"><input value={form.email} onChange={(e) => setF("email", e.target.value)} className={inputCls} placeholder="opcional" /></Field>
          <Field label="Teléfono"><input value={form.telefono} onChange={(e) => setF("telefono", e.target.value)} className={inputCls} placeholder="opcional" /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="NIT / Identificación"><input value={form.numeroDocumento} onChange={(e) => setF("numeroDocumento", e.target.value)} className={inputCls} placeholder="opcional" /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Canal de entrada"><select value={form.canalEntrada} onChange={(e) => setF("canalEntrada", e.target.value)} className={inputCls}>{CANAL_ENTRADA.map((c) => <option key={c} value={c}>{humaniza(c)}</option>)}</select></Field>
          <Field label="Plan de interés"><select value={form.planInteresId} onChange={(e) => setF("planInteresId", e.target.value)} className={inputCls}><option value="">—</option>{planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
        </div>
        {form.canalEntrada === "REFERIDO" && (
          <Field label="Nombre del referido" requerido><input value={form.referidoPor} onChange={(e) => setF("referidoPor", e.target.value)} className={inputCls} placeholder="¿Quién lo refirió?" /></Field>
        )}
        {esAdmin && (
          <Field label="Comercial asignado"><select value={form.comercialId} onChange={(e) => setF("comercialId", e.target.value)} className={inputCls}><option value="">Sin asignar</option>{comerciales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
        )}
        <Field label="Notas"><textarea value={form.notas} onChange={(e) => setF("notas", e.target.value)} className={`${inputCls} resize-y`} rows={2} placeholder="opcional" /></Field>
        {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
      </Modal>

      {/* Detalle */}
      {detalle && (
        <DetalleProspecto
          base={detalle}
          esAdmin={esAdmin}
          planes={planes}
          comerciales={comerciales}
          onClose={() => setDetalle(null)}
          onChange={async () => { await cargar(); setDetalle(null); }}
          notify={notify}
        />
      )}
    </div>
  );
}
