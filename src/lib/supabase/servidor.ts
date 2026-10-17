import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { env } from "../env";

/** Cliente de Supabase para Server Components / Route Handlers, con la sesión del usuario. */
export async function supabaseServidor() {
  const almacen = await cookies();
  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: lo resuelve proxy.ts al refrescar la sesión
        }
      },
    },
  });
}

/** Cliente anónimo, sin cookies: para el catálogo público (se puede cachear). */
export function supabasePublico() {
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
