// "Detalle de pedido" de Coronel Mayorista (PDF con texto, hecho con jsPDF).
//
//  Cant.  Codtex  Codnum  Artículo                                  Adic.   P. Unitario   Total
//  2.00   COLO    281997  ESCOPETA BURBUJERA EN CAJA 42X14X6CM X1 COLORES        13.250  26.500
//                         SURTIDOS - 745773/BB-5                    ← el nombre sigue abajo
//  ...
//  Cantidad de items: 62                                   Total: 1.245.800,60
//
// · El nombre puede seguir en el renglón de abajo, y hasta en la página siguiente.
// · Cada página repite el encabezado y termina con "Página 1/2".
// · El código que guardamos es Codtex + Codnum pegados: "COLO" + "281997" = "COLO281997".
import type { Factura, RenglonFactura, TextoPdf } from "./tipos";
import { cantidad, esImporte, importe } from "./numeros";

type Linea = { y: number; items: TextoPdf[] };
type Columnas = { codtex: number; codnum: number; articulo: number; adic: number; finEncabezado: number };

const TOLERANCIA_Y = 2.5;

/** ¿Es un detalle de pedido de Coronel? */
export function esCoronel(textos: TextoPdf[]): boolean {
  const todo = textos.map((t) => t.texto).join(" ").toUpperCase();
  return todo.includes("CORONEL MAYORISTA") && todo.includes("CODTEX") && todo.includes("CODNUM");
}

/** Agrupa los textos de una página en renglones (de arriba hacia abajo, cada uno de izquierda a derecha). */
export function enLineas(textos: TextoPdf[]): Linea[] {
  const lineas: Linea[] = [];
  for (const t of [...textos].sort((a, b) => b.y - a.y || a.x - b.x)) {
    if (!t.texto.trim()) continue;
    const l = lineas.at(-1);
    if (l && Math.abs(l.y - t.y) <= TOLERANCIA_Y) l.items.push(t);
    else lineas.push({ y: t.y, items: [t] });
  }
  for (const l of lineas) l.items.sort((a, b) => a.x - b.x);
  return lineas;
}

function columnas(lineas: Linea[]): Columnas | null {
  const enc = lineas.find((l) => l.items.some((i) => /^codtex$/i.test(i.texto.trim())));
  if (!enc) return null;
  const x = (re: RegExp) => enc.items.find((i) => re.test(i.texto.trim()))?.x;
  const codtex = x(/^codtex$/i), codnum = x(/^codnum$/i), articulo = x(/^art[ií]culo$/i), adic = x(/^adic\.?$/i);
  if (codtex === undefined || codnum === undefined || articulo === undefined || adic === undefined) return null;
  // "P. Unitario" ocupa dos renglones: el encabezado termina en el más bajo de los dos
  const unitario = lineas.find((l) => l.y < enc.y && enc.y - l.y < 20 && l.items.every((i) => /^unitario$/i.test(i.texto.trim())));
  return { codtex, codnum, articulo, adic, finEncabezado: unitario?.y ?? enc.y };
}

