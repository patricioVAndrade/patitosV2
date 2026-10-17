import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { fichaProducto } from "@/lib/catalogo";
import { edadTexto, moneda, urlFoto, urlProducto } from "@/lib/formato";
import { env } from "@/lib/env";
import { negocio } from "@/lib/negocio";
import { Galeria } from "@/componentes/tienda/Galeria";
import { BotonWhatsApp } from "@/componentes/tienda/BotonWhatsApp";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ sku: string; slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sku } = await params;
  const p = await fichaProducto(decodeURIComponent(sku));
  if (!p) return { title: "Artículo no encontrado" };
  return {
    title: p.nombre,
    description: `${p.nombre} — ${p.categoria}. Consultá disponibilidad en ${negocio.nombre}, Coronel Moldes.`,
    alternates: { canonical: urlProducto(p) },
    openGraph: { title: p.nombre, images: p.ruta_full ? [urlFoto(p.ruta_full)] : [] },
  };
}

export default async function FichaProducto({ params }: Props) {
  const { sku, slug } = await params;
  const p = await fichaProducto(decodeURIComponent(sku));
  if (!p) notFound();
  // Si cambió el nombre, el link viejo redirige al nuevo (el SKU no cambia nunca)
  if ((slug?.[0] ?? "") !== p.slug) permanentRedirect(urlProducto(p));

  const edad = edadTexto(p.edad_desde_meses, p.edad_hasta_meses);
  const disponibilidad = { disponible: "En stock", pocas: "¡Últimas unidades!", agotado: "Agotado" }[p.disponibilidad];
  const datosEstructurados = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.nombre,
    sku: p.sku,
    image: p.imagenes.map((i) => urlFoto(i.full)),
    brand: p.marca ? { "@type": "Brand", name: p.marca } : undefined,
    category: p.categoria,
    description: p.descripcion ?? undefined,
    offers: {
      "@type": "Offer",
      url: `${env.sitioUrl}${urlProducto(p)}`,
      priceCurrency: "ARS",
      price: p.precio ?? undefined,
      availability: p.disponibilidad === "agotado" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };

  return (
    <article className="mx-auto max-w-4xl">
      <nav className="mb-3 text-sm text-suave">
        <Link href="/" className="hover:underline">Catálogo</Link> ›{" "}
        <Link href={`/c/${p.categoria_slug}`} className="hover:underline">{p.categoria}</Link>
      </nav>
      <div className="grid gap-6 md:grid-cols-2">
        <Galeria imagenes={p.imagenes} nombre={p.nombre} agotado={p.disponibilidad === "agotado"} />
        <div className="flex flex-col gap-3">
          {p.marca && <span className="text-sm font-semibold uppercase tracking-wide text-suave">{p.marca}</span>}
          <h1 className="text-2xl font-semibold leading-tight">{p.nombre}</h1>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className={`rounded-full px-3 py-0.5 font-medium ${p.disponibilidad === "agotado" ? "bg-red-100 text-red-800" : p.disponibilidad === "pocas" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
              {disponibilidad}
            </span>
            {p.es_nuevo && <span className="rounded-full bg-amber-200 px-3 py-0.5 font-medium text-amber-900">¡Nuevo!</span>}
            {p.en_oferta && <span className="rounded-full bg-coral px-3 py-0.5 font-medium text-white">Oferta 🔥</span>}
            {edad && <span className="rounded-full bg-sky-100 px-3 py-0.5 font-medium text-sky-800">{edad}</span>}
          </div>
          {p.precio !== null && (
            <p className="flex items-baseline gap-3">
              <span className={`text-3xl font-semibold ${p.en_oferta ? "text-coral" : ""}`}>{moneda(p.precio)}</span>
              {p.precio_anterior !== null && <span className="text-lg text-suave line-through">{moneda(p.precio_anterior)}</span>}
            </p>
          )}
          {p.descripcion && <p className="whitespace-pre-line text-suave">{p.descripcion}</p>}
          <BotonWhatsApp p={p} />
          <p className="text-xs text-suave">Código: {p.sku}</p>
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados).replace(/</g, "\\u003c") }} />
    </article>
  );
}
