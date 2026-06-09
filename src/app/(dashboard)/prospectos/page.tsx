import { redirect } from "next/navigation";

// Prospectos se fusionó en la sección "Comercial" (tab Prospectos).
export default function ProspectosRedirect() {
  redirect("/comercial");
}
