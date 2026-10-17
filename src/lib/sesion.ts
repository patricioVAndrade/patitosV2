import "server-only";
import { cache } from "react";
import { supabaseServidor } from "./supabase/servidor";
import type { Perfil } from "./supabase/database.types";

/** Usuario + perfil de la sesión actual (validado contra Supabase Auth). Se calcula una vez por request. */
export const obtenerSesion = cache(async (): Promise<{ usuarioId: string; email: string | null; perfil: Perfil | null } | null> => {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", data.user.id).maybeSingle();
  return { usuarioId: data.user.id, email: data.user.email ?? null, perfil: perfil ?? null };
});
