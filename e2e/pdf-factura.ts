// Arma un PDF de prueba con el formato del "Detalle de pedido" de Coronel (datos inventados),
// para probar "Cargar desde factura" sin subir al repositorio una factura real.
export type RenglonPrueba = { cant: number; codtex: string; codnum: string; nombre: string; sigue?: string; precio: number; adic?: string };

const miles = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
// Texto de PDF en WinAnsi: se escapan paréntesis y las letras con acento van en octal
const pdfTexto = (t: string) =>
  [...t].map((c) => {
    if (c === "(" || c === ")" || c === "\\") return `\\${c}`;
    const n = c.charCodeAt(0);
    return n < 128 ? c : `\\${n.toString(8).padStart(3, "0")}`;
  }).join("");

export function pdfFactura(numero: string, renglones: RenglonPrueba[]): Buffer {
  const ops: string[] = [];
  const t = (x: number, y: number, texto: string) => ops.push(`BT /F1 9 Tf ${x} ${y} Td (${pdfTexto(texto)}) Tj ET`);
  t(28, 771, "CORONEL MAYORISTA S.A.");
  t(369, 785, "Detale de Pedido N"); t(482, 785, numero);
  t(28, 723, "CLIENTE DE PRUEBA");
  t(33, 688, "Cant."); t(66, 688, "Codtex"); t(106, 688, "Codnum"); t(153, 688, "Artículo");
  t(456, 688, "Adic."); t(514, 688, "P."); t(488, 677, "Unitario"); t(541, 688, "Total");
  let y = 659;
  let total = 0;
  for (const r of renglones) {
    t(31, y, r.cant.toFixed(2)); t(64, y, r.codtex); t(104, y, r.codnum); t(150, y, r.nombre);
    if (r.adic) t(453, y, r.adic);
    t(496, y, miles(r.precio)); t(537, y, miles(r.precio * r.cant));
    total += r.precio * r.cant;
    if (r.sigue) { y -= 10; t(150, y, r.sigue); }
    y -= 16;
  }
  t(28, 48, `Cantidad de items: ${renglones.length}`); t(425, 48, "Total:"); t(482, 48, miles(total));
  t(510, 20, "Página 1/1");

  const contenido = ops.join("\n");
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n";
  const posiciones: number[] = [];
  objetos.forEach((o, i) => { posiciones.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posiciones.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
