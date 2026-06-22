"use client";

import { Fragment, useEffect, useState } from "react";
import { Button, Card, EmptyState, PageHeader, PlusIcon } from "@/components/ui";
import { useConfirm, useNotify } from "@/components/feedback";
import { api, errorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";

type Estado = "ACTIVO" | "PENDIENTE" | "INACTIVO";

type Usuario = {
  id: string;
  email: string;
  nombre: string;
  rol: "ADMIN" | "USUARIO" | "COMERCIAL";
  activo: boolean;
  esAdminEmpresa: boolean;
  empresaId: string | null;
  empresa: { nombre: string } | null;
  porcentajeComision: string | null;
  estado: Estado;
  roles: string[]; // RolEmpresa asignados (ADMINISTRADOR/JURIDICO/CONTABLE/COMERCIAL)
  createdAt: string;
};

// Peso de cada rol de empresa (menor = más alto). Para ordenar dentro de la empresa.
const ROLE_PESO: Record<string, number> = { ADMINISTRADOR: 0, JURIDICO: 1, CONTABLE: 2, COMERCIAL: 3 };
const mejorPeso = (u: { roles: string[] }) =>
  u.roles.length ? Math.min(...u.roles.map((r) => ROLE_PESO[r] ?? 50)) : 99;

type EmpresaOption = { id: string; nombre: string };

type FormState = {
  email: string;
  nombre: string;
  // Tipo de cuenta a crear: USUARIO (de empresa) o COMERCIAL (vendedor de plataforma).
  rol: "USUARIO" | "COMERCIAL";
  empresaId: string;
  esAdminEmpresa: boolean; // false = Usuario, true = Administrador de la empresa
  porcentajeComision: string; // solo COMERCIAL
  activo: boolean;
};

const EMPTY_FORM: FormState = {
  email: "",
  nombre: "",
  rol: "USUARIO",
  empresaId: "",
  esAdminEmpresa: false,
  porcentajeComision: "",
  activo: true,
};

const PLATAFORMA = "Plataforma (sin empresa)";

const ESTADO_STYLES: Record<Estado, string> = {
  ACTIVO: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  PENDIENTE: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  INACTIVO: "bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400",
};

/** Etiqueta de acceso: el ADMIN de plataforma es aparte; dentro de una empresa
 *  un usuario es "Administrador" (gestiona su empresa) o "Usuario". */
function acceso(u: Usuario): string {
  if (u.rol === "ADMIN") return "Plataforma";
  if (u.rol === "COMERCIAL") return "Comercial";
  return u.esAdminEmpresa ? "Administrador" : "Usuario";
}

export default function UsuariosPage() {
  const confirm = useConfirm();
  const notify = useNotify();

  // Id del admin con sesión activa: no puede editarse a sí mismo (solo lectura).
  const [miId, setMiId] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Link de activación a compartir manualmente con el usuario (no hay email aún).
  const [link, setLink] = useState<{
    url: string;
    nombre: string;
    correoEnviado: boolean;
    email?: string;
  } | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [us, es] = await Promise.all([
        api.get<Usuario[]>("/usuarios"),
        api.get<EmpresaOption[]>("/empresas"),
      ]);
      setUsuarios(us);
      setEmpresas(es);
    } catch (err) {
      setError(errorMessage(err, "Error al cargar"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMiId(getUser()?.id ?? null);
    cargar();
  }, []);

  // Filtro de texto (nombre/email), prellenado desde ?q= (búsqueda global).
  const [filtro, setFiltro] = useState("");
  const [filtroAcceso, setFiltroAcceso] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  // Empresas (grupos) colapsadas en el acordeón.
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());
  const toggleEmpresa = (nombre: string) =>
    setColapsadas((s) => {
      const next = new Set(s);
      if (next.has(nombre)) next.delete(nombre); else next.add(nombre);
      return next;
    });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setFiltro(q);
  }, []);
  const usuariosVisibles = (() => {
    const t = filtro.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (t && !(u.nombre.toLowerCase().includes(t) || u.email.toLowerCase().includes(t))) return false;
      if (filtroAcceso && acceso(u) !== filtroAcceso) return false;
      if (filtroEstado && u.estado !== filtroEstado) return false;
      if (filtroEmpresa && (u.empresa?.nombre ?? PLATAFORMA) !== filtroEmpresa) return false;
      return true;
    });
  })();

  // Agrupa los usuarios por empresa; los de plataforma (ADMIN/COMERCIAL, sin
  // empresa) van en un grupo aparte al final. Empresas ordenadas alfabéticamente.
  const gruposUsuarios = (() => {
    const grupos = new Map<string, Usuario[]>();
    for (const u of usuariosVisibles) {
      const key = u.empresa?.nombre ?? PLATAFORMA;
      (grupos.get(key) ?? grupos.set(key, []).get(key)!).push(u);
    }
    // Orden DENTRO de cada empresa: admins primero → más roles asignados → rol más
    // alto (peso) → nombre.
    for (const lista of grupos.values()) {
      lista.sort(
        (a, b) =>
          Number(b.esAdminEmpresa) - Number(a.esAdminEmpresa) ||
          b.roles.length - a.roles.length ||
          mejorPeso(a) - mejorPeso(b) ||
          a.nombre.localeCompare(b.nombre),
      );
    }
    return [...grupos.entries()].sort((a, b) => {
      const pa = a[0] === PLATAFORMA ? 1 : 0;
      const pb = b[0] === PLATAFORMA ? 1 : 0;
      return pa - pb || a[0].localeCompare(b[0]);
    });
  })();

  function abrirCrear() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function abrirEditar(u: Usuario) {
    setEditId(u.id);
    setForm({
      email: u.email,
      nombre: u.nombre,
      rol: u.rol === "COMERCIAL" ? "COMERCIAL" : "USUARIO",
      empresaId: u.empresaId ?? "",
      esAdminEmpresa: u.esAdminEmpresa,
      porcentajeComision: u.porcentajeComision != null ? String(Number(u.porcentajeComision)) : "",
      activo: u.activo,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function guardar() {
    setFormError(null);
    const esComercial = form.rol === "COMERCIAL";
    const faltan: string[] = [];
    if (!form.nombre.trim()) faltan.push("Nombre");
    if (!editId) {
      if (!form.email.trim()) faltan.push("Correo");
      if (!esComercial && !form.empresaId) faltan.push("Empresa");
    }
    if (faltan.length) {
      setFormError(`Completa los campos obligatorios: ${faltan.join(", ")}`);
      return;
    }
    const pct = form.porcentajeComision ? Number(form.porcentajeComision) : 0;
    setSaving(true);
    try {
      if (editId) {
        // PATCH: campos editables por el ADMIN (no email ni empresa).
        await api.patch(`/usuarios/${editId}`, esComercial
          ? { nombre: form.nombre, activo: form.activo, porcentajeComision: pct }
          : { nombre: form.nombre, esAdminEmpresa: form.esAdminEmpresa, activo: form.activo });
        setFormOpen(false);
        await cargar();
      } else {
        // Un COMERCIAL es staff de plataforma (sin empresa). Un USUARIO pertenece
        // a una empresa; el nivel de acceso lo da `esAdminEmpresa`.
        const body = esComercial
          ? { email: form.email.trim(), nombre: form.nombre.trim(), rol: "COMERCIAL", porcentajeComision: pct }
          : { email: form.email.trim(), nombre: form.nombre.trim(), empresaId: form.empresaId, esAdminEmpresa: form.esAdminEmpresa };
        const { user, activationUrl, correoEnviado } = await api.post<{
          user: Usuario;
          activationUrl: string;
          correoEnviado: boolean;
        }>("/usuarios", body);
        setFormOpen(false);
        await cargar();
        setLink({ url: activationUrl, nombre: user.nombre, correoEnviado, email: user.email });
      }
    } catch (err) {
      setFormError(
        errorMessage(err, "Error al guardar"),
      );
    } finally {
      setSaving(false);
    }
  }

  // Restablecer la contraseña del usuario que se está editando: genera un enlace
  // de activación nuevo (revoca la sesión y el enlace anterior en el backend).
  async function resetPasswordActual() {
    if (!editId) return;
    const nombre = form.nombre;
    const ok = await confirm({
      title: "Restablecer contraseña",
      message: `Se generará un nuevo enlace de activación para "${nombre}". El enlace anterior y la sesión activa dejarán de servir. ¿Continuar?`,
      confirmText: "Generar enlace",
    });
    if (!ok) return;
    try {
      const { activationUrl, correoEnviado } = await api.post<{
        activationUrl: string;
        correoEnviado: boolean;
      }>(`/usuarios/${editId}/reset-password`, {});
      setFormOpen(false);
      await cargar();
      setLink({ url: activationUrl, nombre, correoEnviado, email: form.email || undefined });
    } catch (err) {
      await notify({
        message: errorMessage(err, "Error al generar el enlace"),
        variant: "error",
      });
    }
  }

  // Borrado permanente del usuario que se está editando.
  async function eliminarUsuario() {
    if (!editId) return;
    const ok = await confirm({
      title: "Eliminar usuario",
      message: `Se eliminará a "${form.nombre}" de forma permanente. Esta acción no se puede deshacer. ¿Eliminar?`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/usuarios/${editId}`);
      setFormOpen(false);
      await cargar();
      await notify({ message: "Usuario eliminado.", variant: "success" });
    } catch (err) {
      await notify({
        message: errorMessage(err, "Error al eliminar el usuario"),
        variant: "error",
      });
    }
  }

  async function copiarLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      await notify({ message: "Enlace copiado al portapapeles.", variant: "success" });
    } catch {
      await notify({
        message: "No se pudo copiar automáticamente. Copialo manualmente.",
        variant: "error",
      });
    }
  }

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Administra los usuarios de las empresas y sus accesos."
        action={
          <Button onClick={abrirCrear}>
            <PlusIcon />
            Nuevo usuario
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

      {!loading && usuarios.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <select
            value={filtroEmpresa}
            onChange={(e) => setFiltroEmpresa(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="">Todas las empresas</option>
            {empresas.map((e) => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
            <option value={PLATAFORMA}>{PLATAFORMA}</option>
          </select>
          <select
            value={filtroAcceso}
            onChange={(e) => setFiltroAcceso(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="">Todo acceso</option>
            {["Plataforma", "Comercial", "Administrador", "Usuario"].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="">Todo estado</option>
            {(["ACTIVO", "PENDIENTE", "INACTIVO"] as Estado[]).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {(filtro || filtroEmpresa || filtroAcceso || filtroEstado) && (
            <button
              onClick={() => { setFiltro(""); setFiltroEmpresa(""); setFiltroAcceso(""); setFiltroEstado(""); }}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {loading ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>
      ) : usuarios.length === 0 ? (
        <EmptyState
          title="Sin usuarios todavía"
          description="Crea el primer usuario de una empresa. Recibirá un enlace para definir su contraseña."
          action={
            <Button onClick={abrirCrear}>
              <PlusIcon />
              Nuevo usuario
            </Button>
          }
        />
      ) : usuariosVisibles.length === 0 ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">
          Ningún usuario coincide con “{filtro}”.
        </Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-600 text-left text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Acceso</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {gruposUsuarios.map(([empresa, lista]) => {
                const abierta = !colapsadas.has(empresa);
                return (
                <Fragment key={empresa}>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/40">
                    <th colSpan={4} className="p-0 text-left">
                      <button
                        onClick={() => toggleEmpresa(empresa)}
                        className="flex w-full items-center gap-2 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
                      >
                        <svg className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${abierta ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 6 15 12 9 18" />
                        </svg>
                        {empresa}
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-600 dark:text-slate-300">
                          {lista.length}
                        </span>
                      </button>
                    </th>
                  </tr>
                  {abierta && lista.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 dark:border-slate-600 last:border-0">
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{u.nombre}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{u.email}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                          {acceso(u)}
                        </span>
                        {u.roles.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {u.roles.map((r) => (
                              <span key={r} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                                {r.toLowerCase()}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[u.estado]}`}
                        >
                          {u.estado}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {u.id === miId ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500">Tú</span>
                        ) : (
                          <button
                            onClick={() => abrirEditar(u)}
                            className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                          >
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setFormOpen(false);
          }}
        >
          <Card className="w-full max-w-md">
            <h3 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {editId ? "Editar usuario" : "Nuevo usuario"}
            </h3>

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Correo <span className="text-red-500">*</span>
                </span>
                <input
                  type="email"
                  value={form.email}
                  disabled={!!editId}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-400 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-600 dark:disabled:text-slate-500"
                  placeholder="usuario@empresa.com"
                />
              </label>

              <label className="block">
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Nombre <span className="text-red-500">*</span>
                </span>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  placeholder="Nombre y apellido"
                />
              </label>

              {!editId && (
                <label className="block">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Tipo de cuenta</span>
                  <select
                    value={form.rol}
                    onChange={(e) => setForm({ ...form, rol: e.target.value as FormState["rol"] })}
                    className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  >
                    <option value="USUARIO">Usuario de empresa</option>
                    <option value="COMERCIAL">Comercial (vendedor de plataforma)</option>
                  </select>
                </label>
              )}

              {form.rol === "USUARIO" ? (
                <>
                  <label className="block">
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      Empresa <span className="text-red-500">*</span>
                    </span>
                    <select
                      value={form.empresaId}
                      disabled={!!editId}
                      onChange={(e) => setForm({ ...form, empresaId: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-400 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-600 dark:disabled:text-slate-500"
                    >
                      <option value="">Selecciona una empresa…</option>
                      {empresas.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Acceso</span>
                    <select
                      value={form.esAdminEmpresa ? "admin" : "user"}
                      onChange={(e) =>
                        setForm({ ...form, esAdminEmpresa: e.target.value === "admin" })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    >
                      <option value="user">Usuario</option>
                      <option value="admin">Administrador (gestiona su empresa)</option>
                    </select>
                  </label>
                </>
              ) : (
                <label className="block">
                  <span className="text-sm text-slate-600 dark:text-slate-300">% de comisión por venta</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={form.porcentajeComision}
                    onChange={(e) => setForm({ ...form, porcentajeComision: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-400"
                    placeholder="Ej. 10"
                  />
                  <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">Se aplica al precio de cada venta cerrada. Un monto fijo por venta puede sobreescribirlo.</span>
                </label>
              )}

              {editId && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Activo {form.activo ? "" : "(no podrá iniciar sesión)"}
                  </span>
                </label>
              )}
            </div>

            {editId && (
              <div className="mt-4 border-t border-slate-200 dark:border-slate-600 pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Acciones de cuenta
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={resetPasswordActual}
                    disabled={saving}
                    className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
                  >
                    Restablecer contraseña
                  </button>
                  <button
                    type="button"
                    onClick={eliminarUsuario}
                    disabled={saving}
                    className="rounded-lg border border-red-200 dark:border-red-900/60 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                  >
                    Eliminar usuario
                  </button>
                </div>
              </div>
            )}

            {formError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={guardar} disabled={saving}>
                {saving ? "Guardando…" : editId ? "Guardar" : "Crear y generar enlace"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {link && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-lg">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {link.correoEnviado ? "Correo enviado" : "Enlace de activación"}
            </h3>
            {link.correoEnviado ? (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                ✓ Le enviamos un correo
                {link.email ? <> a <strong>{link.email}</strong></> : null} a{" "}
                <strong>{link.nombre}</strong> con el enlace para definir su contraseña
                (vence en 48 horas). ¿No le llegó? También puedes compartirle este enlace:
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                ⚠ No se pudo enviar el correo a <strong>{link.nombre}</strong>. Comparte
                este enlace para que defina su contraseña. Es de un solo uso y vence en 48 horas.
              </p>
            )}
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-200 dark:bg-slate-600 px-3 py-2">
              <input
                readOnly
                value={link.url}
                onFocus={(e) => e.target.select()}
                className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none"
              />
              <Button onClick={copiarLink}>Copiar</Button>
            </div>
            <div className="mt-5 flex justify-end">
              <Button variant="ghost" onClick={() => setLink(null)}>
                Cerrar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
