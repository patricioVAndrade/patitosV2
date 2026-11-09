import Link from "next/link";
import type { ItemCatalogo } from "@/lib/supabase/database.types";
import { marcaVisible, moneda, nombreVisible, urlFoto, urlProducto } from "@/lib/formato";
import { BotonWhatsApp } from "./BotonWhatsApp";
import { EtiquetaPrecio } from "./EtiquetaPrecio";
import { SelloNuevo } from "./SelloNuevo";
import { BotonAgregarConsulta } from "./BotonAgregarConsulta";

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
          {agotado && (
            <span className="absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-full bg-azul px-3 py-1 text-sm font-bold text-white">Agotado</span>
          )}
        </Link>
        {p.es_nuevo && !agotado && (
          <div className="absolute -right-2.5 -top-4 z-10">
            <SelloNuevo />
          </div>
        )}
        {oferta && (
          <div className="absolute -bottom-4 left-1 z-10">
            <EtiquetaPrecio precio={p.precio!} anterior={p.precio_anterior} balancea retraso={(indice % 4) * 90} />
          </div>
      )}
      </div>

      <div className={`flex flex-1 flex-col gap-1 px-0.5 ${oferta ? "pt-7" : "pt-2.5"}`}>
        {p.marca && p.marca_slug && (
          <Link href={`/m/${p.marca_slug}`} className="w-fit text-[0.85rem] font-bold text-celeste-texto hover:underline">{marcaVisible(p.marca)}</Link>
        )}
        <Link href={urlProducto(p)} className="line-clamp-3 text-[0.98rem] leading-snug hover:underline">
          {nombre}
        </Link>
        {p.disponibilidad === "pocas" && <span className="text-sm font-bold text-rojo-texto">Últimas unidades</span>}
        {!oferta && p.precio !== null && <span className="text-lg font-bold">{moneda(p.precio)}</span>}
        <div className="mt-auto flex items-center gap-2 pt-2">
          <div className="min-w-0 flex-1"><BotonWhatsApp p={p} compacto /></div>
          <BotonAgregarConsulta item={{ sku: p.sku, nombre: p.nombre, slug: p.slug, ruta_thumb: p.ruta_thumb, agotado, marca: p.marca }} />
        </div>
      </div>
    </article>
  );
}
