import { describe, expect, test } from "vitest";
import { agruparPorCodigo, FacturaIlegible, leerFactura, type TextoPdf } from "@/lib/facturas";
import { cantidad, importe } from "@/lib/facturas/numeros";

// Factura de ejemplo con el formato de Coronel (datos inventados: ni CUIT, ni cliente, ni precios reales).
// Las posiciones imitan las del PDF real: columnas en x = 31 / 64 / 104 / 150 / 453 / ~500 / ~540.
function t(pagina: number, x: number, y: number, texto: string): TextoPdf {
  return { pagina, x, y, ancho: texto.length * 5, texto };
}
function encabezado(p: number, y: number): TextoPdf[] {
  return [
    t(p, 33, y, "Cant."), t(p, 66, y, "Codtex"), t(p, 106, y, "Codnum"), t(p, 153, y, "Artículo"),
    t(p, 456, y, "Adic."), t(p, 514, y, "P."), t(p, 541, y, "Total"), t(p, 488, y - 11, "Unitario"),
  ];
}
function fila(p: number, y: number, cant: string, codtex: string, codnum: string, desc: string, precio: string, total: string, adic?: string): TextoPdf[] {
  return [
    t(p, 31, y, cant), t(p, 64, y, codtex), t(p, 104, y, codnum), t(p, 150, y, desc),
    ...(adic ? [t(p, 453, y, adic)] : []), t(p, 496, y, precio), t(p, 537, y, total),
  ];
}

const FACTURA: TextoPdf[] = [
  // página 1
  t(1, 28, 771, "CORONEL MAYORISTA S.A."), t(1, 369, 785, "Detale de Pedido N"), t(1, 482, 785, "123456"),
  t(1, 369, 760, "CUIT"), t(1, 397, 760, "30000000000"), t(1, 28, 723, "CLIENTE DE PRUEBA"), t(1, 393, 723, "20000000000"),
  ...encabezado(1, 688),
  ...fila(1, 659, "1.00", "LAM", "100001", "BUTACA PARA AUTO 9-18KGS - 8260", "61.500", "61.500", "LM/6"),
  ...fila(1, 643, "2.00", "COLO", "100002", "ESCOPETA BURBUJERA EN CAJA 42X14X6CM X1 COLORES", "13.250", "26.500"),
  t(1, 150, 633, "SURTIDOS - 745773/BB-5"),
  // precio y total juntos en un mismo texto
  t(1, 31, 610, "1.00"), t(1, 64, 610, "UNB"), t(1, 104, 610, "99643"), t(1, 150, 610, "ANDARIN 2 EN 1 - 440020"), t(1, 489, 610, "25.400,6 25.400,6"),
  ...fila(1, 590, "1.00", "LUN", "100003", "PONCHO 60X120CM \"CITY\" - PON-AFA01", "7.900", "7.900", "ESCU"),
  ...fila(1, 570, "1.00", "LUN", "100003", "PONCHO 60X120CM \"CITY\" - PON-AFA01", "7.900", "7.900", "MESS"),
  ...fila(1, 550, "40.00", "ISA", "100004", "BOMBUCHAS DE AGUA BOLSA X100", "1.150", "46.000"),
  ...fila(1, 51, "2.00", "BLO", "100005", "JUEGO DE MADERA MATEMATICO EN CAJA 30X15X4CM", "16.100", "32.200"),
  t(1, 510, 20, "Página 1/2"),
  // página 2: el nombre del último renglón sigue arriba de todo
  ...encabezado(2, 789),
  t(2, 150, 761, "- BL378/BA005"),
  ...fila(2, 745, "3.00", "DUV", "113182", "MASAS X10 EN CAJA 24X20X5CM DURAVIT - 709", "8.700", "26.100"),
  ...fila(2, 98, "15.00", "COR", "276411", "BOMBUCHAS CON PALITO X37 -", "820", "12.300"),
  t(2, 150, 88, "45594/COR2027-34"),
  t(2, 28, 48, "Cantidad de items: 9"), t(2, 425, 48, "Total:"), t(2, 482, 48, "245.800,60"),
  t(2, 28, 33, "Total Unidades: 66"), t(2, 510, 20, "Página 2/2"),
];

