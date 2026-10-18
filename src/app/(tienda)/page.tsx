import { Catalogo } from "@/componentes/tienda/Catalogo";
import { leerFiltros } from "@/lib/catalogo";

export const dynamic = "force-dynamic"; // siempre fresco: lo que se carga en el panel aparece al instante

export default async function Inicio({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Catalogo filtros={leerFiltros(await searchParams)} />;
}
