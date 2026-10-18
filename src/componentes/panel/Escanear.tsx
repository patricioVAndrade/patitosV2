"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { esCodigoDeBarras, moneda, palabrasBusqueda, urlFoto } from "@/lib/formato";
import { mensajeError } from "@/lib/errores";
import type { Disponibilidad, EstadoProducto } from "@/lib/supabase/database.types";
import { Escaner } from "./Escaner";
import { usePanel } from "./ContextoPanel";
import { IconoEscanear, IconoMas } from "@/componentes/ui/Iconos";
import { EstadoChips } from "./EstadoChips";

interface Resumen {
  id: string;
  sku: string;
  nombre: string;
  precio: number | null;
  estado: EstadoProducto;
  disponibilidad: Disponibilidad;
  categorias: { nombre: string } | null;
  imagenes: { ruta_thumb: string; orden: number }[];
  productos_privado: { costo: number | null } | null;
}

const SELECT_RESUMEN = "id,sku,nombre,precio,estado,disponibilidad,categorias(nombre),imagenes(ruta_thumb,orden),productos_privado(costo)";

export function Escanear({ abrirAlInicio }: { abrirAlInicio: boolean }) {
  const supabase = supabaseNavegador();
  const router = useRouter();
  const { avisar } = usePanel();
  const [camara, setCamara] = useState(abrirAlInicio);
  const [codigo, setCodigo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [producto, setProducto] = useState<Resumen | null>(null);
  const [noEncontrado, setNoEncontrado] = useState<string | null>(null);
  const [continuo, setContinuo] = useState(true);
  const [listo, setListo] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setListo(true);
    try { setContinuo(localStorage.getItem("modoContinuo") !== "0"); } catch { /* sin storage */ }
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus(); // PC con lectora USB
  }, []);

  const procesar = useCallback(async (crudo: string) => {
    const c = crudo.trim().toUpperCase().replace(/\s+/g, "");
    setCamara(false);
    if (!c) return;
    setBuscando(true);
    setProducto(null);
    setNoEncontrado(null);
    const { data, error } = await supabase.rpc("buscar_codigo", { p_codigo: c });
    setBuscando(false);
    if (error) return avisar(mensajeError(error), "error");
    if (data.tipo === "producto") {
      const { data: p, error: e2 } = await supabase.from("productos").select(SELECT_RESUMEN).eq("id", data.producto_id).single();
      if (e2) return avisar(mensajeError(e2), "error");
      setProducto(p as unknown as Resumen);
    } else if (data.tipo === "lista") {
      router.push(`/panel/articulos/nuevo?codigo=${encodeURIComponent(c)}${continuo ? "&continuo=1" : ""}`);
    } else {
      setNoEncontrado(c);
    }
  }, [supabase, avisar, router, continuo]);

  async function cambiar(cambio: { disponibilidad?: Disponibilidad; estado?: EstadoProducto }) {
    if (!producto) return;
    const { data, error } = await supabase.from("productos").update(cambio).eq("id", producto.id).select(SELECT_RESUMEN).single();
    if (error) return avisar(mensajeError(error), "error");
    setProducto(data as unknown as Resumen);
    avisar("Actualizado ✔");
  }

  function alternarContinuo(v: boolean) {
    setContinuo(v);
    try { localStorage.setItem("modoContinuo", v ? "1" : "0"); } catch { /* sin storage */ }
  }

  const foto = producto?.imagenes.slice().sort((a, b) => a.orden - b.orden)[0]?.ruta_thumb;

  return (
    <section className="space-y-3">
      <button onClick={() => setCamara(true)} className="flex w-full flex-col items-center gap-1 rounded-3xl bg-coral py-6 text-lg font-semibold text-white shadow-[0_6px_18px_rgba(255,107,107,0.35)] active:scale-[0.99]">
        <IconoEscanear className="size-10" />
        Escanear con la cámara
      </button>

      <form onSubmit={(e) => { e.preventDefault(); procesar(codigo); setCodigo(""); }} className="flex gap-2">
        <input
          ref={input}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="…o escribí el código / usá una lectora"
          aria-label="Código"
          className="campo"
          autoComplete="off"
          enterKeyHint="search"
        />
        <button className="btn-primario px-5" disabled={buscando || !listo}>{buscando ? "…" : "Buscar"}</button>
      </form>

      <label className="flex items-center gap-2 text-sm text-suave">
        <input type="checkbox" checked={continuo} onChange={(e) => alternarContinuo(e.target.checked)} className="size-4 accent-coral" />
        Modo continuo: después de guardar, vuelve a abrir la cámara
      </label>

      {producto && (
        <div className="tarjeta border-2 border-coral p-3" data-testid="resultado">
          <div className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urlFoto(foto)} alt="" className="size-24 shrink-0 rounded-xl bg-crema object-contain" />
            <div className="min-w-0">
              <p className="font-medium leading-tight">{producto.nombre}</p>
              <p className="text-xs text-suave">{producto.sku} · {producto.categorias?.nombre}{producto.precio !== null ? ` · ${moneda(producto.precio)}` : ""}
                {producto.productos_privado?.costo != null ? ` · costo ${moneda(producto.productos_privado.costo)}` : ""}</p>
              <EstadoChips estado={producto.estado} disponibilidad={producto.disponibilidad} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <button onClick={() => cambiar({ disponibilidad: "disponible" })} className={`btn border ${producto.disponibilidad === "disponible" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-300 text-emerald-700"}`}>Disponible</button>
            <button onClick={() => cambiar({ disponibilidad: "pocas" })} className={`btn border ${producto.disponibilidad === "pocas" ? "border-amber-500 bg-amber-500 text-white" : "border-amber-300 text-amber-700"}`}>Pocas</button>
            <button onClick={() => cambiar({ disponibilidad: "agotado" })} className={`btn border ${producto.disponibilidad === "agotado" ? "border-red-600 bg-red-600 text-white" : "border-red-300 text-red-700"}`}>Agotado</button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <button onClick={() => cambiar({ estado: producto.estado === "publicado" ? "borrador" : "publicado" })} className="btn-claro">
              {producto.estado === "publicado" ? "Ocultar de la web" : "Mostrar en la web"}
            </button>
            <Link href={`/panel/articulos/${producto.id}${continuo ? "?continuo=1" : ""}`} className="btn-primario">Editar / fotos</Link>
          </div>
        </div>
      )}

      {noEncontrado && (
        <NoEncontrado
          codigo={noEncontrado}
          continuo={continuo}
          alAsignar={async (id) => {
            const { error } = await supabase.from("codigos").insert({ codigo: noEncontrado, producto_id: id, tipo: esCodigoDeBarras(noEncontrado) ? "barras" : "legado" });
            if (error) return avisar(mensajeError(error), "error");
            avisar("Código asignado ✔ La próxima vez lo encuentra directo.");
            procesar(noEncontrado);
          }}
        />
      )}

      <Escaner abierto={camara} alLeer={procesar} alCerrar={() => setCamara(false)} />
    </section>
  );
}

