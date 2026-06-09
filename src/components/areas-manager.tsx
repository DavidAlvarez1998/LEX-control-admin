"use client";

// Gestión del catálogo GLOBAL de áreas de práctica (solo ADMIN). Las áreas son el
// punto de extensión de la taxonomía: cada una enruta a UNA jurisdicción (el régimen
// procesal, enum fijo de 6). Aquí se crean, renombran, reordenan y activan/desactivan;
// la jurisdicción NO se crea desde aquí (es fija por ley).

import { useEffect, useState } from "react";
import { Button, Modal, inputCls } from "@/components/ui";
import { useConfirm, useNotify } from "@/components/feedback";
import { api, ApiError } from "@/lib/api";

type Jurisdiccion =
  | "ORDINARIA_CIVIL" | "ORDINARIA_LABORAL" | "CONTENCIOSO_ADMIN"
  | "PENAL" | "CONSTITUCIONAL" | "FAMILIA";

const JURISDICCIONES: { v: Jurisdiccion; label: string }[] = [
  { v: "ORDINARIA_CIVIL", label: "Ordinaria · Civil" },
  { v: "ORDINARIA_LABORAL", label: "Ordinaria · Laboral" },
  { v: "CONTENCIOSO_ADMIN", label: "Contencioso-Administrativa" },
  { v: "PENAL", label: "Penal" },
  { v: "CONSTITUCIONAL", label: "Constitucional" },
  { v: "FAMILIA", label: "Familia" },
];

const TIPOS_AREA = [
  { v: "PRACTICA", label: "Práctica" },
  { v: "JURISDICCION", label: "Jurisdicción" },
  { v: "ESPECIALIDAD", label: "Especialidad" },
] as const;
type TipoArea = (typeof TIPOS_AREA)[number]["v"];

type Area = {
  id: string;
  slug: string;
  nombre: string;
  jurisdiccion: Jurisdiccion;
  tipo: TipoArea;
  activo: boolean;
  orden: number;
};

// Solo estos campos se editan vía "Guardar" (activo/orden se persisten al instante).
const editKey = (a: Area) => `${a.nombre}|${a.jurisdiccion}|${a.tipo}`;

