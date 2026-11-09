import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/componentes/ui/Logo";
import { Buscador } from "@/componentes/tienda/Buscador";
import { NavCategorias } from "@/componentes/tienda/NavCategorias";
import { Pie } from "@/componentes/tienda/Pie";
import { BarraConsulta } from "@/componentes/tienda/BarraConsulta";
import { categoriasConArticulos, hayOfertasYNovedades } from "@/lib/catalogo";

export default async function TiendaLayout({ children }: { children: React.ReactNode }) {
  const [categorias, especiales] = await Promise.all([categoriasConArticulos(), hayOfertasYNovedades()]);
  return (
    <div className="tienda flex min-h-dvh flex-col">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-full focus:bg-azul focus:px-4 focus:py-2 focus:text-white">
        Ir al contenido
      </a>
      <header className="sticky top-0 z-30 border-b-2 border-linea bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:gap-6 sm:py-2.5">
          <Link href="/" aria-label="Patito's: ir al inicio" className="shrink-0">
            <span className="block sm:hidden"><Logo alto={38} /></span>
            <span className="hidden sm:block"><Logo alto={52} /></span>
          </Link>
          <Suspense fallback={<div className="h-11 flex-1 rounded-full border-2 border-linea" />}>
            <Buscador />
          </Suspense>
        </div>
      </header>
      <Suspense>
        <NavCategorias
          categorias={categorias.map((c) => ({ slug: c.slug, nombre: c.nombre }))}
          hayOfertas={especiales.ofertas}
          hayNovedades={especiales.nuevos}
        />
      </Suspense>
      <main id="contenido" className="flex-1">{children}</main>
      <Pie />
      <BarraConsulta />
    </div>
  );
}
