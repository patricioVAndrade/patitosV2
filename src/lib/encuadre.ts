// Cálculos puros para estandarizar fotos (sin depender del navegador: se pueden probar).

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Busca el rectángulo que ocupa el producto ignorando los bordes casi blancos.
 * `pixeles` es RGBA (como ImageData.data). Devuelve null si toda la imagen es blanca.
 * Si el fondo no es blanco (mesa, estante), el rectángulo es casi toda la imagen: no se recorta nada.
 */
export function areaUtil(pixeles: Uint8ClampedArray, w: number, h: number, umbral = 242): Rect | null {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const transparente = pixeles[i + 3]! < 16;
      const blanco = pixeles[i]! >= umbral && pixeles[i + 1]! >= umbral && pixeles[i + 2]! >= umbral;
      if (!transparente && !blanco) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Dado el recorte (en píxeles de la foto original), calcula el lienzo cuadrado final:
 * el producto escalado para entrar en `lado`, centrado, con un margen parejo.
 */
export function lienzoCuadrado(recorte: { w: number; h: number }, lado: number, margen = 0.05) {
  const util = Math.round(lado * (1 - 2 * margen));
  const escala = Math.min(1, util / Math.max(recorte.w, recorte.h)); // nunca agranda
  const w = Math.max(1, Math.round(recorte.w * escala));
  const h = Math.max(1, Math.round(recorte.h * escala));
  const lienzo = Math.max(1, Math.round(Math.max(w, h) / (1 - 2 * margen)));
  return { lienzo, w, h, x: Math.round((lienzo - w) / 2), y: Math.round((lienzo - h) / 2) };
}
