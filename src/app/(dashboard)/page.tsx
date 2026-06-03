import { Card, StatCard } from "@/components/ui";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">
          Bienvenido a LEX Control
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Resumen general del sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Empresas" value="0" hint="+0 este mes" />
        <StatCard label="Servicios activos" value="0" />
        <StatCard label="Facturado (mes)" value="$0" />
        <StatCard label="Usuarios" value="1" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="font-medium text-slate-800">Actividad reciente</h3>
          <p className="mt-4 text-sm text-slate-500">
            Aún no hay actividad registrada.
          </p>
        </Card>
        <Card>
          <h3 className="font-medium text-slate-800">Accesos rápidos</h3>
          <ul className="mt-4 space-y-2 text-sm text-indigo-600">
            <li><a href="/empresas" className="hover:underline">→ Crear empresa</a></li>
            <li><a href="/servicios" className="hover:underline">→ Nuevo servicio</a></li>
            <li><a href="/facturacion" className="hover:underline">→ Ver facturación</a></li>
            <li><a href="/usuarios" className="hover:underline">→ Gestionar usuarios</a></li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
