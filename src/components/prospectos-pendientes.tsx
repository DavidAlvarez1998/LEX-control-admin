"use client";

// Indicador visible de prospectos SIN ASIGNAR y aún en estado NUEVO = "pendientes
// de contactar" (cualquier canal). Derivado de los prospectos existentes (NO es un
// subsistema de notificaciones). Solo ADMIN/COMERCIAL. Refresca al cargar, al volver
// a la pestaña y cada 60s.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ventasApi } from "@/lib/ventas";
import { getUser } from "@/lib/auth";

export function ProspectosPendientes() {
  const [count, setCount] = useState(0);
  const [puede, setPuede] = useState(false);

  useEffect(() => {
    const rol = getUser()?.rol;
    const ok = rol === "ADMIN" || rol === "COMERCIAL";
    setPuede(ok);
    if (!ok) return;

    let vivo = true;
    const cargar = () =>
      ventasApi
        .prospectos({ sinAsignar: true, estado: "NUEVO" })
        .then((p) => { if (vivo) setCount(p.length); })
        .catch(() => {});
    cargar();
    const onFocus = () => cargar();
    window.addEventListener("focus", onFocus);
    const id = setInterval(cargar, 60_000);
    return () => {
      vivo = false;
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
    };
  }, []);

  // Sin permiso o sin pendientes → no se muestra nada.
  if (!puede || count === 0) return null;

  return (
    <Link
      href="/prospectos?sinAsignar=1"
      title={`${count} prospecto(s) sin asignar, pendientes de contactar`}
      className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
      </span>
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <span className="whitespace-nowrap">
        {count} por contactar
      </span>
    </Link>
  );
}
