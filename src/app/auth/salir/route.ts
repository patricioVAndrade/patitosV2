import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { origenDelPedido } from "@/lib/origen";

export async function POST(req: NextRequest) {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/ingresar", origenDelPedido(req)), { status: 303 });
}
