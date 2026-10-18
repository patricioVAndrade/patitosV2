import { describe, expect, it } from "vitest";
import { areaUtil, lienzoCuadrado } from "@/lib/encuadre";

function imagen(w: number, h: number, pintar: (x: number, y: number) => [number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = pintar(x, y);
    d.set([r, g, b, 255], (y * w + x) * 4);
  }
  return d;
}

describe("encuadre de fotos", () => {
  it("encuentra el producto dentro de un fondo blanco", () => {
    const d = imagen(100, 60, (x, y) => (x >= 30 && x < 50 && y >= 10 && y < 40 ? [200, 20, 20] : [255, 255, 255]));
    expect(areaUtil(d, 100, 60)).toEqual({ x: 30, y: 10, w: 20, h: 30 });
  });
  it("tolera fondos casi blancos (sombra suave de la foto)", () => {
    const d = imagen(10, 10, (x, y) => (x === 5 && y === 5 ? [0, 0, 0] : [248, 247, 250]));
    expect(areaUtil(d, 10, 10)).toEqual({ x: 5, y: 5, w: 1, h: 1 });
  });
  it("con fondo de color no recorta nada", () => {
    const d = imagen(40, 30, () => [180, 150, 120]);
    expect(areaUtil(d, 40, 30)).toEqual({ x: 0, y: 0, w: 40, h: 30 });
  });
  it("imagen toda blanca: no hay recorte", () => expect(areaUtil(imagen(5, 5, () => [255, 255, 255]), 5, 5)).toBeNull());
  it("el lienzo final es cuadrado, centrado y con margen", () => {
    const l = lienzoCuadrado({ w: 1600, h: 800 }, 1000);
    expect(l.lienzo).toBe(1000);
    expect(l.w).toBe(900);
    expect(l.h).toBe(450);
    expect(l.x).toBe(50);
    expect(l.y).toBe(275);
  });
  it("nunca agranda fotos chicas", () => {
    const l = lienzoCuadrado({ w: 200, h: 100 }, 1000);
    expect(l.w).toBe(200);
    expect(l.lienzo).toBeLessThan(1000);
  });
});
