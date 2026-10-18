import type { Rol } from "./supabase/database.types";

// Qué ve cada rol en la interfaz. La base de datos lo vuelve a controlar con RLS:
// esto es solo para mostrar u ocultar botones.
//   empleado: todo el trabajo diario (cargar, publicar, costos, precios, lotes)
//   admin:    además historial (logs), usuarios y borrar definitivamente
export const puede = {
  cargar: (rol?: Rol | null) => !!rol,
  verCostos: (rol?: Rol | null) => !!rol,
  preciosMasivos: (rol?: Rol | null) => !!rol,
  borrar: (rol?: Rol | null) => rol === "admin",
  verHistorial: (rol?: Rol | null) => rol === "admin",
  administrarUsuarios: (rol?: Rol | null) => rol === "admin",
};
