"use client";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { CargaMasiva } from "@/componentes/panel/CargaMasiva";
import { useCargar } from "@/componentes/panel/useCargar";

export default function PaginaMasiva() {
  const { datos } = useCargar(async () => {
    const s = supabaseNavegador();
    const [cats, marcas] = await Promise.all([
      s.from("categorias").select("id,nombre").eq("activa", true).order("orden"),
      s.from("marcas").select("id,nombre").eq("activa", true).order("nombre"),
    ]);
    return { categorias: cats.data ?? [], marcas: marcas.data ?? [] };
  });
  return datos ? <CargaMasiva categorias={datos.categorias} marcas={datos.marcas} /> : <p className="text-suave">Cargando…</p>;
}
