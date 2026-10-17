"use client";
// Compresión de fotos EN EL CELULAR, antes de subirlas.
// Una foto de 3-5 MB queda en ~20 KB (miniatura) + ~90 KB (zoom): el 1 GB gratis
// de Supabase alcanza para miles de artículos y la web carga rápido.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

const BUCKET = "productos";
const TAMANIOS = { thumb: { lado: 400, calidad: 0.72 }, full: { lado: 1000, calidad: 0.78 } } as const;

export type FotoComprimida = {
  thumb: Blob;
  full: Blob;
  ancho: number;
  alto: number;
  previa: string; // URL local para mostrarla antes de subir
  pesoOriginal: number;
}

export type FotoSubida = {
  ruta_thumb: string;
  ruta_full: string;
  ancho: number;
  alto: number;
}

async function abrir(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* sigue con <img> */
    }
  }
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error("No se pudo leer la imagen"));
    img.src = URL.createObjectURL(file);
  });
}

function aBlob(canvas: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((ok) => canvas.toBlob(ok, tipo, calidad));
}

async function redimensionar(fuente: ImageBitmap | HTMLImageElement, lado: number, calidad: number) {
  const w0 = fuente.width;
  const h0 = fuente.height;
  const escala = Math.min(1, lado / Math.max(w0, h0));
  const w = Math.round(w0 * escala);
  const h = Math.round(h0 * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no permite procesar imágenes");
  ctx.fillStyle = "#ffffff"; // fondo blanco para PNG transparentes
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(fuente, 0, 0, w, h);
  let blob = await aBlob(canvas, "image/webp", calidad);
  // Safari viejo no genera WebP (devuelve PNG): usamos JPEG
  if (!blob || blob.type !== "image/webp") blob = await aBlob(canvas, "image/jpeg", Math.min(calidad + 0.05, 0.9));
  if (!blob) throw new Error("No se pudo comprimir la imagen");
  return { blob, w, h };
}

export async function comprimirFoto(file: File | Blob): Promise<FotoComprimida> {
  const fuente = await abrir(file);
  const t = await redimensionar(fuente, TAMANIOS.thumb.lado, TAMANIOS.thumb.calidad);
  const f = await redimensionar(fuente, TAMANIOS.full.lado, TAMANIOS.full.calidad);
  if ("close" in fuente) fuente.close();
  return { thumb: t.blob, full: f.blob, ancho: f.w, alto: f.h, previa: URL.createObjectURL(t.blob), pesoOriginal: file.size };
}

function rutaUnica(blob: Blob, sufijo: string): string {
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const d = new Date();
  const carpeta = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const azar = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `${carpeta}/${azar}-${sufijo}.${ext}`;
}

/** Sube miniatura + versión grande. Si falla la segunda, borra la primera. */
export async function subirFoto(supabase: SupabaseClient<Database>, foto: FotoComprimida): Promise<FotoSubida> {
  const ruta_thumb = rutaUnica(foto.thumb, "t");
  const ruta_full = rutaUnica(foto.full, "f");
  const opciones = (b: Blob) => ({ contentType: b.type, cacheControl: "31536000", upsert: false });
  const r1 = await supabase.storage.from(BUCKET).upload(ruta_thumb, foto.thumb, opciones(foto.thumb));
  if (r1.error) throw r1.error;
  const r2 = await supabase.storage.from(BUCKET).upload(ruta_full, foto.full, opciones(foto.full));
  if (r2.error) {
    await supabase.storage.from(BUCKET).remove([ruta_thumb]);
    throw r2.error;
  }
  return { ruta_thumb, ruta_full, ancho: foto.ancho, alto: foto.alto };
}

export async function borrarFotos(supabase: SupabaseClient<Database>, rutas: (string | null | undefined)[]) {
  const lista = rutas.filter((r): r is string => !!r);
  if (lista.length) await supabase.storage.from(BUCKET).remove(lista);
}
