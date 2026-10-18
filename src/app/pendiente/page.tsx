"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/cliente";

export default function Pendiente() {
  const router = useRouter();
  const [info, setInfo] = useState<{ email: string; bloqueado: boolean } | null>(null);
  useEffect(() => {
    const s = supabaseNavegador();
    s.auth.getUser().then(async ({ data }) => {
      if (!data.user) return router.replace("/ingresar");
      const { data: p } = await s.from("perfiles").select("estado").eq("id", data.user.id).maybeSingle();
      if (p?.estado === "activo") return router.replace("/panel");
      setInfo({ email: data.user.email ?? "", bloqueado: p?.estado === "bloqueado" });
    });
  }, [router]);

  async function salir() {
    await supabaseNavegador().auth.signOut();
    router.replace("/ingresar");
  }

  if (!info) return <div className="grid min-h-dvh place-items-center text-suave">Verificando…</div>;
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="tarjeta w-full max-w-sm p-7 text-center">
        <p className="text-4xl">{info.bloqueado ? "🔒" : "⏳"}</p>
        <h1 className="mt-2 text-lg font-semibold">{info.bloqueado ? "Tu acceso está bloqueado" : "Tu acceso está pendiente"}</h1>
        <p className="mt-2 text-sm text-suave">
          Ingresaste como <strong>{info.email}</strong>.{" "}
          {info.bloqueado ? "Hablá con el administrador." : "Avisale al administrador para que te habilite desde el panel (Usuarios). Después recargá esta página."}
        </p>
        <button onClick={salir} className="btn-claro mt-5">Salir</button>
      </div>
    </main>
  );
}
