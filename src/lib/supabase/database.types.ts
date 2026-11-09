// Tipos de la base de datos.
// Se pueden regenerar desde la base real con:  npm run db:tipos
// (mientras tanto, se mantienen a mano y deben coincidir con supabase/migrations)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Tabla<Row, Requeridos extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Requeridos>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Disponibilidad = "disponible" | "pocas" | "agotado";
export type EstadoProducto = "borrador" | "publicado" | "archivado";
export type Rol = "empleado" | "admin";
export type EstadoPerfil = "pendiente" | "activo" | "bloqueado";
export type TipoCodigo = "barras" | "proveedor" | "legado";

export type Producto = {
  id: string;
  sku: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  variantes: string | null;
  categoria_id: number;
  marca_id: number | null;
  proveedor_id: number | null;
  precio: number | null;
  precio_anterior: number | null;
  mostrar_precio: boolean;
  en_oferta: boolean;
  estado: EstadoProducto;
  disponibilidad: Disponibilidad;
  controla_stock: boolean;
  nuevo_hasta: string | null;
  edad_desde_meses: number | null;
  edad_hasta_meses: number | null;
  busqueda: string;
  creado: string;
  actualizado: string;
  creado_por: string | null;
  actualizado_por: string | null;
}

export type Codigo = {
  codigo: string;
  producto_id: string;
  tipo: TipoCodigo;
  proveedor_id: number | null;
  creado: string;
  creado_por: string | null;
}

export type Imagen = {
  id: string;
  producto_id: string;
  ruta_thumb: string;
  ruta_full: string;
  orden: number;
  ancho: number | null;
  alto: number | null;
  creado: string;
  creado_por: string | null;
}

export type Categoria = { id: number; nombre: string; slug: string; orden: number; activa: boolean }
export type Marca = { id: number; nombre: string; slug: string; activa: boolean; creado: string }
export type Proveedor = { id: number; nombre: string; contacto: string | null; activo: boolean; creado: string }
export type Etiqueta = { id: number; nombre: string; slug: string; visible: boolean }

export type Perfil = {
  id: string;
  email: string | null;
  nombre: string;
  avatar_url: string | null;
  rol: Rol;
  estado: EstadoPerfil;
  creado: string;
  actualizado: string;
}

export type Historial = {
  id: number;
  fecha: string;
  usuario_id: string | null;
  usuario: string;
  tabla: string;
  registro_id: string | null;
  producto_id: string | null;
  accion: "alta" | "edicion" | "baja";
  etiqueta: string | null;
  cambios: Json | null;
}

export type HistorialPrecio = {
  id: number;
  producto_id: string;
  fecha: string;
  precio_antes: number | null;
  precio_nuevo: number | null;
  ajuste_id: number | null;
  usuario_id: string | null;
}

export type ProductoPrivado = { producto_id: string; costo: number | null; notas: string | null; actualizado: string }

export type ItemCatalogo = {
  id: string;
  sku: string;
  slug: string;
  nombre: string;
  categoria: string;
  categoria_slug: string;
  marca: string | null;
  marca_slug: string | null;
  precio: number | null;
  precio_anterior: number | null;
  en_oferta: boolean;
  es_nuevo: boolean;
  disponibilidad: Disponibilidad;
  agotado: boolean;
  edad_desde_meses: number | null;
  edad_hasta_meses: number | null;
  ruta_thumb: string | null;
  ruta_full: string | null;
  busqueda: string;
  actualizado: string;
  creado: string;
}

export type FichaProducto = ItemCatalogo & {
  descripcion: string | null;
  variantes: string | null;
  imagenes: { thumb: string; full: string; ancho: number | null; alto: number | null }[];
  etiquetas: string[];
}

export type ItemLista = {
  codigo: string;
  nombre: string;
  categoria: string | null;
  marca: string | null;
  proveedor_id: number;
  proveedor: string;
  costo: number | null;
  precio_sugerido: number | null;
  ya_cargado: boolean;
}