const limpiar = (t: string) => t.replace(/"/g, "″").replace(/\s+/g, " ").trim().toUpperCase();

export function leerCoronel(textos: TextoPdf[]): Factura {
  const avisos: string[] = [];
  const renglones: RenglonFactura[] = [];
  let renglonesDeclarados: number | null = null;
  let totalDeclarado: number | null = null;
  let actual: RenglonFactura | null = null;
  let terminado = false;

  const todo = textos.filter((t) => t.pagina === 1).sort((a, b) => b.y - a.y || a.x - b.x).map((t) => t.texto).join(" ");
  const numero = todo.match(/Pedido\s*N[°º.]?\s*(\d+)/i)?.[1] ?? null;

  const paginas = [...new Set(textos.map((t) => t.pagina))].sort((a, b) => a - b);
  for (const pagina of paginas) {
    if (terminado) break;
    const lineas = enLineas(textos.filter((t) => t.pagina === pagina));
    const col = columnas(lineas);
    if (!col) continue; // página sin tabla
    const margen = 10;

    for (const linea of lineas) {
      if (linea.y >= col.finEncabezado - 1) continue; // encabezado y lo de arriba
      const texto = linea.items.map((i) => i.texto).join(" ");

      // Pie: "Cantidad de items: 62 … Total: 1.245.800,60" / "Página 1/2"
      if (/^p[aá]gina\s+\d+/i.test(texto.trim())) continue;
      const declarados = texto.match(/cantidad de [ií]tems:?\s*(\d+)/i);
      if (declarados) {
        renglonesDeclarados = Number(declarados[1]);
        const total = texto.match(/total:?\s*\$?\s*([\d.]+(?:,\d+)?)\s*$/i);
        if (total) totalDeclarado = importe(total[1]!);
        terminado = true;
        break;
      }

      const izquierda = linea.items.filter((i) => i.x < col.articulo - margen);
      const medio = linea.items.filter((i) => i.x >= col.articulo - margen && i.x < col.adic - margen);
      const derecha = linea.items.filter((i) => i.x >= col.adic - margen);

      const cant = izquierda[0] && izquierda[0].x < col.codtex - margen ? cantidad(izquierda[0].texto) : null;
      if (cant === null) {
        // Sigue el nombre del renglón anterior (también al principio de la página siguiente)
        if (actual && medio.length && !izquierda.length) {
          actual.descripcion = limpiar(`${actual.descripcion} ${medio.map((i) => i.texto).join(" ")}`);
        }
        continue;
      }

      const codtex = izquierda.find((i) => i.x >= col.codtex - margen && i.x < col.codnum - margen)?.texto.trim() ?? "";
      const codnum = izquierda.find((i) => i.x >= col.codnum - margen)?.texto.trim() ?? "";
      // Precio y total pueden venir juntos en un solo texto ("25.400,6 25.400,6"): se separan por espacios
      const fichas = derecha.flatMap((i) => i.texto.trim().split(/\s+/));
      const numeros: number[] = [];
      while (fichas.length && numeros.length < 2 && esImporte(fichas.at(-1)!)) numeros.unshift(importe(fichas.pop()!)!);
      const [costo, total] = numeros.length === 2 ? numeros : [numeros[0] ?? NaN, numeros[0] ?? NaN];

      actual = {
        linea: renglones.length + 1,
        codigo: (codtex + codnum).replace(/\s+/g, "").toUpperCase(),
        descripcion: limpiar(medio.map((i) => i.texto).join(" ")),
        adicional: fichas.length ? fichas.join(" ") : null,
        cantidad: cant,
        costo: costo!,
        total: total!,
      };
      renglones.push(actual);
      if (!codtex || !/^\d+$/.test(codnum)) avisos.push(`Renglón ${actual.linea}: no pude leer bien el código.`);
      if (!Number.isFinite(actual.costo)) avisos.push(`Renglón ${actual.linea}: no pude leer el precio.`);
      else if (Math.abs(actual.costo * actual.cantidad - actual.total) > Math.max(2, actual.total * 0.001)) {
        avisos.push(`Renglón ${actual.linea}: ${actual.cantidad} × ${actual.costo} no da ${actual.total}.`);
      }
    }
  }

  const totalLeido = Math.round(renglones.reduce((s, r) => s + (Number.isFinite(r.total) ? r.total : 0), 0) * 100) / 100;
  if (renglonesDeclarados !== null && renglonesDeclarados !== renglones.length) {
    avisos.push(`La factura dice ${renglonesDeclarados} renglones y se leyeron ${renglones.length}.`);
  }
  if (totalDeclarado !== null && Math.abs(totalDeclarado - totalLeido) > 1) {
    avisos.push(`La factura suma ${totalDeclarado.toLocaleString("es-AR")} y lo leído suma ${totalLeido.toLocaleString("es-AR")}.`);
  }
  if (!renglones.length) avisos.push("No encontré renglones en la factura.");

  return { proveedor: "Coronel", numero, renglones, control: { renglonesDeclarados, totalDeclarado, totalLeido }, avisos };
}
