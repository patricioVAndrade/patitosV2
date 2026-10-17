import Link from "next/link";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { ListaArticulos } from "@/componentes/panel/ListaArticulos";
import { IconoMas } from "@/componentes/ui/Iconos";

export default async function PaginaArticulos({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const { f, q } = await searchParams;
  const supabase = await supabaseServidor();
  const [cats, marcas] = await Promise.all([
    supabase.from("categorias").select("id,nombre").eq("activa", true).order("orden"),
    supabase.from("marcas").select("id,nombre").eq("activa", true).order("nombre"),
  ]);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Artículos</h1>
        <Link href="/panel/articulos/nuevo" className="btn-primario"><IconoMas className="size-4" /> Nuevo</Link>
      </div>
      <ListaArticulos filtroInicial={f ?? ""} textoInicial={q ?? ""} categorias={cats.data ?? []} marcas={marcas.data ?? []} />
    </div>
  );
}