export type ResultadoCodigo =
  | { tipo: "producto"; producto_id: string }
  | { tipo: "lista"; item: Omit<ItemLista, "ya_cargado"> }
  | { tipo: "nada"; codigo?: string };

export type Database = {
  public: {
    Tables: {
      productos: Tabla<Producto, "nombre" | "categoria_id">;
      codigos: Tabla<Codigo, "codigo" | "producto_id" | "tipo">;
      imagenes: Tabla<Imagen, "producto_id" | "ruta_thumb" | "ruta_full">;
      categorias: Tabla<Categoria, "nombre">;
      marcas: Tabla<Marca, "nombre">;
      proveedores: Tabla<Proveedor, "nombre">;
      etiquetas: Tabla<Etiqueta, "nombre">;
      producto_etiquetas: Tabla<{ producto_id: string; etiqueta_id: number }, "producto_id" | "etiqueta_id">;
      perfiles: Tabla<Perfil, "id">;
      historial: Tabla<Historial, "usuario" | "tabla" | "accion">;
      historial_precios: Tabla<HistorialPrecio, "producto_id">;
      productos_privado: Tabla<ProductoPrivado, "producto_id">;
      config: Tabla<{ clave: string; valor: Json; descripcion: string | null }, "clave" | "valor">;
      ajustes_precio: Tabla<AjustePrecio, "descripcion" | "criterio" | "porcentaje">;
    };
    Views: {
      v_catalogo: { Row: ItemCatalogo; Relationships: [] };
      v_producto: { Row: FichaProducto; Relationships: [] };
      v_categorias: { Row: { id: number; nombre: string; slug: string; orden: number; cantidad: number }; Relationships: [] };
      v_marcas: { Row: { slug: string; nombre: string; cantidad: number }; Relationships: [] };
    };
    Functions: {
      guardar_producto: { Args: { datos: Json }; Returns: { id: string; sku: string; fotos_quitadas: string[] } };
      buscar_codigo: { Args: { p_codigo: string }; Returns: ResultadoCodigo };
      buscar_en_listas: { Args: { p_texto: string; p_limite?: number }; Returns: ItemLista[] };
      cambiar_productos: { Args: { p_ids: string[]; p_cambios: Json }; Returns: number };
      resumen_panel: {
        Args: Record<string, never>;
        Returns: { publicados: number; borradores: number; archivados: number; agotados: number; sin_foto: number; sin_marca: number; hoy: number };
      };
      precio_sugerido: { Args: { p_costo: number }; Returns: number | null };
      fotos_sin_uso: { Args: { p_rutas: string[] }; Returns: string[] };
      ajustar_precios: {
        Args: { p_criterio: Json; p_porcentaje: number; p_redondeo?: number | null; p_tambien_costo?: boolean; p_aplicar?: boolean };
        Returns: ResultadoAjuste;
      };
      revertir_ajuste: { Args: { p_ajuste: number }; Returns: { revertidos: number; respetados: number } };
      buscar_catalogo: {
        Args: { p_q?: string | null; p_categoria?: string | null; p_marca?: string | null; p_filtro?: string | null; p_desde?: number; p_cantidad?: number };
        Returns: ResultadoBusqueda;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/** Resultado de buscar_catalogo: `exactos` cuenta los que coinciden tal cual; `corregida` es la búsqueda corregida. */
export type ResultadoBusqueda = { total: number; exactos: number; items: ItemCatalogo[]; corregida: string | null };

export type AjustePrecio = {
  id: number; fecha: string; usuario_id: string | null; descripcion: string; criterio: Json;
  porcentaje: number; redondeo: number; cantidad: number; revertido: boolean;
};
export type ItemAjuste = {
  id: string; sku: string; nombre: string; estado: EstadoProducto;
  precio_antes: number | null; precio_nuevo: number | null; costo_antes: number | null; costo_nuevo: number | null;
};
export type ResultadoAjuste = { cantidad: number; redondeo: number; items: ItemAjuste[]; ajuste_id: number | null };
