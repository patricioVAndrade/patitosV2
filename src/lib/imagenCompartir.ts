"use client";
// Imagen para compartir un artículo en Instagram, estados de WhatsApp, etc.
// Se dibuja en el navegador con los colores y las letras del catálogo; no se sube a ningún lado.
import { moneda } from "./formato";
import { negocio } from "./negocio";

export type Formato = "historia" | "cuadrada";
export type DatosImagen = {
  nombre: string;          // ya "lindo" (nombreVisible)
  marca: string | null;
  foto: string | null;     // URL de la foto grande
  precio: number | null;   // null = sin precio
  precioAnterior: number | null;
  oferta: boolean;
  nuevo: boolean;
  sitio: string;           // "patitosbebe.com.ar"
};

const C = {
  azul: "#1f2a44", gris: "#5b6475", patito: "#ffe500", rojo: "#e8444b", rojoTexto: "#c8243a",
  celeste: "#00cccb", celesteClaro: "#e3f8f8", celesteTexto: "#00706f", linea: "#e4e7ee", verde: "#17804a",
};
const DISPLAY = '"Bagel Fat One", "Fredoka", sans-serif';
const LECTURA = '"Lexend", system-ui, sans-serif';

function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // si no, el navegador no deja exportar el dibujo
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

/** Parte un texto en líneas que entren en `ancho`; si sobra, la última termina en "…". */
function lineas(ctx: CanvasRenderingContext2D, texto: string, ancho: number, maximo: number): string[] {
  const palabras = texto.split(/\s+/);
  const res: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width <= ancho) { actual = prueba; continue; }
    if (actual) res.push(actual);
    actual = p;
    if (res.length === maximo) break;
  }
  if (res.length < maximo && actual) res.push(actual);
  if (res.length === maximo && res.join(" ").length < texto.length) {
    let ultima = res[maximo - 1]!;
    while (ctx.measureText(`${ultima}…`).width > ancho && ultima.length > 1) ultima = ultima.slice(0, -1);
    res[maximo - 1] = `${ultima.trimEnd()}…`;
  }
  return res.slice(0, maximo);
}

