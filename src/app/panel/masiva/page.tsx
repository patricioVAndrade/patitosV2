import { supabaseServidor } from "@/lib/supabase/servidor";
import { CargaMasiva } from "@/componentes/panel/CargaMasiva";

export default async function PaginaMasiva() {
  const supabase = await supabaseServidor();
  const [cats, marcas] = await Promise.all([
    supabase.from("categorias").select("id,nombre").eq("activa", true).order("orden"),
    supabase.from("marcas").select("id,nombre").eq("activa", true).order("nombre"),
  ]);
  return <CargaMasiva categorias={cats.data ?? []} marcas={marcas.data ?? []} />;
}
