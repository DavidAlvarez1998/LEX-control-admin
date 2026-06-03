"use client";

import { useEffect, useState } from "react";
import { Button, Card, EmptyState, PageHeader, PlusIcon } from "@/components/ui";
import { useConfirm, useNotify } from "@/components/feedback";
import { api, ApiError } from "@/lib/api";

type Servicio = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precioBase: string; // Decimal serializado como string por la API
  precioPorUnidad: string;
  unidad: string | null; // qué se cuenta; null = costo fijo
  incluidos: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  nombre: string;
  descripcion: string;
  precioBase: string;
  precioPorUnidad: string;
  unidad: string;
  incluidos: string;
  activo: boolean;
};

const EMPTY_FORM: FormState = {
  nombre: "",
  descripcion: "",
  precioBase: "",
  precioPorUnidad: "",
  unidad: "",
  incluidos: "",
  activo: true,
};

export default function ServiciosPage() {
  const confirm = useConfirm();
  const notify = useNotify();

  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado del formulario (modal). editId === null => crear; si no => editar.
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      setServicios(await api.get<Servicio[]>("/servicios"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function abrirCrear() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function abrirEditar(s: Servicio) {
    setEditId(s.id);
    setForm({
      nombre: s.nombre,
      descripcion: s.descripcion ?? "",
      precioBase: s.precioBase,
      precioPorUnidad: s.precioPorUnidad,
      unidad: s.unidad ?? "",
      incluidos: String(s.incluidos),
      activo: s.activo,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function guardar() {
    setSaving(true);
    setFormError(null);
    const payload = {
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      precioBase: Number(form.precioBase || 0),
      precioPorUnidad: Number(form.precioPorUnidad || 0),
      unidad: form.unidad.trim() || null,
      incluidos: Number(form.incluidos || 0),
      activo: form.activo,
    };
    try {
      if (editId) {
        await api.patch(`/servicios/${editId}`, payload);
      } else {
        await api.post("/servicios", payload);
      }
      setFormOpen(false);
      await cargar();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error al guardar";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(s: Servicio) {
    const ok = await confirm({
      title: "Eliminar servicio",
      message: `¿Eliminar el servicio "${s.nombre}"?`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/servicios/${s.id}`);
      await cargar();
    } catch (err) {
      await notify({
        message: err instanceof Error ? err.message : "Error al eliminar",
        variant: "error",
      });
    }
  }

  return (
    <div>
      <PageHeader
        title="Servicios"
        subtitle="Catálogo de servicios ofrecidos a las empresas."
        action={
          <Button onClick={abrirCrear}>
            <PlusIcon />
            Nuevo servicio
          </Button>
        }
      />

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 text-sm text-red-700">
          {error}{" "}
          <button onClick={cargar} className="font-medium underline">
            reintentar
          </button>
        </Card>
      )}

      {loading ? (
        <Card className="text-sm text-slate-500">Cargando…</Card>
      ) : servicios.length === 0 ? (
        <EmptyState
          title="Sin servicios todavía"
          description="Crea servicios para poder asignarlos a empresas y facturarlos."
          action={
            <Button onClick={abrirCrear}>
              <PlusIcon />
              Nuevo servicio
            </Button>
          }
        />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Servicio</th>
                <th className="px-5 py-3 font-medium">Precios (referencia)</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {servicios.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-800">{s.nombre}</div>
                    {s.descripcion && (
                      <div className="text-xs text-slate-500">{s.descripcion}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    <div>
                      Base: $
                      {Number(s.precioBase).toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    {s.unidad ? (
                      <div className="text-xs text-slate-500">
                        $
                        {Number(s.precioPorUnidad).toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        / {s.unidad}
                        {s.incluidos > 0 && ` · ${s.incluidos} incluidos`}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">costo fijo</div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.activo
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {s.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => abrirEditar(s)}
                      className="font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminar(s)}
                      className="ml-4 font-medium text-red-600 hover:text-red-500"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-md">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">
              {editId ? "Editar servicio" : "Nuevo servicio"}
            </h3>

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm text-slate-600">Nombre</span>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  placeholder="Ej. Asesoría legal"
                />
              </label>

              <label className="block">
                <span className="text-sm text-slate-600">Descripción</span>
                <textarea
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm({ ...form, descripcion: e.target.value })
                  }
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-slate-600">Precio base</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precioBase}
                    onChange={(e) =>
                      setForm({ ...form, precioBase: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    placeholder="0.00"
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-slate-600">Precio por unidad</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precioPorUnidad}
                    onChange={(e) =>
                      setForm({ ...form, precioPorUnidad: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    placeholder="0.00"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-slate-600">
                    Unidad{" "}
                    <span className="text-slate-400">(vacío = costo fijo)</span>
                  </span>
                  <input
                    value={form.unidad}
                    onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    placeholder="mensaje, documento…"
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-slate-600">
                    Incluidos en precio base
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={form.incluidos}
                    onChange={(e) =>
                      setForm({ ...form, incluidos: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    placeholder="0"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                />
                <span className="text-sm text-slate-600">Activo</span>
              </label>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={guardar} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
