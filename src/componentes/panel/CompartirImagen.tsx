"use client";
import { useEffect, useRef, useState } from "react";
import { generarImagen, type DatosImagen, type Formato } from "@/lib/imagenCompartir";
import { IconoCerrar, IconoCompartir, IconoDescargar } from "@/componentes/ui/Iconos";

/**
 * Botón "Imagen para compartir": arma una imagen lista para historias de Instagram,
 * estados de WhatsApp o publicaciones, y la comparte (celular) o la descarga (PC).
 */
export function CompartirImagen({ datos, sku, link }: { datos: Omit<DatosImagen, "precio"> & { precio: number | null; precioVisible: boolean }; sku: string; link: string }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [formato, setFormato] = useState<Formato>("historia");
  const [conPrecio, setConPrecio] = useState(datos.precioVisible);
  const [imagen, setImagen] = useState<{ blob: Blob; url: string } | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    setImagen(null);
    setError(null);
    generarImagen({ ...datos, precio: conPrecio ? datos.precio : null }, formato)
      .then((blob) => { if (vigente) setImagen({ blob, url: URL.createObjectURL(blob) }); })
      .catch(() => { if (vigente) setError("No se pudo armar la imagen. Probá de nuevo."); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, formato, conPrecio]);

  useEffect(() => () => { if (imagen) URL.revokeObjectURL(imagen.url); }, [imagen]);

  const archivo = imagen ? new File([imagen.blob], `patitos-${sku}-${formato}.jpg`, { type: "image/jpeg" }) : null;
  const puedeCompartir = !!archivo && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [archivo] });

  async function compartir() {
    if (!archivo) return;
    try {
      await navigator.share({ files: [archivo], text: `${datos.nombre} — consultanos: ${link}` });
    } catch { /* canceló */ }
  }

  function abrir() {
    setAbierto(true);
    dialogo.current?.showModal();
  }

  const opcion = (activo: boolean) => `flex-1 px-3 py-1.5 ${activo ? "bg-coral text-white" : "bg-white"}`;

  return (
    <>
      <button type="button" onClick={abrir} className="btn-claro px-3 py-1 text-xs" title="Imagen para historias de Instagram o estados de WhatsApp">
        Compartir
      </button>
      <dialog
        ref={dialogo}
        onClose={() => setAbierto(false)}
        aria-labelledby="t-compartir"
        className="m-auto w-[min(26rem,calc(100%-1.5rem))] rounded-2xl p-0 backdrop:bg-black/50"
        onClick={(e) => { if (e.target === e.currentTarget) dialogo.current?.close(); }}
      >
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 id="t-compartir" className="font-semibold">Imagen para compartir</h2>
            <button type="button" onClick={() => dialogo.current?.close()} aria-label="Cerrar" className="p-1 text-suave"><IconoCerrar /></button>
          </div>
          <div className="flex overflow-hidden rounded-full border border-borde text-sm" role="radiogroup" aria-label="Formato">
            <button type="button" role="radio" aria-checked={formato === "historia"} onClick={() => setFormato("historia")} className={opcion(formato === "historia")}>Historia / estado</button>
            <button type="button" role="radio" aria-checked={formato === "cuadrada"} onClick={() => setFormato("cuadrada")} className={opcion(formato === "cuadrada")}>Publicación</button>
          </div>
          {datos.precio !== null && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-coral" checked={conPrecio} onChange={(e) => setConPrecio(e.target.checked)} />
              Mostrar el precio{datos.oferta ? " de oferta" : ""}
            </label>
          )}
          <div className={`mx-auto grid place-items-center overflow-hidden rounded-xl bg-crema ${formato === "historia" ? "aspect-[9/16] max-h-[55dvh]" : "aspect-square max-h-[55dvh]"}`}>
            {imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagen.url} alt="Vista previa de la imagen para compartir" className="size-full object-contain" data-testid="imagen-compartir" />
            ) : (
              <p className="p-6 text-center text-sm text-suave">{error ?? "Armando la imagen…"}</p>
            )}
          </div>
          <div className="flex gap-2">
            {puedeCompartir && (
              <button type="button" onClick={compartir} className="btn-primario flex-1"><IconoCompartir className="size-5" /> Compartir</button>
            )}
            {imagen && (
              <a href={imagen.url} download={archivo?.name} className={`${puedeCompartir ? "btn-claro" : "btn-primario"} flex-1`}>
                <IconoDescargar className="size-5" /> Descargar
              </a>
            )}
          </div>
          <p className="text-xs text-suave">En el celular, “Compartir” abre Instagram, WhatsApp y las demás apps. En la PC se descarga.</p>
        </div>
      </dialog>
    </>
  );
}
