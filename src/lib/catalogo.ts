import "server-only";
import { supabasePublico } from "./supabase/servidor";
import type { ItemCatalogo, ResultadoBusqueda } from "./supabase/database.types";

export const POR_PAGINA = 24;

export interface FiltrosCatalogo {
  q?: string;
  categoria?: string; // slug
  marca?: string;     // slug
  filtro?: "ofertas" | "nuevos";
  pagina?: number;
}

const COLUMNAS =
  "id,sku,slug,nombre,categoria,categoria_slug,marca,marca_slug,precio,precio_anterior,en_oferta,es_nuevo,disponibilidad,agotado,edad_desde_meses,edad_hasta_meses,ruta_thumb,ruta_full,actualizado,creado,busqueda";

export function leerFiltros(sp: Record<string, string | string[] | undefined>): FiltrosCatalogo {
  const uno = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const f = uno("f");
  return {
    q: uno("q")?.slice(0, 80) || undefined,
    marca: uno("marca") || undefined,
    filtro: f === "ofertas" || f === "nuevos" ? f : undefined,
    pagina: Math.max(1, Math.min(500, Number(uno("pag")) || 1)),
  };
}

/**
 * Catálogo con filtros. La búsqueda perdona errores de tipeo ("pelpta" → pelota): primero salen
 * los que coinciden tal cual y después los parecidos. Si ninguno coincide tal cual, `corregida`
 * trae la búsqueda corregida para mostrar "Mostramos resultados para …".
 */
export async function buscarCatalogo(f: FiltrosCatalogo): Promise<ResultadoBusqueda> {
  const pagina = f.pagina ?? 1;
  const { data, error } = await supabasePublico().rpc("buscar_catalogo", {
    p_q: f.q ?? null,
    p_categoria: f.categoria ?? null,
    p_marca: f.marca ?? null,
    p_filtro: f.filtro ?? null,
    p_desde: (pagina - 1) * POR_PAGINA,
    p_cantidad: POR_PAGINA,
  });
  if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`);
  return data;
}

export async function categoriasConArticulos() {
  const { data } = await supabasePublico().from("v_categorias").select("*").gt("cantidad", 0).order("orden");
  return data ?? [];
}

export async function hayOfertasYNovedades() {
  const s = supabasePublico();
  const [o, n] = await Promise.all([
    s.from("v_catalogo").select("id", { count: "exact", head: true }).eq("en_oferta", true),
    s.from("v_catalogo").select("id", { count: "exact", head: true }).eq("es_nuevo", true),
  ]);
  return { ofertas: (o.count ?? 0) > 0, nuevos: (n.count ?? 0) > 0 };
}

export async function fichaProducto(sku: string) {
  const { data } = await supabasePublico().from("v_producto").select("*").eq("sku", sku.toUpperCase()).maybeSingle();
  return data;
}

/** Portada: lo último que entró (marcado como nuevo), sin agotados. */
export async function novedades(limite = 12): Promise<ItemCatalogo[]> {
  const { data } = await supabasePublico().from("v_catalogo").select(COLUMNAS)
    .eq("es_nuevo", true).eq("agotado", false).order("creado", { ascending: false }).limit(limite);
  return (data ?? []) as ItemCatalogo[];
}

/** Portada: ofertas vigentes (con precio), sin agotados. */
export async function ofertas(limite = 8): Promise<{ items: ItemCatalogo[]; total: number }> {
  const { data, count } = await supabasePublico().from("v_catalogo").select(COLUMNAS, { count: "exact" })
    .eq("en_oferta", true).eq("agotado", false).order("actualizado", { ascending: false }).limit(limite);
  return { items: (data ?? []) as ItemCatalogo[], total: count ?? 0 };
}

/** Categorías con cantidad y una foto representativa (la del artículo más reciente con foto). */
export async function categoriasConFoto() {
  const s = supabasePublico();
  const [cats, recientes] = await Promise.all([
    categoriasConArticulos(),
    s.from("v_catalogo").select("categoria_slug,ruta_thumb").not("ruta_thumb", "is", null)
      .eq("agotado", false).order("actualizado", { ascending: false }).limit(400),
  ]);
  const foto = new Map<string, string>();
  for (const r of recientes.data ?? []) if (r.categoria_slug && r.ruta_thumb && !foto.has(r.categoria_slug)) foto.set(r.categoria_slug, r.ruta_thumb);
  return cats.map((c) => ({ ...c, ruta_thumb: c.slug ? foto.get(c.slug) ?? null : null }));
}

/** Ficha: otros artículos de la misma categoría. */
export async function relacionados(categoriaSlug: string, excluirSku: string, limite = 8): Promise<ItemCatalogo[]> {
  const { data } = await supabasePublico().from("v_catalogo").select(COLUMNAS)
    .eq("categoria_slug", categoriaSlug).neq("sku", excluirSku).eq("agotado", false)
    .order("es_nuevo", { ascending: false }).order("actualizado", { ascending: false }).limit(limite);
  return (data ?? []) as ItemCatalogo[];
}

/** Marcas con artículos publicados (para /m/[slug], el sitemap y la portada). */
export async function marcasConArticulos() {
  const { data } = await supabasePublico().from("v_marcas").select("slug,nombre,cantidad").order("cantidad", { ascending: false });
  return data ?? [];
}

export async function marcaPorSlug(slug: string) {
  const { data } = await supabasePublico().from("v_marcas").select("slug,nombre,cantidad").eq("slug", slug).maybeSingle();
  return data;
}
