"use client";

// Equipo comercial (vista ADMIN): lista de comerciales con sus contadores;
// al entrar a uno se ven SUS prospectos (abribles con timeline) y SU agenda.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Field, inputCls, PageHeader, StatCard } from "@/components/ui";
import { useNotify } from "@/components/feedback";
import { errorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { DetalleProspecto } from "@/components/prospecto-detalle";
import { AgendaView } from "@/components/agenda-view";
import { ComisionesView } from "@/components/comisiones-view";
import {
  ventasApi, CANAL_ENTRADA, ESTADO_PROSPECTO,
  type ComercialMin, type ComercialResumen, type PlanMin, type Prospecto,
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

export function EquipoComercial({ openComercialId, onForcedBack }: { openComercialId?: string | null; onForcedBack?: () => void } = {}) {
  const esAdmin = getUser()?.rol === "ADMIN";
  const [lista, setLista] = useState<ComercialResumen[]>([]);
  const [planes, setPlanes] = useState<PlanMin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<ComercialResumen | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try { setLista(await ventasApi.equipoComercial()); }
    catch (err) { setError(errorMessage(err, "Error al cargar el equipo.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (esAdmin) { cargar(); ventasApi.planes().then(setPlanes); } else setLoading(false); }, [esAdmin, cargar]);

  // Apertura forzada desde la Agenda: cuando llega la lista, abre ese comercial.
  useEffect(() => {
    if (!openComercialId) return;
    const found = lista.find((c) => c.id === openComercialId);
    if (found) setSel(found);
  }, [openComercialId, lista]);

  // ComercialMin[] para el modal de detalle (reasignar/etiquetar).
  const comerciales = useMemo<ComercialMin[]>(
    () => lista.map((c) => ({ id: c.id, nombre: c.nombre, porcentajeComision: c.porcentajeComision == null ? null : String(c.porcentajeComision) })),
    [lista],
  );

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? lista.filter((c) => c.nombre.toLowerCase().includes(t) || c.email.toLowerCase().includes(t)) : lista;
  }, [lista, q]);

  if (!esAdmin) return <EmptyState title="Solo administradores" description="Esta sección es para el equipo de plataforma." />;

  if (sel) return (
    <ComercialDetalle
      comercial={sel} planes={planes} comerciales={comerciales}
      onBack={() => {
        // Si se abrió desde la Agenda, "atrás" vuelve a la agenda de todos.
        if (openComercialId && onForcedBack) { onForcedBack(); return; }
        setSel(null); cargar();
      }}
    />
  );

  return (
    <div>
      <PageHeader title="Equipo comercial" subtitle="Tus vendedores, sus prospectos y su agenda." />

      <div className="mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar comercial…"
          className="w-full max-w-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm" />
      </div>

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
          {error} <button onClick={cargar} className="font-medium underline">reintentar</button>
        </Card>
      )}

      {loading ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>
      ) : filtrados.length === 0 ? (
        <EmptyState title="Sin comerciales" description="Crea usuarios con rol COMERCIAL en la sección Usuarios." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((c) => (
            <button key={c.id} onClick={() => setSel(c)}
              className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 p-4 text-left transition hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-800 dark:text-slate-100">{c.nombre}</p>
                {!c.activo && <span className="rounded-full bg-slate-200 dark:bg-slate-600 px-2 py-0.5 text-xs text-slate-500">inactivo</span>}
              </div>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">{c.email}</p>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Comisión: {c.porcentajeComision == null ? "—" : `${c.porcentajeComision}%`}</p>
              <div className="mt-3 flex gap-4 text-sm">
                <span className="text-slate-600 dark:text-slate-300"><b className="text-slate-900 dark:text-slate-100">{c.prospectos}</b> prospectos</span>
                <span className="text-emerald-600 dark:text-emerald-400"><b>{c.ganados}</b> ganados</span>
                <span className={c.pendientesAgenda ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}><b>{c.pendientesAgenda}</b> pendientes</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ComercialDetalle({ comercial, planes, comerciales, onBack }: {
  comercial: ComercialResumen; planes: PlanMin[]; comerciales: ComercialMin[]; onBack: () => void;
}) {
  const notify = useNotify();
  const [tab, setTab] = useState<"prospectos" | "agenda" | "comisiones">("prospectos");
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fEstado, setFEstado] = useState("");
  const [fCanal, setFCanal] = useState("");
  const [detalle, setDetalle] = useState<Prospecto | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setProspectos(await ventasApi.prospectos({ comercialId: comercial.id, estado: fEstado || undefined, canal: fCanal || undefined }));
    } catch (err) {
      setError(errorMessage(err, "Error al cargar."));
    } finally { setLoading(false); }
  }, [comercial.id, fEstado, fCanal]);
  useEffect(() => { if (tab === "prospectos") cargar(); }, [cargar, tab]);

  const tabCls = (t: typeof tab) =>
    `rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${tab === t ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"}`;

  return (
    <div>
      <button onClick={onBack} className="mb-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">‹ Equipo comercial</button>
      <PageHeader title={comercial.nombre} subtitle={comercial.email} />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Prospectos" value={String(comercial.prospectos)} />
        <StatCard label="Ganados" value={String(comercial.ganados)} />
        <StatCard label="Pendientes en agenda" value={String(comercial.pendientesAgenda)} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <button onClick={() => setTab("prospectos")} className={tabCls("prospectos")}>Prospectos</button>
        <button onClick={() => setTab("agenda")} className={tabCls("agenda")}>Agenda</button>
        <button onClick={() => setTab("comisiones")} className={tabCls("comisiones")}>Comisiones</button>
      </div>

      {tab === "agenda" && <AgendaView fixedComercialId={comercial.id} />}
      {tab === "comisiones" && (
        <>
          <PorcentajeComercial key={comercial.id} comercial={comercial} />
          <ComisionesView comercialId={comercial.id} />
        </>
      )}

      {tab === "prospectos" && (
        <>
          {error && (
            <Card className="mb-4 border-red-200 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
              {error} <button onClick={cargar} className="font-medium underline">reintentar</button>
            </Card>
          )}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2.5 py-1.5 text-sm">
              <option value="">Estado: todos</option>
              {ESTADO_PROSPECTO.map((s) => <option key={s} value={s}>{humaniza(s)}</option>)}
            </select>
            <select value={fCanal} onChange={(e) => setFCanal(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2.5 py-1.5 text-sm">
              <option value="">Canal: todos</option>
              {CANAL_ENTRADA.map((c) => <option key={c} value={c}>{humaniza(c)}</option>)}
            </select>
          </div>
          {loading ? (
            <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>
          ) : prospectos.length === 0 ? (
            <EmptyState title="Sin prospectos" description="Este comercial no tiene prospectos con esos filtros." />
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {prospectos.map((p) => (
                  <li key={p.id} className={`flex items-center gap-3 px-4 py-3 text-sm ${p.estado === "NUEVO" ? "bg-amber-50/70 dark:bg-amber-500/[0.07] border-l-2 border-l-amber-400" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                        {p.estado === "NUEVO" && (
                          <span className="relative flex h-2 w-2 shrink-0" title="Nuevo · pendiente de contactar">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                          </span>
                        )}
                        {p.nombreEmpresa}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">{p.nombreContacto} · {humaniza(p.canalEntrada)}</p>
                    </div>
                    {p.estado === "NUEVO"
                      ? <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">Nuevo</span>
                      : <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_BADGE[p.estado] ?? ""}`}>{humaniza(p.estado)}</span>}
                    <button onClick={() => setDetalle(p)} className="shrink-0 font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Abrir</button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {detalle && (
        <DetalleProspecto
          base={detalle} esAdmin planes={planes} comerciales={comerciales}
          onClose={() => setDetalle(null)}
          onChange={async () => { await cargar(); setDetalle(null); }}
          notify={notify}
        />
      )}
    </div>
  );
}

// Editor del % de comisión por defecto del comercial (campo del Usuario).
function PorcentajeComercial({ comercial }: { comercial: ComercialResumen }) {
  const notify = useNotify();
  const [pct, setPct] = useState(comercial.porcentajeComision == null ? "" : String(comercial.porcentajeComision));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function guardar() {
    const n = pct.trim() === "" ? 0 : Number(pct);
    if (Number.isNaN(n) || n < 0 || n > 100) { setErr("Ingresa un porcentaje entre 0 y 100."); return; }
    setBusy(true); setErr(null);
    try {
      await ventasApi.setPorcentajeComercial(comercial.id, n);
      await notify({ message: "Porcentaje de comisión actualizado.", variant: "success" });
    } catch (e) {
      setErr(errorMessage(e, "Error al guardar."));
    } finally { setBusy(false); }
  }

  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="% de comisión por defecto">
          <div className="flex items-center gap-1">
            <input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="decimal" placeholder="Ej. 10" className={`${inputCls} w-28`} />
            <span className="text-slate-400">%</span>
          </div>
        </Field>
        <Button onClick={guardar} disabled={busy}>{busy ? "Guardando…" : "Guardar %"}</Button>
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
      </div>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Se aplica a las nuevas ventas; las comisiones ya generadas no cambian (edítalas una a una si hace falta).</p>
    </Card>
  );
}