function NoEncontrado({ codigo, continuo, alAsignar }: { codigo: string; continuo: boolean; alAsignar: (id: string) => void }) {
  const supabase = supabaseNavegador();
  const [texto, setTexto] = useState("");
  const [opciones, setOpciones] = useState<{ id: string; sku: string; nombre: string }[]>([]);

  useEffect(() => {
    const palabras = palabrasBusqueda(texto).filter((p) => p.length > 1);
    if (!palabras.length) { setOpciones([]); return; }
    const t = setTimeout(async () => {
      let q = supabase.from("productos").select("id,sku,nombre").limit(8);
      for (const p of palabras) q = q.ilike("busqueda", `%${p}%`);
      const { data } = await q;
      setOpciones(data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [texto, supabase]);

  return (
    <div className="tarjeta border-2 border-amber-300 p-4" data-testid="no-encontrado">
      <p className="mb-3">El código <strong className="font-mono">{codigo}</strong> no está cargado.</p>
      <Link href={`/panel/articulos/nuevo?codigo=${encodeURIComponent(codigo)}${continuo ? "&continuo=1" : ""}`} className="btn-primario w-full py-3">
        <IconoMas className="size-5" /> Crear artículo nuevo con este código
      </Link>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-suave">¿Ya está cargado con otro código? Asignale este</summary>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscá por nombre…" className="campo mt-2" aria-label="Buscar artículo para asignar" />
        <ul className="mt-2 space-y-1">
          {opciones.map((o) => (
            <li key={o.id}>
              <button onClick={() => alAsignar(o.id)} className="w-full rounded-xl border border-borde bg-white px-3 py-2 text-left text-sm hover:border-coral">
                {o.nombre} <span className="text-suave">· {o.sku}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
