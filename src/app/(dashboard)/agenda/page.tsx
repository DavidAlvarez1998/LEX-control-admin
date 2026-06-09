"use client";

// Agenda — entrada propia del sidebar (antes era una pestaña dentro de Comercial).
// Renderiza el calendario mensual de actividades. El ADMIN puede abrir el detalle
// de un comercial: navega a la sección Comercial (pestaña Equipo) con ?comercial=.

import { useRouter } from "next/navigation";
import { AgendaView } from "@/components/agenda-view";

export default function AgendaPage() {
  const router = useRouter();
  return (
    <AgendaView
      onOpenComercial={(id) => router.push(`/comercial?tab=equipo&comercial=${id}`)}
    />
  );
}
