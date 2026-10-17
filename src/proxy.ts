// Next 16 "proxy" (antes middleware): refresca la sesión de Supabase y protege el panel.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista) => {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        },
      },
    },
  );

  // Importante: no poner código entre createServerClient y getUser (lo pide @supabase/ssr)
  const { data } = await supabase.auth.getUser();

  if (!data.user && request.nextUrl.pathname.startsWith("/panel")) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.search = `?volver=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return respuesta;
}

// Solo corre donde hace falta sesión: el catálogo público queda libre y rápido.
export const config = { matcher: ["/panel/:path*", "/ingresar", "/pendiente"] };
