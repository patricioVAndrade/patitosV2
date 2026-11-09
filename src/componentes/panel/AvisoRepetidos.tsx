"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { urlFoto } from "@/lib/formato";
import type { FichaCorta } from "@/lib/supabase/database.types";

type Parecido = FichaCorta & { porNombre: boolean; porFoto: boolean };

/**
 * "¿Ya está cargado?": mientras se carga un artículo, busca otros con un nombre casi igual
 * (y los mismos números: 9″ ≠ 11″) o con una foto casi igual. No bloquea nada: avisa.
 */
export function AvisoRepetidos({ nombre, huellas, excluir, compacto = false }: { nombre: string; huellas: string[]; excluir?: string | null; compacto?: boolean }) {
  const [parecidos, setParecidos] = useState<Parecido[]>([]);
  const [descartados, setDescartados] = useState<Set<string>>(new Set());
  const clave = huellas.join(",");

  useEffect(() => {
    const texto = nombre.trim();
    if (texto.length < 6 && !huellas.length) { setParecidos([]); return; }
    const t = setTimeout(async () => {
      const supabase = supabaseNavegador();
      const [porNombre, porFoto] = await Promise.all([
        texto.length >= 6 ? supabase.rpc("posibles_repetidos", { p_nombre: texto, p_excluir: excluir ?? null }) : Promise.resolve({ data: [] as FichaCorta[] }),
        huellas.length ? supabase.rpc("fotos_parecidas", { p_huellas: huellas, p_excluir: excluir ?? null }) : Promise.resolve({ data: [] as FichaCorta[] }),
      ]);
      const mapa = new Map<string, Parecido>();
      for (const f of porFoto.data ?? []) mapa.set(f.id, { ...f, porNombre: false, porFoto: true });
      for (const n of porNombre.data ?? []) {
        const ya = mapa.get(n.id);
        mapa.set(n.id, ya ? { ...ya, porNombre: true } : { ...n, porNombre: true, porFoto: false });
      }
      setParecidos([...mapa.values()].slice(0, 3));
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre, clave, excluir]);

  const visibles = parecidos.filter((p) => !descartados.has(p.id));
  if (!visibles.length) return null;

  return (
    <div className={`rounded-xl border border-amber-300 bg-amber-50 ${compacto ? "p-2 text-xs" : "p-3 text-sm"}`} role="status" data-testid="aviso-repetidos">
      <p className="mb-1.5 font-semibold text-amber-900">¿Ya está cargado?</p>
      <ul className="space-y-1.5">
        {visibles.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urlFoto(p.ruta_thumb)} alt="" className={`${compacto ? "size-8" : "size-11"} shrink-0 rounded-lg bg-white object-contain`} />
            <div className="min-w-0 flex-1">
              <a href={`/panel/articulos/${p.id}`} target="_blank" rel="noopener" className="line-clamp-2 font-medium leading-tight text-amber-950 underline-offset-2 hover:underline">
                {p.nombre}
              </a>
              <p className="text-[0.7rem] text-amber-800">
                {p.sku}
                {p.estado !== "publicado" ? " · oculto" : ""}
                {p.porFoto && p.porNombre ? " · misma foto y nombre parecido" : p.porFoto ? " · foto casi igual" : " · nombre parecido"}
              </p>
            </div>
            <button type="button" onClick={() => setDescartados((d) => new Set(d).add(p.id))} className="shrink-0 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[0.7rem] text-amber-900">
              Es otro
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
