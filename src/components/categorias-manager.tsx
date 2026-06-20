"use client";

// Gestión del catálogo GLOBAL de categorías de proceso (clase de proceso; solo ADMIN).
// Una categoría es un nivel de NAVEGACIÓN entre la jurisdicción y el tipo (CGP:
// Declarativo, Ejecutivo, Liquidación, Jurisdicción Voluntaria…). Es excluyente por
// tipo (≠ áreas, que son varias por tipo). `proximamente` = teaser sin tipos aún.

import { useEffect, useState } from "react";
import { Button, Modal, inputCls } from "@/components/ui";
import { useConfirm, useNotify } from "@/components/feedback";
import { api, errorMessage } from "@/lib/api";

type Jurisdiccion =
  | "ORDINARIA_CIVIL" | "ORDINARIA_LABORAL" | "CONTENCIOSO_ADMIN"
  | "PENAL" | "CONSTITUCIONAL" | "FAMILIA";

const JURISDICCIONES: { v: Jurisdiccion; label: string }[] = [
  { v: "PENAL", label: "Ordinaria · Penal" },
  { v: "ORDINARIA_CIVIL", label: "Ordinaria · Civil" },
  { v: "ORDINARIA_LABORAL", label: "Ordinaria · Laboral" },
  { v: "CONTENCIOSO_ADMIN", label: "Contencioso-Administrativa" },
  { v: "CONSTITUCIONAL", label: "Constitucional" },
  { v: "FAMILIA", label: "Familia" },
];

type Categoria = {
  id: string;
  slug: string;
  nombre: string;
  jurisdiccion: Jurisdiccion;
  activo: boolean;
  proximamente: boolean;
  orden: number;
};

// Solo estos campos se editan vía "Guardar" (activo/proximamente/orden son instantáneos).
const editKey = (c: Categoria) => `${c.nombre}|${c.jurisdiccion}`;

