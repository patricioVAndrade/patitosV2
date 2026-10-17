import { describe, expect, it } from "vitest";
import { esquemaProducto } from "@/lib/validacion";

const base = {
  nombre: "PELOTA", descripcion: null, categoria_id: 1, marca_id: null, proveedor_id: null, precio: 1000, precio_anterior: null,
  mostrar_precio: true, en_oferta: false, estado: "publicado", disponibilidad: "disponible", nuevo_hasta: null,
  edad_desde_meses: null, edad_hasta_meses: null, codigos: [], etiquetas: [],
} as const;

describe("validación de artículos", () => {
  it("acepta un artículo válido", () => expect(esquemaProducto.safeParse(base).success).toBe(true));
  it("exige nombre", () => expect(esquemaProducto.safeParse({ ...base, nombre: " " }).success).toBe(false));
  it("rechaza precios negativos", () => expect(esquemaProducto.safeParse({ ...base, precio: -1 }).success).toBe(false));
  it("rechaza edades invertidas", () => expect(esquemaProducto.safeParse({ ...base, edad_desde_meses: 60, edad_hasta_meses: 12 }).success).toBe(false));
  it("en oferta, el precio anterior debe ser mayor", () =>
    expect(esquemaProducto.safeParse({ ...base, en_oferta: true, precio: 1000, precio_anterior: 900 }).success).toBe(false));
});
