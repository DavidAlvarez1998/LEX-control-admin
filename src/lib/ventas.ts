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
  referidoPor: string | null;
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

// Resumen de un comercial para la vista de equipo del ADMIN.
export type ComercialResumen = {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  porcentajeComision: number | null;
  prospectos: number;
  ganados: number;
  pendientesAgenda: number;
};

export const TIPO_GESTION = ["LLAMADA", "WHATSAPP", "REUNION", "VIDEOLLAMADA", "CORREO", "OTRO"] as const;

export type Seguimiento = {
  id: string;
  prospectoId: string;
  comercialId: string | null;
  tipo: string;
  titulo: string | null;
  nota: string | null;
  resultado: string | null;
  fechaProgramada: string | null;
  completada: boolean;
  fechaCompletada: string | null;
  canceladaEn: string | null;
  motivoCancelacion: string | null;
  createdAt: string;
};

// Resumen del prospecto que viaja con cada item de la agenda.
export type ProspectoResumen = Pick<Prospecto, "id" | "nombreEmpresa" | "nombreContacto" | "estado" | "telefono">;
export type AgendaItem = Seguimiento & { prospecto: ProspectoResumen };
export type Agenda = { desde: string; hasta: string; items: AgendaItem[]; vencidas: AgendaItem[] };

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
  editarComision: (id: string, body: Record<string, unknown>) => api.patch<Comision>(`/comisiones/${id}`, body),

  // Resumen del equipo comercial (solo ADMIN).
  equipoComercial: () => api.get<ComercialResumen[]>("/equipo-comercial"),
  // % de comisión por defecto del comercial (campo del Usuario).
  setPorcentajeComercial: (usuarioId: string, porcentajeComision: number) =>
    api.patch<unknown>(`/usuarios/${usuarioId}`, { porcentajeComision }),

  // Seguimiento (timeline por prospecto) + agenda (pendientes por comercial).
  seguimientos: (prospectoId: string) => api.get<Seguimiento[]>(`/prospectos/${prospectoId}/seguimientos`),
  addSeguimiento: (prospectoId: string, body: Record<string, unknown>) =>
    api.post<Seguimiento>(`/prospectos/${prospectoId}/seguimientos`, body),
  editarSeguimiento: (id: string, body: Record<string, unknown>) => api.patch<Seguimiento>(`/seguimientos/${id}`, body),
  completarSeguimiento: (id: string, body: Record<string, unknown> = {}) =>
    api.post<Seguimiento>(`/seguimientos/${id}/completar`, body),
  cancelarSeguimiento: (id: string, motivo: string) =>
    api.post<Seguimiento>(`/seguimientos/${id}/cancelar`, { motivo }),
  reabrirSeguimiento: (id: string) => api.post<Seguimiento>(`/seguimientos/${id}/reabrir`, {}),
  borrarSeguimiento: (id: string) => api.del<void>(`/seguimientos/${id}`),
  agenda: (q: { desde?: string; hasta?: string; comercialId?: string; incluirCompletadas?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (q.desde) qs.set("desde", q.desde);
    if (q.hasta) qs.set("hasta", q.hasta);
    if (q.comercialId) qs.set("comercialId", q.comercialId);
    if (q.incluirCompletadas) qs.set("incluirCompletadas", "true");
    const s = qs.toString();
    return api.get<Agenda>(`/agenda${s ? `?${s}` : ""}`);
  },

  // Fuentes auxiliares para selects.
  planes: () => api.get<PlanMin[]>("/planes").then((ps) => ps.map((p) => ({ id: p.id, nombre: p.nombre, precioMensual: p.precioMensual }))).catch(() => [] as PlanMin[]),
  comerciales: () =>
    api.get<{ id: string; nombre: string; rol: string; porcentajeComision: string | null }[]>("/usuarios")
      .then((us) => us.filter((u) => u.rol === "COMERCIAL").map((u) => ({ id: u.id, nombre: u.nombre, porcentajeComision: u.porcentajeComision })))
      .catch(() => [] as ComercialMin[]),
};
