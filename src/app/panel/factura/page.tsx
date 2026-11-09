"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { useCargar } from "@/componentes/panel/useCargar";
import { usePanel } from "@/componentes/panel/ContextoPanel";
import { mensajeError } from "@/lib/errores";
import { fechaHora, moneda, urlFoto } from "@/lib/formato";
import { agruparPorCodigo, FacturaIlegible, leerFactura, textoDePdf, type ArticuloFactura, type Factura } from "@/lib/facturas";
import type { AnalisisFactura, FichaCorta, ItemFacturaExiste, ItemFacturaNuevo, ResultadoCargaFactura } from "@/lib/supabase/database.types";

/** "crear" | "saltar" | id del artículo existente al que se le suma el código */
type Decision = "crear" | "saltar" | { vincular: string };
type FilaNueva = { art: ArticuloFactura; item: ItemFacturaNuevo; decision: Decision; nombre: string; categoria_id: number; marca_id: number | null; precio: string };
type FilaExiste = { art: ArticuloFactura; item: ItemFacturaExiste; actualizar: boolean };
type Lectura = { archivo: string; factura: Factura; analisis: AnalisisFactura; nuevas: FilaNueva[]; existentes: FilaExiste[] };

const numero = (t: string) => (t.trim() === "" ? null : Number(t.replace(/\./g, "").replace(",", ".")));
const cambioCosto = (f: FilaExiste) => f.item.producto.costo === null || Math.abs(Number(f.item.producto.costo) - f.art.costo) >= 1;

