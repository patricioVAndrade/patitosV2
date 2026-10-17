import { notFound, redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { obtenerSesion } from "@/lib/sesion";
import { esCodigoDeBarras, normalizar } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { EditorProducto, type ValoresIniciales } from "@/componentes/panel/EditorProducto";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ codigo?: string; continuo?: string }> };

export default async function PaginaEditor({ params, searchParams }: Props) {
  const { id } = await params;
  const { codigo, continuo } = await searchParams;
  const supabase = await supabaseServidor();
  const sesion = await obtenerSesion();
  const esAdmin = puede.verCostos(sesion?.perfil?.rol);

  const [cats, marcas, provs, etiqs] = await Promise.all([
    supabase.from("categorias").select("id,nombre").eq("activa", true).order("orden"),
    supabase.from("marcas").select("id,nombre").eq("activa", true).order("nombre"),
    supabase.from("proveedores").select("id,nombre").eq("activo", true).order("nombre"),
    supabase.from("etiquetas").select("id,nombre").order("nombre"),
  ]);
  const listas = { categorias: cats.data ?? [], marcas: marcas.data ?? [], proveedores: provs.data ?? [], etiquetas: etiqs.data ?? [] };

  let iniciales: ValoresIniciales;
  let aviso: string | null = null;

  if (id === "nuevo") {
    iniciales = { producto: null, codigos: [], imagenes: [], etiquetas: [], costo: null };
    const c = codigo?.trim().toUpperCase();
    if (c) {
      const { data: r } = await supabase.rpc("buscar_codigo", { p_codigo: c });
      if (r?.tipo === "producto") redirect(`/panel/articulos/${r.producto_id}${continuo ? "?continuo=1" : ""}`);
      if (r?.tipo === "lista") {
        const it = r.item;
        const cat = listas.categorias.find((x) => normalizar(x.nombre) === normalizar(it.categoria ?? ""));
        const marca = it.marca ? listas.marcas.find((x) => normalizar(x.nombre) === normalizar(it.marca ?? "")) : undefined;
        iniciales.prefill = {
          nombre: it.nombre,
          categoria_id: cat?.id,
          marca_id: marca?.id ?? null,
          marcaTexto: marca ? undefined : it.marca ?? undefined,
          proveedor_id: it.proveedor_id,
          precio: it.precio_sugerido,
        };
        iniciales.codigos = [{ codigo: it.codigo, tipo: "proveedor", proveedor_id: it.proveedor_id }];
        aviso = `Encontrado en la lista de ${it.proveedor}: nombre, categoría y precio sugerido completados. Sacale una foto y guardá.`;
      } else {
        iniciales.codigos = [{ codigo: c, tipo: esCodigoDeBarras(c) ? "barras" : "legado", proveedor_id: null }];
      }
    }
  } else {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
    const [p, cods, imgs, et, priv] = await Promise.all([
      supabase.from("productos").select("*").eq("id", id).maybeSingle(),
      supabase.from("codigos").select("codigo,tipo,proveedor_id").eq("producto_id", id).order("creado"),
      supabase.from("imagenes").select("ruta_thumb,ruta_full,ancho,alto").eq("producto_id", id).order("orden"),
      supabase.from("producto_etiquetas").select("etiqueta_id").eq("producto_id", id),
      esAdmin ? supabase.from("productos_privado").select("costo").eq("producto_id", id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!p.data) notFound();
    iniciales = {
      producto: p.data,
      codigos: cods.data ?? [],
      imagenes: imgs.data ?? [],
      etiquetas: ((et.data ?? []) as { etiqueta_id: number }[]).map((x) => x.etiqueta_id),
      costo: (priv.data as { costo: number | null } | null)?.costo ?? null,
    };
  }

  return <EditorProducto iniciales={iniciales} listas={listas} aviso={aviso} continuo={continuo === "1"} esAdmin={esAdmin} />;
}
