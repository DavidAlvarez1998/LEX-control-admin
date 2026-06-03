import { Button, Card, PageHeader, PlusIcon } from "@/components/ui";

export default function UsuariosPage() {
  const usuarios = [
    { id: "1", nombre: "Admin", email: "admin@lex.com", rol: "ADMIN", estado: "Activo" },
  ];

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Administra los usuarios y sus roles de acceso."
        action={
          <Button>
            <PlusIcon />
            Nuevo usuario
          </Button>
        }
      />

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Rol</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-3 font-medium text-slate-800">{u.nombre}</td>
                <td className="px-5 py-3 text-slate-600">{u.email}</td>
                <td className="px-5 py-3">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                    {u.rol}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    {u.estado}
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-indigo-600">Editar</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
