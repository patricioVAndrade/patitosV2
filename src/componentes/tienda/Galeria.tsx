"use client";
import { useState } from "react";
import { urlFoto } from "@/lib/formato";

export function Galeria({ imagenes, nombre, agotado, nuevo = false }: { imagenes: { thumb: string; full: string }[]; nombre: string; agotado: boolean; nuevo?: boolean }) {
  const [actual, setActual] = useState(0);
  const foto = imagenes[actual];
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-[1.5rem] border-2 border-linea bg-white p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foto ? urlFoto(foto.full) : "/sin-foto.svg"} alt={nombre} className={`size-full object-contain ${agotado ? "opacity-50 grayscale" : ""}`} />
        {nuevo && !agotado && (
          <span className="absolute left-3 top-3 rounded-full bg-celeste px-3 py-1 font-bold text-azul">Nuevo</span>
        )}
      </div>
      {imagenes.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {imagenes.map((img, i) => (
            <button
              key={img.thumb}
              onClick={() => setActual(i)}
              aria-label={`Ver foto ${i + 1} de ${imagenes.length}`}
              aria-pressed={i === actual}
              className={`size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white p-1 transition-colors sm:size-20 ${i === actual ? "border-azul" : "border-linea hover:border-gris"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlFoto(img.thumb)} alt="" className="size-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
