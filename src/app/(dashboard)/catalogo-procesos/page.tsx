"use client";

import { useEffect, useState } from "react";
import { Button, Card, PageHeader, PlusIcon } from "@/components/ui";
import { useConfirm, useNotify } from "@/components/feedback";
import { AreasManager } from "@/components/areas-manager";
import { api, errorMessage } from "@/lib/api";

// --- Tipos del dominio (Colombia) ---
type Jurisdiccion =
  | "ORDINARIA_CIVIL"
  | "ORDINARIA_LABORAL"
  | "CONTENCIOSO_ADMIN"
  | "PENAL"
  | "CONSTITUCIONAL"
  | "FAMILIA";

const JURISDICCIONES: { v: Jurisdiccion; label: string }[] = [
  { v: "ORDINARIA_CIVIL", label: "Ordinaria · Civil" },
  { v: "ORDINARIA_LABORAL", label: "Ordinaria · Laboral" },
  { v: "CONTENCIOSO_ADMIN", label: "Contencioso-Administrativa" },
  { v: "PENAL", label: "Penal" },
  { v: "CONSTITUCIONAL", label: "Constitucional" },
  { v: "FAMILIA", label: "Familia" },
];

const CAMPO_TIPOS = ["texto", "textoLargo", "numero", "fecha", "boolean", "select", "multiselect"] as const;
type CampoTipo = (typeof CAMPO_TIPOS)[number];

type Campo = { key: string; label: string; tipo: CampoTipo; requerido: boolean; opciones?: string[] };
type Etapa = { key: string; nombre: string; orden: number; terminal?: boolean; reglas?: { camposRequeridos?: string[]; plazoDias?: number } };
type Area = { id: string; slug: string; nombre: string; jurisdiccion: Jurisdiccion; activo: boolean };
type Tipo = {
  id: string;
  nombre: string;
  descripcion: string | null;
  jurisdiccion: Jurisdiccion;
  esJudicial: boolean;
  esquemaFormulario: Campo[];
  etapas: Etapa[];
  areaSlugs: string[];
};

type Plantilla = { id: string; nombre: string; contenido: string };

// --- Estado editable del formulario ---
// `key` vacío = fila nueva (se derivará una key); con valor = fila existente (se
// PRESERVA su key y sus props avanzadas no editables vía merge en guardar()).
type CampoRow = { key: string; label: string; tipo: CampoTipo; requerido: boolean; opciones: string };
type EtapaRow = { key: string; nombre: string; terminal: boolean; plazoDias: string; camposRequeridos: string[] }; // camposRequeridos por label

