"use client";
import { useState } from "react";
import { urlFoto } from "@/lib/formato";

export function Galeria({ imagenes, nombre, agotado }: { imagenes: { thumb: string; full: string }[]; nombre: string; agotado: boolean }) {
  const [actual, setActual] = useState(0);
  const foto = imagenes[actual];
  return (
    <div>
      <div className={`relative aspect-square overflow-hidden rounded-3xl border border-borde bg-white p-4 ${agotado ? "grayscale" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foto ? urlFoto(foto.full) : "/sin-foto.svg"} alt={nombre} className="size-full object-contain" />
      </div>
      {imagenes.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {imagenes.map((img, i) => (
            <button
              key={img.thumb}
              onClick={() => setActual(i)}
              aria-label={`Foto ${i + 1}`}
              className={`size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white p-1 ${i === actual ? "border-coral" : "border-borde"}`}
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
