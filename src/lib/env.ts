// Variables de entorno públicas, validadas en un solo lugar.
// Next reemplaza process.env.NEXT_PUBLIC_* en tiempo de compilación (tienen que escribirse completas).
function requerida(nombre: string, valor: string | undefined): string {
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre} (ver .env.example)`);
  return valor;
}

export const env = {
  supabaseUrl: requerida("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: requerida("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  sitioUrl: (process.env.NEXT_PUBLIC_SITIO_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  /** Dominio del panel (ej. https://admin.patitosbebe.com.ar). Vacío = mismo dominio que el catálogo. */
  adminUrl: (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, ""),
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP ?? "5493582405970",
};
