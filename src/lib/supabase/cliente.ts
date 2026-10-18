"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { env } from "../env";

let cliente: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente de Supabase para el navegador (usa la sesión del usuario logueado). */
export function supabaseNavegador() {
  cliente ??= createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
  return cliente;
}
