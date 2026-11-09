import { expect, test, type Page } from "@playwright/test";
import { pdfFactura } from "./pdf-factura";

// "Cargar desde factura": lee un PDF con el formato de Coronel (armado acá, con datos inventados),
// reconoce por código los artículos que ya están y crea los nuevos ocultos.
// Corre al final (por eso el nombre "zz-"): crea artículos y no debe cambiarles las cuentas a las otras pruebas.

const PANEL = process.env.E2E_ADMIN_URL ?? "";
const enPanel = (ruta: string) => `${PANEL}${ruta}`;

async function entrarComoAdmin(page: Page) {
  await page.goto(enPanel("/panel"));
  await page.getByRole("button", { name: "Ingresar con Google" }).click();
  await page.getByLabel("Email").fill("pato08070@gmail.com");
  await page.getByLabel("Nombre").fill("Pato");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForLoadState("networkidle");
}

// Códigos distintos en cada corrida, así la prueba se puede repetir sobre la misma base
const n = String(Date.now()).slice(-6);
const numero = `9${n}`;
const pdf = pdfFactura(numero, [
  { cant: 1, codtex: "SBG", codnum: "266465", nombre: "ALFOMBRA PIANO MUSICAL 45X30CM BABYGUS EN CAJA 16X16CM -", sigue: "55471", precio: 12000 },
  { cant: 2, codtex: "ZZT", codnum: n, nombre: `ROBOT DE PRUEBA ${n} A PILAS EN CAJA 20X14CM X1 COLORES`, sigue: "SURTIDOS - ZT-77", precio: 13250 },
  { cant: 1, codtex: "ZZP", codnum: n, nombre: `PONCHO DE PRUEBA ${n} 60X120CM`, precio: 7900.5, adic: "ROJO" },
  { cant: 1, codtex: "ZZP", codnum: n, nombre: `PONCHO DE PRUEBA ${n} 60X120CM`, precio: 7900.5, adic: "AZUL" },
]);
const archivo = { name: "pedido.pdf", mimeType: "application/pdf", buffer: pdf };

test.describe.configure({ mode: "serial" }); // la segunda prueba usa lo que cargó la primera

test.describe("Panel: cargar desde factura", () => {
  test.skip(!PANEL, "Definí E2E_ADMIN_URL");

  test("lee el PDF, reconoce lo que ya está y crea lo nuevo oculto", async ({ page }) => {
    await entrarComoAdmin(page);
    await page.goto(enPanel("/panel/factura"));
    await page.getByTestId("archivo-factura").setInputFiles(archivo);

    const control = page.getByTestId("factura-control");
    await expect(control).toContainText(`Coronel · pedido ${numero} · 4 renglones`);
    await expect(control).toContainText("Se leyó completa");

    // el que ya estaba se reconoce por Codtex+Codnum
    await expect(page.getByTestId("factura-existentes")).toContainText("ALFOMBRA PIANO MUSICAL");
    // los nuevos: nombre completo (dos renglones) y los dos modelos del poncho juntos
    const nuevos = page.getByTestId("factura-nuevos");
    await expect(nuevos.locator("> li")).toHaveCount(2);
    await expect(nuevos).toContainText(`ROBOT DE PRUEBA ${n} A PILAS EN CAJA 20X14CM X1 COLORES SURTIDOS - ZT-77`);
    await expect(nuevos).toContainText(`Cód. ZZT${n} · ×2`);
    await expect(nuevos).toContainText("modelos: ROJO, AZUL");

    // se puede corregir antes de cargar
    const robot = nuevos.locator("> li").filter({ hasText: "ROBOT DE PRUEBA" });
    await robot.getByRole("button", { name: "Cambiar" }).click();
    await robot.getByLabel("Precio").fill("25900");

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /^Cargar: 2 nuevos/ }).click();
    const lista = page.getByTestId("factura-lista");
    await expect(lista).toContainText("2 artículos nuevos");

    // quedó oculto, con el código del proveedor, el costo y el precio corregido
    await lista.getByRole("link", { name: new RegExp(`ROBOT DE PRUEBA ${n}`) }).click();
    await expect(page.getByLabel("Nombre *")).toHaveValue(new RegExp(`ROBOT DE PRUEBA ${n}`));
    await expect(page.getByText(`ZZT${n}`)).toBeVisible();
    await expect(page.getByRole("radio", { name: "Oculto" })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#costo")).toHaveValue("13250");

    // y no aparece en el catálogo público
    await page.goto(`/?q=${encodeURIComponent(`robot de prueba ${n}`)}`);
    await expect(page.locator("article").filter({ hasText: `ROBOT DE PRUEBA ${n}` })).toHaveCount(0);
  });

  test("la misma factura otra vez: avisa y no duplica", async ({ page }) => {
    await entrarComoAdmin(page);
    await page.goto(enPanel("/panel/factura"));
    await page.getByTestId("archivo-factura").setInputFiles(archivo);
    await expect(page.getByText("esta factura ya se cargó")).toBeVisible();
    await expect(page.getByTestId("factura-nuevos")).toHaveCount(0);
    await expect(page.getByTestId("factura-existentes").locator("> li")).toHaveCount(3);
  });

  test("un PDF que no es de un proveedor conocido se explica", async ({ page }) => {
    await entrarComoAdmin(page);
    await page.goto(enPanel("/panel/factura"));
    const otro = Buffer.from(pdf.toString("latin1").replace("CORONEL MAYORISTA", "OTRA EMPRESA SRL ."), "latin1");
    await page.getByTestId("archivo-factura").setInputFiles({ ...archivo, buffer: otro });
    await expect(page.getByText("Todavía no sé leer facturas con este formato")).toBeVisible();
  });
});
