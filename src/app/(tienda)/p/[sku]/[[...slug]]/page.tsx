import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { fichaProducto, relacionados } from "@/lib/catalogo";
import { edadTexto, marcaVisible, moneda, nombreVisible, urlFoto, urlProducto } from "@/lib/formato";
import { env } from "@/lib/env";
import { negocio } from "@/lib/negocio";
import { Galeria } from "@/componentes/tienda/Galeria";
import { BotonWhatsApp } from "@/componentes/tienda/BotonWhatsApp";
import { EtiquetaPrecio } from "@/componentes/tienda/EtiquetaPrecio";
import { Estante } from "@/componentes/tienda/Estante";
import { BotonAgregarConsulta } from "@/componentes/tienda/BotonAgregarConsulta";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ sku: string; slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sku } = await params;
  const p = await fichaProducto(decodeURIComponent(sku));
  if (!p) return { title: "Artículo no encontrado" };
  const nombre = nombreVisible(p.nombre, p.marca);
  return {
    title: nombre,
    description: `${nombre}, en ${p.categoria}. Consultá disponibilidad en ${negocio.nombre}, Coronel Moldes.`,
    alternates: { canonical: urlProducto(p) },
    openGraph: { title: nombre, images: p.ruta_full ? [urlFoto(p.ruta_full)] : [] },
  };
}

const ESTADO = {
  disponible: { texto: "Hay en el local", punto: "bg-wa" },
  pocas: { texto: "Quedan pocas unidades", punto: "bg-rojo" },
  agotado: { texto: "Agotado por ahora", punto: "bg-gris" },
} as const;

export default async function FichaProducto({ params }: Props) {
  const { sku, slug } = await params;
  const p = await fichaProducto(decodeURIComponent(sku));
  if (!p) notFound();
  // Si cambió el nombre, el link viejo redirige al nuevo (el SKU no cambia nunca)
  if ((slug?.[0] ?? "") !== p.slug) permanentRedirect(urlProducto(p));

  const otros = await relacionados(p.categoria_slug, p.sku);
  const nombre = nombreVisible(p.nombre, p.marca);
  const edad = edadTexto(p.edad_desde_meses, p.edad_hasta_meses);
  const agotado = p.disponibilidad === "agotado";
  const oferta = p.en_oferta && p.precio !== null && !agotado;
  const estado = ESTADO[p.disponibilidad];
  const datosEstructurados = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: nombre,
    sku: p.sku,
    image: p.imagenes.map((i) => urlFoto(i.full)),
    brand: p.marca ? { "@type": "Brand", name: marcaVisible(p.marca) } : undefined,
    category: p.categoria,
    description: p.descripcion ?? undefined,
    offers: {
      "@type": "Offer",
      url: `${env.sitioUrl}${urlProducto(p)}`,
      priceCurrency: "ARS",
      price: p.precio ?? undefined,
      availability: agotado ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };

  return (
    <>
      <article className="mx-auto max-w-6xl px-4 pt-5">
        <nav aria-label="Ubicación" className="mb-4 text-sm text-gris">
          <ol className="flex flex-wrap gap-x-2">
            <li><Link href="/" className="underline-offset-4 hover:underline">Inicio</Link></li>
            <li aria-hidden>/</li>
            <li><Link href={`/c/${p.categoria_slug}`} className="underline-offset-4 hover:underline">{p.categoria}</Link></li>
          </ol>
        </nav>

        <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:gap-12">
          <Galeria imagenes={p.imagenes} nombre={nombre} agotado={agotado} nuevo={p.es_nuevo} />

          <div className="flex flex-col gap-4 md:pt-2">
            <div>
              {p.marca && (p.marca_slug
                ? <Link href={`/m/${p.marca_slug}`} className="font-bold text-celeste-texto hover:underline">{marcaVisible(p.marca)}</Link>
                : <p className="font-bold text-celeste-texto">{marcaVisible(p.marca)}</p>)}
              <h1 className="text-[1.6rem] font-bold leading-tight sm:text-[2rem]">{nombre}</h1>
            </div>

            <p className="flex items-center gap-2 font-bold">
              <span className={`size-3 rounded-full ${estado.punto}`} aria-hidden />
              {estado.texto}
            </p>

            {oferta ? (
              <div className="py-2 pl-1">
                <EtiquetaPrecio precio={p.precio!} anterior={p.precio_anterior} grande balancea />
              </div>
            ) : p.precio !== null ? (
              <p className="text-3xl font-bold">{moneda(p.precio)}</p>
            ) : (
              <p className="text-gris">Consultanos el precio por WhatsApp.</p>
            )}

            {(p.variantes || edad) && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-[1.25rem] bg-celeste-claro px-4 py-3">
                {p.variantes && (<><dt className="font-bold">Colores / modelos</dt><dd>{p.variantes}</dd></>)}
                {edad && (<><dt className="font-bold">Edad</dt><dd>{edad}</dd></>)}
              </dl>
            )}

            {p.descripcion && <p className="whitespace-pre-line leading-relaxed">{p.descripcion}</p>}

            <div className="mt-1">
              <BotonWhatsApp p={p} />
              <div className="mt-2">
                <BotonAgregarConsulta grande item={{ sku: p.sku, nombre: p.nombre, slug: p.slug, ruta_thumb: p.imagenes[0]?.thumb ?? null, agotado, marca: p.marca }} />
              </div>
              <p className="mt-2 text-center text-sm text-gris">
                {agotado ? "Te escribimos cuando vuelva a entrar." : "Te respondemos en el horario del local."}
              </p>
            </div>

            <div className="rounded-[1.25rem] border-2 border-linea px-4 py-3 text-[0.95rem]">
              <p className="font-bold">Retiralo en el local</p>
              <p className="text-gris">{negocio.direccion}</p>
              <p className="text-gris">{negocio.horarios}</p>
            </div>

            <p className="text-sm text-gris">Código del artículo: {p.sku}</p>
          </div>
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados).replace(/</g, "\\u003c") }} />
      </article>

      {otros.length > 0 && (
        <section aria-labelledby="t-mas" className="mx-auto mt-14 max-w-6xl px-4">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 id="t-mas" className="titulo-seccion">Más de {p.categoria}</h2>
            <Link href={`/c/${p.categoria_slug}`} className="shrink-0 pb-1 font-bold underline decoration-2 underline-offset-4 hover:text-celeste-texto">
              Ver todo
            </Link>
          </div>
          <Estante items={otros} etiqueta={`Más de ${p.categoria}`} />
        </section>
      )}
    </>
  );
}
