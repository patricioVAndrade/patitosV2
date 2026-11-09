"use client";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { useCargar } from "@/componentes/panel/useCargar";
import { usePanel } from "@/componentes/panel/ContextoPanel";
import { mensajeError } from "@/lib/errores";
import { ErrorCarga } from "@/componentes/panel/ErrorCarga";
import { huellaDeUrl } from "@/lib/imagenes";
import { moneda, urlFoto } from "@/lib/formato";
import type { FichaCorta, ParRepetido } from "@/lib/supabase/database.types";

export default function PaginaRepetidos() {
  const supabase = supabaseNavegador();
  const { avisar } = usePanel();
  const [resueltos, setResueltos] = useState<Set<string>>(new Set());
  const [analisis, setAnalisis] = useState<{ hechas: number; total: number } | null>(null);

  const { datos, error, recargar } = useCargar(async () => {
    const [pares, sinHuella] = await Promise.all([supabase.rpc("pares_repetidos", { p_limite: 60 }), supabase.rpc("fotos_sin_huella", { p_limite: 1 })]);
    if (pares.error) throw pares.error;
    setResueltos(new Set());
    return { ...pares.data, fotosSinAnalizar: sinHuella.data?.total ?? 0 };
  });

  /** Calcula la huella de las fotos viejas (una sola vez; las nuevas ya la traen). */
  async function analizarFotos() {
    let hechas = 0;
    const total = datos?.fotosSinAnalizar ?? 0;
    setAnalisis({ hechas, total });
    for (let vuelta = 0; vuelta < 1000; vuelta++) { // de a 40: hasta 40.000 fotos
      const { data } = await supabase.rpc("fotos_sin_huella", { p_limite: 40 });
      const rutas = data?.rutas ?? [];
      if (!rutas.length) break;
      const huellas = await Promise.all(rutas.map(async (r) => ({ ruta_thumb: r, huella: await huellaDeUrl(urlFoto(r)) })));
      // las que no se pudieron leer quedan en cero (no se comparan) para no reintentarlas siempre
      await supabase.rpc("guardar_huellas", { p_datos: huellas.map((h) => ({ ...h, huella: h.huella ?? "" })) });
      hechas += rutas.length;
      setAnalisis({ hechas: Math.min(hechas, total), total });
    }
    setAnalisis(null);
    avisar("Fotos analizadas ✔");
    recargar();
  }

  const clave = (p: ParRepetido) => `${p.a.id}|${p.b.id}`;
  const listo = (p: ParRepetido) => setResueltos((r) => new Set(r).add(clave(p)));

  async function unir(par: ParRepetido, queda: FichaCorta, sale: FichaCorta) {
    const texto = `¿Dejar ${queda.sku} y unirle ${sale.sku}?\n\nLos códigos y las fotos de ${sale.sku} pasan a ${queda.sku}, se completan los datos que le falten y ${sale.sku} se archiva. Su link viejo va a llevar a ${queda.sku}.`;
    if (!window.confirm(texto)) return;
    const { data, error } = await supabase.rpc("unir_productos", { p_queda: queda.id, p_sale: sale.id });
    if (error) return avisar(mensajeError(error), "error");
    avisar(`Unidos: queda ${data.sku} ✔`);
    listo(par);
  }

  async function noSon(par: ParRepetido) {
    const { error } = await supabase.rpc("descartar_repetido", { p_a: par.a.id, p_b: par.b.id });
    if (error) return avisar(mensajeError(error), "error");
    listo(par);
  }

  const pares = (datos?.pares ?? []).filter((p) => !resueltos.has(clave(p)));
  const total = Math.max(0, (datos?.total ?? 0) - resueltos.size);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Posibles repetidos</h1>
        <p className="text-sm text-suave">
          Artículos con la foto casi igual, o con el nombre casi igual y los mismos números (así un 9″ y un 11″ no se confunden). Revisá cada par: dejá uno o marcá que son distintos.
        </p>
      </div>

      {!!datos?.fotosSinAnalizar && (
        <section className="tarjeta space-y-2 border-amber-300 bg-amber-50 p-4 text-sm">
          <p><strong>{datos.fotosSinAnalizar.toLocaleString("es-AR")} fotos sin analizar.</strong> Para encontrar repetidos por foto, hay que analizarlas una vez (las fotos nuevas ya se analizan solas). Conviene hacerlo con wifi.</p>
          {analisis ? (
            <div aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-amber-200"><div className="h-full bg-coral transition-all" style={{ width: `${(analisis.hechas / Math.max(analisis.total, 1)) * 100}%` }} /></div>
              <p className="mt-1 text-xs">Analizando… {analisis.hechas.toLocaleString("es-AR")} de {analisis.total.toLocaleString("es-AR")}</p>
            </div>
          ) : (
            <button className="btn-primario w-full" onClick={analizarFotos}>Analizar fotos</button>
          )}
        </section>
      )}

      {error && !datos ? (
        <ErrorCarga error={error} reintentar={recargar} />
      ) : !datos ? (
        <p className="text-suave">Buscando… (puede tardar unos segundos)</p>
      ) : total === 0 ? (
        <p className="tarjeta p-6 text-center">No hay posibles repetidos 🎉</p>
      ) : (
        <>
          <p className="font-medium" aria-live="polite">{total} pares para revisar</p>
          <ul className="space-y-3" data-testid="pares">
            {pares.map((par) => (
              <li key={clave(par)} className="tarjeta p-3">
                <p className="mb-2 flex flex-wrap gap-1.5 text-xs">
                  {par.motivos.includes("foto") && <span className="rounded-full bg-coral/15 px-2 py-0.5 font-medium text-coral">Foto casi igual</span>}
                  {par.motivos.includes("nombre") && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">Nombre casi igual</span>}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[par.a, par.b].map((x, i) => {
                    const otro = i === 0 ? par.b : par.a;
                    return (
                      <div key={x.id} className="flex flex-col gap-1.5 rounded-xl border border-borde p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={urlFoto(x.ruta_thumb)} alt="" className="aspect-square w-full rounded-lg bg-crema object-contain" />
                        <a href={`/panel/articulos/${x.id}`} target="_blank" rel="noopener" className="line-clamp-3 text-sm font-medium leading-tight hover:underline">{x.nombre}</a>
                        <p className="text-xs text-suave">
                          {x.sku}{x.estado !== "publicado" ? " · oculto" : ""}{x.precio !== null ? ` · ${moneda(x.precio)}` : ""}
                          {x.codigos.length ? <><br />Cód: {x.codigos.join(", ")}</> : null}
                        </p>
                        <button className="btn-claro mt-auto px-2 py-1 text-xs" onClick={() => unir(par, x, otro)}>Dejar este</button>
                      </div>
                    );
                  })}
                </div>
                <button className="mt-2 w-full py-1.5 text-sm text-suave underline underline-offset-2 hover:text-coral" onClick={() => noSon(par)}>No son repetidos</button>
              </li>
            ))}
          </ul>
          {pares.length === 0 && <button className="btn-claro w-full" onClick={recargar}>Ver más</button>}
        </>
      )}
    </div>
  );
}
