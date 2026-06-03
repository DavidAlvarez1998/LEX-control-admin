"use client";

import { useEffect, useState } from "react";
import { Button, Card, EmptyState, PageHeader, PlusIcon } from "@/components/ui";
import { useConfirm, useNotify } from "@/components/feedback";
import { api, ApiError } from "@/lib/api";

type Empresa = {
  id: string;
  nombre: string;
  rfc: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  _count: { usuarios: number; servicios: number };
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  nombre: string;
  rfc: string;
  email: string;
  telefono: string;
  activo: boolean;
};

const EMPTY_FORM: FormState = {
  nombre: "",
  rfc: "",
  email: "",
  telefono: "",
  activo: true,
};

export default function EmpresasPage() {
  const confirm = useConfirm();
  const notify = useNotify();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      setEmpresas(await api.get<Empresa[]>("/empresas"));
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

  function abrirEditar(e: Empresa) {
    setEditId(e.id);
    setForm({
      nombre: e.nombre,
      rfc: e.rfc ?? "",
      email: e.email ?? "",
      telefono: e.telefono ?? "",
      activo: e.activo,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function guardar() {
    setSaving(true);
    setFormError(null);
    const payload = {
      nombre: form.nombre,
      rfc: form.rfc.trim() || null,
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      activo: form.activo,
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

  async function eliminar(e: Empresa) {
    const ok = await confirm({
      title: "Eliminar empresa",
      message: `¿Eliminar "${e.nombre}"? Se borrarán también sus usuarios y servicios asignados.`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/empresas/${e.id}`);
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
        <Card className="mb-4 border-red-200 bg-red-50 text-sm text-red-700">
          {error}{" "}
          <button onClick={cargar} className="font-medium underline">
            reintentar
          </button>
        </Card>
      )}

      {loading ? (
        <Card className="text-sm text-slate-500">Cargando…</Card>
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
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Empresa</th>
                <th className="px-5 py-3 font-medium">RFC / NIT</th>
                <th className="px-5 py-3 font-medium">Usuarios</th>
                <th className="px-5 py-3 font-medium">Servicios</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-800">{e.nombre}</div>
                    {e.email && (
                      <div className="text-xs text-slate-500">{e.email}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{e.rfc ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{e._count.usuarios}</td>
                  <td className="px-5 py-3 text-slate-600">{e._count.servicios}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        e.activo
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {e.activo ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => abrirEditar(e)}
                      className="font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminar(e)}
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
              {editId ? "Editar empresa" : "Nueva empresa"}
            </h3>

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm text-slate-600">Nombre</span>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  placeholder="Ej. Bufete García & Asociados"
                />
              </label>

              <label className="block">
                <span className="text-sm text-slate-600">RFC / NIT</span>
                <input
                  value={form.rfc}
                  onChange={(e) => setForm({ ...form, rfc: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  placeholder="Identificador fiscal"
                />
              </label>

              <label className="block">
                <span className="text-sm text-slate-600">Correo</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  placeholder="contacto@empresa.com"
                />
              </label>

              <label className="block">
                <span className="text-sm text-slate-600">Teléfono</span>
                <input
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  placeholder="300 123 4567"
                />
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                />
                <span className="text-sm text-slate-600">Activa</span>
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
