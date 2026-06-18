"use client";

// Contratos del personal de la PLATAFORMA (comerciales de LEX Control), dentro
// del hub Comercial. Solo ADMIN. Usa la MISMA API /contratos que el portal
// cliente: como quien llama es ADMIN, el backend resuelve el ámbito PLATAFORMA
// (empresaId null), así que aquí se gestionan justo los contratos de plataforma.

import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Field, inputCls, Modal, MoneyInput, PlusIcon, StatCard } from "./ui";
import { DocumentosContrato, type DocumentoContrato as Documento } from "./documentos-contrato";
import { api, errorMessage } from "@/lib/api";

type Estado = "ACTIVO" | "FINALIZADO" | "SUSPENDIDO";

type Contrato = {
  id: string;
  usuarioId: string | null;
  nombreCompleto: string;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  fechaNacimiento: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  tipoColaborador: string | null;
  cargo: string | null;
  tipoContrato: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  duracionValor: number | null;
  duracionUnidad: string | null;
  estado: Estado;
  honorarios: string | null;
  formaPago: string | null;
  diaPago: number | null;
  bonificaciones: string | null;
  descuentos: string | null;
  cuentaBancaria: string | null;
  descripcionCargo: string | null;
  funciones: string | null;
  area: string | null;
  supervisor: string | null;
  horario: string | null;
  modalidad: string | null;
  observaciones: string | null;
  clausulas: string | null;
  tipoTerminacion: string | null;
  penalidades: string | null;
  documentos: Documento[];
};
type Reportes = { total: number; porEstado: Partial<Record<Estado, number>>; vencimientos: { id: string; nombreCompleto: string; fechaFin: string }[] };
type Comercial = { id: string; nombre: string; email: string };

const TIPO_DOC = ["CC", "CE", "NIT", "TI", "PASAPORTE", "PEP_PPT"];
const ESTADOS: Estado[] = ["ACTIVO", "FINALIZADO", "SUSPENDIDO"];
const FORMA_PAGO = ["Mensual", "Por caso", "Comisión"];
const MODALIDAD = ["Presencial", "Remoto", "Híbrido"];
const UNIDAD = ["DIA", "MES", "AÑO"];
const UNIDAD_LABEL: Record<string, string> = { DIA: "Días", MES: "Meses", AÑO: "Años" };

const ESTADO_STYLES: Record<Estado, string> = {
  ACTIVO: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  FINALIZADO: "bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400",
  SUSPENDIDO: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
};

const TABS = ["Datos", "Contractual", "Pagos", "Documentos", "Observaciones"] as const;
type Tab = (typeof TABS)[number];

type FormState = Record<string, string>;
const EMPTY: FormState = { estado: "ACTIVO" };
const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const moneyDigits = (v: string | null) => (v ? String(Math.round(Number(v))) : "");

function toForm(c: Contrato): FormState {
  return {
    usuarioId: c.usuarioId ?? "",
    nombreCompleto: c.nombreCompleto ?? "",
    tipoDocumento: c.tipoDocumento ?? "",
    numeroDocumento: c.numeroDocumento ?? "",
    fechaNacimiento: dateInput(c.fechaNacimiento),
    direccion: c.direccion ?? "",
    telefono: c.telefono ?? "",
    email: c.email ?? "",
    tipoColaborador: c.tipoColaborador ?? "",
    cargo: c.cargo ?? "",
    tipoContrato: c.tipoContrato ?? "",
    fechaInicio: dateInput(c.fechaInicio),
    fechaFin: dateInput(c.fechaFin),
    duracionValor: c.duracionValor != null ? String(c.duracionValor) : "",
    duracionUnidad: c.duracionUnidad ?? "",
    estado: c.estado ?? "ACTIVO",
    honorarios: moneyDigits(c.honorarios),
    formaPago: c.formaPago ?? "",
    diaPago: c.diaPago != null ? String(c.diaPago) : "",
    bonificaciones: c.bonificaciones ?? "",
    descuentos: c.descuentos ?? "",
    cuentaBancaria: c.cuentaBancaria ?? "",
    descripcionCargo: c.descripcionCargo ?? "",
    funciones: c.funciones ?? "",
    area: c.area ?? "",
    supervisor: c.supervisor ?? "",
    horario: c.horario ?? "",
    modalidad: c.modalidad ?? "",
    observaciones: c.observaciones ?? "",
    clausulas: c.clausulas ?? "",
    tipoTerminacion: c.tipoTerminacion ?? "",
    penalidades: c.penalidades ?? "",
  };
}

