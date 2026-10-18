import type { NextRequest } from "next/server";
import { env } from "./env";

/**
 * Dominio real desde el que llegó el pedido. Detrás de Cloudflare u otro proxy,
 * req.nextUrl puede traer el host interno del servidor; por eso se prefiere el dominio
 * configurado del panel y, si no hay, los encabezados del pedido.
 */
export function origenDelPedido(req: NextRequest): string {
  if (env.adminUrl) return env.adminUrl;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}
