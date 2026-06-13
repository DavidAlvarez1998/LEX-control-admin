import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui";

export default function FacturacionPage() {
  const facturas: { id: string; numero: string; empresa: string; total: string; estado: string }[] = [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturación"
        subtitle="Control de facturas emitidas y su estado de pago."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Facturado (mes)" value="$0" />
        <StatCard label="Pendiente de cobro" value="$0" />
        <StatCard label="Facturas emitidas" value="0" />
      </div>

      {facturas.length === 0 ? (
        <EmptyState
          title="Sin facturas todavía"
          description="Cuando emitas facturas a las empresas aparecerán aquí."
        />
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">N.º</th>
                <th className="px-5 py-3 font-medium">Empresa</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{f.numero}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{f.empresa}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{f.total}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{f.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