function toPayload(f: FormState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const numeros = new Set(["duracionValor", "diaPago", "honorarios"]);
  for (const [k, raw] of Object.entries(f)) {
    const v = raw.trim();
    if (v === "") continue;
    out[k] = numeros.has(k) ? Number(v) : v;
  }
  out.nombreCompleto = (f.nombreCompleto ?? "").trim();
  return out;
}

export function ContratosComercial() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [reportes, setReportes] = useState<Reportes | null>(null);
  const [comerciales, setComerciales] = useState<Comercial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [tab, setTab] = useState<Tab>("Datos");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [confirm, setConfirm] = useState<{ id: string; nombre: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [cs, rep, com] = await Promise.all([
        api.get<Contrato[]>("/contratos"),
        api.get<Reportes>("/contratos/reportes"),
        api.get<Comercial[]>("/equipo-comercial"),
      ]);
      setContratos(cs);
      setReportes(rep);
      setComerciales(com);
    } catch (err) {
      setError(errorMessage(err, "Error al cargar"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    cargar();
  }, []);

  function abrirCrear() {
    setEditId(null);
    setForm(EMPTY);
    setDocs([]);
    setTab("Datos");
    setFormError(null);
    setOpen(true);
  }
  function abrirEditar(c: Contrato) {
    setEditId(c.id);
    setForm(toForm(c));
    setDocs(c.documentos);
    setTab("Datos");
    setFormError(null);
    setOpen(true);
  }

  // Vincular un comercial: rellena nombre (editable) y correo (bloqueado mientras
  // siga vinculado). "Sin vincular" libera el correo.
  function vincular(id: string) {
    const c = comerciales.find((x) => x.id === id);
    setForm((f) => ({ ...f, usuarioId: id, ...(c ? { nombreCompleto: c.nombre, email: c.email } : {}) }));
  }

  async function guardar() {
    if (!form.nombreCompleto?.trim()) {
      setTab("Datos");
      setFormError("El nombre completo es obligatorio");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = toPayload(form);
      if (editId) await api.patch(`/contratos/${editId}`, payload);
      else await api.post("/contratos", payload);
      setOpen(false);
      setAviso(editId ? "Contrato actualizado" : "Contrato creado");
      await cargar();
    } catch (err) {
      setFormError(errorMessage(err, "Error al guardar"));
    } finally {
      setSaving(false);
    }
  }

  async function eliminar() {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await api.del(`/contratos/${confirm.id}`);
      setConfirm(null);
      setAviso("Contrato eliminado");
      await cargar();
    } catch (err) {
      setError(errorMessage(err, "Error al eliminar"));
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Contratos del personal de la plataforma (comerciales de LEX Control).
        </p>
        <Button onClick={abrirCrear}>
          <PlusIcon /> Nuevo contrato
        </Button>
      </div>

      {reportes && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Contratos" value={String(reportes.total)} />
          <StatCard label="Activos" value={String(reportes.porEstado.ACTIVO ?? 0)} />
          <StatCard
            label="Vencen pronto (≤60 días)"
            value={String(reportes.vencimientos.length)}
            hint={reportes.vencimientos[0] ? `Próximo: ${reportes.vencimientos[0].nombreCompleto}` : undefined}
          />
        </div>
      )}

      {aviso && <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{aviso}</div>}
      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      {loading ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>
      ) : contratos.length === 0 ? (
        <EmptyState
          title="Aún no hay contratos"
          description="Crea el primer contrato del personal comercial de la plataforma."
          action={<Button onClick={abrirCrear}><PlusIcon /> Nuevo contrato</Button>}
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Fin</th>
                <th className="px-4 py-3 font-medium">Docs</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 dark:border-slate-600/60">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{c.nombreCompleto}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.cargo ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.tipoContrato ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_STYLES[c.estado]}`}>{c.estado}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{dateInput(c.fechaFin) || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{c.documentos.length}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => abrirEditar(c)} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">Editar</button>
                    <button onClick={() => setConfirm({ id: c.id, nombre: c.nombreCompleto })} className="ml-4 text-sm font-medium text-red-600 hover:text-red-500">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={editId ? "Editar contrato" : "Nuevo contrato"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cerrar</Button>
            <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : editId ? "Guardar cambios" : "Crear"}</Button>
          </>
        }
      >
        <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 dark:border-slate-600">
          {TABS.map((t) => {
            const disabled = t === "Documentos" && !editId;
            return (
              <button
                key={t}
                type="button"
                disabled={disabled}
                onClick={() => setTab(t)}
                title={disabled ? "Guarda el contrato primero" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
                  tab === t ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300" : "text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-600"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        {tab === "Datos" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Vincular solo al CREAR; al editar el contrato ya existe. */}
            {!editId && (
              <div className="sm:col-span-2">
                <Field label="Vincular comercial (opcional)">
                  <select value={form.usuarioId ?? ""} onChange={(e) => vincular(e.target.value)} className={inputCls}>
                    <option value="">— Sin vincular (personal externo) —</option>
                    {comerciales.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            <div className="sm:col-span-2">
              <Field label="Nombre completo" requerido>
                <input value={form.nombreCompleto ?? ""} onChange={(e) => set("nombreCompleto", e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Tipo de documento">
              <select value={form.tipoDocumento ?? ""} onChange={(e) => set("tipoDocumento", e.target.value)} className={inputCls}>
                <option value="">Selecciona…</option>
                {TIPO_DOC.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Número de documento">
              <input value={form.numeroDocumento ?? ""} onChange={(e) => set("numeroDocumento", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Fecha de nacimiento">
              <input type="date" value={form.fechaNacimiento ?? ""} onChange={(e) => set("fechaNacimiento", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Teléfono">
              <input value={form.telefono ?? ""} onChange={(e) => set("telefono", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Correo electrónico">
              {form.usuarioId ? (
                <input value={form.email ?? ""} readOnly disabled title="Tomado del usuario vinculado" className={`${inputCls} cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-600/50 dark:text-slate-400`} />
              ) : (
                <input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} className={inputCls} />
              )}
            </Field>
            <Field label="Dirección">
              <input value={form.direccion ?? ""} onChange={(e) => set("direccion", e.target.value)} className={inputCls} />
            </Field>
          </div>
        )}

        {tab === "Contractual" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de colaborador">
              <input value={form.tipoColaborador ?? ""} onChange={(e) => set("tipoColaborador", e.target.value)} placeholder="Comercial, Abogado, otro…" className={inputCls} />
            </Field>
            <Field label="Cargo">
              <input value={form.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Tipo de contrato">
              <input value={form.tipoContrato ?? ""} onChange={(e) => set("tipoContrato", e.target.value)} placeholder="Prestación de servicios, Laboral…" className={inputCls} />
            </Field>
            <Field label="Estado">
              <select value={form.estado ?? "ACTIVO"} onChange={(e) => set("estado", e.target.value)} className={inputCls}>
                {ESTADOS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Fecha de inicio">
              <input type="date" value={form.fechaInicio ?? ""} onChange={(e) => set("fechaInicio", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Fecha de terminación">
              <input type="date" value={form.fechaFin ?? ""} onChange={(e) => set("fechaFin", e.target.value)} className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Duración del contrato">
                <div className="flex gap-2">
                  <input inputMode="numeric" value={form.duracionValor ?? ""} onChange={(e) => set("duracionValor", e.target.value.replace(/\D/g, ""))} placeholder="Ej. 12" className={`${inputCls} flex-1`} />
                  <select value={form.duracionUnidad ?? ""} onChange={(e) => set("duracionUnidad", e.target.value)} className={`${inputCls} flex-1`}>
                    <option value="">Unidad…</option>
                    {UNIDAD.map((o) => <option key={o} value={o}>{UNIDAD_LABEL[o]}</option>)}
                  </select>
                </div>
                <span className="mt-1 block text-xs text-slate-400">Cuánto dura el contrato (vigencia). Ej.: 12 meses, 1 año.</span>
              </Field>
            </div>
          </div>
        )}

        {tab === "Pagos" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Honorarios / salario (COP)">
              <div className="mt-1">
                <MoneyInput value={form.honorarios ?? ""} onChange={(v) => set("honorarios", v)} placeholder="0" className={inputCls} />
              </div>
            </Field>
            <Field label="Forma de pago">
              <select value={form.formaPago ?? ""} onChange={(e) => set("formaPago", e.target.value)} className={inputCls}>
                <option value="">Selecciona…</option>
                {FORMA_PAGO.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Día de pago (1-31)">
              <input inputMode="numeric" value={form.diaPago ?? ""} onChange={(e) => set("diaPago", e.target.value.replace(/\D/g, ""))} placeholder="Ej. 30" className={inputCls} />
            </Field>
            <Field label="Cuenta bancaria">
              <input value={form.cuentaBancaria ?? ""} onChange={(e) => set("cuentaBancaria", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Bonificaciones">
              <input value={form.bonificaciones ?? ""} onChange={(e) => set("bonificaciones", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Descuentos">
              <input value={form.descuentos ?? ""} onChange={(e) => set("descuentos", e.target.value)} className={inputCls} />
            </Field>
          </div>
        )}

        {tab === "Documentos" && editId && (
          <DocumentosContrato contratoId={editId} docs={docs} onChange={setDocs} onError={setFormError} />
        )}

        {tab === "Observaciones" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Área">
              <input value={form.area ?? ""} onChange={(e) => set("area", e.target.value)} placeholder="Comercial, administrativa, otro…" className={inputCls} />
            </Field>
            <Field label="Supervisor / jefe directo">
              <input value={form.supervisor ?? ""} onChange={(e) => set("supervisor", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Horario">
              <input value={form.horario ?? ""} onChange={(e) => set("horario", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Modalidad">
              <select value={form.modalidad ?? ""} onChange={(e) => set("modalidad", e.target.value)} className={inputCls}>
                <option value="">Selecciona…</option>
                {MODALIDAD.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Descripción del cargo"><textarea value={form.descripcionCargo ?? ""} onChange={(e) => set("descripcionCargo", e.target.value)} rows={3} className={inputCls} /></Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Funciones principales"><textarea value={form.funciones ?? ""} onChange={(e) => set("funciones", e.target.value)} rows={3} className={inputCls} /></Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Cláusulas especiales (confidencialidad, no competencia…)"><textarea value={form.clausulas ?? ""} onChange={(e) => set("clausulas", e.target.value)} rows={3} className={inputCls} /></Field>
            </div>
            <Field label="Tipo de terminación">
              <input value={form.tipoTerminacion ?? ""} onChange={(e) => set("tipoTerminacion", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Penalidades">
              <input value={form.penalidades ?? ""} onChange={(e) => set("penalidades", e.target.value)} className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Observaciones"><textarea value={form.observaciones ?? ""} onChange={(e) => set("observaciones", e.target.value)} rows={3} className={inputCls} /></Field>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmación de borrado */}
      <Modal
        open={!!confirm}
        onClose={() => !confirmBusy && setConfirm(null)}
        title="Eliminar contrato"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={confirmBusy}>Cancelar</Button>
            <Button variant="danger" onClick={eliminar} disabled={confirmBusy}>{confirmBusy ? "Eliminando…" : "Eliminar"}</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          ¿Eliminar el contrato de {confirm?.nombre}? Se borrarán también sus documentos registrados.
        </p>
      </Modal>
    </div>
  );
}
