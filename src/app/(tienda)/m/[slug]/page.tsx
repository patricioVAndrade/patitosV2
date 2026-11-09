import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Catalogo } from "@/componentes/tienda/Catalogo";
import { leerFiltros, marcaPorSlug } from "@/lib/catalogo";
import { marcaVisible } from "@/lib/formato";
import { negocio } from "@/lib/negocio";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const marca = await marcaPorSlug(slug);
  if (!marca) return {};
  const nombre = marcaVisible(marca.nombre);
  return {
    title: `${nombre} en Coronel Moldes`,
    description: `${marca.cantidad} artículos ${nombre} en ${negocio.nombre}, Coronel Moldes. Consultá disponibilidad por WhatsApp.`,
    alternates: { canonical: `/m/${slug}` },
  };
}

export default async function PaginaMarca({ params, searchParams }: Props) {
  const { slug } = await params;
  const marca = await marcaPorSlug(slug);
  if (!marca) notFound();
  return <Catalogo filtros={{ ...leerFiltros(await searchParams), marca: slug }} titulo={marcaVisible(marca.nombre)} />;
}
