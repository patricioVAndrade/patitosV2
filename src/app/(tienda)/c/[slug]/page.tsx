import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Catalogo } from "@/componentes/tienda/Catalogo";
import { categoriasConArticulos, leerFiltros } from "@/lib/catalogo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = (await categoriasConArticulos()).find((c) => c.slug === slug);
  return cat ? { title: cat.nombre, alternates: { canonical: `/c/${slug}` } } : {};
}

export default async function PaginaCategoria({ params, searchParams }: Props) {
  const { slug } = await params;
  const existe = (await categoriasConArticulos()).some((c) => c.slug === slug);
  if (!existe) notFound();
  return <Catalogo filtros={{ ...leerFiltros(await searchParams), categoria: slug }} />;
}
