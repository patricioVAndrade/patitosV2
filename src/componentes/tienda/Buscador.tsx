"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconoBuscar, IconoCerrar } from "@/componentes/ui/Iconos";

/** Buscador del encabezado. En una ficha de artículo, buscar lleva al catálogo con los resultados. */
export function Buscador() {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const [texto, setTexto] = useState(params.get("q") ?? "");
  const escribiendo = useRef(false);

  // Si la URL cambia por otro lado (un link, volver atrás), el campo la acompaña
  useEffect(() => {
    if (!escribiendo.current) setTexto(params.get("q") ?? "");
  }, [params]);

  useEffect(() => {
    if (!escribiendo.current) return;
    const t = setTimeout(() => {
      escribiendo.current = false;
      const enFicha = ruta.startsWith("/p/");
      const p = new URLSearchParams(enFicha ? "" : params.toString());
      if (texto.trim()) p.set("q", texto.trim()); else p.delete("q");
      p.delete("pag");
      const destino = `${enFicha ? "/" : ruta}${p.size ? `?${p}` : ""}`;
      if (enFicha) router.push(destino); else router.replace(destino, { scroll: false });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  return (
    <form role="search" className="min-w-0 flex-1" onSubmit={(e) => e.preventDefault()}>
      <label className="flex items-center gap-2 rounded-full border-2 border-linea bg-white px-3.5 py-2 transition-colors focus-within:border-azul sm:px-4 sm:py-2.5">
        <IconoBuscar className="size-5 shrink-0 text-gris" />
        <input
          type="search"
          value={texto}
          onChange={(e) => { escribiendo.current = true; setTexto(e.target.value); }}
          placeholder="Buscar en el catálogo"
          aria-label="Buscar en el catálogo"
          className="w-full min-w-0 bg-transparent text-base text-azul outline-none placeholder:text-gris [&::-webkit-search-cancel-button]:hidden"
          enterKeyHint="search"
        />
        {texto && (
          <button type="button" onClick={() => { escribiendo.current = true; setTexto(""); }} aria-label="Borrar búsqueda" className="shrink-0 rounded-full p-0.5 text-gris hover:text-azul">
            <IconoCerrar className="size-4" />
          </button>
        )}
      </label>
    </form>
  );
}
