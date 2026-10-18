"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

type Cat = { slug: string; nombre: string };

/** Fila de categorías debajo del encabezado. Marca la actual y conserva la búsqueda. */
export function NavCategorias({ categorias, hayOfertas, hayNovedades }: { categorias: Cat[]; hayOfertas: boolean; hayNovedades: boolean }) {
  const ruta = usePathname();
  const params = useSearchParams();
  const q = params.get("q");
  const f = params.get("f");
  const conQ = (base: string, filtro?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (filtro) p.set("f", filtro);
    return p.size ? `${base}?${p}` : base;
  };
  const clase = (activo: boolean) => (activo ? "chip-tienda chip-tienda-activo" : "chip-tienda");
  const enInicio = ruta === "/";
  const fila = useRef<HTMLDivElement>(null);

  // En el celular, que la categoría actual quede a la vista en la fila
  useEffect(() => {
    const contenedor = fila.current;
    const activo = contenedor?.querySelector<HTMLElement>(".chip-tienda-activo");
    if (!contenedor || !activo) return;
    const caja = contenedor.getBoundingClientRect();
    const chip = activo.getBoundingClientRect();
    if (chip.right > caja.right || chip.left < caja.left) {
      contenedor.scrollTo({ left: contenedor.scrollLeft + chip.left - caja.left - 16 });
    }
  }, [ruta, f]);

  return (
    <nav aria-label="Categorías" className="border-b-2 border-linea bg-white">
      <div ref={fila} className="estante mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2.5">
        <Link href={conQ("/")} className={clase(enInicio && !f)} aria-current={enInicio && !f ? "page" : undefined}>Inicio</Link>
        {hayOfertas && <Link href={conQ("/", "ofertas")} className={clase(enInicio && f === "ofertas")}>Ofertas</Link>}
        {hayNovedades && <Link href={conQ("/", "nuevos")} className={clase(enInicio && f === "nuevos")}>Recién llegados</Link>}
        {categorias.map((c) => {
          const activo = ruta === `/c/${c.slug}`;
          return (
            <Link key={c.slug} href={conQ(`/c/${c.slug}`)} className={clase(activo)} aria-current={activo ? "page" : undefined}>
              {c.nombre}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
