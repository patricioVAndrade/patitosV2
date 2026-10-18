import { NextResponse, type NextRequest } from "next/server";
import { buscarCatalogo, leerFiltros } from "@/lib/catalogo";

export async function GET(req: NextRequest) {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const filtros = { ...leerFiltros(sp), categoria: sp.cat || undefined };
  try {
    return NextResponse.json(await buscarCatalogo(filtros));
  } catch {
    return NextResponse.json({ error: "No se pudo leer el catálogo" }, { status: 502 });
  }
}
