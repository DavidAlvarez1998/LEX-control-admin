"use client";

// Comercial — única entrada del sidebar que agrupa todo el módulo de ventas en
// pestañas: Prospectos, Equipo (solo ADMIN), Agenda y Comisiones. El COMERCIAL
// ve todas menos Equipo. El tab inicial puede venir por ?tab= (links viejos).

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getUser } from "@/lib/auth";
import { ProspectosList } from "@/components/prospectos-list";
import { EquipoComercial } from "@/components/equipo-comercial";
import { AgendaView } from "@/components/agenda-view";
import { ComisionesView } from "@/components/comisiones-view";

type Tab = "prospectos" | "equipo" | "agenda" | "comisiones";

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
    { id: "agenda", label: "Agenda" },
    { id: "comisiones", label: "Comisiones" },
  ];

  const fromUrl = sp.get("tab") as Tab | null;
  const initial = tabs.some((t) => t.id === fromUrl) ? (fromUrl as Tab) : "prospectos";
  const [tab, setTab] = useState<Tab>(initial);
  // Comercial a abrir en la pestaña Equipo (al navegar desde Agenda o Prospectos).
  const [openComercialId, setOpenComercialId] = useState<string | null>(null);
  const [returnTab, setReturnTab] = useState<Tab>("agenda"); // a dónde vuelve "Atrás"

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
      {tab === "agenda" && <AgendaView onOpenComercial={openComercial} />}
      {tab === "comisiones" && <ComisionesView />}
    </div>
  );
}