describe("números", () => {
  test("importes con punto de miles y coma decimal", () => {
    expect(importe("61.500")).toBe(61500);
    expect(importe("25.400,6")).toBe(25400.6);
    expect(importe("1.245.800,60")).toBe(1245800.6);
    expect(importe("798")).toBe(798);
    expect(importe("$ 1.500")).toBe(1500);
    expect(importe("LM/6")).toBeNull();
    expect(importe("12.34.5")).toBeNull();
  });
  test("cantidades con punto decimal", () => {
    expect(cantidad("40.00")).toBe(40);
    expect(cantidad("1.50")).toBe(1.5);
    expect(cantidad("1.000.00")).toBe(1000);
    expect(cantidad("3")).toBe(3);
    expect(cantidad("LAM")).toBeNull();
  });
});

describe("factura de Coronel", () => {
  const f = leerFactura(FACTURA);

  test("lee todos los renglones y cierra con el pie", () => {
    expect(f.proveedor).toBe("Coronel");
    expect(f.numero).toBe("123456");
    expect(f.renglones).toHaveLength(9);
    expect(f.control).toEqual({ renglonesDeclarados: 9, totalDeclarado: 245800.6, totalLeido: 245800.6 });
    expect(f.avisos).toEqual([]);
  });

  test("código = Codtex + Codnum; cantidades, precios y adicional", () => {
    expect(f.renglones[0]).toEqual({
      linea: 1, codigo: "LAM100001", descripcion: "BUTACA PARA AUTO 9-18KGS - 8260",
      adicional: "LM/6", cantidad: 1, costo: 61500, total: 61500,
    });
    expect(f.renglones[2]).toMatchObject({ codigo: "UNB99643", costo: 25400.6, total: 25400.6, adicional: null });
    expect(f.renglones[5]).toMatchObject({ cantidad: 40, costo: 1150, total: 46000 });
  });

  test("el nombre que sigue abajo se junta, también si pasa a la otra página", () => {
    expect(f.renglones[1]!.descripcion).toBe("ESCOPETA BURBUJERA EN CAJA 42X14X6CM X1 COLORES SURTIDOS - 745773/BB-5");
    expect(f.renglones[6]!.descripcion).toBe("JUEGO DE MADERA MATEMATICO EN CAJA 30X15X4CM - BL378/BA005");
    expect(f.renglones[8]!.descripcion).toBe("BOMBUCHAS CON PALITO X37 - 45594/COR2027-34");
  });

  test("comillas como en el resto del catálogo", () => {
    expect(f.renglones[3]!.descripcion).toBe("PONCHO 60X120CM ″CITY″ - PON-AFA01");
  });

  test("avisa si falta un renglón o no da el total", () => {
    const sinUno = FACTURA.filter((x) => !(x.pagina === 1 && x.y === 550));
    const g = leerFactura(sinUno);
    expect(g.renglones).toHaveLength(8);
    expect(g.avisos.join(" ")).toMatch(/dice 9 renglones y se leyeron 8/);
    expect(g.avisos.join(" ")).toMatch(/suma/);
  });

  test("avisa si cantidad × precio no da el total", () => {
    const mal = FACTURA.map((x) => (x.texto === "46.000" ? { ...x, texto: "46.100" } : x));
    expect(leerFactura(mal).avisos.join(" ")).toMatch(/Renglón 6: 40 × 1150 no da 46100/);
  });

  test("junta los renglones del mismo código", () => {
    const a = agruparPorCodigo(f.renglones);
    expect(a).toHaveLength(8);
    expect(a.find((x) => x.codigo === "LUN100003")).toMatchObject({ cantidad: 2, adicionales: ["ESCU", "MESS"], lineas: [4, 5] });
  });
});

describe("formatos que no sabemos leer", () => {
  test("PDF sin texto (foto o escaneo)", () => {
    expect(() => leerFactura([])).toThrow(FacturaIlegible);
    expect(() => leerFactura([])).toThrow(/no tiene texto/);
  });
  test("otro proveedor", () => {
    expect(() => leerFactura([t(1, 10, 700, "FACTURA B"), t(1, 10, 680, "Descripción")])).toThrow(/Todavía no sé leer/);
  });
});
