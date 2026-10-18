import Link from "next/link";
import type { ItemCatalogo } from "@/lib/supabase/database.types";
import { marcaVisible, moneda, nombreVisible, urlFoto, urlProducto } from "@/lib/formato";
import { BotonWhatsApp } from "./BotonWhatsApp";
import { EtiquetaPrecio } from "./EtiquetaPrecio";

export function TarjetaProducto({ p, indice = 0, prioridad = false }: { p: ItemCatalogo; indice?: number; prioridad?: boolean }) {
  const agotado = p.disponibilidad === "agotado";
  const nombre = nombreVisible(p.nombre, p.marca);
  const oferta = p.en_oferta && p.precio !== null && !agotado;
  return (
    <article className="flex min-w-0 flex-col" data-sku={p.sku}>
      <div className="relative">
        <Link
          href={urlProducto(p)}
          className="relative block aspect-square overflow-hidden rounded-[1.25rem] border-2 border-linea bg-white p-3 transition-colors hover:border-azul"
          tabIndex={-1}
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urlFoto(p.ruta_thumb)}
            alt=""
            loading={prioridad ? "eager" : "lazy"}
            decoding="async"
            className={`size-full object-contain ${agotado ? "opacity-40 grayscale" : ""}`}
          />
          {p.es_nuevo && !agotado && (
            <span className="absolute left-2 top-2 rounded-full bg-celeste px-2.5 py-0.5 text-[0.8rem] font-bold text-azul">Nuevo</span>
          )}
          {agotado && (
            <span className="absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-full bg-azul px-3 py-1 text-sm font-bold text-white">Agotado</span>
          )}
        </Link>
        {oferta && (
          <div className="absolute -bottom-4 left-1 z-10">
            <EtiquetaPrecio precio={p.precio!} anterior={p.precio_anterior} balancea retraso={(indice % 4) * 90} />
          </div>
      )}
      </div>

      <div className={`flex flex-1 flex-col gap-1 px-0.5 ${oferta ? "pt-7" : "pt-2.5"}`}>
        {p.marca && <span className="text-[0.85rem] font-bold text-celeste-texto">{marcaVisible(p.marca)}</span>}
        <Link href={urlProducto(p)} className="line-clamp-3 text-[0.98rem] leading-snug hover:underline">
          {nombre}
        </Link>
        {p.disponibilidad === "pocas" && <span className="text-sm font-bold text-rojo-texto">Últimas unidades</span>}
        {!oferta && p.precio !== null && <span className="text-lg font-bold">{moneda(p.precio)}</span>}
        <div className="mt-auto pt-2">
          <BotonWhatsApp p={p} compacto />
        </div>
      </div>
    </article>
  );
}
