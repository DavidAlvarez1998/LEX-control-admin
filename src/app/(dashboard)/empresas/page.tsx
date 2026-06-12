"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  MoneyInput,
  PageHeader,
  PlusIcon,
} from "@/components/ui";
import { useConfirm, useNotify } from "@/components/feedback";
import { api, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";

type Empresa = {
  id: string;
  nombre: string;
  rfc: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  _count: { usuarios: number; servicios: number };
  // Vista previa de servicios asignados (solo nombre; total en _count.servicios).
  // Opcional: la API podría no incluirlo si todavía no recargó el nuevo `include`.
  servicios?: { servicio: { nombre: string } }[];
  createdAt: string;
  updatedAt: string;
};

// Servicio del catálogo (los decimales llegan como string desde la API).
type CatalogoServicio = {
  id: string;
  nombre: string;
  precioBase: string;
  precioPorUnidad: string;
  unidad: string | null;
  incluidos: number;
  activo: boolean;
};

// Asignación existente al cargar una empresa para editar.
type EmpresaServicio = {
  servicioId: string;
  precioBase: string;
  precioPorUnidad: string;
  incluidos: number;
};

type EmpresaDetalle = Empresa & { servicios: EmpresaServicio[] };

// Plan del catálogo (para asignar/cambiar el plan de una empresa).
type PlanItem = { id: string; clave: string; nombre: string; activo: boolean };
// Suscripción tal como la lista GET /planes/suscripciones (por empresa).
type SuscripcionItem = { id: string; plan: string | null; planClave: string | null };

type FormState = {
  nombre: string;
  rfc: string;
  email: string;
  telefono: string;
  activo: boolean;
};

// Estado editable de un servicio dentro del formulario.
type AsignacionForm = {
  seleccionado: boolean;
  precioBase: string;
  precioPorUnidad: string;
  incluidos: string;
};

const EMPTY_FORM: FormState = {
  nombre: "",
  rfc: "",
  email: "",
  telefono: "",
  activo: true,
};

// Precio mostrado: "$1.000.000" (separador de miles con punto).
const money = (v: string | number) => `$${formatMoney(v)}`;

export default function EmpresasPage() {
  const confirm = useConfirm();
  const notify = useNotify();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoServicio[]>([]);
  // Planes disponibles + plan actual por empresa, para editar el plan en la lista.
  const [planes, setPlanes] = useState<PlanItem[]>([]);
  const [planPorEmpresa, setPlanPorEmpresa] = useState<Record<string, { nombre: string | null; clave: string | null }>>({});
  const [cambiandoPlan, setCambiandoPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Filtro de texto (nombre/NIT/email). Se prellena desde ?q= (búsqueda global).
  const [filtro, setFiltro] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  // Asignaciones del formulario, indexadas por servicioId.
  const [asignaciones, setAsignaciones] = useState<
    Record<string, AsignacionForm>
  >({});
  const [saving, setSaving] = useState(false);
  const [cargandoForm, setCargandoForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [emp, cat, pls, subs] = await Promise.all([
        api.get<Empresa[]>("/empresas"),
        api.get<CatalogoServicio[]>("/servicios"),
        api.get<PlanItem[]>("/planes"),
        api.get<SuscripcionItem[]>("/planes/suscripciones"),
      ]);
      setEmpresas(emp);
      setCatalogo(cat);
      setPlanes(pls);
      setPlanPorEmpresa(
        Object.fromEntries(subs.map((s) => [s.id, { nombre: s.plan, clave: s.planClave }])),
      );
    } catch (err) {
      setError(errorMessage(err, "Error al cargar"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  // Prellenar el filtro desde ?q= (al llegar desde la búsqueda global).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setFiltro(q);
  }, []);

  // Lista visible según el filtro de texto (nombre / NIT / email).
  const visibles = (() => {
    const t = filtro.trim().toLowerCase();
    if (!t) return empresas;
    return empresas.filter(
      (e) =>
        e.nombre.toLowerCase().includes(t) ||
        (e.rfc ?? "").toLowerCase().includes(t) ||
        (e.email ?? "").toLowerCase().includes(t),
    );
  })();

  // Asigna/cambia el plan de una empresa (PUT /planes/suscripciones/:empresaId).
  async function cambiarPlan(empresaId: string, clave: string) {
    const plan = planes.find((p) => p.clave === clave);
    if (!plan) return;
    setCambiandoPlan(empresaId);
    try {
      await api.put(`/planes/suscripciones/${empresaId}`, { planId: plan.id });
      setPlanPorEmpresa((m) => ({ ...m, [empresaId]: { nombre: plan.nombre, clave: plan.clave } }));
      await notify({ message: `Plan actualizado a "${plan.nombre}".`, variant: "success" });
    } catch (err) {
      await notify({
        message: errorMessage(err, "No se pudo cambiar el plan."),
        variant: "error",
      });
    } finally {
      setCambiandoPlan(null);
    }
  }

  // Asignaciones por defecto: todos los servicios sin seleccionar, con los
  // precios de referencia del catálogo precargados.
  function asignacionesPorDefecto(): Record<string, AsignacionForm> {
    const base: Record<string, AsignacionForm> = {};
    for (const s of catalogo) {
      base[s.id] = {
        seleccionado: false,
        precioBase: String(Math.round(Number(s.precioBase))),
        precioPorUnidad: String(Math.round(Number(s.precioPorUnidad))),
        incluidos: String(s.incluidos),
      };
    }
    return base;
  }

  function abrirCrear() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setAsignaciones(asignacionesPorDefecto());
    setFormError(null);
    setFormOpen(true);
  }

  async function abrirEditar(e: Empresa) {
    setEditId(e.id);
    setForm({
      nombre: e.nombre,
      rfc: e.rfc ?? "",
      email: e.email ?? "",
      telefono: e.telefono ?? "",
      activo: e.activo,
    });
    setFormError(null);
    // Parte de los valores por defecto y superpone las asignaciones existentes.
    const base = asignacionesPorDefecto();
    setAsignaciones(base);
    setFormOpen(true);
    setCargandoForm(true);
    try {
      const detalle = await api.get<EmpresaDetalle>(`/empresas/${e.id}`);
      const merged = { ...base };
      for (const a of detalle.servicios) {
        merged[a.servicioId] = {
          seleccionado: true,
          precioBase: String(Math.round(Number(a.precioBase))),
          precioPorUnidad: String(Math.round(Number(a.precioPorUnidad))),
          incluidos: String(a.incluidos),
        };
      }
      setAsignaciones(merged);
    } catch (err) {
      setFormError(
        errorMessage(err, "No se pudieron cargar los servicios"),
      );
    } finally {
      setCargandoForm(false);
    }
  }

  function setAsignacion(id: string, patch: Partial<AsignacionForm>) {
    setAsignaciones((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function guardar() {
    setFormError(null);
    if (!form.nombre.trim()) {
      setFormError("Completa los campos obligatorios: Nombre");
      return;
    }
    // Desactivar una empresa que estaba activa bloquea a TODOS sus usuarios.
    if (editId) {
      const original = empresas.find((x) => x.id === editId);
      if (original?.activo && !form.activo) {
        const ok = await confirm({
          title: "Desactivar empresa",
          message: `Al desactivar "${form.nombre.trim()}", todos sus usuarios quedarán bloqueados: no podrán iniciar sesión y sus sesiones activas dejarán de funcionar. ¿Continuar?`,
          confirmText: "Desactivar",
          danger: true,
        });
        if (!ok) return;
      }
    }
    setSaving(true);
    const servicios = catalogo
      .filter((s) => asignaciones[s.id]?.seleccionado)
      .map((s) => {
        const a = asignaciones[s.id];
        return {
          servicioId: s.id,
          precioBase: Number(a.precioBase || 0),
          precioPorUnidad: Number(a.precioPorUnidad || 0),
          incluidos: Number(a.incluidos || 0),
        };
      });
    const payload = {
      nombre: form.nombre,
      rfc: form.rfc.trim() || null,
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      activo: form.activo,
      servicios,
    };
    try {
      if (editId) {
        await api.patch(`/empresas/${editId}`, payload);
      } else {
        await api.post("/empresas", payload);
      }
      setFormOpen(false);
      await cargar();
    } catch (err) {
      const msg =
        errorMessage(err, "Error al guardar");
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  // Borrado permanente de la empresa que se está editando (desde el modal).
  async function eliminarEmpresaActual() {
    if (!editId) return;
    const ok = await confirm({
      title: "Eliminar empresa",
      message: `¿Eliminar "${form.nombre}"? Se borrarán también sus usuarios y servicios asignados. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/empresas/${editId}`);
      setFormOpen(false);
      await cargar();
      await notify({ message: "Empresa eliminada.", variant: "success" });
    } catch (err) {
      await notify({
        message: errorMessage(err, "Error al eliminar"),
        variant: "error",
      });
    }
  }

  const seleccionados = catalogo.filter(
    (s) => asignaciones[s.id]?.seleccionado,
  ).length;

  return (
    <div>
      <PageHeader
        title="Empresas"
        subtitle="Gestiona las empresas registradas en el sistema."
        action={
          <Button onClick={abrirCrear}>
            <PlusIcon />
            Crear empresa
          </Button>
        }
      />

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
          {error}{" "}
          <button onClick={cargar} className="font-medium underline">
            reintentar
          </button>
        </Card>
      )}

      {!loading && empresas.length > 0 && (
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar por nombre, NIT o correo…"
          className="mb-4 w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        />
      )}

      {loading ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>
      ) : empresas.length === 0 ? (
        <EmptyState
          title="Sin empresas todavía"
          description="Crea tu primera empresa para empezar a gestionar servicios y facturación."
          action={
            <Button onClick={abrirCrear}>
              <PlusIcon />
              Crear empresa
            </Button>
          }
        />
      ) : visibles.length === 0 ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">
          Ninguna empresa coincide con “{filtro}”.
        </Card>
      ) : (
        <div className="space-y-4">
          {visibles.map((e) => (
            <Card key={e.id} className="p-0">
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 dark:text-slate-100">{e.nombre}</div>
                  {e.email && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">{e.email}</div>
                  )}
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-slate-400 dark:text-slate-500">RFC / NIT:</span>{" "}
                    {e.rfc ?? "—"}
                    <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
                    {e._count.usuarios} usuario{e._count.usuarios === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.activo
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {e.activo ? "Activa" : "Inactiva"}
                  </span>
                  <button
                    onClick={() => abrirEditar(e)}
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                  >
                    Editar
                  </button>
                </div>
              </div>

              {/* Plan + servicios asignados de la empresa. */}
              <div className="px-5 pb-4 pt-3 space-y-3">
                <div className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Plan
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <select
                      value={planPorEmpresa[e.id]?.clave ?? ""}
                      disabled={cambiandoPlan === e.id}
                      onChange={(ev) => cambiarPlan(e.id, ev.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 outline-none focus:border-indigo-400 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="" disabled>
                        Sin plan — selecciona…
                      </option>
                      {planes
                        .filter((p) => p.activo)
                        .map((p) => (
                          <option key={p.id} value={p.clave}>
                            {p.nombre}
                          </option>
                        ))}
                    </select>
                    {cambiandoPlan === e.id && (
                      <span className="text-xs text-slate-400">Guardando…</span>
                    )}
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Servicios
                  </p>
                  {(e.servicios ?? []).length === 0 ? (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Sin servicios asignados
                    </p>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(e.servicios ?? []).map((s, i) => (
                        <span
                          key={i}
                          className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300"
                        >
                          {s.servicio.nombre}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setFormOpen(false);
          }}
        >
          <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col">
            <h3 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {editId ? "Editar empresa" : "Nueva empresa"}
            </h3>

            <div className="-mr-1 flex-1 space-y-3 overflow-y-auto pr-1">
              <label className="block">
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Nombre <span className="text-red-500">*</span>
                </span>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  placeholder="Ej. Bufete García & Asociados"
                />
              </label>

              <label className="block">
                <span className="text-sm text-slate-600 dark:text-slate-300">RFC / NIT</span>
                <input
                  value={form.rfc}
                  onChange={(e) => setForm({ ...form, rfc: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  placeholder="Identificador fiscal"
                />
              </label>

              <label className="block">
                <span className="text-sm text-slate-600 dark:text-slate-300">Correo</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  placeholder="contacto@empresa.com"
                />
              </label>

              <label className="block">
                <span className="text-sm text-slate-600 dark:text-slate-300">Teléfono</span>
                <input
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  placeholder="300 123 4567"
                />
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">Activa</span>
              </label>
              {!form.activo && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Con la empresa inactiva, ninguno de sus usuarios podrá iniciar
                  sesión.
                </p>
              )}

              {/* Servicios contratados */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Servicios contratados
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {seleccionados} seleccionado{seleccionados === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  Los precios se precargan del catálogo y puedes ajustarlos para
                  esta empresa.
                </p>

                {cargandoForm ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Cargando servicios…</p>
                ) : catalogo.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No hay servicios en el catálogo todavía.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {catalogo.map((s) => {
                      const a = asignaciones[s.id];
                      if (!a) return null;
                      return (
                        <div
                          key={s.id}
                          className={`rounded-lg border p-3 ${
                            a.seleccionado
                              ? "border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40"
                              : "border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={a.seleccionado}
                              onChange={(e) =>
                                setAsignacion(s.id, {
                                  seleccionado: e.target.checked,
                                })
                              }
                            />
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                              {s.nombre}
                            </span>
                            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                              ref. {money(s.precioBase)}
                              {s.unidad && ` + ${money(s.precioPorUnidad)}/${s.unidad}`}
                            </span>
                          </label>

                          {a.seleccionado && (
                            <div className="mt-3 grid grid-cols-1 gap-3 pl-6 sm:grid-cols-3">
                              <label className="block">
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  Precio base
                                </span>
                                <MoneyInput
                                  value={a.precioBase}
                                  onChange={(precioBase) =>
                                    setAsignacion(s.id, { precioBase })
                                  }
                                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
                                />
                              </label>
                              {s.unidad && (
                                <>
                                  <label className="block">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                      Precio / {s.unidad}
                                    </span>
                                    <MoneyInput
                                      value={a.precioPorUnidad}
                                      onChange={(precioPorUnidad) =>
                                        setAsignacion(s.id, { precioPorUnidad })
                                      }
                                      className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                      Incluidos
                                    </span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={a.incluidos}
                                      onChange={(e) =>
                                        setAsignacion(s.id, {
                                          incluidos: e.target.value,
                                        })
                                      }
                                      className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
                                    />
                                  </label>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>}

            <div className="mt-5 flex items-center justify-between gap-2">
              <div>
                {editId && (
                  <button
                    type="button"
                    onClick={eliminarEmpresaActual}
                    disabled={saving}
                    className="rounded-lg border border-red-200 dark:border-red-900/60 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                  >
                    Eliminar empresa
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={guardar} disabled={saving || cargandoForm}>
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