export function CategoriasManager({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const notify = useNotify();
  const confirm = useConfirm();

  const [cats, setCats] = useState<Categoria[]>([]);
  const [orig, setOrig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaJur, setNuevaJur] = useState<Jurisdiccion>("ORDINARIA_CIVIL");
  const [creando, setCreando] = useState(false);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const a = await api.get<Categoria[]>("/catalogo/categorias?incluirInactivas=1");
      setCats(a);
      setOrig(Object.fromEntries(a.map((x) => [x.id, editKey(x)])));
    } catch (err) {
      setError(errorMessage(err, "Error al cargar"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void (async () => { await cargar(); })();
  }, []);

  const patchLocal = (id: string, patch: Partial<Categoria>) =>
    setCats((as) => as.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  async function guardar(c: Categoria) {
    if (!c.nombre.trim()) return notify({ message: "El nombre no puede quedar vacío", variant: "error" });
    setBusyId(c.id);
    try {
      const upd = await api.patch<Categoria>(`/catalogo/categorias/${c.id}`, {
        nombre: c.nombre.trim(),
        jurisdiccion: c.jurisdiccion,
      });
      patchLocal(c.id, upd);
      setOrig((o) => ({ ...o, [c.id]: editKey(upd) }));
      onChanged();
    } catch (err) {
      await notify({ message: errorMessage(err, "Error al guardar"), variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(c: Categoria, campo: "activo" | "proximamente") {
    setBusyId(c.id);
    try {
      const upd = await api.patch<Categoria>(`/catalogo/categorias/${c.id}`, { [campo]: !c[campo] });
      patchLocal(c.id, { [campo]: upd[campo] });
      onChanged();
    } catch (err) {
      await notify({ message: errorMessage(err, "Error al cambiar estado"), variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  // Reordena intercambiando `orden` con el vecino y persistiendo ambos.
  async function mover(idx: number, dir: -1 | 1) {
    const vecino = idx + dir;
    if (vecino < 0 || vecino >= cats.length) return;
    const a = cats[idx];
    const b = cats[vecino];
    setBusyId(a.id);
    try {
      await Promise.all([
        api.patch(`/catalogo/categorias/${a.id}`, { orden: b.orden }),
        api.patch(`/catalogo/categorias/${b.id}`, { orden: a.orden }),
      ]);
      await cargar();
      onChanged();
    } catch (err) {
      await notify({ message: errorMessage(err, "Error al reordenar"), variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function eliminar(c: Categoria) {
    const ok = await confirm({
      title: `Eliminar "${c.nombre}"`,
      message: "Esta acción no se puede deshacer. Si la categoría tiene tipos asociados, deberás reasignarlos o desactivarla.",
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    setBusyId(c.id);
    try {
      await api.del(`/catalogo/categorias/${c.id}`);
      setCats((as) => as.filter((x) => x.id !== c.id));
      onChanged();
    } catch (err) {
      await notify({ message: errorMessage(err, "Error al eliminar"), variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function crear() {
    if (!nuevoNombre.trim()) return notify({ message: "Escribe un nombre para la categoría", variant: "error" });
    setCreando(true);
    try {
      await api.post("/catalogo/categorias", {
        nombre: nuevoNombre.trim(),
        jurisdiccion: nuevaJur,
      });
      setNuevoNombre("");
      await cargar();
      onChanged();
    } catch (err) {
      await notify({ message: errorMessage(err, "Error al crear"), variant: "error" });
    } finally {
      setCreando(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Categorías de proceso" size="lg">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Las categorías son la <strong>clase de proceso</strong> dentro de una jurisdicción (Declarativo,
        Ejecutivo…). Estructuran la navegación de Procesos. Marca <strong>Próximamente</strong> una categoría
        sin tipos aún. Desactiva en vez de eliminar si ya tiene tipos asociados.
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
          {cats.map((c, idx) => {
            const dirty = orig[c.id] !== editKey(c);
            const busy = busyId === c.id;
            return (
              <div
                key={c.id}
                className={`rounded-lg border p-2.5 ${c.activo ? "border-slate-200 dark:border-slate-600" : "border-dashed border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-700/40"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-col">
                    <button disabled={idx === 0 || busy} onClick={() => mover(idx, -1)} className="text-slate-400 hover:text-slate-600 disabled:opacity-30" title="Subir">▲</button>
                    <button disabled={idx === cats.length - 1 || busy} onClick={() => mover(idx, 1)} className="text-slate-400 hover:text-slate-600 disabled:opacity-30" title="Bajar">▼</button>
                  </div>
                  <input
                    value={c.nombre}
                    onChange={(e) => patchLocal(c.id, { nombre: e.target.value })}
                    className={`${inputCls} mt-0 min-w-0 flex-1`}
                    placeholder="Nombre de la categoría"
                  />
                  <select value={c.jurisdiccion} onChange={(e) => patchLocal(c.id, { jurisdiccion: e.target.value as Jurisdiccion })} className={`${inputCls} mt-0 w-auto`}>
                    {JURISDICCIONES.map((j) => <option key={j.v} value={j.v}>{j.label}</option>)}
                  </select>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-7">
                  <span className="text-xs text-slate-400">slug: {c.slug}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <button onClick={() => toggle(c, "activo")} disabled={busy} className={c.activo ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-slate-500"}>
                      {c.activo ? "● Activa" : "○ Inactiva"}
                    </button>
                    <button onClick={() => toggle(c, "proximamente")} disabled={busy} className={c.proximamente ? "font-medium text-amber-600 dark:text-amber-400" : "font-medium text-slate-500"}>
                      {c.proximamente ? "◐ Próximamente" : "○ Disponible"}
                    </button>
                    {dirty && (
                      <button onClick={() => guardar(c)} disabled={busy} className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 disabled:opacity-50">
                        {busy ? "Guardando…" : "Guardar"}
                      </button>
                    )}
                    <button onClick={() => eliminar(c)} disabled={busy} className="font-medium text-red-600 dark:text-red-400 hover:text-red-500 disabled:opacity-50">Eliminar</button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Crear nueva categoría */}
          <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-2.5 dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Nueva categoría</div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") crear(); }}
                className={`${inputCls} mt-0 min-w-0 flex-1`}
                placeholder="Nombre (ej. Liquidación)"
              />
              <select value={nuevaJur} onChange={(e) => setNuevaJur(e.target.value as Jurisdiccion)} className={`${inputCls} mt-0 w-auto`}>
                {JURISDICCIONES.map((j) => <option key={j.v} value={j.v}>{j.label}</option>)}
              </select>
              <Button onClick={crear} disabled={creando}>{creando ? "Creando…" : "Agregar"}</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