export function AreasManager({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const notify = useNotify();
  const confirm = useConfirm();

  const [areas, setAreas] = useState<Area[]>([]);
  const [orig, setOrig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaJur, setNuevaJur] = useState<Jurisdiccion>("ORDINARIA_CIVIL");
  const [nuevoTipo, setNuevoTipo] = useState<TipoArea>("PRACTICA");
  const [creando, setCreando] = useState(false);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const a = await api.get<Area[]>("/catalogo/areas?incluirInactivas=1");
      setAreas(a);
      setOrig(Object.fromEntries(a.map((x) => [x.id, editKey(x)])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void (async () => { await cargar(); })();
  }, []);

  const patchLocal = (id: string, patch: Partial<Area>) =>
    setAreas((as) => as.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  async function guardar(a: Area) {
    if (!a.nombre.trim()) return notify({ message: "El nombre no puede quedar vacío", variant: "error" });
    setBusyId(a.id);
    try {
      const upd = await api.patch<Area>(`/catalogo/areas/${a.id}`, {
        nombre: a.nombre.trim(),
        jurisdiccion: a.jurisdiccion,
        tipo: a.tipo,
      });
      patchLocal(a.id, upd);
      setOrig((o) => ({ ...o, [a.id]: editKey(upd) }));
      onChanged();
    } catch (err) {
      await notify({ message: err instanceof Error ? err.message : "Error al guardar", variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActivo(a: Area) {
    setBusyId(a.id);
    try {
      const upd = await api.patch<Area>(`/catalogo/areas/${a.id}`, { activo: !a.activo });
      patchLocal(a.id, { activo: upd.activo });
      onChanged();
    } catch (err) {
      await notify({ message: err instanceof Error ? err.message : "Error al cambiar estado", variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  // Reordena intercambiando `orden` con el vecino y persistiendo ambos.
  async function mover(idx: number, dir: -1 | 1) {
    const vecino = idx + dir;
    if (vecino < 0 || vecino >= areas.length) return;
    const a = areas[idx];
    const b = areas[vecino];
    setBusyId(a.id);
    try {
      await Promise.all([
        api.patch(`/catalogo/areas/${a.id}`, { orden: b.orden }),
        api.patch(`/catalogo/areas/${b.id}`, { orden: a.orden }),
      ]);
      await cargar();
      onChanged();
    } catch (err) {
      await notify({ message: err instanceof Error ? err.message : "Error al reordenar", variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function eliminar(a: Area) {
    const ok = await confirm({
      title: `Eliminar "${a.nombre}"`,
      message: "Esta acción no se puede deshacer. Si el área tiene tipos asociados, deberás desactivarla en su lugar.",
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    setBusyId(a.id);
    try {
      await api.del(`/catalogo/areas/${a.id}`);
      setAreas((as) => as.filter((x) => x.id !== a.id));
      onChanged();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Error al eliminar";
      await notify({ message: msg, variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function crear() {
    if (!nuevoNombre.trim()) return notify({ message: "Escribe un nombre para el área", variant: "error" });
    setCreando(true);
    try {
      await api.post("/catalogo/areas", {
        nombre: nuevoNombre.trim(),
        jurisdiccion: nuevaJur,
        tipo: nuevoTipo,
      });
      setNuevoNombre("");
      setNuevoTipo("PRACTICA");
      await cargar();
      onChanged();
    } catch (err) {
      await notify({ message: err instanceof Error ? err.message : "Error al crear", variant: "error" });
    } finally {
      setCreando(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Áreas de práctica" size="lg">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Las áreas agrupan el catálogo. Cada una enruta a una <strong>jurisdicción</strong> (régimen procesal, fijo).
        Desactiva en vez de eliminar si ya tiene tipos asociados.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error} <button onClick={cargar} className="font-medium underline">reintentar</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
      ) : (
        <div className="space-y-2">
          {areas.map((a, idx) => {
            const dirty = orig[a.id] !== editKey(a);
            const busy = busyId === a.id;
            return (
              <div
                key={a.id}
                className={`rounded-lg border p-2.5 ${a.activo ? "border-slate-200 dark:border-slate-800" : "border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-col">
                    <button disabled={idx === 0 || busy} onClick={() => mover(idx, -1)} className="text-slate-400 hover:text-slate-600 disabled:opacity-30" title="Subir">▲</button>
                    <button disabled={idx === areas.length - 1 || busy} onClick={() => mover(idx, 1)} className="text-slate-400 hover:text-slate-600 disabled:opacity-30" title="Bajar">▼</button>
                  </div>
                  <input
                    value={a.nombre}
                    onChange={(e) => patchLocal(a.id, { nombre: e.target.value })}
                    className={`${inputCls} mt-0 min-w-0 flex-1`}
                    placeholder="Nombre del área"
                  />
                  <select value={a.jurisdiccion} onChange={(e) => patchLocal(a.id, { jurisdiccion: e.target.value as Jurisdiccion })} className={`${inputCls} mt-0 w-auto`}>
                    {JURISDICCIONES.map((j) => <option key={j.v} value={j.v}>{j.label}</option>)}
                  </select>
                  <select value={a.tipo} onChange={(e) => patchLocal(a.id, { tipo: e.target.value as TipoArea })} className={`${inputCls} mt-0 w-auto`}>
                    {TIPOS_AREA.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                  </select>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-7">
                  <span className="text-xs text-slate-400">slug: {a.slug}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <button onClick={() => toggleActivo(a)} disabled={busy} className={a.activo ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-slate-500"}>
                      {a.activo ? "● Activa" : "○ Inactiva"}
                    </button>
                    {dirty && (
                      <button onClick={() => guardar(a)} disabled={busy} className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 disabled:opacity-50">
                        {busy ? "Guardando…" : "Guardar"}
                      </button>
                    )}
                    <button onClick={() => eliminar(a)} disabled={busy} className="font-medium text-red-600 dark:text-red-400 hover:text-red-500 disabled:opacity-50">Eliminar</button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Crear nueva área */}
          <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-2.5 dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Nueva área</div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") crear(); }}
                className={`${inputCls} mt-0 min-w-0 flex-1`}
                placeholder="Nombre (ej. Seguros y Reaseguros)"
              />
              <select value={nuevaJur} onChange={(e) => setNuevaJur(e.target.value as Jurisdiccion)} className={`${inputCls} mt-0 w-auto`}>
                {JURISDICCIONES.map((j) => <option key={j.v} value={j.v}>{j.label}</option>)}
              </select>
              <select value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value as TipoArea)} className={`${inputCls} mt-0 w-auto`}>
                {TIPOS_AREA.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
              <Button onClick={crear} disabled={creando}>{creando ? "Creando…" : "Agregar"}</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
