import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { origenDelPedido } from "@/lib/origen";

// Google vuelve acá con un "code" que se cambia por la sesión (flujo PKCE)
export async function GET(req: NextRequest) {
  const base = origenDelPedido(req);
  const codigo = req.nextUrl.searchParams.get("code");
  const volver = req.nextUrl.searchParams.get("volver") ?? "/panel";
  const destino = volver.startsWith("/panel") ? volver : "/panel";
  if (codigo) {
    const supabase = await supabaseServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL(destino, base));
  }
  return NextResponse.redirect(new URL("/ingresar?error=1", base));
}
