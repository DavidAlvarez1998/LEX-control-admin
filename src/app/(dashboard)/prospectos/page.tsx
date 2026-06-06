"use client";

// Prospectos — embudo de venta de la plataforma (vender Planes a despachos).
// ADMIN ve todos y asigna comercial; COMERCIAL ve solo los suyos. Ganar crea
// Empresa + Suscripción + Comisión en el backend.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Field, inputCls, Modal, PageHeader, PlusIcon } from "@/components/ui";
import { MoneyInput } from "@/components/ui";
import { useNotify } from "@/components/feedback";
import { getUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import {
  ventasApi, CANAL_ENTRADA, ESTADO_EDITABLE, ESTADO_PROSPECTO,
  type ComercialMin, type PlanMin, type Prospecto,
} from "@/lib/ventas";

const money = (v: string | number | null) => (v == null || v === "" ? "—" : `$${formatMoney(v)}`);
const humaniza = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

const ESTADO_BADGE: Record<string, string> = {
  NUEVO: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
  CONTACTADO: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300",
  COTIZADO: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300",
  NEGOCIACION: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  GANADO: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  PERDIDO: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};
const EMPTY = { nombreEmpresa: "", nombreContacto: "", email: "", telefono: "", cargo: "", canalEntrada: "DIRECTO", planInteresId: "", comercialId: "", notas: "" };

export default function ProspectosPage() {
  const notify = useNotify();
  const esAdmin = getUser()?.rol === "ADMIN";

  const [items, setItems] = useState<Prospecto[]>([]);
  const [planes, setPlanes] = useState<PlanMin[]>([]);
  const [comerciales, setComerciales] = useState<ComercialMin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fEstado, setFEstado] = useState("");
  const [fCanal, setFCanal] = useState("");

  const [crear, setCrear] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const setF = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [detalle, setDetalle] = useState<Prospecto | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setItems(await ventasApi.prospectos({ estado: fEstado || undefined, canal: fCanal || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally { setLoading(false); }
  }, [fEstado, fCanal]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    ventasApi.planes().then(setPlanes);
    if (esAdmin) ventasApi.comerciales().then(setComerciales);
  }, [esAdmin]);

  const planNombre = useMemo(() => (id: string | null) => planes.find((p) => p.id === id)?.nombre ?? "—", [planes]);
  const comNombre = useMemo(() => (id: string | null) => comerciales.find((c) => c.id === id)?.nombre ?? (id ? "Asignado" : "—"), [comerciales]);

  async function guardarNuevo() {
    setFormError(null);
    if (!form.nombreEmpresa.trim() || !form.nombreContacto.trim()) { setFormError("Empresa y contacto son obligatorios."); return; }
    setSaving(true);
    try {
      await ventasApi.crearProspecto({
        nombreEmpresa: form.nombreEmpresa.trim(), nombreContacto: form.nombreContacto.trim(),
        email: form.email.trim() || undefined, telefono: form.telefono.trim() || undefined,
        cargo: form.cargo.trim() || undefined, canalEntrada: form.canalEntrada,
        planInteresId: form.planInteresId || undefined,
        comercialId: esAdmin && form.comercialId ? form.comercialId : undefined,
        notas: form.notas.trim() || undefined,
      });
      setCrear(false); setForm(EMPTY); await cargar();
    } catch (err) {
      setFormError(err instanceof ApiError || err instanceof Error ? err.message : "Error al crear.");
    } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader
        title="Prospectos"
        subtitle="Empresas interesadas en contratar LEX Control."
        action={<Button onClick={() => { setForm(EMPTY); setFormError(null); setCrear(true); }}><PlusIcon />Nuevo prospecto</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          {ESTADO_PROSPECTO.map((s) => <option key={s} value={s}>{humaniza(s)}</option>)}
        </select>
        <select value={fCanal} onChange={(e) => setFCanal(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
          <option value="">Todos los canales</option>
          {CANAL_ENTRADA.map((c) => <option key={c} value={c}>{humaniza(c)}</option>)}
        </select>
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
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
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
                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{p.nombreEmpresa}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{p.nombreContacto}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{humaniza(p.canalEntrada)}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{planNombre(p.planInteresId)}</td>
                  {esAdmin && <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{comNombre(p.comercialId)}</td>}
                  <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_BADGE[p.estado] ?? ""}`}>{humaniza(p.estado)}</span></td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => setDetalle(p)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Abrir</button>
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Empresa" requerido><input value={form.nombreEmpresa} onChange={(e) => setF("nombreEmpresa", e.target.value)} className={inputCls} placeholder="Despacho…" /></Field>
          <Field label="Contacto" requerido><input value={form.nombreContacto} onChange={(e) => setF("nombreContacto", e.target.value)} className={inputCls} placeholder="Nombre" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><input value={form.email} onChange={(e) => setF("email", e.target.value)} className={inputCls} placeholder="opcional" /></Field>
          <Field label="Teléfono"><input value={form.telefono} onChange={(e) => setF("telefono", e.target.value)} className={inputCls} placeholder="opcional" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Canal de entrada"><select value={form.canalEntrada} onChange={(e) => setF("canalEntrada", e.target.value)} className={inputCls}>{CANAL_ENTRADA.map((c) => <option key={c} value={c}>{humaniza(c)}</option>)}</select></Field>
          <Field label="Plan de interés"><select value={form.planInteresId} onChange={(e) => setF("planInteresId", e.target.value)} className={inputCls}><option value="">—</option>{planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
        </div>
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

function DetalleProspecto({ base, esAdmin, planes, comerciales, onClose, onChange, notify }: {
  base: Prospecto; esAdmin: boolean; planes: PlanMin[]; comerciales: ComercialMin[];
  onClose: () => void; onChange: () => void; notify: ReturnType<typeof useNotify>;
}) {
  const [estado, setEstado] = useState(base.estado);
  const [comercialId, setComercialId] = useState(base.comercialId ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const terminal = base.estado === "GANADO" || base.estado === "PERDIDO";

  // Ganar
  const [ganar, setGanar] = useState(false);
  const planDefault = base.planInteresId ?? "";
  const [planId, setPlanId] = useState(planDefault);
  const precioDefault = String(Math.round(Number(planes.find((p) => p.id === planDefault)?.precioMensual ?? 0))) || "";
  const [precioVenta, setPrecioVenta] = useState(precioDefault);
  const [montoFijo, setMontoFijo] = useState("");

  // Perder
  const [perder, setPerder] = useState(false);
  const [motivo, setMotivo] = useState("");

  async function guardarCambios() {
    setBusy(true); setErr(null);
    try {
      const body: Record<string, unknown> = {};
      if (estado !== base.estado) body.estado = estado;
      if (esAdmin && comercialId !== (base.comercialId ?? "")) body.comercialId = comercialId || null;
      if (Object.keys(body).length) await ventasApi.editarProspecto(base.id, body);
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar.");
    } finally { setBusy(false); }
  }

  async function confirmarGanar() {
    setBusy(true); setErr(null);
    try {
      await ventasApi.ganar(base.id, {
        planId: planId || undefined,
        precioVenta: precioVenta ? Number(precioVenta) : undefined,
        montoComisionFijo: montoFijo ? Number(montoFijo) : undefined,
      });
      await notify({ message: "Venta cerrada: empresa, suscripción y comisión creadas.", variant: "success" });
      onChange();
    } catch (e) {
      setErr(e instanceof ApiError || e instanceof Error ? e.message : "Error al cerrar la venta.");
      setBusy(false);
    }
  }

  async function confirmarPerder() {
    if (!motivo.trim()) { setErr("Indica el motivo."); return; }
    setBusy(true); setErr(null);
    try { await ventasApi.perder(base.id, motivo.trim()); onChange(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Error."); setBusy(false); }
  }

  const onPlanChange = (id: string) => {
    setPlanId(id);
    const pm = planes.find((p) => p.id === id)?.precioMensual;
    if (pm != null) setPrecioVenta(String(Math.round(Number(pm))));
  };

  return (
    <Modal open onClose={onClose} title={base.nombreEmpresa} size="lg"
      footer={<Button variant="ghost" onClick={onClose}>Cerrar</Button>}>
      <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
        <p><span className="text-slate-400">Contacto:</span> {base.nombreContacto}{base.cargo ? ` · ${base.cargo}` : ""}</p>
        {base.email && <p><span className="text-slate-400">Email:</span> {base.email}</p>}
        {base.telefono && <p><span className="text-slate-400">Teléfono:</span> {base.telefono}</p>}
        <p><span className="text-slate-400">Canal:</span> {humaniza(base.canalEntrada)}</p>
        {base.notas && <p><span className="text-slate-400">Notas:</span> {base.notas}</p>}
        {base.estado === "GANADO" && <p className="text-emerald-700 dark:text-emerald-400">Vendido por {money(base.precioVenta)}{base.fechaCierre ? ` · ${new Date(base.fechaCierre).toLocaleDateString()}` : ""}</p>}
        {base.estado === "PERDIDO" && base.motivoPerdida && <p className="text-red-600 dark:text-red-400">Perdido: {base.motivoPerdida}</p>}
      </div>

      {!terminal && !ganar && !perder && (
        <div className="mt-2 space-y-3 border-t border-slate-200 dark:border-slate-800 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Etapa"><select value={estado} onChange={(e) => setEstado(e.target.value)} className={inputCls}>{ESTADO_EDITABLE.map((s) => <option key={s} value={s}>{humaniza(s)}</option>)}</select></Field>
            {esAdmin && <Field label="Comercial"><select value={comercialId} onChange={(e) => setComercialId(e.target.value)} className={inputCls}><option value="">Sin asignar</option>{comerciales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>}
          </div>
          {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              <Button onClick={() => setGanar(true)}>Ganar venta</Button>
              <Button variant="ghost" onClick={() => setPerder(true)}>Marcar perdido</Button>
            </div>
            <Button variant="ghost" onClick={guardarCambios} disabled={busy}>{busy ? "…" : "Guardar cambios"}</Button>
          </div>
        </div>
      )}

      {ganar && (
        <div className="mt-2 space-y-3 border-t border-slate-200 dark:border-slate-800 pt-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Cerrar venta</p>
          <Field label="Plan vendido" requerido><select value={planId} onChange={(e) => onPlanChange(e.target.value)} className={inputCls}><option value="">Selecciona…</option>{planes.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {money(p.precioMensual)}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio de venta"><MoneyInput value={precioVenta} onChange={setPrecioVenta} placeholder="0" className={inputCls} /></Field>
            <Field label="Comisión fija (opcional)"><MoneyInput value={montoFijo} onChange={setMontoFijo} placeholder="usa el % del comercial" className={inputCls} /></Field>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">Si dejas la comisión vacía, se calcula con el % del comercial asignado. Se creará la empresa, su suscripción y la comisión.</p>
          {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setGanar(false)} disabled={busy}>Volver</Button>
            <Button onClick={confirmarGanar} disabled={busy || !planId}>{busy ? "Cerrando…" : "Confirmar venta"}</Button>
          </div>
        </div>
      )}

      {perder && (
        <div className="mt-2 space-y-3 border-t border-slate-200 dark:border-slate-800 pt-3">
          <Field label="Motivo de pérdida" requerido><input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} placeholder="Ej. Precio, eligió competencia…" /></Field>
          {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPerder(false)} disabled={busy}>Volver</Button>
            <Button onClick={confirmarPerder} disabled={busy}>{busy ? "…" : "Marcar perdido"}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
