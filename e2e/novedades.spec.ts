import { expect, test, type Page } from "@playwright/test";

// Funciones nuevas: búsqueda que perdona errores, marcas, "Armá tu consulta", aumentos de
// precios, "¿Sigue habiendo?", repetidos e imagen para compartir.
// Corre después de flujo-completo.spec.ts (mismos datos de ejemplo).

const PANEL = process.env.E2E_ADMIN_URL ?? "";
const enPanel = (ruta: string) => (/^\/(panel|ingresar|pendiente)/.test(ruta) ? `${PANEL}${ruta}` : ruta);

async function entrarComoAdmin(page: Page) {
  await page.goto(enPanel("/panel"));
  await page.getByRole("button", { name: "Ingresar con Google" }).click();
  await page.getByLabel("Email").fill("pato08070@gmail.com");
  await page.getByLabel("Nombre").fill("Pato");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForLoadState("networkidle");
}
async function ir(page: Page, url: string) {
  await page.goto(enPanel(url));
  await page.waitForLoadState("networkidle");
}

test.describe.configure({ mode: "serial" });

test.describe("Catálogo: novedades", () => {
  test("la búsqueda perdona errores de tipeo y lo avisa", async ({ page }) => {
    await page.goto("/?q=pelpta%20futbol");
    await expect(page.getByText("No encontramos “pelpta futbol” tal cual")).toBeVisible();
    await expect(page.locator("article").first()).toContainText(/pelota/i);
    await page.goto("/?q=dinosaruio");
    await expect(page.locator("article").first()).toContainText(/dinosaurio/i);
  });

  test("página por marca", async ({ page }) => {
    await page.goto("/m/duravit");
    await expect(page.getByRole("heading", { level: 1, name: "Duravit" })).toBeVisible();
    await expect(page.locator("article").first()).toContainText(/duravit/i);
    // desde una tarjeta, la marca lleva a su página
    await page.goto("/c/jugueteria");
    await page.locator("article").getByRole("link", { name: "Duravit", exact: true }).first().click();
    await expect(page).toHaveURL(/\/m\/duravit$/);
  });

  test("Armá tu consulta: varios artículos en un solo WhatsApp", async ({ page }) => {
    await page.goto("/c/jugueteria");
    const tarjetas = page.locator("article");
    const skus = [await tarjetas.nth(0).getAttribute("data-sku"), await tarjetas.nth(1).getAttribute("data-sku")];
    await tarjetas.nth(0).getByRole("button", { name: "Agregar a mi consulta" }).click();
    await tarjetas.nth(1).getByRole("button", { name: "Agregar a mi consulta" }).click();
    await expect(page.getByText("Tu consulta: 2 artículos")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Tu consulta: 2 artículos")).toBeVisible();   // queda guardada en el navegador
    await page.getByRole("button", { name: "Ver y enviar" }).click();
    const href = decodeURIComponent((await page.getByRole("link", { name: "Enviar por WhatsApp" }).getAttribute("href")) ?? "");
    expect(href).toContain("wa.me/5493582405970");
    for (const sku of skus) expect(href).toContain(`Cód: ${sku}`);
    await page.getByRole("button", { name: "Vaciar la lista" }).click();
    await expect(page.getByText(/Tu consulta:/)).toHaveCount(0);
  });
});

test.describe("Panel: novedades", () => {
  test.skip(!PANEL, "Definí E2E_ADMIN_URL");

  test("aumento de precios por categoría: vista previa, aplicar y deshacer", async ({ page }) => {
    await entrarComoAdmin(page);
    await ir(page, "/panel/precios");
    await page.getByRole("radio", { name: "Categoría" }).click();
    const lista = page.getByLabel("Categoría", { exact: true });
    await lista.locator("option", { hasText: "Juguetería" }).waitFor({ state: "attached" });
    await lista.selectOption({ value: (await lista.locator("option", { hasText: "Juguetería" }).getAttribute("value"))! });
    await page.getByRole("button", { name: "10%" }).click();
    await page.getByRole("button", { name: "Ver cómo quedan los precios" }).click();
    await expect(page.getByTestId("vista-previa")).toContainText("+10%");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /^Aumentar \d+ artículos$/ }).click();
    await expect(page.getByTestId("ajustes").locator("li").first()).toContainText("+10%");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Deshacer" }).first().click();
    await expect(page.getByTestId("ajustes").locator("li").first()).toContainText("deshecho");
  });

  test("revisar: ¿sigue habiendo? y datos que faltan", async ({ page }) => {
    await entrarComoAdmin(page);
    await ir(page, "/panel/revisar");
    await expect(page.getByText(/para revisar$|Todo al día/)).toBeVisible();
    await page.getByRole("tab", { name: "Datos que faltan" }).click();
    await expect(page.getByTestId("faltantes").or(page.getByText("No falta nada"))).toBeVisible();
  });

  test("repetidos: aviso al cargar y pares para revisar", async ({ page }) => {
    await entrarComoAdmin(page);
    await ir(page, "/panel/articulos/nuevo");
    await page.getByLabel("Nombre *").fill("alfombra piano musical 45x30cm babygus en caja 16x16cm");
    await expect(page.getByTestId("aviso-repetidos")).toContainText(/ALFOMBRA PIANO MUSICAL/);
    await ir(page, "/panel/repetidos");
    const pares = page.getByTestId("pares");
    await expect(pares).toContainText(/ALFOMBRA PIANO MUSICAL/);
    const total = Number((await page.getByText(/pares para revisar$/).textContent())!.match(/\d+/)![0]);
    await pares.locator("li").first().getByRole("button", { name: "No son repetidos" }).click();
    await expect(page.getByText(total > 1 ? `${total - 1} pares para revisar` : "No hay posibles repetidos 🎉")).toBeVisible();
  });

  test("imagen para compartir desde el editor", async ({ page }) => {
    await entrarComoAdmin(page);
    await ir(page, "/panel/articulos");
    await page.locator('a[href^="/panel/articulos/"]:not([href$="/nuevo"])').first().click();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Compartir" }).click();
    await expect(page.getByTestId("imagen-compartir")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("radio", { name: "Publicación" }).click();
    await expect(page.getByTestId("imagen-compartir")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: "Descargar" })).toHaveAttribute("download", /\.jpg$/);
  });
});
