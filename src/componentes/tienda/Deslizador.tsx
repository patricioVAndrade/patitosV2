"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconoFlechaDer, IconoFlechaIzq } from "@/componentes/ui/Iconos";

/**
 * Fila que se desliza con el dedo, con una barra y flechas debajo que muestran
 * que hay más para ver (y permiten avanzar tocando, para quien no desliza).
 * En pantallas grandes (lg) se muestra como grilla y la barra se oculta.
 */
export function Deslizador({ children, etiqueta }: { children: React.ReactNode; etiqueta: string }) {
  const fila = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState({ inicio: 0, ancho: 1, alInicio: true, alFinal: false });

  const medir = useCallback(() => {
    const el = fila.current;
    if (!el) return;
    const total = el.scrollWidth || 1;
    setPos({
      inicio: el.scrollLeft / total,
      ancho: Math.min(1, el.clientWidth / total),
      alInicio: el.scrollLeft <= 4,
      alFinal: el.scrollLeft + el.clientWidth >= total - 4,
    });
  }, []);

  useEffect(() => {
    medir();
    const el = fila.current;
    if (!el) return;
    el.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      el.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, [medir]);

  function mover(sentido: 1 | -1) {
    const el = fila.current;
    if (!el) return;
    el.scrollBy({ left: sentido * el.clientWidth * 0.85, behavior: "smooth" });
  }

  const hayMas = pos.ancho < 0.999;
  const flecha = "grid size-10 shrink-0 place-items-center rounded-full border-2 border-azul bg-white text-azul transition disabled:border-linea disabled:text-linea";

  return (
    <div>
      <ul ref={fila} aria-label={etiqueta} className="estante -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 pt-5 sm:gap-4 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
        {children}
      </ul>
      {hayMas && (
        <div className="mt-4 flex items-center gap-3 lg:hidden">
          <button type="button" onClick={() => mover(-1)} disabled={pos.alInicio} aria-label="Ver los anteriores" className={flecha}>
            <IconoFlechaIzq className="size-5" />
          </button>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-azul/12" aria-hidden>
            <div
              className="absolute inset-y-0 rounded-full bg-azul transition-[left] duration-150"
              style={{ left: `${pos.inicio * 100}%`, width: `${Math.max(pos.ancho * 100, 12)}%` }}
            />
          </div>
          <button type="button" onClick={() => mover(1)} disabled={pos.alFinal} aria-label="Ver más" className={flecha}>
            <IconoFlechaDer className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
