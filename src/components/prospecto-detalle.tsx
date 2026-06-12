"use client";

// Detalle de un prospecto (embudo: ganar/perder/editar) + timeline de seguimiento.
// Compartido por la pantalla de Prospectos y el hub de Equipo comercial.

import { useCallback, useEffect, useState } from "react";
import { Button, Field, inputCls, Modal, MoneyInput } from "@/components/ui";
import { useNotify } from "@/components/feedback";
import { errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import {
  ventasApi, ESTADO_EDITABLE, TIPO_GESTION,
  type ComercialMin, type PlanMin, type Prospecto, type Seguimiento,
} from "@/lib/ventas";

const money = (v: string | number | null) => (v == null || v === "" ? "—" : `$${formatMoney(v)}`);
const humaniza = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

export function DetalleProspecto({ base, esAdmin, planes, comerciales, onClose, onChange, notify }: {
  base: Prospecto; esAdmin: boolean; planes: PlanMin[]; comerciales: ComercialMin[];
  onClose: () => void; onChange: () => void; notify: ReturnType<typeof useNotify>;
}) {
  const [estado, setEstado] = useState(base.estado);
  const [comercialId, setComercialId] = useState(base.comercialId ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const terminal = base.estado === "GANADO" || base.estado === "PERDIDO";

  // Ganar
  const [ganar, setGanar] = useState(false);
  const planDefault = base.planInteresId ?? "";
  const [planId, setPlanId] = useState(planDefault);
  const precioDefault = String(Math.round(Number(planes.find((p) => p.id === planDefault)?.precioMensual ?? 0))) || "";
  const [precioVenta, setPrecioVenta] = useState(precioDefault);
  const [montoFijo, setMontoFijo] = useState("");

  // Perder
  const [perder, setPerder] = useState(false);
  const [motivo, setMotivo] = useState("");

  async function guardarCambios() {
    setBusy(true); setErr(null);
    try {
      const body: Record<string, unknown> = {};
      if (estado !== base.estado) body.estado = estado;
      if (esAdmin && comercialId !== (base.comercialId ?? "")) body.comercialId = comercialId || null;
      if (Object.keys(body).length) await ventasApi.editarProspecto(base.id, body);
      onChange();
    } catch (e) {
      setErr(errorMessage(e, "Error al guardar."));
    } finally { setBusy(false); }
  }

  async function confirmarGanar() {
    setBusy(true); setErr(null);
    try {
      await ventasApi.ganar(base.id, {
        planId: planId || undefined,
        precioVenta: precioVenta ? Number(precioVenta) : undefined,
        montoComisionFijo: montoFijo ? Number(montoFijo) : undefined,
      });
      await notify({ message: "Venta cerrada: empresa, suscripción y comisión creadas.", variant: "success" });
      onChange();
    } catch (e) {
      setErr(errorMessage(e, "Error al cerrar la venta."));
      setBusy(false);
    }
  }

  async function confirmarPerder() {
    if (!motivo.trim()) { setErr("Indica el motivo."); return; }
    setBusy(true); setErr(null);
    try { await ventasApi.perder(base.id, motivo.trim()); onChange(); }
    catch (e) { setErr(errorMessage(e, "Error.")); setBusy(false); }
  }

  const onPlanChange = (id: string) => {
    setPlanId(id);
    const pm = planes.find((p) => p.id === id)?.precioMensual;
    if (pm != null) setPrecioVenta(String(Math.round(Number(pm))));
  };

  const comNombre = comerciales.find((c) => c.id === base.comercialId)?.nombre ?? (base.comercialId ? "Asignado" : "Sin asignar");

  return (
    <Modal open onClose={onClose} title={base.nombreEmpresa} size="lg"
      footer={<Button variant="ghost" onClick={onClose}>Cerrar</Button>}>
      <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
        <p><span className="text-slate-400">Contacto:</span> {base.nombreContacto}{base.cargo ? ` · ${base.cargo}` : ""}</p>
        {base.email && <p><span className="text-slate-400">Email:</span> {base.email}</p>}
        {base.telefono && <p><span className="text-slate-400">Teléfono:</span> {base.telefono}</p>}
        {base.numeroDocumento && <p><span className="text-slate-400">NIT / Identificación:</span> {base.numeroDocumento}</p>}
        <p><span className="text-slate-400">Canal:</span> {humaniza(base.canalEntrada)}{base.referidoPor ? ` · referido por ${base.referidoPor}` : ""}</p>
        <p><span className="text-slate-400">Comercial:</span> {comNombre}</p>
        {base.notas && <p><span className="text-slate-400">Notas:</span> {base.notas}</p>}
        {base.estado === "GANADO" && <p className="text-emerald-700 dark:text-emerald-400">Vendido por {money(base.precioVenta)}{base.fechaCierre ? ` · ${new Date(base.fechaCierre).toLocaleDateString()}` : ""}</p>}
        {base.estado === "PERDIDO" && base.motivoPerdida && <p className="text-red-600 dark:text-red-400">Perdido: {base.motivoPerdida}</p>}
      </div>

      {!terminal && !ganar && !perder && (
        <div className="mt-2 space-y-3 border-t border-slate-200 dark:border-slate-800 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Etapa"><select value={estado} onChange={(e) => setEstado(e.target.value)} className={inputCls}>{ESTADO_EDITABLE.map((s) => <option key={s} value={s}>{humaniza(s)}</option>)}</select></Field>
            {esAdmin && <Field label="Comercial"><select value={comercialId} onChange={(e) => setComercialId(e.target.value)} className={inputCls}><option value="">Sin asignar</option>{comerciales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>}
          </div>
          {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              <Button onClick={() => setGanar(true)}>Ganar venta</Button>
              <Button variant="ghost" onClick={() => setPerder(true)}>Marcar perdido</Button>
            </div>
            <Button variant="ghost" onClick={guardarCambios} disabled={busy}>{busy ? "…" : "Guardar cambios"}</Button>
          </div>
        </div>
      )}

      {ganar && (
        <div className="mt-2 space-y-3 border-t border-slate-200 dark:border-slate-800 pt-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Cerrar venta</p>
          <Field label="Plan vendido" requerido><select value={planId} onChange={(e) => onPlanChange(e.target.value)} className={inputCls}><option value="">Selecciona…</option>{planes.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {money(p.precioMensual)}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio de venta"><MoneyInput value={precioVenta} onChange={setPrecioVenta} placeholder="0" className={inputCls} /></Field>
            <Field label="Comisión fija (opcional)"><MoneyInput value={montoFijo} onChange={setMontoFijo} placeholder="usa el % del comercial" className={inputCls} /></Field>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">Si dejas la comisión vacía, se calcula con el % del comercial asignado. Se creará la empresa, su suscripción y la comisión.</p>
          {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setGanar(false)} disabled={busy}>Volver</Button>
            <Button onClick={confirmarGanar} disabled={busy || !planId}>{busy ? "Cerrando…" : "Confirmar venta"}</Button>
          </div>
        </div>
      )}

      {perder && (
        <div className="mt-2 space-y-3 border-t border-slate-200 dark:border-slate-800 pt-3">
          <Field label="Motivo de pérdida" requerido><input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} placeholder="Ej. Precio, eligió competencia…" /></Field>
          {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPerder(false)} disabled={busy}>Volver</Button>
            <Button onClick={confirmarPerder} disabled={busy}>{busy ? "…" : "Marcar perdido"}</Button>
          </div>
        </div>
      )}

      <SeguimientoTimeline prospectoId={base.id} esAdmin={esAdmin} comerciales={comerciales} comercialActual={base.comercialId} />
    </Modal>
  );
}

// Timeline de seguimiento + alta/agenda de actividades para un prospecto.
function SeguimientoTimeline({ prospectoId, esAdmin, comerciales = [], comercialActual }: {
  prospectoId: string; esAdmin?: boolean; comerciales?: ComercialMin[]; comercialActual?: string | null;
}) {
  const [items, setItems] = useState<Seguimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [tipo, setTipo] = useState<string>("LLAMADA");
  const [titulo, setTitulo] = useState("");
  const [nota, setNota] = useState("");
  const [fecha, setFecha] = useState(""); // datetime-local; obligatorio
  const [comercialId, setComercialId] = useState(comercialActual ?? ""); // admin: dueño/asignación

  const cargar = useCallback(async () => {
    setLoading(true);
    try { setItems(await ventasApi.seguimientos(prospectoId)); }
    catch (e) { setErr(errorMessage(e, "Error al cargar seguimiento.")); }
    finally { setLoading(false); }
  }, [prospectoId]);
  useEffect(() => { cargar(); }, [cargar]);

  async function agregar() {
    setErr(null);
    if (!fecha) { setErr("La fecha programada es obligatoria."); return; }
    setBusy(true);
    try {
      await ventasApi.addSeguimiento(prospectoId, {
        tipo,
        titulo: titulo.trim() || undefined,
        nota: nota.trim() || undefined,
        fechaProgramada: new Date(fecha).toISOString(),
        // Si el prospecto ya tiene dueño, no se reasigna; si no, el admin lo fija.
        comercialId: esAdmin && !comercialActual && comercialId ? comercialId : undefined,
      });
      setTitulo(""); setNota(""); setFecha("");
      await cargar();
    } catch (e) {
      setErr(errorMessage(e, "Error al guardar."));
    } finally { setBusy(false); }
  }

  async function completar(id: string) {
    setBusy(true);
    try { await ventasApi.completarSeguimiento(id); await cargar(); }
    catch (e) { setErr(errorMessage(e, "Error.")); }
    finally { setBusy(false); }
  }
  async function borrar(id: string) {
    setBusy(true);
    try { await ventasApi.borrarSeguimiento(id); await cargar(); }
    catch (e) { setErr(errorMessage(e, "Error.")); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-3 border-t border-slate-200 dark:border-slate-800 pt-3">
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Seguimiento</p>

      {/* Alta de actividad */}
      <div className="mb-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tipo"><select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>{TIPO_GESTION.map((t) => <option key={t} value={t}>{humaniza(t)}</option>)}</select></Field>
          <Field label="Programar para" requerido><input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} /></Field>
        </div>
        {esAdmin && (
          <Field label="Comercial asignado">
            {comercialActual ? (
              <input value={comerciales.find((c) => c.id === comercialActual)?.nombre ?? "Asignado"} disabled className={`${inputCls} opacity-70`} />
            ) : (
              <select value={comercialId} onChange={(e) => setComercialId(e.target.value)} className={inputCls}>
                <option value="">Sin asignar</option>
                {comerciales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            )}
          </Field>
        )}
        <Field label="Título"><input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputCls} placeholder="Ej. Insistir con la oferta" /></Field>
        <Field label="Nota"><textarea value={nota} onChange={(e) => setNota(e.target.value)} className={`${inputCls} resize-y`} rows={2} placeholder="Contexto / qué se habló" /></Field>
        <p className="text-xs text-slate-400 dark:text-slate-500">La actividad queda pendiente en la agenda del comercial en la fecha programada.</p>
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        <div className="flex justify-end">
          <Button onClick={agregar} disabled={busy}>{busy ? "…" : "Agendar"}</Button>
        </div>
      </div>

      {/* Línea de tiempo */}
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Aún no hay actividades registradas.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => {
            const cancelada = s.canceladaEn != null;
            const pendiente = !s.completada && !cancelada;
            const vencida = pendiente && s.fechaProgramada != null && new Date(s.fechaProgramada) < new Date();
            return (
              <li key={s.id} className={`flex items-start gap-3 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 text-sm ${!pendiente ? "opacity-70" : ""}`}>
                <span className={`mt-0.5 rounded px-2 py-0.5 text-xs font-medium ${
                  s.completada ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                  : cancelada ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                  : vencida ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"}`}>
                  {humaniza(s.tipo)}
                </span>
                <div className="min-w-0 flex-1">
                  {s.titulo && <p className={`font-medium text-slate-800 dark:text-slate-100 ${cancelada ? "line-through" : ""}`}>{s.titulo}</p>}
                  {s.nota && <p className="text-slate-600 dark:text-slate-300">{s.nota}</p>}
                  {s.resultado && <p className="text-slate-500 dark:text-slate-400">→ {s.resultado}</p>}
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {s.completada
                      ? `✓ Hecho ${s.fechaCompletada ? new Date(s.fechaCompletada).toLocaleString() : ""}`
                      : cancelada
                      ? `✗ Cancelada${s.motivoCancelacion ? ` · ${s.motivoCancelacion}` : ""}`
                      : `Pendiente ${s.fechaProgramada ? new Date(s.fechaProgramada).toLocaleString() : ""}`}
                    {vencida && " · vencida"}
                  </p>
                </div>
                {pendiente && (
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => completar(s.id)} disabled={busy} className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">Completar</button>
                    <button onClick={() => borrar(s.id)} disabled={busy} className="text-xs font-medium text-slate-400 hover:text-red-500 hover:underline">Borrar</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
