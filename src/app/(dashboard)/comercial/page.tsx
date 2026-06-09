"use client";

// Comercial — sección de ventas en pestañas: Prospectos, Equipo (solo ADMIN) y
// Comisiones. La Agenda vive en su propia entrada del sidebar (/agenda). El
// COMERCIAL ve todas menos Equipo. El tab inicial puede venir por ?tab=; al venir
// desde /agenda con ?comercial=, abre ese comercial en la pestaña Equipo.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getUser } from "@/lib/auth";
import { ProspectosList } from "@/components/prospectos-list";
import { EquipoComercial } from "@/components/equipo-comercial";
import { ComisionesView } from "@/components/comisiones-view";
import { ContratosComercial } from "@/components/contratos-comercial";

type Tab = "prospectos" | "equipo" | "comisiones" | "contratos";

export default function ComercialPage() {
  return (
    <Suspense fallback={null}>
      <ComercialTabs />
    </Suspense>
  );
}

function ComercialTabs() {
  const esAdmin = getUser()?.rol === "ADMIN";
  const sp = useSearchParams();

  const tabs: { id: Tab; label: string }[] = [
    { id: "prospectos", label: "Prospectos" },
    ...(esAdmin ? [{ id: "equipo" as Tab, label: "Equipo comercial" }] : []),
    { id: "comisiones", label: "Comisiones" },
    ...(esAdmin ? [{ id: "contratos" as Tab, label: "Contratos" }] : []),
  ];

  // Comercial a abrir en Equipo cuando se llega desde /agenda (?comercial=).
  const comercialFromUrl = esAdmin ? sp.get("comercial") : null;
  const fromUrl = sp.get("tab") as Tab | null;
  const initial = comercialFromUrl
    ? "equipo"
    : tabs.some((t) => t.id === fromUrl)
      ? (fromUrl as Tab)
      : "prospectos";
  const [tab, setTab] = useState<Tab>(initial);
  // Comercial a abrir en la pestaña Equipo (al navegar desde Agenda o Prospectos).
  const [openComercialId, setOpenComercialId] = useState<string | null>(comercialFromUrl);
  const [returnTab, setReturnTab] = useState<Tab>("prospectos"); // a dónde vuelve "Atrás"

  const selectTab = (t: Tab) => { setOpenComercialId(null); setTab(t); };
  // Abrir un comercial en Equipo recordando desde qué pestaña se vino.
  const openComercial = (id: string) => { setReturnTab(tab); setOpenComercialId(id); setTab("equipo"); };
  const forcedBack = () => { setOpenComercialId(null); setTab(returnTab); };

  const tabCls = (t: Tab) =>
    `rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
      tab === t
        ? "bg-indigo-600 text-white"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
    }`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => selectTab(t.id)} className={tabCls(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab === "prospectos" && <ProspectosList onOpenComercial={esAdmin ? openComercial : undefined} />}
      {tab === "equipo" && esAdmin && (
        <EquipoComercial openComercialId={openComercialId} onForcedBack={forcedBack} />
      )}
      {tab === "comisiones" && <ComisionesView />}
      {tab === "contratos" && esAdmin && <ContratosComercial />}
    </div>
  );
}
