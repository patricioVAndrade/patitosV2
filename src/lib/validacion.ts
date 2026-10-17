import { z } from "zod";

const precio = z
  .union([z.number(), z.null()])
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 100_000_000), "Precio inválido");

export const esquemaProducto = z
  .object({
    nombre: z.string().trim().min(2, "El nombre es obligatorio (mínimo 2 letras)").max(200, "Nombre demasiado largo"),
    descripcion: z.string().max(4000).nullable(),
    categoria_id: z.number().int().positive("Elegí una categoría"),
    marca_id: z.number().int().positive().nullable(),
    proveedor_id: z.number().int().positive().nullable(),
    precio,
    precio_anterior: precio,
    mostrar_precio: z.boolean(),
    en_oferta: z.boolean(),
    estado: z.enum(["borrador", "publicado", "archivado"]),
    disponibilidad: z.enum(["disponible", "pocas", "agotado"]),
    nuevo_hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    edad_desde_meses: z.number().int().min(0).max(1200).nullable(),
    edad_hasta_meses: z.number().int().min(0).max(1200).nullable(),
    codigos: z.array(z.object({ codigo: z.string().trim().min(1).max(64), tipo: z.enum(["barras", "proveedor", "legado"]), proveedor_id: z.number().nullable() })),
    etiquetas: z.array(z.number().int()),
  })
  .refine((p) => p.edad_desde_meses === null || p.edad_hasta_meses === null || p.edad_hasta_meses >= p.edad_desde_meses, {
    message: "La edad 'hasta' tiene que ser mayor que 'desde'",
    path: ["edad_hasta_meses"],
  })
  .refine((p) => !p.en_oferta || p.precio_anterior === null || p.precio === null || p.precio_anterior > p.precio, {
    message: "En una oferta, el precio anterior tiene que ser mayor al precio actual",
    path: ["precio_anterior"],
  });

export type DatosProducto = z.infer<typeof esquemaProducto>;
