"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { consulta, mensajeConsulta, useConsulta } from "@/lib/tienda/consulta";
import { linkWhatsApp, nombreVisible, urlFoto } from "@/lib/formato";
import { negocio } from "@/lib/negocio";
import { IconoCerrar, IconoWhatsApp } from "@/componentes/ui/Iconos";

/**
 * Barra fija abajo cuando hay artículos en "Mi consulta". Abre la lista para revisarla y
 * mandar UN solo WhatsApp con todos (en vez de un mensaje por artículo).
 */
export function BarraConsulta() {
  const lista = useConsulta();
  const dialogo = useRef<HTMLDialogElement>(null);
  const n = lista.length;

  // Si se vacía con la lista abierta, se cierra sola
  useEffect(() => { if (n === 0) dialogo.current?.close(); }, [n]);

  if (n === 0) return null;
  const enlace = linkWhatsApp(negocio.whatsapp, mensajeConsulta(lista));

  return (
    <>
      {/* lugar para que la barra no tape el final de la página */}
      <div className="h-20" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-azul/10 bg-white/95 px-4 py-3 backdrop-blur" role="region" aria-label="Mi consulta">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <p className="min-w-0 flex-1 leading-tight">
            <span className="block font-bold">Tu consulta: {n} artículo{n === 1 ? "" : "s"}</span>
            <span className="block truncate text-sm text-gris">Mandalos todos juntos en un solo mensaje</span>
          </p>
          <button
            type="button"
            onClick={() => dialogo.current?.showModal()}
            className="shrink-0 rounded-full bg-azul px-5 py-2.5 font-bold text-white transition hover:bg-azul/90 active:scale-[0.98]"
          >
            Ver y enviar
          </button>
        </div>
      </div>

      <dialog
        ref={dialogo}
        aria-labelledby="t-consulta"
        className="tienda m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-[1.5rem] p-0 backdrop:bg-azul/40 sm:m-auto sm:max-w-lg sm:rounded-[1.5rem]"
        onClick={(e) => { if (e.target === e.currentTarget) dialogo.current?.close(); }}
      >
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b-2 border-linea px-5 py-4">
            <h2 id="t-consulta" className="font-display text-2xl leading-none">Mi consulta</h2>
            <button type="button" onClick={() => dialogo.current?.close()} aria-label="Cerrar" className="rounded-full p-1.5 text-gris hover:text-azul">
              <IconoCerrar className="size-6" />
            </button>
          </div>

          <ul className="flex-1 divide-y-2 divide-linea overflow-y-auto px-5">
            {lista.map((i) => (
              <li key={i.sku} className="flex items-center gap-3 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlFoto(i.ruta_thumb)} alt="" className="size-14 shrink-0 rounded-xl border-2 border-linea object-contain p-1" />
                <div className="min-w-0 flex-1">
                  <Link href={`/p/${i.sku}/${i.slug}`} onClick={() => dialogo.current?.close()} className="line-clamp-2 leading-snug hover:underline">
                    {nombreVisible(i.nombre, i.marca)}
                  </Link>
                  {i.agotado && <p className="text-sm text-gris">Figura agotado: preguntamos si vuelve</p>}
                </div>
                <button type="button" onClick={() => consulta.quitar(i.sku)} aria-label={`Sacar ${nombreVisible(i.nombre)}`} className="shrink-0 rounded-full p-2 text-gris hover:bg-linea hover:text-azul">
                  <IconoCerrar className="size-5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="space-y-2 border-t-2 border-linea px-5 pb-5 pt-4">
            <a href={enlace} target="_blank" rel="noopener" className="btn-whatsapp-grande">
              <IconoWhatsApp className="size-5" /> Enviar por WhatsApp
            </a>
            <button type="button" onClick={() => consulta.vaciar()} className="w-full py-2 text-sm font-bold text-gris underline underline-offset-4 hover:text-azul">
              Vaciar la lista
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
