"use client";

// Dashboard de la plataforma (ADMIN): resumen real de empresas, servicios,
// usuarios y planes, más las empresas registradas recientemente.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, StatCard } from "@/components/ui";
import { api } from "@/lib/api";

type Empresa = { id: string; nombre: string; activo: boolean; _count?: { usuarios: number; servicios: number }; createdAt: string };
type Servicio = { id: string; activo: boolean };
type Usuario = { id: string };
type Plan = { id: string };

export default function DashboardPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [e, s, u, p] = await Promise.all([
          api.get<Empresa[]>("/empresas"),
          api.get<Servicio[]>("/servicios"),
          api.get<Usuario[]>("/usuarios"),
          api.get<Plan[]>("/planes").catch(() => [] as Plan[]),
        ]);
        setEmpresas(e); setServicios(s); setUsuarios(u); setPlanes(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const empresasActivas = empresas.filter((e) => e.activo).length;
  const serviciosActivos = servicios.filter((s) => s.activo).length;
  const recientes = [...empresas]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Bienvenido a LEX Control</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Resumen general de la plataforma.</p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">{error}</Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Empresas" value={loading ? "…" : String(empresas.length)} hint={loading ? undefined : `${empresasActivas} activas`} />
        <StatCard label="Servicios" value={loading ? "…" : String(servicios.length)} hint={loading ? undefined : `${serviciosActivos} activos`} />
        <StatCard label="Usuarios" value={loading ? "…" : String(usuarios.length)} />
        <StatCard label="Planes" value={loading ? "…" : String(planes.length)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-0 lg:col-span-2">
          <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <h3 className="font-medium text-slate-800 dark:text-slate-100">Empresas recientes</h3>
          </div>
          {loading ? (
            <p className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
          ) : recientes.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">Aún no hay empresas registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-2 font-medium">Empresa</th>
                  <th className="px-5 py-2 font-medium">Usuarios</th>
                  <th className="px-5 py-2 font-medium">Servicios</th>
                  <th className="px-5 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-5 py-2 font-medium text-slate-800 dark:text-slate-100">{e.nombre}</td>
                    <td className="px-5 py-2 text-slate-600 dark:text-slate-300">{e._count?.usuarios ?? "—"}</td>
                    <td className="px-5 py-2 text-slate-600 dark:text-slate-300">{e._count?.servicios ?? "—"}</td>
                    <td className="px-5 py-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${e.activo ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                        {e.activo ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h3 className="font-medium text-slate-800 dark:text-slate-100">Accesos rápidos</h3>
          <ul className="mt-4 space-y-2 text-sm text-indigo-600 dark:text-indigo-400">
            <li><Link href="/empresas" className="hover:underline">→ Crear empresa</Link></li>
            <li><Link href="/servicios" className="hover:underline">→ Nuevo servicio</Link></li>
            <li><Link href="/planes" className="hover:underline">→ Gestionar planes</Link></li>
            <li><Link href="/usuarios" className="hover:underline">→ Gestionar usuarios</Link></li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
