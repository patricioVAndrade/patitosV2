import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";

// Google vuelve acá con un "code" que se cambia por la sesión (flujo PKCE)
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const codigo = url.searchParams.get("code");
  const volver = url.searchParams.get("volver") ?? "/panel";
  const destino = volver.startsWith("/panel") ? volver : "/panel";
  if (codigo) {
    const supabase = await supabaseServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  }
  return NextResponse.redirect(new URL("/ingresar?error=1", url.origin));
}
