import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { Logo } from "@/componentes/ui/Logo";
import { BotonGoogle } from "./BotonGoogle";

export const metadata = { title: "Ingresar", robots: { index: false } };

export default async function Ingresar({ searchParams }: { searchParams: Promise<{ volver?: string; error?: string }> }) {
  const { volver, error } = await searchParams;
  const sesion = await obtenerSesion();
  if (sesion?.perfil?.estado === "activo") redirect(volver?.startsWith("/panel") ? volver : "/panel");
  if (sesion) redirect("/pendiente");

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="tarjeta w-full max-w-sm p-7 text-center shadow-[0_8px_30px_rgba(255,107,107,0.15)]">
        <div className="mb-2 flex justify-center"><Logo alto={56} /></div>
        <h1 className="text-lg font-semibold">Panel del local</h1>
        <p className="mb-6 text-sm text-suave">Ingresá con tu cuenta de Google. La primera vez, el administrador tiene que aprobar tu acceso.</p>
        <BotonGoogle volver={volver?.startsWith("/panel") ? volver : "/panel"} />
        {error && <p className="mt-4 text-sm text-red-600">No se pudo completar el ingreso. Probá de nuevo.</p>}
      </div>
    </main>
  );
}
