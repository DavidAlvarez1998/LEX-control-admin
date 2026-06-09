import { redirect } from "next/navigation";

// Comisiones se fusionó en la sección "Comercial" (tab Comisiones).
export default function ComisionesRedirect() {
  redirect("/comercial?tab=comisiones");
}
