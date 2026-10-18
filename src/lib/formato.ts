import { env } from "./env";

/** "Fútbol  Nº5" -> "futbol  no5" (igual que public.normalizar en la base) */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Palabras de búsqueda limpias (sin caracteres que rompan filtros de PostgREST) */
export function palabrasBusqueda(texto: string): string[] {
  return normalizar(texto)
    .replace(/[%_*,()"'\\]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 1)
    .slice(0, 6);
}

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
export function moneda(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : pesos.format(Math.round(Number(n)));
}

export function urlFoto(ruta: string | null | undefined): string {
  if (!ruta) return "/sin-foto.svg";
  return `${env.supabaseUrl}/storage/v1/object/public/productos/${ruta}`;
}

export function urlProducto(p: { sku: string; slug: string }): string {
  return `/p/${encodeURIComponent(p.sku)}/${p.slug}`;
}

export function edadTexto(desde: number | null, hasta: number | null): string | null {
  const t = (m: number) => (m < 24 ? `${m} meses` : `${Math.floor(m / 12)} años`);
  if (desde === null && hasta === null) return null;
  if (desde !== null && hasta !== null) return `De ${t(desde)} a ${t(hasta)}`;
  if (desde !== null) return `Desde ${t(desde)}`;
  return `Hasta ${t(hasta as number)}`;
}

export function linkWhatsApp(telefono: string, texto: string): string {
  return `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`;
}

/** Un código de barras de caja (EAN-8/13, UPC-A/E, ITF-14) tiene solo dígitos y 8 a 14 de largo */
export function esCodigoDeBarras(codigo: string): boolean {
  return /^\d{8,14}$/.test(codigo.trim());
}

export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });
}
