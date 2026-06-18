"use client";

import { useEffect, useState } from "react";
import { Button, Card, MoneyInput, PageHeader, PlusIcon } from "@/components/ui";
import { useNotify } from "@/components/feedback";
import { api, errorMessage } from "@/lib/api";

type Cuotas = Partial<Record<string, number | null>>;
type Plan = { id: string; clave: string; nombre: string; precioMensual: number; activo: boolean; orden: number; modulos: string[]; cuotas: Cuotas };
type Modulo = { id: string; clave: string; nombre: string; esBaseline: boolean };
type Despacho = { id: string; nombre: string; activo: boolean; plan: string | null; planClave: string | null; estado: string | null };

const ROLES = ["ADMINISTRADOR", "JURIDICO", "CONTABLE", "COMERCIAL"];

type Form = { clave: string; nombre: string; precio: string; activo: boolean; orden: string; modulos: string[]; cuotas: Record<string, string> };
const EMPTY: Form = { clave: "", nombre: "", precio: "", activo: true, orden: "0", modulos: [], cuotas: { ADMINISTRADOR: "", JURIDICO: "", CONTABLE: "", COMERCIAL: "" } };
const money = (v: number) => `$${v.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
const INPUT = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";
const cuotaTxt = (v: number | null | undefined) => (v === null ? "∞" : v === undefined ? "0" : String(v));

export default function PlanesPage() {
  const notify = useNotify();
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [p, m, d] = await Promise.all([
        api.get<Plan[]>("/planes"),
        api.get<Modulo[]>("/planes/modulos"),
        api.get<Despacho[]>("/planes/suscripciones"),
      ]);
      setPlanes(p); setModulos(m); setDespachos(d);
    } catch (err) {
      setError(errorMessage(err, "Error al cargar"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { cargar(); }, []);
  // Filtro de texto del catálogo, prellenado desde ?q= (búsqueda global).
  const [filtro, setFiltro] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setFiltro(q);
  }, []);
  const planesVisibles = (() => {
    const t = filtro.trim().toLowerCase();
    if (!t) return planes;
    return planes.filter((p) => p.nombre.toLowerCase().includes(t) || p.clave.toLowerCase().includes(t));
  })();

  const noBaseline = modulos.filter((m) => !m.esBaseline);
  const baseline = modulos.filter((m) => m.esBaseline);
  const planPorClave = (c: string | null) => planes.find((p) => p.clave === c);

  function abrirCrear() {
    setEditId(null); setForm(EMPTY); setFormError(null); setOpen(true);
  }
  function abrirEditar(p: Plan) {
    setEditId(p.id);
    setForm({
      clave: p.clave, nombre: p.nombre, precio: String(p.precioMensual), activo: p.activo, orden: String(p.orden),
      modulos: p.modulos,
      cuotas: Object.fromEntries(ROLES.map((r) => [r, p.cuotas[r] === null ? "" : p.cuotas[r] === undefined ? "0" : String(p.cuotas[r])])) as Record<string, string>,
    });
    setFormError(null); setOpen(true);
  }

  async function guardar() {
    setFormError(null);
    if (!form.nombre.trim() || (!editId && !form.clave.trim())) { setFormError("Clave y nombre son obligatorios"); return; }
    setSaving(true);
    // cuotas: "" = ilimitado (null), número = ese cupo
    const cuotas = Object.fromEntries(ROLES.map((r) => [r, form.cuotas[r].trim() === "" ? null : Number(form.cuotas[r])]));
    const base = { nombre: form.nombre.trim(), precioMensual: Number(form.precio || 0), orden: Number(form.orden || 0), activo: form.activo, modulos: form.modulos, cuotas };
    try {
      if (editId) await api.patch(`/planes/${editId}`, base);
      else await api.post("/planes", { ...base, clave: form.clave.trim() });
      setOpen(false);
      await cargar();
      await notify({ message: editId ? "Plan actualizado." : "Plan creado.", variant: "success" });
    } catch (err) {
      setFormError(errorMessage(err, "Error al guardar"));
    } finally {
      setSaving(false);
    }
  }

  async function asignar(despachoId: string, clave: string) {
    const plan = planPorClave(clave);
    if (!plan) return;
    try {
      await api.put(`/planes/suscripciones/${despachoId}`, { planId: plan.id });
      await cargar();
      await notify({ message: "Plan asignado.", variant: "success" });
    } catch (err) {
      await notify({ message: errorMessage(err, "Error al asignar"), variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Planes"
        subtitle="Catálogo de planes (precio, módulos, cupos) y su asignación a cada despacho."
        action={<Button onClick={abrirCrear}><PlusIcon />Nuevo plan</Button>}
      />

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
          {error} <button onClick={cargar} className="font-medium underline">reintentar</button>
        </Card>
      )}

      {loading ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>
      ) : (
        <div className="space-y-6">
          {/* Catálogo */}
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar planes por nombre o clave…"
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {planesVisibles.map((p) => (
              <Card key={p.id} className={p.activo ? "" : "opacity-60"}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">{p.nombre}</h3>
                    <p className="text-xs text-slate-400">{p.clave}</p>
                  </div>
                  <button onClick={() => abrirEditar(p)} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">Editar</button>
                </div>
                <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">{money(p.precioMensual)}<span className="text-sm font-normal text-slate-400"> /mes</span></p>
                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  <p className="font-medium text-slate-600 dark:text-slate-300">Cupos por rol</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {ROLES.map((r) => (
                      <span key={r} className="rounded bg-slate-200 px-1.5 py-0.5 dark:bg-slate-600">{r.slice(0, 4)}: {cuotaTxt(p.cuotas[r])}</span>
                    ))}
                  </div>
                  <p className="mt-2 font-medium text-slate-600 dark:text-slate-300">Módulos extra</p>
                  <p>{p.modulos.length ? p.modulos.join(", ") : "—"}</p>
                </div>
                {!p.activo && <span className="mt-3 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-600">Inactivo</span>}
              </Card>
            ))}
          </div>

          {/* Asignación a despachos */}
          <Card className="p-0 overflow-x-auto">
            <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-600">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Plan por despacho</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 dark:text-slate-400">
                <tr><th className="px-5 py-2 font-medium">Despacho</th><th className="px-5 py-2 font-medium">Plan actual</th><th className="px-5 py-2 font-medium">Cambiar a</th></tr>
              </thead>
              <tbody>
                {despachos.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100 dark:border-slate-600">
                    <td className="px-5 py-2 font-medium text-slate-800 dark:text-slate-100">{d.nombre}{!d.activo && <span className="ml-2 text-xs text-slate-400">(inactivo)</span>}</td>
                    <td className="px-5 py-2 text-slate-600 dark:text-slate-300">{d.plan ?? <span className="text-slate-400">sin plan</span>}</td>
                    <td className="px-5 py-2">
                      <select
                        value={d.planClave ?? ""}
                        onChange={(e) => asignar(d.id, e.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                      >
                        <option value="" disabled>Selecciona…</option>
                        {planes.filter((p) => p.activo).map((p) => <option key={p.id} value={p.clave}>{p.nombre}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60" onClick={(e) => { if (e.target === e.currentTarget && !saving) setOpen(false); }}>
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">{editId ? "Editar plan" : "Nuevo plan"}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Clave {!editId && <span className="text-red-500">*</span>}</span>
                  {editId ? (
                    <div className="mt-1 rounded-lg border border-slate-200 bg-slate-200 px-3 py-2 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-600 dark:text-slate-400">
                      {form.clave} <span className="text-xs">(no editable)</span>
                    </div>
                  ) : (
                    <input value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} placeholder="bufete_pro" className={`mt-1 ${INPUT}`} />
                  )}
                </label>
                <label className="block">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Nombre <span className="text-red-500">*</span></span>
                  <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Bufete PRO"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Precio mensual (COP)</span>
                  <div className="mt-1"><MoneyInput value={form.precio} onChange={(v) => setForm({ ...form, precio: v })} placeholder="0" className={INPUT} /></div>
                </label>
                <label className="block">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Orden</span>
                  <input value={form.orden} onChange={(e) => setForm({ ...form, orden: e.target.value.replace(/\D/g, "") })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
                </label>
              </div>

              <div>
                <span className="text-sm text-slate-600 dark:text-slate-300">Cupos por rol <span className="text-xs text-slate-400">(vacío = ilimitado)</span></span>
                <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ROLES.map((r) => (
                    <label key={r} className="block">
                      <span className="text-[11px] text-slate-400">{r.slice(0, 5)}</span>
                      <input value={form.cuotas[r]} onChange={(e) => setForm({ ...form, cuotas: { ...form.cuotas, [r]: e.target.value.replace(/\D/g, "") } })} placeholder="∞"
                        className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-sm text-slate-600 dark:text-slate-300">Módulos incluidos</span>
                <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {noBaseline.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <input type="checkbox" checked={form.modulos.includes(m.clave)}
                        onChange={(e) => setForm({ ...form, modulos: e.target.checked ? [...form.modulos, m.clave] : form.modulos.filter((x) => x !== m.clave) })} />
                      {m.nombre}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-400">Siempre incluidos (baseline): {baseline.map((m) => m.nombre).join(", ")}</p>
              </div>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
                <span className="text-sm text-slate-600 dark:text-slate-300">Plan activo</span>
              </label>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : editId ? "Guardar" : "Crear plan"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
