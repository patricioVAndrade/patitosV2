"use client";
import { useEffect, useRef, useState } from "react";
import type { ItemCatalogo } from "@/lib/supabase/database.types";
import { TarjetaProducto } from "./TarjetaProducto";

interface Props {
  iniciales: ItemCatalogo[];
  total: number;
  porPagina: number;
  paginaInicial: number;
  consulta: { q?: string; cat?: string; marca?: string; f?: string };
}

export function ListaProductos({ iniciales, total, porPagina, paginaInicial, consulta }: Props) {
  const [items, setItems] = useState(iniciales);
  const [pagina, setPagina] = useState(paginaInicial);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const centinela = useRef<HTMLDivElement>(null);
  const quedan = total - ((paginaInicial - 1) * porPagina + items.length);

  async function verMas() {
    if (cargando || quedan <= 0) return;
    setCargando(true);
    setError(false);
    try {
      const p = new URLSearchParams();
      Object.entries(consulta).forEach(([k, v]) => v && p.set(k, v));
      p.set("pag", String(pagina + 1));
      const r = await fetch(`/api/catalogo?${p}`);
      if (!r.ok) throw new Error();
      const datos = (await r.json()) as { items: ItemCatalogo[] };
      setItems((prev) => [...prev, ...datos.items.filter((n) => !prev.some((x) => x.id === n.id))]);
      setPagina((n) => n + 1);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const el = centinela.current;
    if (!el) return;
    const obs = new IntersectionObserver((e) => e[0]?.isIntersecting && verMas(), { rootMargin: "800px" });
    obs.observe(el);
    return () => obs.disconnect();
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((p, i) => <TarjetaProducto key={p.id} p={p} indice={i} />)}
      </div>
      <div ref={centinela} className="mt-6 text-center">
        {quedan > 0 && (
          <button onClick={verMas} disabled={cargando} className="btn-claro border-coral text-coral">
            {cargando ? "Cargando…" : error ? "Reintentar" : `Ver más (${quedan})`}
          </button>
        )}
        {/* Paginación clásica para buscadores y navegadores sin JavaScript */}
        <noscript>
          {quedan > 0 && <a href={`?pag=${paginaInicial + 1}`}>Página siguiente</a>}
        </noscript>
      </div>
    </>
  );
}
