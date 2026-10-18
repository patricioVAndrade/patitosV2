"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { Logo } from "@/componentes/ui/Logo";
import { BotonGoogle } from "./BotonGoogle";
import { env } from "@/lib/env";

function Ingresar() {
  const sp = useSearchParams();
  const router = useRouter();
  const volver = sp.get("volver")?.startsWith("/panel") ? sp.get("volver")! : "/panel";
  const [verificando, setVerificando] = useState(true);

  // Si ya tiene sesión, no hace falta volver a ingresar
  useEffect(() => {
    supabaseNavegador().auth.getUser().then(({ data }) => {
      if (data.user) router.replace(volver);
      else setVerificando(false);
    });
  }, [router, volver]);

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="tarjeta w-full max-w-sm p-7 text-center shadow-[0_8px_30px_rgba(255,107,107,0.15)]">
        <div className="mb-2 flex justify-center"><Logo alto={56} /></div>
        <h1 className="text-lg font-semibold">Panel del local</h1>
        <p className="mb-6 text-sm text-suave">Ingresá con tu cuenta de Google. La primera vez, el administrador tiene que aprobar tu acceso.</p>
        {verificando ? <p className="text-sm text-suave">Verificando…</p> : <BotonGoogle volver={volver} />}
        {sp.get("error") && <p className="mt-4 text-sm text-red-600">No se pudo completar el ingreso. Probá de nuevo.</p>}
        <p className="mt-6 text-xs text-suave">
          <a href={`${env.sitioUrl}/privacidad`} className="underline">Política de privacidad</a>
        </p>
      </div>
    </main>
  );
}

export default function PaginaIngresar() {
  return <Suspense><Ingresar /></Suspense>;
}
