"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { puede } from "@/lib/permisos";
import { usePanel } from "@/componentes/panel/ContextoPanel";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { useCargar } from "@/componentes/panel/useCargar";
import { fechaHora } from "@/lib/formato";
import type { Json } from "@/lib/supabase/database.types";

const POR_PAGINA = 50;
const CAMPOS: Record<string, string> = {
  nombre: "nombre", categoria_id: "categoría", marca_id: "marca", proveedor_id: "proveedor", precio: "precio",
  precio_anterior: "precio anterior", mostrar_precio: "mostrar precio", en_oferta: "oferta", estado: "web",
  disponibilidad: "stock", nuevo_hasta: "nuevo hasta", descripcion: "descripción", edad_desde_meses: "edad desde",
  edad_hasta_meses: "edad hasta", costo: "costo", rol: "rol",
};
const VALORES: Record<string, string> = { publicado: "visible", borrador: "oculto", archivado: "archivado", true: "sí", false: "no", null: "—" };
const verbo = { alta: "agregó", edicion: "cambió", baja: "eliminó" } as const;

type Nombres = Record<string, Record<string, string>>;

function detalle(tabla: string, accion: string, cambios: Json | null, nombres: Nombres): string {
  if (accion !== "edicion" || !cambios || typeof cambios !== "object" || Array.isArray(cambios)) return "";
  return Object.entries(cambios)
    .filter(([k]) => CAMPOS[k] || tabla === "perfiles")
    .map(([k, v]) => {
      const c = v as { antes: Json; ahora: Json };
      const f = (x: Json) => (x !== null && nombres[k]?.[String(x)]) || VALORES[String(x)] || String(x);
      return `${CAMPOS[k] ?? k}: ${f(c.antes)} → ${f(c.ahora)}`;
    })
    .join(" · ");
}

export default function PaginaHistorial() {
  const [pag, setPag] = useState(1);
  const { perfil } = usePanel();
  const router = useRouter();
  const habilitado = puede.verHistorial(perfil.rol);
  useEffect(() => { if (!habilitado) router.replace("/panel"); }, [habilitado, router]);
  const { datos } = useCargar(async () => {
    if (!habilitado) return null;
    const supabase = supabaseNavegador();
    const [h, cats, marcas, provs] = await Promise.all([
      supabase.from("historial").select("*").order("fecha", { ascending: false }).range((pag - 1) * POR_PAGINA, pag * POR_PAGINA - 1),
      supabase.from("categorias").select("id,nombre"),
      supabase.from("marcas").select("id,nombre"),
      supabase.from("proveedores").select("id,nombre"),
    ]);
    const mapa = (l: { id: number; nombre: string }[] | null) => Object.fromEntries((l ?? []).map((x) => [String(x.id), x.nombre]));
    return { filas: h.data ?? [], nombres: { categoria_id: mapa(cats.data), marca_id: mapa(marcas.data), proveedor_id: mapa(provs.data) } as Nombres };
  }, [pag, habilitado]);
  if (!datos) return <p className="text-suave">Cargando…</p>;
  const { filas, nombres } = datos;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Historial</h1>
      <ul className="space-y-2" data-testid="historial">
        {filas.map((h) => {
          const d = detalle(h.tabla, h.accion, h.cambios, nombres);
          const color = { alta: "border-l-emerald-500", edicion: "border-l-sky-500", baja: "border-l-red-500" }[h.accion];
          return (
            <li key={h.id} className={`rounded-xl border border-borde border-l-4 bg-white px-3 py-2 text-sm ${color}`}>
              <p>
                <strong>{h.usuario}</strong> {verbo[h.accion]}{" "}
                {h.producto_id && h.tabla !== "productos" ? <>{h.etiqueta} en </> : null}
                {h.producto_id ? (
                  <Link href={`/panel/articulos/${h.producto_id}`} className="font-medium underline-offset-2 hover:underline">
                    {h.tabla === "productos" ? h.etiqueta : "un artículo"}
                  </Link>
                ) : (
                  <span className="font-medium">{h.etiqueta}</span>
                )}
              </p>
              {d && <p className="text-xs text-suave">{d}</p>}
              <p className="text-xs text-suave">{fechaHora(h.fecha)}</p>
            </li>
          );
        })}
        {filas.length === 0 && <li className="text-suave">Todavía no hay movimientos.</li>}
      </ul>
      <div className="flex justify-between">
        {pag > 1 ? <button onClick={() => setPag(pag - 1)} className="btn-claro">Más nuevos</button> : <span />}
        {filas.length === POR_PAGINA && <button onClick={() => setPag(pag + 1)} className="btn-claro">Más viejos</button>}
      </div>
    </div>
  );
}
