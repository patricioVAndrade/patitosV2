/** Un pedazo de texto del PDF con su posición (y crece hacia arriba, como en el PDF). */
export type TextoPdf = { pagina: number; x: number; y: number; ancho: number; texto: string };

/** Un renglón de la factura tal como lo trae el proveedor. */
export type RenglonFactura = {
  linea: number;            // número de renglón en la factura (1, 2, 3…)
  codigo: string;           // código del proveedor, como lo guardamos: "SBG266465"
  descripcion: string;      // nombre del proveedor, limpio
  adicional: string | null; // columna "Adic." (variante: color, modelo…)
  cantidad: number;
  costo: number;            // precio unitario
  total: number;
};

export type Factura = {
  proveedor: string;        // nombre como figura en la tabla proveedores: "Coronel"
  numero: string | null;    // número de pedido / factura
  renglones: RenglonFactura[];
  /** Lo que la factura dice al pie, para comprobar que se leyó todo. */
  control: { renglonesDeclarados: number | null; totalDeclarado: number | null; totalLeido: number };
  avisos: string[];
};

/** Un artículo de la factura: renglones con el mismo código juntos (ej. el mismo poncho en 2 modelos). */
export type ArticuloFactura = {
  codigo: string;
  descripcion: string;
  adicionales: string[];
  cantidad: number;
  costo: number;
  lineas: number[];
};
