import type { ArticuloFactura, Factura, RenglonFactura, TextoPdf } from "./tipos";
import { esCoronel, leerCoronel } from "./coronel";

export type { ArticuloFactura, Factura, RenglonFactura, TextoPdf } from "./tipos";

/** Formatos que sabemos leer. Para sumar un proveedor: un archivo nuevo como coronel.ts y una línea acá. */
const FORMATOS = [{ nombre: "Coronel", reconoce: esCoronel, leer: leerCoronel }];

export class FacturaIlegible extends Error {}

/** Lee una factura a partir del texto del PDF. */
export function leerFactura(textos: TextoPdf[]): Factura {
  if (!textos.some((t) => t.texto.trim())) {
    throw new FacturaIlegible("Este PDF no tiene texto (parece una foto o un escaneo). Por ahora solo puedo leer PDFs con texto, como los de Coronel.");
  }
  const formato = FORMATOS.find((f) => f.reconoce(textos));
  if (!formato) {
    throw new FacturaIlegible(`Todavía no sé leer facturas con este formato. Por ahora: ${FORMATOS.map((f) => f.nombre).join(", ")}.`);
  }
  return formato.leer(textos);
}

/** Junta los renglones con el mismo código (el mismo artículo pedido en varios modelos o colores). */
export function agruparPorCodigo(renglones: RenglonFactura[]): ArticuloFactura[] {
  const porCodigo = new Map<string, ArticuloFactura>();
  for (const r of renglones) {
    const a = porCodigo.get(r.codigo);
    if (a) {
      a.cantidad += r.cantidad;
      a.costo = Math.max(a.costo, r.costo);
      a.lineas.push(r.linea);
      if (r.adicional && !a.adicionales.includes(r.adicional)) a.adicionales.push(r.adicional);
    } else {
      porCodigo.set(r.codigo, {
        codigo: r.codigo, descripcion: r.descripcion, adicionales: r.adicional ? [r.adicional] : [],
        cantidad: r.cantidad, costo: r.costo, lineas: [r.linea],
      });
    }
  }
  return [...porCodigo.values()];
}

/** Saca el texto (con posiciones) de un PDF, en el navegador. El archivo no se sube a ningún lado. */
export async function textoDePdf(archivo: Blob): Promise<TextoPdf[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs"; // copiado de node_modules al instalar
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise;
  const textos: TextoPdf[] = [];
  try {
    for (let pagina = 1; pagina <= Math.min(doc.numPages, 50); pagina++) {
      const contenido = await (await doc.getPage(pagina)).getTextContent();
      for (const item of contenido.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        textos.push({ pagina, x: item.transform[4], y: item.transform[5], ancho: item.width, texto: item.str });
      }
    }
  } finally {
    await doc.destroy();
  }
  return textos;
}
