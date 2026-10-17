import type { Rol } from "./supabase/database.types";

// Qué puede hacer cada rol en la interfaz. (La base de datos lo vuelve a controlar con RLS:
// esto es solo para mostrar u ocultar botones.)
const nivel: Record<Rol, number> = { cargador: 1, encargado: 2, admin: 3 };

export const puede = {
  cargar: (rol?: Rol | null) => !!rol,
  borrar: (rol?: Rol | null) => rol === "admin",
  verCostos: (rol?: Rol | null) => rol === "admin",
  administrarUsuarios: (rol?: Rol | null) => rol === "admin",
  preciosMasivos: (rol?: Rol | null) => !!rol && nivel[rol] >= nivel.encargado,
};
