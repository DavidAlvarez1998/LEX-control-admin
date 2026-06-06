import { Button, Card, EmptyState, PageHeader, PlusIcon } from "@/components/ui";

export default function ApiPage() {
  const keys: { id: string; nombre: string; prefijo: string; creada: string }[] = [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="API"
        subtitle="Gestiona las llaves de acceso e integraciones del API."
        action={
          <Button>
            <PlusIcon />
            Generar API key
          </Button>
        }
      />

      <Card>
        <h3 className="font-medium text-slate-800 dark:text-slate-100">Endpoint base</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">URL del backend para las integraciones:</p>
        <code className="mt-3 block rounded-lg bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100">
          https://api.lexcontrol.com/v1
        </code>
      </Card>

      {keys.length === 0 ? (
        <EmptyState
          title="Sin API keys"
          description="Genera una llave para que sistemas externos consuman el API de LEX Control."
          action={
            <Button>
              <PlusIcon />
              Generar API key
            </Button>
          }
        />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Prefijo</th>
                <th className="px-5 py-3 font-medium">Creada</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{k.nombre}</td>
                  <td className="px-5 py-3 font-mono text-slate-600 dark:text-slate-300">{k.prefijo}…</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{k.creada}</td>
                  <td className="px-5 py-3 text-right text-rose-600 dark:text-rose-400">Revocar</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
