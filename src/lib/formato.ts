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

const LOCALE = "es-AR";
const escaparRegex = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "DURAVIT" → "Duravit" · "BIC" → "BIC" (siglas cortas quedan igual) · "Mi Marca" queda igual */
export function marcaVisible(marca: string): string {
  if (marca !== marca.toLocaleUpperCase(LOCALE)) return marca;
  return marca
    .split(/(\s+)/)
    .map((w) => (w.trim().length <= 3 ? w : w.charAt(0) + w.slice(1).toLocaleLowerCase(LOCALE)))
    .join("");
}

/**
 * Nombre para mostrar al cliente (solo presentación: el nombre guardado no cambia).
 *  · "MOCHILA FOOTY CON CARRO 18″" → "Mochila footy con carro 18″"
 *  · quita el código del proveedor del final: "… TRENDY - 53703" → "… Trendy"
 *  · la marca del artículo queda con mayúscula inicial
 * Si el nombre ya viene escrito en minúsculas y mayúsculas, se respeta.
 */
export function nombreVisible(nombre: string, marca?: string | null): string {
  let s = nombre.replace(/\s+/g, " ").trim();
  const sufijo = s.match(/\s-\s([\p{L}\d][\p{L}\d./-]*)$/u);
  if (sufijo && /\d/.test(sufijo[1]!) && s.length - sufijo[0].length >= 8) s = s.slice(0, -sufijo[0].length);
  const mayusculas = (s.match(/\p{Lu}/gu) ?? []).length;
  const minusculas = (s.match(/\p{Ll}/gu) ?? []).length;
  if (mayusculas <= minusculas * 3) return s;
  s = s.toLocaleLowerCase(LOCALE);
  s = s.charAt(0).toLocaleUpperCase(LOCALE) + s.slice(1);
  if (marca) {
    const m = marcaVisible(marca);
    s = s.replace(new RegExp(`(^|[^\\p{L}])${escaparRegex(m.toLocaleLowerCase(LOCALE))}(?=$|[^\\p{L}])`, "giu"), (_, antes: string) => antes + m);
  }
  return s;
}
