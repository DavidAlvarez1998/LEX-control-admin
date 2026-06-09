import { redirect } from "next/navigation";

// Agenda se fusionó en la sección "Comercial" (tab Agenda).
export default function AgendaRedirect() {
  redirect("/comercial?tab=agenda");
}
