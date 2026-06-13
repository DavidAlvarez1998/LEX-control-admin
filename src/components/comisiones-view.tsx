"use client";

// Comisiones — una por venta ganada. El COMERCIAL ve las suyas; solo el ADMIN
// marca PAGADA o ANULADA.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Field, inputCls, Modal, MoneyInput, PageHeader, StatCard } from "@/components/ui";
import { useConfirm, useNotify } from "@/components/feedback";
import { getUser } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import {
  ventasApi, ESTADO_COMISION,
  type Comision, type ComercialMin, type Prospecto,
} from "@/lib/ventas";

const money = (v: string | number | null) => (v == null || v === "" ? "—" : `$${formatMoney(v)}`);
const fecha = (v: string | null) => (v ? new Date(v).toLocaleDateString() : "—");

const BADGE: Record<string, string> = {
  PENDIENTE: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  PAGADA: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  ANULADA: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
};

export function ComisionesView({ comercialId }: { comercialId?: string } = {}) {
  const esAdmin = getUser()?.rol === "ADMIN";
  const embedded = !!comercialId; // dentro del detalle de un comercial
  const confirm = useConfirm();
  const notify = useNotify();

  const [items, setItems] = useState<Comision[]>([]);
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [comerciales, setComerciales] = useState<ComercialMin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fEstado, setFEstado] = useState("");
  const [editC, setEditC] = useState<Comision | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [cs, ps] = await Promise.all([
        ventasApi.comisiones({ estado: fEstado || undefined, comercialId }),
        ventasApi.prospectos({ comercialId }),
      ]);
      setItems(cs); setProspectos(ps);
    } catch (err) {
      setError(errorMessage(err, "Error al cargar"));
    } finally { setLoading(false); }
  }, [fEstado, comercialId]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (esAdmin && !embedded) ventasApi.comerciales().then(setComerciales); }, [esAdmin, embedded]);

  const empresaDe = useMemo(() => (prospectoId: string) => prospectos.find((p) => p.id === prospectoId)?.nombreEmpresa ?? "—", [prospectos]);
  const comercialDe = useMemo(() => (id: string) => comerciales.find((c) => c.id === id)?.nombre ?? "—", [comerciales]);

  const totalPendiente = items.filter((c) => c.estado === "PENDIENTE").reduce((s, c) => s + Number(c.monto), 0);
  const totalPagado = items.filter((c) => c.estado === "PAGADA").reduce((s, c) => s + Number(c.monto), 0);

  async function pagar(c: Comision) {
    const ok = await confirm({ title: "Marcar pagada", message: `¿Confirmas el pago de la comisión de ${money(c.monto)}?`, confirmText: "Marcar pagada" });
    if (!ok) return;
    try { await ventasApi.pagarComision(c.id); await cargar(); await notify({ message: "Comisión marcada como pagada.", variant: "success" }); }
    catch (err) { await notify({ message: errorMessage(err, "Error"), variant: "error" }); }
  }
  async function anular(c: Comision) {
    const ok = await confirm({ title: "Anular comisión", message: "¿Anular esta comisión?", confirmText: "Anular", danger: true });
    if (!ok) return;
    try { await ventasApi.anularComision(c.id); await cargar(); await notify({ message: "Comisión anulada.", variant: "success" }); }
    catch (err) { await notify({ message: errorMessage(err, "Error"), variant: "error" }); }
  }

  return (
    <div>
      {!embedded && <PageHeader title="Comisiones" subtitle="Comisiones generadas por las ventas de planes." />}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Pendiente por pagar" value={money(totalPendiente)} />
        <StatCard label="Pagado" value={money(totalPagado)} />
      </div>

      <div className="mb-4">
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          {ESTADO_COMISION.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </select>
      </div>

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
          {error} <button onClick={cargar} className="font-medium underline">reintentar</button>
        </Card>
      )}

      {loading ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>
      ) : items.length === 0 ? (
        <EmptyState title="Sin comisiones" description="Las comisiones aparecen al cerrar una venta de un prospecto." />
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Empresa</th>
                {esAdmin && !embedded && <th className="px-5 py-3 font-medium">Comercial</th>}
                <th className="px-5 py-3 font-medium">Base</th>
                <th className="px-5 py-3 font-medium">%</th>
                <th className="px-5 py-3 font-medium">Comisión</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Pago</th>
                {esAdmin && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{empresaDe(c.prospectoId)}</td>
                  {esAdmin && !embedded && <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{comercialDe(c.comercialId)}</td>}
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{money(c.baseCalculo)}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{c.porcentaje != null ? `${Number(c.porcentaje)}%` : "fijo"}</td>
                  <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{money(c.monto)}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${BADGE[c.estado] ?? ""}`}>{c.estado.charAt(0) + c.estado.slice(1).toLowerCase()}</span></td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{fecha(c.fechaPago)}</td>
                  {esAdmin && (
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <span className="flex justify-end gap-3">
                        {c.estado === "PENDIENTE" && <button onClick={() => pagar(c)} className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline">Marcar pagada</button>}
                        <button onClick={() => setEditC(c)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Editar</button>
                        {c.estado === "PENDIENTE" && <button onClick={() => anular(c)} className="font-medium text-red-600 dark:text-red-400 hover:underline">Anular</button>}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editC && (
        <EditarComisionModal
          comision={editC} empresa={empresaDe(editC.prospectoId)}
          onClose={() => setEditC(null)}
          onSaved={async () => { setEditC(null); await cargar(); await notify({ message: "Comisión actualizada.", variant: "success" }); }}
        />
      )}
    </div>
  );
}

// Editar una comisión: monto, %, estado y notas.
function EditarComisionModal({ comision, empresa, onClose, onSaved }: {
  comision: Comision; empresa: string; onClose: () => void; onSaved: () => void;
}) {
  const [monto, setMonto] = useState(String(Math.round(Number(comision.monto))));
  const [porcentaje, setPorcentaje] = useState(comision.porcentaje != null ? String(Number(comision.porcentaje)) : "");
  const [estado, setEstado] = useState(comision.estado);
  const [notas, setNotas] = useState(comision.notas ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function guardar() {
    setBusy(true); setErr(null);
    try {
      await ventasApi.editarComision(comision.id, {
        estado,
        monto: monto ? Number(monto) : undefined,
        porcentaje: porcentaje.trim() === "" ? null : Number(porcentaje),
        notas: notas.trim() || null,
      });
      onSaved();
    } catch (e) {
      setErr(errorMessage(e, "Error al guardar."));
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Comisión · ${empresa}`}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button><Button onClick={guardar} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button></>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Monto comisión"><MoneyInput value={monto} onChange={setMonto} placeholder="0" className={inputCls} /></Field>
        <Field label="% (vacío = monto fijo)"><input value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} className={inputCls} placeholder="Ej. 10" inputMode="decimal" /></Field>
      </div>
      <Field label="Estado"><select value={estado} onChange={(e) => setEstado(e.target.value)} className={inputCls}>{ESTADO_COMISION.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</select></Field>
      <Field label="Notas"><textarea value={notas} onChange={(e) => setNotas(e.target.value)} className={`${inputCls} resize-y`} rows={2} placeholder="opcional" /></Field>
      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
    </Modal>
  );
}
