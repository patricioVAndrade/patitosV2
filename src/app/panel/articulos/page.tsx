"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { ListaArticulos } from "@/componentes/panel/ListaArticulos";
import { useCargar } from "@/componentes/panel/useCargar";
import { IconoMas } from "@/componentes/ui/Iconos";

function Articulos() {
  const sp = useSearchParams();
  const { datos } = useCargar(async () => {
    const s = supabaseNavegador();
    const [cats, marcas] = await Promise.all([
      s.from("categorias").select("id,nombre").eq("activa", true).order("orden"),
      s.from("marcas").select("id,nombre").eq("activa", true).order("nombre"),
    ]);
    return { categorias: cats.data ?? [], marcas: marcas.data ?? [] };
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Artículos</h1>
        <Link href="/panel/articulos/nuevo" className="btn-primario"><IconoMas className="size-4" /> Nuevo</Link>
      </div>
      {datos && <ListaArticulos filtroInicial={sp.get("f") ?? ""} textoInicial={sp.get("q") ?? ""} categorias={datos.categorias} marcas={datos.marcas} />}
    </div>
  );
}

export default function PaginaArticulos() {
  return <Suspense><Articulos /></Suspense>;
}
