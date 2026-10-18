"use client";
// Guardia del panel: verifica la sesión EN EL NAVEGADOR (el cliente de Supabase renueva
// el token solo). Así no hace falta "proxy"/middleware y la app corre igual en cualquier
// hosting (Cloudflare, Vercel, Node). Los datos los protege la base con RLS.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import type { Perfil } from "@/lib/supabase/database.types";
import { ProveedorPanel } from "./ContextoPanel";
import { NavPanel } from "./NavPanel";

export function GuardiaPanel({ children }: { children: React.ReactNode }) {
  const supabase = supabaseNavegador();
  const router = useRouter();
  const ruta = usePathname();
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    let vivo = true;
    async function verificar() {
      const { data } = await supabase.auth.getUser();
      if (!vivo) return;
      if (!data.user) return router.replace(`/ingresar?volver=${encodeURIComponent(ruta)}`);
      const { data: p } = await supabase.from("perfiles").select("*").eq("id", data.user.id).maybeSingle();
      if (!vivo) return;
      if (!p || p.estado !== "activo") return router.replace("/pendiente");
      setPerfil(p);
    }
    verificar();
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") router.replace("/ingresar");
    });
    return () => { vivo = false; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!perfil) {
    return (
      <div className="grid min-h-dvh place-items-center text-suave" aria-busy="true">
        <p className="animate-pulse">🐣 Cargando panel…</p>
      </div>
    );
  }
  return (
    <ProveedorPanel perfil={perfil}>
      <div className="min-h-dvh md:flex">
        <NavPanel perfil={perfil} />
        <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 md:pb-10">{children}</main>
      </div>
    </ProveedorPanel>
  );
}
