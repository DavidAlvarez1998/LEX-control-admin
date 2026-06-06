// Contrato del módulo de venta de la plataforma (prospectos + comisiones) para
// el panel admin. Dinero llega como string (Decimal serializado).

import { api } from "./api";

export const CANAL_ENTRADA = ["WEB", "WHATSAPP", "DIRECTO", "REFERIDO", "LLAMADA", "REDES_SOCIALES", "OTRO"] as const;
export const ESTADO_PROSPECTO = ["NUEVO", "CONTACTADO", "COTIZADO", "NEGOCIACION", "GANADO", "PERDIDO"] as const;
export const ESTADO_EDITABLE = ["NUEVO", "CONTACTADO", "COTIZADO", "NEGOCIACION"] as const;
export const ESTADO_COMISION = ["PENDIENTE", "PAGADA", "ANULADA"] as const;

export type Prospecto = {
  id: string;
  nombreEmpresa: string;
  nombreContacto: string;
  email: string | null;
  telefono: string | null;
  cargo: string | null;
  canalEntrada: string;
  estado: string;
  planInteresId: string | null;
  comercialId: string | null;
  planVendidoId: string | null;
  precioVenta: string | null;
  fechaCierre: string | null;
  empresaId: string | null;
  motivoPerdida: string | null;
  notas: string | null;
  createdAt: string;
};

export type ProspectoDetalle = Prospecto & { comision: Comision | null };

export type Comision = {
  id: string;
  prospectoId: string;
  comercialId: string;
  baseCalculo: string;
  porcentaje: string | null;
  monto: string;
  estado: string;
  fechaPago: string | null;
  notas: string | null;
  createdAt: string;
};

export type PlanMin = { id: string; nombre: string; precioMensual: string };
export type ComercialMin = { id: string; nombre: string; porcentajeComision: string | null };

export const ventasApi = {
  prospectos: (q: { estado?: string; canal?: string; comercialId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (q.estado) qs.set("estado", q.estado);
    if (q.canal) qs.set("canal", q.canal);
    if (q.comercialId) qs.set("comercialId", q.comercialId);
    const s = qs.toString();
    return api.get<Prospecto[]>(`/prospectos${s ? `?${s}` : ""}`);
  },
  prospecto: (id: string) => api.get<ProspectoDetalle>(`/prospectos/${id}`),
  crearProspecto: (body: Record<string, unknown>) => api.post<Prospecto>("/prospectos", body),
  editarProspecto: (id: string, body: Record<string, unknown>) => api.patch<Prospecto>(`/prospectos/${id}`, body),
  ganar: (id: string, body: Record<string, unknown>) => api.post<unknown>(`/prospectos/${id}/ganar`, body),
  perder: (id: string, motivoPerdida: string) => api.post<unknown>(`/prospectos/${id}/perder`, { motivoPerdida }),

  comisiones: (q: { estado?: string; comercialId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (q.estado) qs.set("estado", q.estado);
    if (q.comercialId) qs.set("comercialId", q.comercialId);
    const s = qs.toString();
    return api.get<Comision[]>(`/comisiones${s ? `?${s}` : ""}`);
  },
  pagarComision: (id: string) => api.patch<Comision>(`/comisiones/${id}`, { estado: "PAGADA" }),
  anularComision: (id: string) => api.patch<Comision>(`/comisiones/${id}`, { estado: "ANULADA" }),

  // Fuentes auxiliares para selects.
  planes: () => api.get<PlanMin[]>("/planes").then((ps) => ps.map((p) => ({ id: p.id, nombre: p.nombre, precioMensual: p.precioMensual }))).catch(() => [] as PlanMin[]),
  comerciales: () =>
    api.get<{ id: string; nombre: string; rol: string; porcentajeComision: string | null }[]>("/usuarios")
      .then((us) => us.filter((u) => u.rol === "COMERCIAL").map((u) => ({ id: u.id, nombre: u.nombre, porcentajeComision: u.porcentajeComision })))
      .catch(() => [] as ComercialMin[]),
};
