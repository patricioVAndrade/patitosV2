import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ProveedorPanel } from "@/componentes/panel/ContextoPanel";
import { NavPanel } from "@/componentes/panel/NavPanel";

export const metadata = { title: "Panel", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/ingresar");
  if (!sesion.perfil || sesion.perfil.estado !== "activo") redirect("/pendiente");

  return (
    <ProveedorPanel perfil={sesion.perfil}>
      <div className="min-h-dvh md:flex">
        <NavPanel perfil={sesion.perfil} />
        <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 md:pb-10">{children}</main>
      </div>
    </ProveedorPanel>
  );
}
