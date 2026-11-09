import Link from "next/link";
import {
  buscarCatalogo, categoriasConArticulos, categoriasConFoto, marcasConArticulos, novedades, ofertas, POR_PAGINA, type FiltrosCatalogo,
} from "@/lib/catalogo";
import { marcaVisible, urlFoto } from "@/lib/formato";
import { ListaProductos } from "./ListaProductos";
import { TarjetaProducto } from "./TarjetaProducto";
import { Estante } from "./Estante";

const cantidad = (n: number) => `${n.toLocaleString("es-AR")} artículo${n === 1 ? "" : "s"}`;

/** Inicio sin filtros: vidriera (recién llegados → ofertas → categorías → todo). Con filtros: resultados. */
export async function Catalogo({ filtros, titulo }: { filtros: FiltrosCatalogo; titulo?: string }) {
  const portada = !filtros.q && !filtros.categoria && !filtros.marca && !filtros.filtro && (filtros.pagina ?? 1) === 1;
  return portada ? <Portada /> : <Resultados filtros={filtros} tituloFijo={titulo} />;
}

async function Portada() {
  const [nuevos, enOferta, categorias, marcas, todo] = await Promise.all([
    novedades(12),
    ofertas(8),
    categoriasConFoto(),
    marcasConArticulos(),
    buscarCatalogo({}),
  ]);

  return (
    <>
      {nuevos.length > 0 && (
        <section aria-labelledby="t-nuevos" className="bg-celeste-claro">
          <div className="mx-auto max-w-6xl px-4 pb-8 pt-7 sm:pb-10 sm:pt-9">
            <Encabezado id="t-nuevos" titulo="Recién llegados" bajada="Lo último que entró al local." link={{ href: "/?f=nuevos", texto: "Ver todos" }} />
            <Estante items={nuevos} prioridad etiqueta="Recién llegados" />
          </div>
        </section>
      )}

      {enOferta.items.length > 0 && (
        <section aria-labelledby="t-ofertas" className="mx-auto max-w-6xl px-4 pt-10">
          <Encabezado
            id="t-ofertas"
            titulo="Ofertas"
            bajada="Precios especiales mientras haya stock."
            link={enOferta.total > enOferta.items.length ? { href: "/?f=ofertas", texto: `Ver las ${enOferta.total}` } : undefined}
          />
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
            {enOferta.items.map((p, i) => <TarjetaProducto key={p.id} p={p} indice={i} />)}
          </div>
        </section>
      )}

      {categorias.length > 0 && (
        <section aria-labelledby="t-categorias" className="mx-auto max-w-6xl px-4 pt-12">
          <Encabezado id="t-categorias" titulo="Buscá por categoría" />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {categorias.map((c) => (
              <li key={c.slug}>
                <Link href={`/c/${c.slug}`} className="flex items-center gap-3 rounded-[1.25rem] border-2 border-linea bg-white p-2 pr-3 transition-colors hover:border-azul">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlFoto(c.ruta_thumb)} alt="" loading="lazy" className="size-14 shrink-0 rounded-xl object-contain sm:size-16" />
                  <span className="min-w-0">
                    <span className="block font-bold leading-tight">{c.nombre}</span>
                    <span className="block text-sm text-gris">{cantidad(c.cantidad)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {marcas.length > 0 && (
        <section aria-labelledby="t-marcas" className="mx-auto max-w-6xl px-4 pt-12">
          <Encabezado id="t-marcas" titulo="Marcas" />
          <ul className="flex flex-wrap gap-2">
            {marcas.slice(0, 24).map((m) => (
              <li key={m.slug}>
                <Link href={`/m/${m.slug}`} className="chip-tienda">
                  {marcaVisible(m.nombre)}<span className="ml-1.5 font-normal text-gris">{m.cantidad}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="t-todo" className="mx-auto max-w-6xl px-4 pt-12">
        <Encabezado id="t-todo" titulo="Todo el catálogo" bajada={todo.total ? `${cantidad(todo.total)} en el local.` : undefined} />
        <ListaProductos iniciales={todo.items} total={todo.total} porPagina={POR_PAGINA} paginaInicial={1} consulta={{}} />
      </section>
    </>
  );
}

async function Resultados({ filtros, tituloFijo }: { filtros: FiltrosCatalogo; tituloFijo?: string }) {
  const [{ items, total, exactos, corregida }, categorias] = await Promise.all([buscarCatalogo(filtros), categoriasConArticulos()]);
  const categoria = categorias.find((c) => c.slug === filtros.categoria)?.nombre;
  const titulo = tituloFijo ?? (filtros.filtro === "ofertas" ? "Ofertas" : filtros.filtro === "nuevos" ? "Recién llegados" : categoria ?? "Catálogo");
  // "pelpta" no está tal cual, pero "pelota" sí: se avisa qué se buscó en realidad
  const corregido = filtros.q && total > 0 && exactos === 0 && corregida ? corregida : null;
  const detalle = [
    filtros.q ? `para “${filtros.q}”` : null,
    filtros.filtro && categoria ? `en ${categoria}` : null,
  ].filter(Boolean).join(" ");

  return (
    <section aria-labelledby="t-resultados" className="mx-auto max-w-6xl px-4 pt-7">
      <h1 id="t-resultados" className="titulo-seccion">{titulo}</h1>
      <p className="mb-5 mt-1 text-gris" aria-live="polite">
        {total === 0 ? "Sin resultados" : cantidad(total)}{corregido ? ` para “${corregido}”` : detalle ? ` ${detalle}` : ""}
      </p>
      {corregido && (
        <p className="-mt-3 mb-5 text-sm text-gris">
          No encontramos “{filtros.q}” tal cual, así que te mostramos lo más parecido.
        </p>
      )}

      {total === 0 ? (
        <div className="rounded-[1.25rem] border-2 border-dashed border-linea px-6 py-12 text-center">
          <p className="text-lg font-bold">No encontramos {filtros.q ? `“${filtros.q}”` : "artículos acá"}.</p>
          <p className="mt-1 text-gris">Probá con otra palabra, o preguntanos por WhatsApp: muchas cosas no llegan a estar en la web.</p>
          <Link href="/" className="mt-4 inline-block font-bold underline decoration-2 underline-offset-4">Ver todo el catálogo</Link>
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
    </section>
  );
}

function Encabezado({ id, titulo, bajada, link }: { id: string; titulo: string; bajada?: string; link?: { href: string; texto: string } }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 id={id} className="titulo-seccion">{titulo}</h2>
        {bajada && <p className="mt-1 text-gris">{bajada}</p>}
      </div>
      {link && (
        <Link href={link.href} className="shrink-0 pb-1 font-bold underline decoration-2 underline-offset-4 hover:text-celeste-texto">
          {link.texto}
        </Link>
      )}
    </div>
  );
}
