"use client";
// Compresión de fotos EN EL CELULAR, antes de subirlas.
// Se estandarizan: cuadradas, fondo blanco, producto centrado y sin bordes blancos de más.
// Una foto de 3-5 MB queda en ~20 KB (miniatura) + ~90 KB (zoom): el 1 GB gratis
// de Supabase alcanza para miles de artículos y la web carga rápido.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";
import { areaUtil, lienzoCuadrado, type Rect } from "./encuadre";

const BUCKET = "productos";
const TAMANIOS = { thumb: { lado: 400, calidad: 0.72 }, full: { lado: 1000, calidad: 0.78 } } as const;

export type FotoComprimida = {
  thumb: Blob;
  full: Blob;
  ancho: number;
  alto: number;
  previa: string; // URL local para mostrarla antes de subir
  pesoOriginal: number;
  huella: string;  // huella de la foto (256 bits en hexadecimal) para detectar repetidas
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

/** Recorta bordes blancos sobrantes (se analiza una copia chica para que sea rápido). */
function calcularRecorte(fuente: ImageBitmap | HTMLImageElement): Rect {
  const completo = { x: 0, y: 0, w: fuente.width, h: fuente.height };
  const escala = Math.min(1, 240 / Math.max(fuente.width, fuente.height));
  const aw = Math.max(1, Math.round(fuente.width * escala));
  const ah = Math.max(1, Math.round(fuente.height * escala));
  const c = document.createElement("canvas");
  c.width = aw;
  c.height = ah;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return completo;
  ctx.drawImage(fuente, 0, 0, aw, ah);
  const area = areaUtil(ctx.getImageData(0, 0, aw, ah).data, aw, ah);
  if (!area) return completo;
  // margen de 1 píxel de análisis para no "comerse" el borde del producto
  const x = Math.max(0, (area.x - 1) / escala);
  const y = Math.max(0, (area.y - 1) / escala);
  const w = Math.min(fuente.width - x, (area.w + 2) / escala);
  const h = Math.min(fuente.height - y, (area.h + 2) / escala);
  // si el recorte es casi igual a la foto, no vale la pena
  return w * h > fuente.width * fuente.height * 0.97 ? completo : { x, y, w, h };
}

/**
 * "Huella" de una imagen para encontrar fotos repetidas (dHash de 256 bits, en hexadecimal).
 * Se achica a 17×16 en grises promediando bloques (así da lo mismo en el celular y en la PC)
 * y se compara cada píxel con el de al lado. Dos fotos casi iguales, aunque cambie el tamaño,
 * el recorte o la compresión, quedan a pocos bits de distancia; fotos de productos distintos, lejos.
 */
export function huellaDe(fuente: CanvasImageSource): string {
  const W = 17, H = 16, B = 4; // se dibuja a 68×64 y se promedian bloques de 4×4
  const c = document.createElement("canvas");
  c.width = W * B;
  c.height = H * B;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(fuente, 0, 0, c.width, c.height);
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  const gris = new Float32Array(W * H);
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      gris[Math.floor(y / B) * W + Math.floor(x / B)]! += px[i]! * 0.299 + px[i + 1]! * 0.587 + px[i + 2]! * 0.114;
    }
  }
  let hex = "";
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x += 4) {
      let nibble = 0;
      for (let k = 0; k < 4; k++) nibble = (nibble << 1) | (gris[y * W + x + k]! < gris[y * W + x + k + 1]! ? 1 : 0);
      hex += nibble.toString(16);
    }
  }
  return hex; // 64 caracteres = 256 bits
}

/** Huella de una foto ya subida (para analizar las fotos viejas). */
export async function huellaDeUrl(url: string): Promise<string | null> {
  return new Promise((ok) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { try { ok(huellaDe(img)); } catch { ok(null); } };
    img.onerror = () => ok(null);
    img.src = url;
  });
}

/** Foto final: cuadrada, fondo blanco, producto centrado con margen parejo. */
async function generar(fuente: ImageBitmap | HTMLImageElement, recorte: Rect, lado: number, calidad: number) {
  const l = lienzoCuadrado(recorte, lado);
  const canvas = document.createElement("canvas");
  canvas.width = l.lienzo;
  canvas.height = l.lienzo;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no permite procesar imágenes");
  ctx.fillStyle = "#ffffff"; // fondo blanco (también para PNG transparentes)
  ctx.fillRect(0, 0, l.lienzo, l.lienzo);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(fuente, recorte.x, recorte.y, recorte.w, recorte.h, l.x, l.y, l.w, l.h);
  let blob = await aBlob(canvas, "image/webp", calidad);
  // Safari viejo no genera WebP (devuelve PNG): usamos JPEG
  if (!blob || blob.type !== "image/webp") blob = await aBlob(canvas, "image/jpeg", Math.min(calidad + 0.05, 0.9));
  if (!blob) throw new Error("No se pudo comprimir la imagen");
  return { blob, w: l.lienzo, h: l.lienzo, canvas };
}

export async function comprimirFoto(file: File | Blob): Promise<FotoComprimida> {
  const fuente = await abrir(file);
  const recorte = calcularRecorte(fuente);
  const t = await generar(fuente, recorte, TAMANIOS.thumb.lado, TAMANIOS.thumb.calidad);
  const f = await generar(fuente, recorte, TAMANIOS.full.lado, TAMANIOS.full.calidad);
  if ("close" in fuente) fuente.close();
  return { thumb: t.blob, full: f.blob, ancho: f.w, alto: f.h, previa: URL.createObjectURL(t.blob), pesoOriginal: file.size, huella: huellaDe(t.canvas) };
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
