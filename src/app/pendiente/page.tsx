import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";

export const metadata = { title: "Acceso pendiente", robots: { index: false } };

export default async function Pendiente() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/ingresar");
  if (sesion.perfil?.estado === "activo") redirect("/panel");
  const bloqueado = sesion.perfil?.estado === "bloqueado";
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="tarjeta w-full max-w-sm p-7 text-center">
        <p className="text-4xl">{bloqueado ? "🔒" : "⏳"}</p>
        <h1 className="mt-2 text-lg font-semibold">{bloqueado ? "Tu acceso está bloqueado" : "Tu acceso está pendiente"}</h1>
        <p className="mt-2 text-sm text-suave">
          Ingresaste como <strong>{sesion.email}</strong>.{" "}
          {bloqueado ? "Hablá con el administrador." : "Avisale al administrador para que te habilite desde el panel (Usuarios). Después recargá esta página."}
        </p>
        <form action="/auth/salir" method="post" className="mt-5">
          <button className="btn-claro">Salir</button>
        </form>
      </div>
    </main>
  );
}
