import { describe, expect, it } from "vitest";
import { edadTexto, esCodigoDeBarras, moneda, normalizar, palabrasBusqueda, urlFoto, urlProducto } from "@/lib/formato";

describe("formato", () => {
  it("normaliza igual que la base (sin tildes, minúsculas)", () => {
    expect(normalizar("Pelota de FÚTBOL Ñandú")).toBe("pelota de futbol nandu");
  });
  it("limpia las palabras de búsqueda de caracteres peligrosos para los filtros", () => {
    expect(palabrasBusqueda('  Mochila,(Stitch) "16%" ')).toEqual(["mochila", "stitch", "16"]);
  });
  it("formatea pesos argentinos sin decimales", () => {
    expect(moneda(12500).replace(/\s/g, " ")).toMatch(/\$ ?12\.500/);
    expect(moneda(null)).toBe("");
  });
  it("describe rangos de edad", () => {
    expect(edadTexto(36, 96)).toBe("De 3 años a 8 años");
    expect(edadTexto(6, null)).toBe("Desde 6 meses");
    expect(edadTexto(null, null)).toBeNull();
  });
  it("reconoce códigos de barras de caja", () => {
    expect(esCodigoDeBarras("7791234567890")).toBe(true);
    expect(esCodigoDeBarras("WIL225199")).toBe(false);
    expect(esCodigoDeBarras("90007")).toBe(false);
  });
  it("arma URLs de fotos y artículos", () => {
    expect(urlFoto(null)).toBe("/sin-foto.svg");
    expect(urlFoto("2026-10/a-t.webp")).toBe("https://ejemplo.supabase.co/storage/v1/object/public/productos/2026-10/a-t.webp");
    expect(urlProducto({ sku: "PB-000001", slug: "pelota" })).toBe("/p/PB-000001/pelota");
  });
});