function estrella(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const puntas = 14;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.2);
  ctx.beginPath();
  for (let i = 0; i < puntas * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.82;
    const a = (Math.PI * i) / puntas - Math.PI / 2;
    ctx.lineTo(rad * Math.cos(a), rad * Math.sin(a));
  }
  ctx.closePath();
  ctx.fillStyle = C.rojoTexto;
  ctx.fill();
  ctx.lineWidth = r * 0.07;
  ctx.strokeStyle = C.patito;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = `${Math.round(r * 0.36)}px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("¡Nuevo!", 0, 2);
  ctx.restore();
}

/** Etiqueta de precio amarilla con borde rojo, como en la web. (x, y) = esquina izquierda, centro vertical. */
function etiquetaPrecio(ctx: CanvasRenderingContext2D, x: number, y: number, precio: number, anterior: number | null, tam: number) {
  ctx.save();
  ctx.font = `${tam}px ${DISPLAY}`;
  const textoPrecio = moneda(precio);
  const anchoPrecio = ctx.measureText(textoPrecio).width;
  ctx.font = `600 ${Math.round(tam * 0.42)}px ${LECTURA}`;
  const textoAnterior = anterior ? moneda(anterior) : "";
  const anchoAnterior = anterior ? ctx.measureText(textoAnterior).width : 0;
  const izq = tam * 0.95, der = tam * 0.45, arriba = tam * 0.28;
  const ancho = izq + Math.max(anchoPrecio, anchoAnterior) + der;
  const alto = arriba * 2 + tam * 0.92 + (anterior ? tam * 0.5 : 0);
  ctx.translate(x, y);
  ctx.rotate((-4 * Math.PI) / 180);
  const borde = Math.max(5, tam * 0.07);
  ctx.fillStyle = C.rojo;
  ctx.beginPath(); ctx.roundRect(borde * 0.9, -alto / 2 + borde * 1.2, ancho, alto, [tam * 0.18, tam * 0.45, tam * 0.45, tam * 0.18]); ctx.fill();
  ctx.fillStyle = C.patito;
  ctx.strokeStyle = C.rojo;
  ctx.lineWidth = borde;
  ctx.beginPath(); ctx.roundRect(0, -alto / 2, ancho, alto, [tam * 0.18, tam * 0.45, tam * 0.45, tam * 0.18]); ctx.fill(); ctx.stroke();
  // agujerito
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(tam * 0.42, 0, tam * 0.16, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = borde * 0.6; ctx.stroke();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  let base = -alto / 2 + arriba;
  if (anterior) {
    base += tam * 0.42;
    ctx.font = `600 ${Math.round(tam * 0.42)}px ${LECTURA}`;
    ctx.fillStyle = C.rojoTexto;
    ctx.fillText(textoAnterior, izq, base);
    ctx.fillRect(izq, base - tam * 0.15, anchoAnterior, Math.max(3, tam * 0.045));
    base += tam * 0.08;
  }
  ctx.font = `${tam}px ${DISPLAY}`;
  ctx.fillStyle = C.azul;
  ctx.fillText(textoPrecio, izq, base + tam * 0.8);
  ctx.restore();
}

function tarjetaFoto(ctx: CanvasRenderingContext2D, foto: HTMLImageElement | null, x: number, y: number, lado: number) {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = C.linea;
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.roundRect(x, y, lado, lado, lado * 0.06); ctx.fill(); ctx.stroke();
  if (!foto) return;
  const margen = lado * 0.07;
  const util = lado - margen * 2;
  const escala = Math.min(util / foto.naturalWidth, util / foto.naturalHeight);
  const w = foto.naturalWidth * escala, h = foto.naturalHeight * escala;
  ctx.drawImage(foto, x + (lado - w) / 2, y + (lado - h) / 2, w, h);
}

function dibujarLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, cx: number, y: number, alto: number, alinear: "centro" | "izquierda" = "centro") {
  if (logo) {
    const ancho = (logo.naturalWidth / logo.naturalHeight) * alto;
    ctx.drawImage(logo, alinear === "centro" ? cx - ancho / 2 : cx, y, ancho, alto);
  } else {
    ctx.fillStyle = C.rojo;
    ctx.font = `${alto * 0.6}px ${DISPLAY}`;
    ctx.textAlign = alinear === "centro" ? "center" : "left";
    ctx.fillText(negocio.nombre, cx, y + alto * 0.7);
  }
}

export async function generarImagen(d: DatosImagen, formato: Formato): Promise<Blob> {
  await Promise.all([
    document.fonts.load(`80px ${DISPLAY}`),
    document.fonts.load(`600 40px ${LECTURA}`),
    document.fonts.load(`400 40px ${LECTURA}`),
  ]).catch(() => undefined);
  const [foto, logo] = await Promise.all([d.foto ? cargarImagen(d.foto) : Promise.resolve(null), cargarImagen("/logo.png")]);

  const W = 1080, H = formato === "historia" ? 1920 : 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = C.celesteClaro;
  ctx.fillRect(0, 0, W, H);
  const conPrecio = d.precio !== null;

  if (formato === "historia") {
    dibujarLogo(ctx, logo, W / 2, 80, 190);
    const lado = 900, fx = (W - lado) / 2, fy = 330;
    tarjetaFoto(ctx, foto, fx, fy, lado);
    if (d.nuevo) estrella(ctx, fx + lado - 40, fy + 40, 120);
    if (conPrecio) etiquetaPrecio(ctx, fx - 10, fy + lado - 20, d.precio!, d.oferta ? d.precioAnterior : null, 104);
    let y = fy + lado + (conPrecio ? (d.oferta && d.precioAnterior ? 170 : 140) : 90);
    ctx.textAlign = "center";
    if (d.marca) {
      ctx.fillStyle = C.celesteTexto;
      ctx.font = `600 46px ${LECTURA}`;
      ctx.fillText(d.marca, W / 2, y);
      y += 74;
    }
    // franja de abajo: el nombre usa las líneas que entren antes de ella
    const fh = 280;
    ctx.fillStyle = C.azul;
    ctx.font = `600 62px ${LECTURA}`;
    const entran = Math.max(1, Math.min(3, Math.floor((H - fh - 40 - y + 62) / 80)));
    for (const l of lineas(ctx, d.nombre, W - 160, entran)) { ctx.fillText(l, W / 2, y); y += 80; }
    ctx.fillStyle = C.patito;
    ctx.fillRect(0, H - fh, W, fh);
    ctx.fillStyle = C.azul;
    ctx.font = `68px ${DISPLAY}`;
    ctx.fillText("Consultanos por WhatsApp", W / 2, H - fh + 120);
    ctx.font = `400 40px ${LECTURA}`;
    ctx.fillText(`${d.sitio} · ${negocio.direccion.split(",")[0]}`, W / 2, H - fh + 200);
  } else {
    dibujarLogo(ctx, logo, 60, 50, 120, "izquierda");
    const lado = 600, fx = 60, fy = 220;
    tarjetaFoto(ctx, foto, fx, fy, lado);
    if (d.nuevo) estrella(ctx, fx + 40, fy + 40, 88);
    const cx = fx + lado + 50, ancho = W - cx - 50;
    let y = fy + 40;
    ctx.textAlign = "left";
    if (d.marca) {
      ctx.fillStyle = C.celesteTexto;
      ctx.font = `600 36px ${LECTURA}`;
      ctx.fillText(d.marca, cx, y);
      y += 62;
    }
    ctx.fillStyle = C.azul;
    ctx.font = `600 42px ${LECTURA}`;
    for (const l of lineas(ctx, d.nombre, ancho, 6)) { ctx.fillText(l, cx, y); y += 54; }
    if (conPrecio) etiquetaPrecio(ctx, cx, Math.max(y + 70, fy + 420), d.precio!, d.oferta ? d.precioAnterior : null, 70);
    const fh = 150;
    ctx.fillStyle = C.patito;
    ctx.fillRect(0, H - fh, W, fh);
    ctx.fillStyle = C.azul;
    ctx.textAlign = "center";
    ctx.font = `52px ${DISPLAY}`;
    ctx.fillText("Consultanos por WhatsApp", W / 2, H - fh + 72);
    ctx.font = `400 32px ${LECTURA}`;
    ctx.fillText(d.sitio, W / 2, H - fh + 120);
  }

  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo generar la imagen"))), "image/jpeg", 0.92));
}