export default function PaginaFactura() {
  const supabase = supabaseNavegador();
  const { avisar } = usePanel();
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [tambienPrecio, setTambienPrecio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [hecho, setHecho] = useState<ResultadoCargaFactura | null>(null);

  const { datos: listas } = useCargar(async () => {
    const [c, m] = await Promise.all([
      supabase.from("categorias").select("id,nombre").eq("activa", true).order("orden"),
      supabase.from("marcas").select("id,nombre").eq("activa", true).order("nombre"),
    ]);
    return { categorias: c.data ?? [], marcas: m.data ?? [] };
  });

  async function leer(archivo: File) {
    setError(null); setLectura(null); setHecho(null); setLeyendo(true);
    try {
      const factura = leerFactura(await textoDePdf(archivo));
      const articulos = agruparPorCodigo(factura.renglones);
      const { data, error } = await supabase.rpc("analizar_factura", {
        p_proveedor: factura.proveedor, p_numero: factura.numero,
        p_articulos: articulos.map((a) => ({ codigo: a.codigo, descripcion: a.descripcion, costo: a.costo })),
      });
      if (error) throw error;
      const porCodigo = new Map(data.items.map((i) => [i.codigo, i]));
      const nuevas: FilaNueva[] = [];
      const existentes: FilaExiste[] = [];
      for (const art of articulos) {
        const item = porCodigo.get(art.codigo);
        if (!item) continue;
        if (item.estado === "existe") {
          const f: FilaExiste = { art, item, actualizar: false };
          f.actualizar = cambioCosto(f);
          existentes.push(f);
        } else {
          nuevas.push({
            art, item, decision: item.estado === "nuevo" ? "crear" : "saltar",
            nombre: art.descripcion, categoria_id: item.categoria_id, marca_id: item.marca_id,
            precio: item.precio_sugerido === null ? "" : String(item.precio_sugerido),
          });
        }
      }
      setLectura({ archivo: archivo.name, factura, analisis: data, nuevas, existentes });
    } catch (e) {
      setError(e instanceof FacturaIlegible ? e.message : `No pude leer la factura: ${mensajeError(e)}`);
    } finally {
      setLeyendo(false);
    }
  }

  function cambiarNueva(codigo: string, cambio: Partial<FilaNueva>) {
    setLectura((l) => l && { ...l, nuevas: l.nuevas.map((f) => (f.art.codigo === codigo ? { ...f, ...cambio } : f)) });
  }
  function cambiarExiste(codigo: string, actualizar: boolean) {
    setLectura((l) => l && { ...l, existentes: l.existentes.map((f) => (f.art.codigo === codigo ? { ...f, actualizar } : f)) });
  }

  const resumen = useMemo(() => {
    const n = lectura?.nuevas ?? [];
    const crear = n.filter((f) => f.decision === "crear");
    const vincular = n.filter((f) => typeof f.decision === "object");
    const costos = (lectura?.existentes ?? []).filter((f) => f.actualizar);
    const invalidos = crear.filter((f) => f.nombre.trim().length < 2 || f.nombre.trim().length > 200 || (f.precio.trim() !== "" && !(Number(numero(f.precio)) >= 0)));
    return { crear, vincular, costos, invalidos, sinDecidir: n.filter((f) => f.item.estado === "parecido" && f.decision === "saltar").length };
  }, [lectura]);

  async function cargar() {
    if (!lectura) return;
    const { crear, vincular, costos } = resumen;
    const partes = [
      crear.length && `crear ${crear.length} artículos nuevos (ocultos, sin foto)`,
      vincular.length && `sumarle el código a ${vincular.length} que ya estaban`,
      costos.length && `actualizar el costo${tambienPrecio ? " y el precio" : ""} de ${costos.length}`,
    ].filter(Boolean);
    if (!window.confirm(`Se va a ${partes.join(", ")}.\n\n¿Seguimos?`)) return;
    setGuardando(true);
    const { data, error } = await supabase.rpc("cargar_factura", {
      p_datos: {
        proveedor_id: lectura.analisis.proveedor_id, numero: lectura.factura.numero,
        renglones: lectura.factura.renglones.length, total: lectura.factura.control.totalLeido,
        crear: crear.map((f) => ({
          codigo: f.art.codigo, nombre: f.nombre.trim(), categoria_id: f.categoria_id, marca_id: f.marca_id,
          costo: f.art.costo, precio: numero(f.precio),
        })),
        vincular: vincular.map((f) => ({ producto_id: (f.decision as { vincular: string }).vincular, codigo: f.art.codigo, costo: f.art.costo })),
        costos: costos.map((f) => ({ producto_id: f.item.producto.id, costo: f.art.costo, precio: tambienPrecio ? f.item.precio_sugerido : null })),
      },
    });
    setGuardando(false);
    if (error) return avisar(mensajeError(error), "error");
    setHecho(data);
    setLectura(null);
    window.scrollTo({ top: 0 });
  }

  if (hecho) return <Listo hecho={hecho} otra={() => setHecho(null)} />;

  const parecidas = lectura?.nuevas.filter((f) => f.item.estado === "parecido") ?? [];
  const nuevas = lectura?.nuevas.filter((f) => f.item.estado === "nuevo") ?? [];
  const algo = resumen.crear.length + resumen.vincular.length + resumen.costos.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Cargar desde factura</h1>
        <p className="text-sm text-suave">
          Subí el detalle de pedido en PDF (por ahora, el de Coronel). Se lee en este dispositivo: el archivo no se guarda.
          Los artículos que ya tenemos se reconocen por su código; los nuevos se crean <strong>ocultos y sin foto</strong>, para que les agregues la foto y los publiques.
        </p>
      </div>

      <label className={`tarjeta flex cursor-pointer flex-col items-center gap-1 border-dashed p-5 text-center hover:border-coral ${leyendo ? "pointer-events-none opacity-60" : ""}`}>
        <span className="font-medium">{leyendo ? "Leyendo la factura…" : lectura ? "Elegir otra factura" : "Elegir el PDF de la factura"}</span>
        {lectura && <span className="text-xs text-suave">{lectura.archivo}</span>}
        <input type="file" accept="application/pdf,.pdf" className="sr-only" data-testid="archivo-factura" disabled={leyendo}
          onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ""; if (a) leer(a); }} />
      </label>

      {error && <p role="alert" className="tarjeta border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</p>}

      {lectura && listas && (
        <>
          <Control lectura={lectura} />

          {parecidas.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-semibold">Para confirmar ({parecidas.length})</h2>
              <p className="text-sm text-suave">No tienen el código, pero hay uno cargado con un nombre casi igual. ¿Es el mismo? Si no elegís, no se cargan.</p>
              <ul className="space-y-2" data-testid="factura-parecidos">
                {parecidas.map((f) => (
                  <li key={f.art.codigo} className="tarjeta space-y-2 p-3">
                    <Renglon art={f.art} />
                    {f.item.parecidos.map((p) => (
                      <label key={p.id} className={`flex items-center gap-3 rounded-xl border p-2 ${typeof f.decision === "object" && f.decision.vincular === p.id ? "border-coral bg-coral/5" : "border-borde"}`}>
                        <input type="radio" name={`d-${f.art.codigo}`} checked={typeof f.decision === "object" && f.decision.vincular === p.id}
                          onChange={() => cambiarNueva(f.art.codigo, { decision: { vincular: p.id } })} />
                        <Miniatura ficha={p} />
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="block font-medium">Es este</span>
                          <span className="block leading-tight">{p.nombre}</span>
                          <span className="text-xs text-suave">{p.sku}{p.estado !== "publicado" ? " · oculto" : ""}</span>
                        </span>
                      </label>
                    ))}
                    <label className="flex items-center gap-3 rounded-xl border border-borde p-2 text-sm">
                      <input type="radio" name={`d-${f.art.codigo}`} checked={f.decision === "crear"} onChange={() => cambiarNueva(f.art.codigo, { decision: "crear" })} />
                      Es otro: crearlo nuevo
                    </label>
                    {f.decision === "crear" && <CamposNuevo f={f} listas={listas} cambiar={cambiarNueva} />}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {nuevas.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">Nuevos ({nuevas.length})</h2>
                <button className="text-sm text-suave underline underline-offset-2" onClick={() => {
                  const todos = nuevas.every((f) => f.decision === "crear");
                  for (const f of nuevas) cambiarNueva(f.art.codigo, { decision: todos ? "saltar" : "crear" });
                }}>{nuevas.every((f) => f.decision === "crear") ? "Destildar todos" : "Tildar todos"}</button>
              </div>
              <p className="text-sm text-suave">Revisá la categoría y el precio (sugerido: costo × margen, redondeado). Con «Cambiar» también corregís el nombre y la marca.</p>
              <ul className="space-y-2" data-testid="factura-nuevos">
                {nuevas.map((f) => (
                  <li key={f.art.codigo} className={`tarjeta space-y-2 p-3 ${f.decision === "crear" ? "" : "opacity-60"}`}>
                    <label className="flex items-start gap-3">
                      <input type="checkbox" className="mt-1 size-5 shrink-0" checked={f.decision === "crear"}
                        onChange={(e) => cambiarNueva(f.art.codigo, { decision: e.target.checked ? "crear" : "saltar" })} aria-label={`Crear ${f.art.descripcion}`} />
                      <Renglon art={f.art} nombre={f.nombre} />
                    </label>
                    {f.decision === "crear" && <CamposNuevo f={f} listas={listas} cambiar={cambiarNueva} />}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {lectura.existentes.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-semibold">Ya los tenemos ({lectura.existentes.length})</h2>
              {lectura.existentes.some(cambioCosto) && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4" checked={tambienPrecio} onChange={(e) => setTambienPrecio(e.target.checked)} />
                  A los que les cambió el costo, ponerles también el precio sugerido
                </label>
              )}
              <ul className="tarjeta divide-y divide-borde" data-testid="factura-existentes">
                {lectura.existentes.map((f) => {
                  const p = f.item.producto;
                  const cambio = cambioCosto(f);
                  const pct = p.costo ? Math.round(((f.art.costo - p.costo) / p.costo) * 100) : null;
                  return (
                    <li key={f.art.codigo} className="flex items-center gap-3 p-2.5">
                      <Miniatura ficha={p} />
                      <div className="min-w-0 flex-1 text-sm">
                        <Link href={`/panel/articulos/${p.id}`} className="line-clamp-2 leading-tight hover:underline">{p.nombre}</Link>
                        <p className="text-xs text-suave">
                          {p.sku}{p.estado !== "publicado" ? ` · ${p.estado === "archivado" ? "archivado" : "oculto"}` : ""} · ×{f.art.cantidad}
                        </p>
                        {cambio ? (
                          <label className="mt-1 flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={f.actualizar} onChange={(e) => cambiarExiste(f.art.codigo, e.target.checked)} />
                            <span>
                              Costo {p.costo === null ? "sin cargar" : moneda(p.costo)} → <strong>{moneda(f.art.costo)}</strong>
                              {pct !== null && pct !== 0 && <span className={pct > 0 ? "text-red-700" : "text-emerald-700"}> ({pct > 0 ? "+" : ""}{pct}%)</span>}
                              {tambienPrecio && f.actualizar && f.item.precio_sugerido !== null && <> · precio {moneda(p.precio)} → <strong>{moneda(f.item.precio_sugerido)}</strong></>}
                            </span>
                          </label>
                        ) : (
                          <p className="mt-1 text-xs text-suave">Mismo costo ({moneda(f.art.costo)})</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 -mx-4 space-y-1 border-t border-borde bg-crema/95 px-4 py-3 backdrop-blur md:bottom-0">
            {resumen.invalidos.length > 0 && <p className="text-xs text-red-700">Revisá {resumen.invalidos.length === 1 ? "un nombre o precio" : `${resumen.invalidos.length} nombres o precios`}.</p>}
            {resumen.sinDecidir > 0 && <p className="text-xs text-suave">{resumen.sinDecidir} para confirmar sin elegir (no se cargan).</p>}
            <button className="btn-primario w-full" disabled={!algo || guardando || resumen.invalidos.length > 0} onClick={cargar}>
              {guardando ? "Cargando…" : algo ? `Cargar: ${[
                resumen.crear.length && `${resumen.crear.length} nuevos`,
                resumen.vincular.length && `${resumen.vincular.length} con código`,
                resumen.costos.length && `${resumen.costos.length} ${resumen.costos.length === 1 ? "costo" : "costos"}`,
              ].filter(Boolean).join(" · ")}` : "No hay nada para cargar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Lo que dice la factura y si se leyó completa. */
function Control({ lectura }: { lectura: Lectura }) {
  const { factura, analisis } = lectura;
  const { renglonesDeclarados, totalDeclarado, totalLeido } = factura.control;
  const completa = factura.avisos.length === 0 && renglonesDeclarados !== null;
  return (
    <section className="space-y-2" data-testid="factura-control">
      <div className={`tarjeta p-3 text-sm ${completa ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
        <p className="font-medium">
          {factura.proveedor}{factura.numero ? ` · pedido ${factura.numero}` : ""} · {factura.renglones.length} renglones · {moneda(totalDeclarado ?? totalLeido)}
        </p>
        {completa ? (
          <p>✔ Se leyó completa: coinciden la cantidad de renglones y el total.</p>
        ) : (
          <ul className="list-disc pl-5">
            {factura.avisos.map((a) => <li key={a}>{a}</li>)}
            {renglonesDeclarados === null && <li>No encontré el pie de la factura: fijate que estén todas las páginas.</li>}
          </ul>
        )}
      </div>
      {analisis.ya_cargada && (
        <p className="tarjeta border-amber-300 bg-amber-50 p-3 text-sm" role="status">
          <strong>Ojo: esta factura ya se cargó</strong> el {fechaHora(analisis.ya_cargada.fecha)}{analisis.ya_cargada.usuario ? ` (${analisis.ya_cargada.usuario})` : ""}.
          Los artículos que se crearon esa vez ya aparecen abajo como «Ya los tenemos».
        </p>
      )}
    </section>
  );
}

function Renglon({ art, nombre }: { art: ArticuloFactura; nombre?: string }) {
  return (
    <span className="block min-w-0 flex-1 text-sm">
      <span className="block font-medium leading-tight">{nombre?.trim() || art.descripcion}</span>
      <span className="block text-xs text-suave">
        Cód. {art.codigo} · ×{art.cantidad} · costo {moneda(art.costo)}
        {art.adicionales.length > 0 && <> · modelos: {art.adicionales.join(", ")}</>}
      </span>
    </span>
  );
}

function Miniatura({ ficha }: { ficha: Pick<FichaCorta, "ruta_thumb"> }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={urlFoto(ficha.ruta_thumb)} alt="" className="size-12 shrink-0 rounded-lg bg-crema object-contain" />;
}

function CamposNuevo({ f, listas, cambiar }: {
  f: FilaNueva;
  listas: { categorias: { id: number; nombre: string }[]; marcas: { id: number; nombre: string }[] };
  cambiar: (codigo: string, cambio: Partial<FilaNueva>) => void;
}) {
  const id = f.art.codigo;
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    // Resumen en un renglón: con 60 artículos, la lista entera abierta se hace eterna en el celular
    const precio = numero(f.precio);
    return (
      <p className="flex items-center gap-2 pl-8 text-sm">
        <span className="min-w-0 flex-1">
          {listas.categorias.find((c) => c.id === f.categoria_id)?.nombre ?? "—"}
          {" · "}{precio === null ? "sin precio" : <strong>{moneda(precio)}</strong>}
          {" · "}{listas.marcas.find((m) => m.id === f.marca_id)?.nombre ?? "sin marca"}
        </span>
        <button className="btn-claro shrink-0 px-3 py-1 text-xs" onClick={() => setAbierto(true)}>Cambiar</button>
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 pl-8">
      <label className="col-span-2">
        <span className="etiqueta-campo">Nombre</span>
        <textarea className="campo min-h-[2.75rem] py-1.5 text-sm" rows={2} maxLength={200} value={f.nombre} onChange={(e) => cambiar(id, { nombre: e.target.value })} />
      </label>
      <label>
        <span className="etiqueta-campo">Categoría</span>
        <select className="campo py-1.5 text-sm" value={f.categoria_id} onChange={(e) => cambiar(id, { categoria_id: Number(e.target.value) })}>
          {listas.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </label>
      <label>
        <span className="etiqueta-campo">Precio</span>
        <input className="campo py-1.5 text-sm" inputMode="numeric" value={f.precio} placeholder="Sin precio" onChange={(e) => cambiar(id, { precio: e.target.value })} />
      </label>
      <label className="col-span-2">
        <span className="etiqueta-campo">Marca</span>
        <select className="campo py-1.5 text-sm" value={f.marca_id ?? ""} onChange={(e) => cambiar(id, { marca_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">Sin marca</option>
          {listas.marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
      </label>
    </div>
  );
}

function Listo({ hecho, otra }: { hecho: ResultadoCargaFactura; otra: () => void }) {
  return (
    <div className="space-y-4" data-testid="factura-lista">
      <h1 className="text-xl font-semibold">Factura cargada ✔</h1>
      <p className="tarjeta p-4 text-sm">
        {hecho.creados.length > 0 && <>Se crearon <strong>{hecho.creados.length} artículos nuevos</strong>, ocultos hasta que les pongas foto y los publiques. </>}
        {hecho.vinculados > 0 && <>{hecho.vinculados} ya cargados ahora tienen el código del proveedor. </>}
        {hecho.costos > 0 && <>Se actualizó el costo de {hecho.costos}.</>}
      </p>
      {hecho.creados.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Para agregarles foto</h2>
          <ul className="tarjeta divide-y divide-borde">
            {hecho.creados.map((c) => (
              <li key={c.id}>
                <Link href={`/panel/articulos/${c.id}`} className="flex items-center gap-3 p-3 text-sm hover:text-coral">
                  <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                  <span className="shrink-0 text-xs text-suave">{c.sku}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-sm text-suave">También los encontrás en Artículos → Ocultos.</p>
        </section>
      )}
      <div className="flex gap-2">
        <button className="btn-claro flex-1" onClick={otra}>Cargar otra factura</button>
        <Link href="/panel/articulos?f=ocultos" className="btn-primario flex-1">Ver los ocultos</Link>
      </div>
    </div>
  );
}
