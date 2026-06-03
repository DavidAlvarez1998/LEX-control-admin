"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

/**
 * Protege las vistas del panel: si no hay sesión, redirige a /login.
 * Mientras verifica (primer render en cliente) no muestra el contenido.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (getToken()) {
      setChecked(true);
    } else {
      router.replace("/login");
    }
  }, [router]);

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-400">
        Cargando…
      </div>
    );
  }

  return <>{children}</>;
}
