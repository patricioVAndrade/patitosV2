"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { puede } from "@/lib/permisos";
import { GestionUsuarios } from "@/componentes/panel/GestionUsuarios";
import { usePanel } from "@/componentes/panel/ContextoPanel";
import { useCargar } from "@/componentes/panel/useCargar";

export default function PaginaUsuarios() {
  const { perfil } = usePanel();
  const router = useRouter();
  const esAdmin = puede.administrarUsuarios(perfil.rol);
  useEffect(() => { if (!esAdmin) router.replace("/panel"); }, [esAdmin, router]);
  const { datos } = useCargar(async () => {
    if (!esAdmin) return [];
    const { data } = await supabaseNavegador().from("perfiles").select("*").order("estado").order("creado", { ascending: false });
    return data ?? [];
  }, [esAdmin]);
  return datos ? <GestionUsuarios iniciales={datos} miId={perfil.id} /> : <p className="text-suave">Cargando…</p>;
}