/** ¿El campo usa reglas que este formulario NO edita (condicionales)? */
function esCampoAvanzado(c: Record<string, unknown>): boolean {
  return !!(c.mostrarSi || c.requeridoSi);
}
/** ¿La etapa usa reglas que este formulario NO edita (docs, condicionales, ramas, plazos derivados, derivación)? */
function esEtapaAvanzada(e: Record<string, unknown>): boolean {
  const r = (e.reglas ?? {}) as Record<string, unknown>;
  return !!(
    e.disponibleSi ||
    e.accion ||
    (Array.isArray(r.documentosRequeridos) && r.documentosRequeridos.length) ||
    (Array.isArray(r.requeridosSi) && r.requeridosSi.length) ||
    r.plazoDesdeCampo ||
    r.plazoTipoDias ||
    r.plazoDiasPorValorDe
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-indigo-400";

/** Deriva una clave camelCase estable a partir de una etiqueta, sin colisiones. */
function toKey(label: string, used: Set<string>): string {
  let base = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
  if (!base) base = "campo";
  let key = base;
  let n = 2;
  while (used.has(key)) key = base + n++;
  used.add(key);
  return key;
}

export default function CatalogoProcesosPage() {
  const confirm = useConfirm();
  const notify = useNotify();

  const [areas, setAreas] = useState<Area[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Áreas colapsadas (acordeón). Se siembran las vacías al cargar; el usuario alterna.
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());
  const [gestionAreas, setGestionAreas] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [jurisdiccion, setJurisdiccion] = useState<Jurisdiccion>("ORDINARIA_CIVIL");
  const [esJudicial, setEsJudicial] = useState(true);
  const [areaSlugs, setAreaSlugs] = useState<string[]>([]);
  const [campos, setCampos] = useState<CampoRow[]>([]);
  const [etapas, setEtapas] = useState<EtapaRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Snapshot crudo del tipo en edición (key → objeto original COMPLETO), para
  // preservar al guardar lo que el form no edita. Vacío al crear.
  const [origCampos, setOrigCampos] = useState<Record<string, Record<string, unknown>>>({});
  const [origEtapas, setOrigEtapas] = useState<Record<string, Record<string, unknown>>>({});
  const [tipoAvanzado, setTipoAvanzado] = useState(false);

  // --- Plantillas de documento del tipo seleccionado ---
  const [plantillaTipo, setPlantillaTipo] = useState<Tipo | null>(null);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [plLoading, setPlLoading] = useState(false);
  const [plEditId, setPlEditId] = useState<string | null>(null);
  const [plNombre, setPlNombre] = useState("");
  const [plContenido, setPlContenido] = useState("");
  const [plSaving, setPlSaving] = useState(false);
  const [plError, setPlError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [a, t] = await Promise.all([
        api.get<Area[]>("/catalogo/areas"),
        api.get<Tipo[]>("/catalogo/tipos-proceso"),
      ]);
      setAreas(a);
      setTipos(t);
      // El acordeón siempre arranca cerrado: colapsa todas las jurisdicciones.
      setColapsadas(new Set(JURISDICCIONES.map((j) => j.v)));
    } catch (err) {
      setError(errorMessage(err, "Error al cargar"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    cargar();
  }, []);

  function abrirCrear(area?: Area, jur?: Jurisdiccion) {
    setEditId(null);
    setNombre("");
    setDescripcion("");
    setJurisdiccion(jur ?? area?.jurisdiccion ?? "ORDINARIA_CIVIL");
    setEsJudicial(true);
    setAreaSlugs(area ? [area.slug] : []);
    setCampos([{ key: "", label: "", tipo: "texto", requerido: true, opciones: "" }]);
    setEtapas([{ key: "", nombre: "", terminal: false, plazoDias: "", camposRequeridos: [] }]);
    setOrigCampos({});
    setOrigEtapas({});
    setTipoAvanzado(false);
    setFormError(null);
    setFormOpen(true);
  }

  function abrirEditar(t: Tipo) {
    setEditId(t.id);
    setNombre(t.nombre);
    setDescripcion(t.descripcion ?? "");
    setJurisdiccion(t.jurisdiccion);
    setEsJudicial(t.esJudicial ?? true);
    setAreaSlugs(t.areaSlugs);

    // Snapshot CRUDO (con todo lo que el form no edita: ayuda, mostrarSi,
    // requeridoSi, documentosRequeridos, requeridosSi, disponibleSi, accion,
    // resultado, plazos derivados…), indexado por key, para hacer merge al guardar.
    const camposRaw = t.esquemaFormulario as unknown as Record<string, unknown>[];
    const etapasRaw = (t.etapas as unknown as Record<string, unknown>[])
      .slice()
      .sort((a, b) => (a.orden as number) - (b.orden as number));
    setOrigCampos(Object.fromEntries(camposRaw.map((c) => [c.key as string, c])));
    setOrigEtapas(Object.fromEntries(etapasRaw.map((e) => [e.key as string, e])));
    setTipoAvanzado(camposRaw.some(esCampoAvanzado) || etapasRaw.some(esEtapaAvanzada));

    setCampos(
      t.esquemaFormulario.map((c) => ({
        key: c.key,
        label: c.label,
        tipo: c.tipo,
        requerido: c.requerido,
        opciones: (c.opciones ?? []).join(", "),
      })),
    );
    // camposRequeridos vienen por key → los paso a label para los checkboxes.
    const keyToLabel = new Map(t.esquemaFormulario.map((c) => [c.key, c.label]));
    setEtapas(
      t.etapas
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map((e) => ({
          key: e.key,
          nombre: e.nombre,
          terminal: !!e.terminal,
          plazoDias: e.reglas?.plazoDias ? String(e.reglas.plazoDias) : "",
          camposRequeridos: (e.reglas?.camposRequeridos ?? [])
            .map((k) => keyToLabel.get(k))
            .filter((x): x is string => !!x),
        })),
    );
    setFormError(null);
    setFormOpen(true);
  }

  const labelsValidos = campos.map((c) => c.label.trim()).filter(Boolean);

  async function guardar() {
    setFormError(null);
    if (!nombre.trim()) return setFormError("El nombre es obligatorio.");
    if (areaSlugs.length === 0) return setFormError("Selecciona al menos un área de práctica.");
    const camposLlenos = campos.filter((c) => c.label.trim());
    if (camposLlenos.length === 0) return setFormError("Agrega al menos un campo al formulario.");
    const etapasLlenas = etapas.filter((e) => e.nombre.trim());
    if (etapasLlenas.length === 0) return setFormError("Agrega al menos una etapa.");

    // Keys: se PRESERVAN las existentes (no se regeneran desde el label → no se
    // rompen datos guardados, plantillas ni etapaActual de procesos vivos). Solo
    // las filas nuevas (key vacío) derivan una key. Se reservan las existentes
    // primero para que toKey no choque con ellas. campos y etapas comparten espacio.
    const used = new Set<string>();
    for (const c of camposLlenos) if (c.key) used.add(c.key);
    for (const e of etapasLlenas) if (e.key) used.add(e.key);

    const labelToKey = new Map<string, string>();
    const esquemaFormulario = camposLlenos.map((c) => {
      const orig = c.key ? origCampos[c.key] : undefined;
      const key = c.key || toKey(c.label.trim(), used);
      labelToKey.set(c.label.trim(), key);
      // Parte del original (conserva ayuda/mostrarSi/requeridoSi) y sobrescribe lo editable.
      const campo: Record<string, unknown> = {
        ...(orig ?? {}),
        key,
        label: c.label.trim(),
        tipo: c.tipo,
        requerido: c.requerido,
      };
      if (c.tipo === "select" || c.tipo === "multiselect") {
        campo.opciones = c.opciones.split(",").map((o) => o.trim()).filter(Boolean);
      } else {
        delete campo.opciones;
      }
      return campo;
    });

    const etapasOut = etapasLlenas.map((e, i) => {
      const orig = e.key ? origEtapas[e.key] : undefined;
      const key = e.key || toKey(e.nombre.trim(), used);
      const camposRequeridos = e.camposRequeridos
        .map((lbl) => labelToKey.get(lbl.trim()))
        .filter((x): x is string => !!x);
      // Conserva reglas avanzadas (documentosRequeridos, requeridosSi, plazos
      // derivados…) y sobrescribe solo lo editable (camposRequeridos simples, plazoDias).
      const reglas: Record<string, unknown> = { ...((orig?.reglas as Record<string, unknown>) ?? {}) };
      if (camposRequeridos.length) reglas.camposRequeridos = camposRequeridos;
      else delete reglas.camposRequeridos;
      if (e.plazoDias.trim()) reglas.plazoDias = Number(e.plazoDias);
      else delete reglas.plazoDias;
      // Parte del original (conserva terminal/resultado/disponibleSi/accion) y sobrescribe lo editable.
      const etapa: Record<string, unknown> = { ...(orig ?? {}), key, nombre: e.nombre.trim(), orden: i + 1 };
      if (e.terminal) etapa.terminal = true;
      else delete etapa.terminal;
      if (Object.keys(reglas).length) etapa.reglas = reglas;
      else delete etapa.reglas;
      return etapa;
    });

    const payload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      jurisdiccion,
      esJudicial,
      areaSlugs,
      esquemaFormulario,
      etapas: etapasOut,
    };

    setSaving(true);
    try {
      if (editId) await api.patch(`/catalogo/tipos-proceso/${editId}`, payload);
      else await api.post("/catalogo/tipos-proceso", payload);
      setFormOpen(false);
      await cargar();
    } catch (err) {
      setFormError(errorMessage(err, "Error al guardar"));
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(t: Tipo) {
    const ok = await confirm({
      title: "Eliminar tipo de proceso",
      message: `¿Eliminar "${t.nombre}"? No se podrá si ya hay procesos de este tipo.`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/catalogo/tipos-proceso/${t.id}`);
      await cargar();
    } catch (err) {
      await notify({ message: errorMessage(err, "Error al eliminar"), variant: "error" });
    }
  }

  // --- Plantillas ---
  async function abrirPlantillas(t: Tipo) {
    setPlantillaTipo(t);
    setPlEditId(null);
    setPlNombre("");
    setPlContenido("");
    setPlError(null);
    setPlLoading(true);
    try {
      setPlantillas(await api.get<Plantilla[]>(`/catalogo/tipos-proceso/${t.id}/plantillas`));
    } catch {
      setPlantillas([]);
    } finally {
      setPlLoading(false);
    }
  }

  function editarPlantilla(p: Plantilla) {
    setPlEditId(p.id);
    setPlNombre(p.nombre);
    setPlContenido(p.contenido);
    setPlError(null);
  }

  function nuevaPlantilla() {
    setPlEditId(null);
    setPlNombre("");
    setPlContenido("");
    setPlError(null);
  }

  async function guardarPlantilla() {
    if (!plantillaTipo) return;
    if (!plNombre.trim()) return setPlError("El nombre es obligatorio.");
    if (!plContenido.trim()) return setPlError("El contenido es obligatorio.");
    setPlSaving(true);
    setPlError(null);
    try {
      if (plEditId) {
        await api.patch(`/catalogo/plantillas/${plEditId}`, { nombre: plNombre.trim(), contenido: plContenido });
      } else {
        await api.post(`/catalogo/tipos-proceso/${plantillaTipo.id}/plantillas`, { nombre: plNombre.trim(), contenido: plContenido });
      }
      setPlantillas(await api.get<Plantilla[]>(`/catalogo/tipos-proceso/${plantillaTipo.id}/plantillas`));
      nuevaPlantilla();
    } catch (err) {
      setPlError(errorMessage(err, "Error al guardar la plantilla"));
    } finally {
      setPlSaving(false);
    }
  }

  async function eliminarPlantilla(p: Plantilla) {
    const ok = await confirm({
      title: "Eliminar plantilla",
      message: `¿Eliminar la plantilla "${p.nombre}"? Los documentos ya generados se conservan.`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok || !plantillaTipo) return;
    try {
      await api.del(`/catalogo/plantillas/${p.id}`);
      setPlantillas((ps) => ps.filter((x) => x.id !== p.id));
      if (plEditId === p.id) nuevaPlantilla();
    } catch (err) {
      await notify({ message: errorMessage(err, "Error al eliminar"), variant: "error" });
    }
  }

  // Helpers de filas
  const setCampo = (i: number, patch: Partial<CampoRow>) =>
    setCampos((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const setEtapa = (i: number, patch: Partial<EtapaRow>) =>
    setEtapas((es) => es.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  // --- Agrupación por JURISDICCIÓN (6 fijas; cada tipo cae en exactamente una) ---
  const tiposPorJurisdiccion = (j: Jurisdiccion) => tipos.filter((t) => t.jurisdiccion === j);
  const toggleJur = (j: string) =>
    setColapsadas((s) => {
      const next = new Set(s);
      if (next.has(j)) next.delete(j); else next.add(j);
      return next;
    });

  // Card de un tipo, reutilizada en cada sección de área y en "Sin área".
  const renderTipo = (t: Tipo) => (
    <Card key={t.id} className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="font-medium text-slate-800 dark:text-slate-100">{t.nombre}</div>
        {t.descripcion && <div className="text-xs text-slate-500 dark:text-slate-400">{t.descripcion}</div>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {t.areaSlugs.map((s) => (
            <span key={s} className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300">
              {areas.find((a) => a.slug === s)?.nombre ?? s}
            </span>
          ))}
          <span className="rounded bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 text-xs text-indigo-700 dark:text-indigo-300">
            {t.esquemaFormulario.length} campos · {t.etapas.length} etapas
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button onClick={() => abrirPlantillas(t)} className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-500">Plantillas</button>
        <button onClick={() => abrirEditar(t)} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">Editar</button>
        <button onClick={() => eliminar(t)} className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-500">Eliminar</button>
      </div>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="Catálogo de procesos"
        subtitle="Tipos de proceso globales: formularios y etapas que usan todos los despachos."
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setGestionAreas(true)}>Gestionar áreas</Button>
            <Button onClick={() => abrirCrear()}>
              <PlusIcon /> Crear tipo
            </Button>
          </div>
        }
      />

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
          {error} <button onClick={cargar} className="font-medium underline">reintentar</button>
        </Card>
      )}

      {loading ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>
      ) : (
        <div className="space-y-4">
          {JURISDICCIONES.map((j) => {
            const lista = tiposPorJurisdiccion(j.v);
            const abierta = !colapsadas.has(j.v);
            return (
              <div key={j.v} className="rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleJur(j.v)}
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    <svg className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${abierta ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 6 15 12 9 18" />
                    </svg>
                    <span className="truncate font-medium text-slate-800 dark:text-slate-100">{j.label}</span>
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">{lista.length}</span>
                  </button>
                  <button onClick={() => abrirCrear(undefined, j.v)} className="flex shrink-0 items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
                    <PlusIcon /> Crear tipo
                  </button>
                </div>
                {abierta && (
                  <div className="space-y-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                    {lista.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        Sin tipos en esta jurisdicción. <button onClick={() => abrirCrear(undefined, j.v)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Crear el primero</button>.
                      </p>
                    ) : (
                      lista.map(renderTipo)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget && !saving) setFormOpen(false); }}
        >
          <Card className="flex max-h-[90vh] w-full max-w-3xl flex-col">
            <h3 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {editId ? "Editar tipo de proceso" : "Nuevo tipo de proceso"}
            </h3>

            {tipoAvanzado && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                Este tipo usa <strong>reglas avanzadas</strong> (documentos requeridos,
                campos/etapas condicionales, ramas o plazos especiales) que este formulario no
                edita. Se <strong>conservarán</strong> al guardar; para cambiarlas, edita el
                catálogo semilla.
              </div>
            )}

            <div className="-mr-1 flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Nombre <span className="text-red-500">*</span></span>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} placeholder="Ej. Proceso ejecutivo" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Descripción</span>
                  <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputCls} placeholder="Breve descripción y base legal" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Jurisdicción (régimen procesal) <span className="text-red-500">*</span></span>
                  <select value={jurisdiccion} onChange={(e) => setJurisdiccion(e.target.value as Jurisdiccion)} className={inputCls}>
                    {JURISDICCIONES.map((j) => <option key={j.v} value={j.v}>{j.label}</option>)}
                  </select>
                </label>
                <label className="flex items-start gap-2 sm:col-span-2">
                  <input type="checkbox" className="mt-1" checked={esJudicial} onChange={(e) => setEsJudicial(e.target.checked)} />
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Es proceso judicial (va ante un juez)
                    <span className="block text-xs text-slate-400">
                      Si está activo, sus procesos muestran los “datos judiciales”: radicado de 23 dígitos,
                      despacho/juzgado y cuantía. Desactívalo para trámites ante una entidad (p. ej. derecho de petición).
                    </span>
                  </span>
                </label>
              </div>

              {/* Áreas de práctica */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Áreas de práctica <span className="text-red-500">*</span></span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {areas.map((a) => {
                    const on = areaSlugs.includes(a.slug);
                    return (
                      <button
                        key={a.slug}
                        type="button"
                        onClick={() => setAreaSlugs((s) => on ? s.filter((x) => x !== a.slug) : [...s, a.slug])}
                        className={`rounded-full border px-3 py-1 text-sm ${on ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
                      >
                        {a.nombre}{!a.activo && " (inactiva)"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Campos del formulario */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Campos del formulario</span>
                  <Button variant="ghost" onClick={() => setCampos((cs) => [...cs, { key: "", label: "", tipo: "texto", requerido: false, opciones: "" }])}>+ Campo</Button>
                </div>
                <div className="space-y-2">
                  {campos.map((c, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end">
                        <label className="block sm:col-span-5">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Etiqueta</span>
                          <input value={c.label} onChange={(e) => setCampo(i, { label: e.target.value })} className={inputCls} placeholder="Ej. Valor de la obligación" />
                        </label>
                        <label className="block sm:col-span-3">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Tipo</span>
                          <select value={c.tipo} onChange={(e) => setCampo(i, { tipo: e.target.value as CampoTipo })} className={inputCls}>
                            {CAMPO_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </label>
                        <label className="flex items-center gap-2 sm:col-span-3 sm:pb-2">
                          <input type="checkbox" checked={c.requerido} onChange={(e) => setCampo(i, { requerido: e.target.checked })} />
                          <span className="text-xs text-slate-600 dark:text-slate-300">Obligatorio</span>
                        </label>
                        <div className="sm:col-span-1 sm:pb-1 sm:text-right">
                          <button type="button" onClick={() => setCampos((cs) => cs.filter((_, idx) => idx !== i))} className="text-xs text-red-600 hover:underline">Quitar</button>
                        </div>
                      </div>
                      {(c.tipo === "select" || c.tipo === "multiselect") && (
                        <label className="mt-2 block">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Opciones (separadas por coma)</span>
                          <input value={c.opciones} onChange={(e) => setCampo(i, { opciones: e.target.value })} className={inputCls} placeholder="Pagaré, Letra de cambio, Factura" />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Etapas */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Etapas (en orden)</span>
                  <Button variant="ghost" onClick={() => setEtapas((es) => [...es, { key: "", nombre: "", terminal: false, plazoDias: "", camposRequeridos: [] }])}>+ Etapa</Button>
                </div>
                <div className="space-y-2">
                  {etapas.map((e, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end">
                        <label className="block sm:col-span-6">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Etapa {i + 1}</span>
                          <input value={e.nombre} onChange={(ev) => setEtapa(i, { nombre: ev.target.value })} className={inputCls} placeholder="Ej. Mandamiento de pago" />
                        </label>
                        <label className="block sm:col-span-3">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Plazo (días)</span>
                          <input type="number" min="0" value={e.plazoDias} onChange={(ev) => setEtapa(i, { plazoDias: ev.target.value })} className={inputCls} />
                        </label>
                        <label className="flex items-center gap-2 sm:col-span-2 sm:pb-2">
                          <input type="checkbox" checked={e.terminal} onChange={(ev) => setEtapa(i, { terminal: ev.target.checked })} />
                          <span className="text-xs text-slate-600 dark:text-slate-300">Final</span>
                        </label>
                        <div className="sm:col-span-1 sm:pb-1 sm:text-right">
                          <button type="button" onClick={() => setEtapas((es) => es.filter((_, idx) => idx !== i))} className="text-xs text-red-600 hover:underline">Quitar</button>
                        </div>
                      </div>
                      {labelsValidos.length > 0 && (
                        <div className="mt-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Requiere estos campos para llegar a esta etapa:</span>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {labelsValidos.map((lbl) => {
                              const on = e.camposRequeridos.includes(lbl);
                              return (
                                <button
                                  key={lbl}
                                  type="button"
                                  onClick={() => setEtapa(i, { camposRequeridos: on ? e.camposRequeridos.filter((x) => x !== lbl) : [...e.camposRequeridos, lbl] })}
                                  className={`rounded-full border px-2 py-0.5 text-xs ${on ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"}`}
                                >
                                  {lbl}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
            </div>
          </Card>
        </div>
      )}

      {plantillaTipo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget && !plSaving) setPlantillaTipo(null); }}
        >
          <Card className="flex max-h-[90vh] w-full max-w-3xl flex-col">
            <h3 className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
              Plantillas de documento
            </h3>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{plantillaTipo.nombre}</p>

            <div className="-mr-1 flex-1 space-y-4 overflow-y-auto pr-1">
              {/* Lista de plantillas */}
              {plLoading ? (
                <p className="text-sm text-slate-500">Cargando…</p>
              ) : plantillas.length === 0 ? (
                <p className="text-sm text-slate-400">Aún no hay plantillas para este tipo.</p>
              ) : (
                <ul className="space-y-2">
                  {plantillas.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                      <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{p.nombre}</span>
                      <span className="flex shrink-0 gap-3">
                        <button onClick={() => editarPlantilla(p)} className="text-xs font-medium text-indigo-600 hover:underline">Editar</button>
                        <button onClick={() => eliminarPlantilla(p)} className="text-xs font-medium text-red-600 hover:underline">Eliminar</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Editor */}
              <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {plEditId ? "Editar plantilla" : "Nueva plantilla"}
                  </span>
                  {plEditId && (
                    <button onClick={nuevaPlantilla} className="text-xs font-medium text-indigo-600 hover:underline">+ Nueva</button>
                  )}
                </div>
                <label className="block">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Nombre</span>
                  <input value={plNombre} onChange={(e) => setPlNombre(e.target.value)} className={inputCls} placeholder="Ej. Demanda ejecutiva" />
                </label>
                <label className="mt-2 block">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Contenido</span>
                  <textarea
                    value={plContenido}
                    onChange={(e) => setPlContenido(e.target.value)}
                    rows={12}
                    className={`${inputCls} resize-y font-mono`}
                    placeholder={"SEÑOR JUEZ {{proceso.despachoJuzgado}}\n\n{{mayus parte.demandante.nombre}}, identificado con {{parte.demandante.tipoDocumento}} {{parte.demandante.numeroDocumento}}, demando a {{parte.demandado.nombre}} por la suma de {{moneda datos.valor}} PESOS ({{enLetras datos.valor}} M/CTE).\n\n{{#each datos.hechos}}{{@index}}. {{this}}\n{{/each}}"}
                  />
                </label>
                <details className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  <summary className="cursor-pointer select-none">Marcadores disponibles</summary>
                  <div className="mt-2 space-y-1">
                    <p><code>{"{{proceso.codigoInterno}}"}</code>, <code>{"{{proceso.radicado}}"}</code>, <code>{"{{proceso.despachoJuzgado}}"}</code>, <code>{"{{proceso.titulo}}"}</code></p>
                    <p><code>{"{{parte.demandante.nombre}}"}</code>, <code>{"{{parte.demandado.numeroDocumento}}"}</code> (rol en minúsculas)</p>
                    <p>Campos del formulario: {plantillaTipo.esquemaFormulario.map((c) => <code key={c.key} className="mr-1">{`{{datos.${c.key}}}`}</code>)}</p>
                    <p>Helpers: <code>{"{{moneda datos.x}}"}</code>, <code>{"{{enLetras datos.x}}"}</code>, <code>{"{{fecha proceso.createdAt}}"}</code>, <code>{"{{mayus x}}"}</code></p>
                    <p>Bloques: <code>{"{{#if datos.x}}…{{else}}…{{/if}}"}</code>, <code>{"{{#each datos.lista}}{{@index}}. {{this}}{{/each}}"}</code></p>
                    <p>Un marcador sin dato se muestra como <code>[[falta: …]]</code> (no falla).</p>
                  </div>
                </details>
              </div>
            </div>

            {plError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{plError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPlantillaTipo(null)} disabled={plSaving}>Cerrar</Button>
              <Button onClick={guardarPlantilla} disabled={plSaving}>{plSaving ? "Guardando…" : plEditId ? "Guardar cambios" : "Crear plantilla"}</Button>
            </div>
          </Card>
        </div>
      )}

      {gestionAreas && (
        <AreasManager onClose={() => setGestionAreas(false)} onChanged={cargar} />
      )}
    </div>
  );
}
