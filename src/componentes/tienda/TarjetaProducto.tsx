import Link from "next/link";
import type { ItemCatalogo } from "@/lib/supabase/database.types";
import { moneda, urlFoto, urlProducto } from "@/lib/formato";
import { BotonWhatsApp } from "./BotonWhatsApp";

const bordes = ["border-tema-0", "border-tema-1", "border-tema-2", "border-tema-3"];

export function TarjetaProducto({ p, indice }: { p: ItemCatalogo; indice: number }) {
  const agotado = p.disponibilidad === "agotado";
  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white ${bordes[indice % 4]} ${agotado ? "opacity-70 grayscale" : ""}`}
      data-sku={p.sku}
    >
      {p.es_nuevo && !agotado && (
        <span className="absolute right-0 top-3 z-10 rounded-l-full bg-amber-300 px-3 py-0.5 text-xs font-semibold text-amber-900">¡NUEVO!</span>
      )}
      <Link href={urlProducto(p)} className="relative block aspect-square bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={urlFoto(p.ruta_thumb)} alt={p.nombre} loading="lazy" decoding="async" className="size-full object-contain" />
        {agotado && (
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 -rotate-6 bg-tinta/85 py-1 text-center text-xs font-semibold tracking-[0.2em] text-white">
            AGOTADO
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3 pt-1">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-suave">{p.marca ?? p.categoria}</span>
        <Link href={urlProducto(p)} className="line-clamp-3 text-sm font-medium leading-snug">{p.nombre}</Link>
        {p.disponibilidad === "pocas" && <span className="w-fit rounded-full bg-amber-100 px-2 text-xs font-medium text-amber-800">¡Últimas unidades!</span>}
        <div className="mt-auto pt-2">
          {p.precio !== null && (
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
              <span className={`text-lg font-semibold ${p.en_oferta ? "text-coral" : ""}`}>{moneda(p.precio)}</span>
              {p.precio_anterior !== null && <span className="text-sm text-suave line-through">{moneda(p.precio_anterior)}</span>}
            </div>
          )}
          {p.en_oferta && p.precio === null && <span className="mb-2 inline-block rounded-full bg-coral px-2 text-xs font-semibold text-white">OFERTA 🔥</span>}
          <BotonWhatsApp p={p} compacto />
        </div>
      </div>
    </article>
  );
}
