"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { moneda, palabrasBusqueda, urlFoto } from "@/lib/formato";
import { mensajeError } from "@/lib/errores";
import type { Disponibilidad, EstadoProducto } from "@/lib/supabase/database.types";
import { usePanel } from "./ContextoPanel";
import { EstadoChips } from "./EstadoChips";
import { IconoBuscar } from "@/componentes/ui/Iconos";

interface Fila {
  id: string;
  sku: string;
  nombre: string;
  precio: number | null;
  estado: EstadoProducto;
  disponibilidad: Disponibilidad;
  categorias: { nombre: string } | null;
  marcas: { nombre: string } | null;
  imagenes: { ruta_thumb: string; orden: number }[];
}

const FILTROS = [
  { v: "", t: "Todos" },
  { v: "ocultos", t: "Ocultos" },
  { v: "agotados", t: "Agotados" },
  { v: "pocas", t: "Pocas" },
  { v: "sinfoto", t: "Sin foto" },
  { v: "sinmarca", t: "Sin marca" },
  { v: "ofertas", t: "Ofertas" },
];
const POR_PAGINA = 40;

export function ListaArticulos({ filtroInicial, textoInicial, categorias, marcas }: {
  filtroInicial: string; textoInicial: string; categorias: { id: number; nombre: string }[]; marcas: { id: number; nombre: string }[];
}) {
  const supabase = supabaseNavegador();
  const { avisar } = usePanel();
  const [filtro, setFiltro] = useState(filtroInicial);
  const [texto, setTexto] = useState(textoInicial);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  const cargar = useCallback(async (desde: number) => {
    setCargando(true);
    const sinFoto = filtro === "sinfoto";
    let q = supabase
      .from("productos")
      .select(`id,sku,nombre,precio,estado,disponibilidad,categorias(nombre),marcas(nombre),imagenes${sinFoto ? "!left" : ""}(ruta_thumb,orden)`, { count: "exact" })
      .order("actualizado", { ascending: false })
      .range(desde, desde + POR_PAGINA - 1);
    if (filtro === "ocultos") q = q.neq("estado", "publicado");
    if (filtro === "agotados") q = q.eq("disponibilidad", "agotado");
    if (filtro === "pocas") q = q.eq("disponibilidad", "pocas");
    if (filtro === "sinmarca") q = q.is("marca_id", null);
    if (filtro === "ofertas") q = q.eq("en_oferta", true);
    if (sinFoto) q = q.is("imagenes", null);
    for (const p of palabrasBusqueda(texto)) q = q.ilike("busqueda", `%${p}%`);
    const { data, count, error } = await q;
    setCargando(false);
    if (error) return avisar(mensajeError(error), "error");
    const nuevas = (data ?? []) as unknown as Fila[];
    setFilas((f) => (desde === 0 ? nuevas : [...f, ...nuevas]));
    setTotal(count ?? 0);
  }, [supabase, filtro, texto, avisar]);

  useEffect(() => {
    const t = setTimeout(() => { setSeleccion(new Set()); cargar(0); }, texto ? 350 : 0);
    return () => clearTimeout(t);
  }, [cargar, texto]);

  async function cambiarEnLote(cambios: Record<string, string | boolean | number | null>) {
    const ids = [...seleccion];
    const { data, error } = await supabase.rpc("cambiar_productos", { p_ids: ids, p_cambios: cambios });
    if (error) return avisar(mensajeError(error), "error");
    avisar(`${data} artículos actualizados ✔`);
    setSeleccion(new Set());
    cargar(0);
  }

  async function cambiarUno(f: Fila, cambio: { estado?: EstadoProducto; disponibilidad?: Disponibilidad }) {
    const { error } = await supabase.from("productos").update(cambio).eq("id", f.id);
    if (error) return avisar(mensajeError(error), "error");
    setFilas((fs) => fs.map((x) => (x.id === f.id ? { ...x, ...cambio } : x)));
  }

  const alternar = (id: string) => setSeleccion((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-xl border border-borde bg-white px-3 py-2">
        <IconoBuscar className="size-5 text-suave" />
        <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por nombre o SKU" aria-label="Buscar artículos" className="w-full bg-transparent outline-none" />
      </label>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
        {FILTROS.map((x) => (
          <button key={x.v} role="tab" aria-selected={filtro === x.v} onClick={() => setFiltro(x.v)} className={filtro === x.v ? "chip chip-activo" : "chip"}>{x.t}</button>
        ))}
      </div>

      {seleccion.size > 0 && (
        <div className="sticky top-12 z-20 flex flex-wrap items-center gap-2 rounded-2xl bg-tinta p-2 text-sm text-white md:top-2" data-testid="barra-lote">
          <span className="px-2">{seleccion.size} seleccionado{seleccion.size === 1 ? "" : "s"}</span>
          <button onClick={() => cambiarEnLote({ estado: "publicado" })} className="btn bg-white/15 px-3 py-1">Mostrar</button>
          <button onClick={() => cambiarEnLote({ estado: "borrador" })} className="btn bg-white/15 px-3 py-1">Ocultar</button>
          <button onClick={() => cambiarEnLote({ disponibilidad: "disponible" })} className="btn bg-white/15 px-3 py-1">Disponible</button>
          <button onClick={() => cambiarEnLote({ disponibilidad: "agotado" })} className="btn bg-white/15 px-3 py-1">Agotado</button>
          <select aria-label="Cambiar categoría" className="rounded-full bg-white/15 px-3 py-1" value="" onChange={(e) => e.target.value && cambiarEnLote({ categoria_id: Number(e.target.value) })}>
            <option value="">Categoría…</option>
            {categorias.map((c) => <option key={c.id} value={c.id} className="text-tinta">{c.nombre}</option>)}
          </select>
          <select aria-label="Cambiar marca" className="rounded-full bg-white/15 px-3 py-1" value="" onChange={(e) => e.target.value && cambiarEnLote({ marca_id: Number(e.target.value) })}>
            <option value="">Marca…</option>
            {marcas.map((m) => <option key={m.id} value={m.id} className="text-tinta">{m.nombre}</option>)}
          </select>
          <button onClick={() => setSeleccion(new Set())} className="ml-auto px-2 opacity-80">Cancelar</button>
        </div>
      )}

      <p className="text-sm text-suave">{cargando && filas.length === 0 ? "Cargando…" : `${total.toLocaleString("es-AR")} artículos`}</p>

      <ul className="space-y-2" data-testid="lista-articulos">
        {filas.map((f) => {
          const foto = f.imagenes.slice().sort((a, b) => a.orden - b.orden)[0]?.ruta_thumb;
          return (
            <li key={f.id} className={`flex items-center gap-3 rounded-2xl border bg-white p-2 ${seleccion.has(f.id) ? "border-coral" : "border-borde"} ${f.estado !== "publicado" ? "opacity-60" : ""}`}>
              <input type="checkbox" checked={seleccion.has(f.id)} onChange={() => alternar(f.id)} aria-label={`Seleccionar ${f.nombre}`} className="size-5 shrink-0 accent-coral" />
              <Link href={`/panel/articulos/${f.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlFoto(foto)} alt="" loading="lazy" className="size-14 shrink-0 rounded-xl bg-crema object-contain" />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium leading-tight">{f.nombre}</p>
                  <p className="truncate text-xs text-suave">{f.sku} · {f.marcas?.nombre ?? f.categorias?.nombre}{f.precio !== null ? ` · ${moneda(f.precio)}` : ""}</p>
                  <EstadoChips estado={f.estado} disponibilidad={f.disponibilidad} />
                </div>
              </Link>
              <div className="flex shrink-0 flex-col gap-1">
                <button onClick={() => cambiarUno(f, { estado: f.estado === "publicado" ? "borrador" : "publicado" })} className="btn-claro px-2 py-1 text-xs">
                  {f.estado === "publicado" ? "Ocultar" : "Mostrar"}
                </button>
                <button onClick={() => cambiarUno(f, { disponibilidad: f.disponibilidad === "agotado" ? "disponible" : "agotado" })} className="btn-claro px-2 py-1 text-xs">
                  {f.disponibilidad === "agotado" ? "Hay" : "Agotar"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {filas.length < total && (
        <button onClick={() => cargar(filas.length)} disabled={cargando} className="btn-claro w-full">{cargando ? "Cargando…" : `Cargar más (${total - filas.length})`}</button>
      )}
    </div>
  );
}
