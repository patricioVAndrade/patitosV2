import Link from "next/link";
import { Suspense } from "react";
import { buscarCatalogo, categoriasConArticulos, hayOfertasYNovedades, POR_PAGINA, type FiltrosCatalogo } from "@/lib/catalogo";
import { Buscador } from "./Buscador";
import { ListaProductos } from "./ListaProductos";

export async function Catalogo({ filtros }: { filtros: FiltrosCatalogo }) {
  const [{ items, total }, categorias, especiales] = await Promise.all([
    buscarCatalogo(filtros),
    categoriasConArticulos(),
    hayOfertasYNovedades(),
  ]);

  const base = filtros.categoria ? `/c/${filtros.categoria}` : "/";
  const conQ = (ruta: string, extra?: string) => {
    const p = new URLSearchParams();
    if (filtros.q) p.set("q", filtros.q);
    if (extra) p.set("f", extra);
    const s = p.toString();
    return s ? `${ruta}?${s}` : ruta;
  };
  const activo = (cond: boolean) => (cond ? "chip chip-activo" : "chip");

  return (
    <div>
      <Suspense>
        <Buscador inicial={filtros.q ?? ""} />
      </Suspense>

      <nav aria-label="Categorías" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href={conQ("/")} className={activo(!filtros.categoria && !filtros.filtro)}>Todo</Link>
        {especiales.ofertas && <Link href={conQ(base, "ofertas")} className={activo(filtros.filtro === "ofertas")}>🔥 Ofertas</Link>}
        {especiales.nuevos && <Link href={conQ(base, "nuevos")} className={activo(filtros.filtro === "nuevos")}>🆕 Novedades</Link>}
        {categorias.map((c) => (
          <Link key={c.slug} href={conQ(`/c/${c.slug}`)} className={activo(filtros.categoria === c.slug && !filtros.filtro)}>
            {c.nombre}
          </Link>
        ))}
      </nav>

      <p className="mb-3 text-center text-sm text-suave" aria-live="polite">
        {total === 0 ? "" : `${total.toLocaleString("es-AR")} artículo${total === 1 ? "" : "s"}`}
      </p>

      {total === 0 ? (
        <div className="py-16 text-center text-suave">
          <p className="text-4xl">🧸</p>
          <p className="mt-2">No encontramos artículos{filtros.q ? ` para "${filtros.q}"` : ""}.</p>
          <p>¡Consultanos por WhatsApp igual!</p>
        </div>
      ) : (
        <ListaProductos
          key={JSON.stringify(filtros)}
          iniciales={items}
          total={total}
          porPagina={POR_PAGINA}
          paginaInicial={filtros.pagina ?? 1}
          consulta={{ q: filtros.q, cat: filtros.categoria, marca: filtros.marca, f: filtros.filtro }}
        />
      )}
    </div>
  );
}
