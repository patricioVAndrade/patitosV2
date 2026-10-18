import { describe, expect, it } from "vitest";
import { edadTexto, esCodigoDeBarras, marcaVisible, moneda, nombreVisible, normalizar, palabrasBusqueda, urlFoto, urlProducto } from "@/lib/formato";

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

describe("nombreVisible", () => {
  it("pasa a oración y quita el código del proveedor del final", () => {
    expect(nombreVisible("CARTERA INFANTIL PELUCHE CAPIBARA 17X21CM TRENDY - 53703", "TRENDY")).toBe("Cartera infantil peluche capibara 17x21cm Trendy");
    expect(nombreVisible("TRICICLO GO ROSA CON BARRAL 45X87X80CM RONDI - PTTRI3021")).toBe("Triciclo go rosa con barral 45x87x80cm rondi");
    expect(nombreVisible("BILLETERA HOMBRE NAUTICA 12X8.5CM WILSON - 65.B716", "WILSON")).toBe("Billetera hombre nautica 12x8.5cm Wilson");
  });
  it("no toca un final que es texto y no código", () => {
    expect(nombreVisible("MUÑECO AVENGER SPIDERMAN - LUZ Y SONIDO")).toBe("Muñeco avenger spiderman - luz y sonido");
  });
  it("respeta nombres ya escritos con minúsculas y limpia espacios dobles", () => {
    expect(nombreVisible("Peluche  Panda grande")).toBe("Peluche Panda grande");
    expect(nombreVisible("CAMIONETA DE  POLICIA")).toBe("Camioneta de policia");
  });
  it("la marca va con mayúscula inicial y las siglas cortas quedan igual", () => {
    expect(marcaVisible("DURAVIT")).toBe("Duravit");
    expect(marcaVisible("BIC")).toBe("BIC");
    expect(nombreVisible("MARCADOR ESCOLAR FILGO PINTO X10", "FILGO")).toBe("Marcador escolar Filgo pinto x10");
  });
});
