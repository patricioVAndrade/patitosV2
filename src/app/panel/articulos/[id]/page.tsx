"use client";
import { Suspense } from "react";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { esCodigoDeBarras, normalizar } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { EditorProducto, type ValoresIniciales } from "@/componentes/panel/EditorProducto";
import { usePanel } from "@/componentes/panel/ContextoPanel";
import { useCargar } from "@/componentes/panel/useCargar";

function Editor() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const { perfil } = usePanel();
  const codigo = sp.get("codigo")?.trim().toUpperCase();
  const continuo = sp.get("continuo") === "1";
  const esAdmin = puede.verCostos(perfil.rol);

  const { datos, cargando } = useCargar(async () => {
    const s = supabaseNavegador();
    const [cats, marcas, provs, etiqs] = await Promise.all([
      s.from("categorias").select("id,nombre").eq("activa", true).order("orden"),
      s.from("marcas").select("id,nombre").eq("activa", true).order("nombre"),
      s.from("proveedores").select("id,nombre").eq("activo", true).order("nombre"),
      s.from("etiquetas").select("id,nombre").order("nombre"),
    ]);
    const listas = { categorias: cats.data ?? [], marcas: marcas.data ?? [], proveedores: provs.data ?? [], etiquetas: etiqs.data ?? [] };
    let iniciales: ValoresIniciales = { producto: null, codigos: [], imagenes: [], etiquetas: [], costo: null };
    let aviso: string | null = null;

    if (id === "nuevo") {
      if (codigo) {
        const { data: r } = await s.rpc("buscar_codigo", { p_codigo: codigo });
        if (r?.tipo === "producto") {
          router.replace(`/panel/articulos/${r.producto_id}${continuo ? "?continuo=1" : ""}`);
          return null;
        }
        if (r?.tipo === "lista") {
          const it = r.item;
          const cat = listas.categorias.find((x) => normalizar(x.nombre) === normalizar(it.categoria ?? ""));
          const marca = it.marca ? listas.marcas.find((x) => normalizar(x.nombre) === normalizar(it.marca ?? "")) : undefined;
          iniciales.prefill = { nombre: it.nombre, categoria_id: cat?.id, marca_id: marca?.id ?? null, marcaTexto: marca ? undefined : it.marca ?? undefined, proveedor_id: it.proveedor_id, precio: it.precio_sugerido };
          iniciales.codigos = [{ codigo: it.codigo, tipo: "proveedor", proveedor_id: it.proveedor_id }];
          aviso = `Encontrado en la lista de ${it.proveedor}: nombre, categoría y precio sugerido completados. Sacale una foto y guardá.`;
        } else {
          iniciales.codigos = [{ codigo, tipo: esCodigoDeBarras(codigo) ? "barras" : "legado", proveedor_id: null }];
        }
      }
    } else {
      const [p, cods, imgs, et, priv] = await Promise.all([
        s.from("productos").select("*").eq("id", id).maybeSingle(),
        s.from("codigos").select("codigo,tipo,proveedor_id").eq("producto_id", id).order("creado"),
        s.from("imagenes").select("ruta_thumb,ruta_full,ancho,alto").eq("producto_id", id).order("orden"),
        s.from("producto_etiquetas").select("etiqueta_id").eq("producto_id", id),
        esAdmin ? s.from("productos_privado").select("costo").eq("producto_id", id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (!p.data) return { noExiste: true as const };
      iniciales = {
        producto: p.data,
        codigos: cods.data ?? [],
        imagenes: imgs.data ?? [],
        etiquetas: (et.data ?? []).map((x) => x.etiqueta_id),
        costo: (priv.data as { costo: number | null } | null)?.costo ?? null,
      };
    }
    return { listas, iniciales, aviso };
  }, [id, codigo]);

  if (cargando || !datos) return <p className="text-suave">Cargando…</p>;
  if ("noExiste" in datos) notFound();
  // key: si se pasa de "nuevo" al artículo guardado, el editor arranca limpio
  return <EditorProducto key={datos.iniciales.producto?.id ?? `nuevo-${codigo ?? ""}`} iniciales={datos.iniciales} listas={datos.listas} aviso={datos.aviso} continuo={continuo} esAdmin={esAdmin} />;
}

export default function PaginaEditor() {
  return <Suspense><Editor /></Suspense>;
}
