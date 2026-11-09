/** Importe argentino: "61.500" → 61500 · "25.400,6" → 25400.6 · "1.245.800,60" → 1245800.6 · "798" → 798 */
export function importe(texto: string): number | null {
  const t = texto.trim().replace(/^\$\s*/, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(t)) return null;
  return Number(t.replace(/\./g, "").replace(",", "."));
}

export const esImporte = (texto: string) => importe(texto) !== null;

/** Cantidad con punto decimal: "40.00" → 40 · "1.50" → 1.5 · "1.000.00" → 1000 */
export function cantidad(texto: string): number | null {
  const t = texto.trim();
  if (!/^\d{1,3}(\.\d{3})*\.\d{1,3}$|^\d+$/.test(t)) return null;
  const partes = t.split(".");
  if (partes.length <= 2) return Number(t);
  return Number(partes.slice(0, -1).join("") + "." + partes.at(-1));
}
