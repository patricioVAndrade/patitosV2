/** Convierte errores de Supabase/PostgREST en mensajes entendibles para el personal */
export function mensajeError(e: unknown): string {
  const err = (e ?? {}) as { code?: string; message?: string; details?: string };
  const msg = err.message ?? String(e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return "Sin conexión a internet. Probá de nuevo.";
  if (err.code === "42501" || /row-level security|permission denied/i.test(msg)) return "No tenés permiso para hacer eso.";
  if (err.code === "23505") return msg.includes("ya pertenece") || msg.includes("SKU") ? msg : "Ese dato ya existe (código o nombre repetido).";
  if (err.code === "23503") return "Falta un dato relacionado (por ejemplo, la categoría).";
  if (err.code === "23514") return "Algún dato no es válido (revisá precios y edades).";
  if (err.code === "P0001" || err.code === "P0002" || err.code === "22023") return msg;
  return msg || "Ocurrió un error inesperado.";
}
