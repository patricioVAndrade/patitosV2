import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

// Fotos de ejemplo para subir (cualquier imagen sirve)
const FOTOS = (process.env.E2E_FOTOS ?? "").split(",").filter(Boolean);
const ADMIN = "pato08070@gmail.com";
// Dominio del panel (ej. http://admin.localhost:3000). Vacío = mismo dominio que el catálogo.
const PANEL = process.env.E2E_ADMIN_URL ?? "";
const enPanel = (ruta: string) => (/^\/(panel|ingresar|pendiente)/.test(ruta) ? `${PANEL}${ruta}` : ruta);
const EMPLEADA = `sofi.${Date.now()}@gmail.com`;

async function ingresarCon(page: Page, email: string, nombre: string) {
  await page.goto(enPanel("/panel"));
  await expect(page).toHaveURL(/\/ingresar/);
  await page.getByRole("button", { name: "Ingresar con Google" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Nombre").fill(nombre);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForLoadState("networkidle");
}

/** Navega y espera a que la página esté lista para usarse */
async function ir(page: Page, url: string) {
  await page.goto(enPanel(url));
  await page.waitForLoadState("networkidle");
}

test.describe.configure({ mode: "serial" });

test.describe("Catálogo público", () => {
  test("muestra artículos, busca sin tildes y abre la ficha", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/artículos$/).first()).toBeVisible();
    await expect(page.locator("article").first()).toBeVisible();
    await page.getByLabel("Buscar artículo").fill("pelota futbol");
    await expect(page).toHaveURL(/q=pelota/);
    await expect(page.locator("article").first()).toContainText("PELOTA");
    await page.locator("article a").nth(1).click();
    await expect(page).toHaveURL(/\/p\/PB-\d{6}\//);
    await expect(page.getByRole("link", { name: /Consultar|Avisame/ })).toHaveAttribute("href", /wa\.me\/5493582405970/);
  });

  test("categorías y carga de más resultados", async ({ page }) => {
    await page.goto("/c/jugueteria");
    await expect(page.locator("article").first()).toBeVisible();
    // Al bajar, se cargan más artículos solos (o con el botón "Ver más")
    await page.mouse.wheel(0, 20000);
    const boton = page.getByRole("button", { name: /Ver más/ });
    if (await boton.isVisible().catch(() => false)) await boton.click();
    await expect.poll(() => page.locator("article").count()).toBeGreaterThan(24);
  });

  test("un link viejo sin nombre redirige al correcto y un SKU inexistente da 404", async ({ page }) => {
    await page.goto("/p/PB-000001");
    await expect(page).toHaveURL(/\/p\/PB-000001\/billetera/);
    const r = await page.goto("/p/PB-999999");
    expect(r?.status()).toBe(404);
  });
});

test.describe("Separación catálogo / panel", () => {
  test.skip(!PANEL, "Definí E2E_ADMIN_URL para probar el dominio separado");

  test("en el dominio público el panel y el login no existen", async ({ page }) => {
    for (const ruta of ["/panel", "/panel/articulos", "/ingresar", "/pendiente"]) {
      const r = await page.goto(ruta);
      expect(r?.status(), ruta).toBe(404);
    }
  });

  test("en el dominio del panel el catálogo redirige al público", async ({ page }) => {
    await page.goto(`${PANEL}/c/jugueteria`);
    const publico = new URL(process.env.E2E_URL ?? "http://localhost:3000").host;
    await expect(page).toHaveURL(new RegExp(`^https?://${publico.replace(/\./g, "\\.")}/c/jugueteria`));
    await page.goto(`${PANEL}/`);
    await expect(page).toHaveURL(/\/ingresar/);
  });
});

test.describe("Panel", () => {
  test("el admin entra con Google y ve el resumen", async ({ page }) => {
    await ingresarCon(page, ADMIN, "Pato");
    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.getByText("Publicados")).toBeVisible();
    await expect(page.getByRole("link", { name: "Usuarios" }).first()).toBeVisible();
  });

  test("una empleada nueva queda pendiente hasta que el admin la aprueba", async ({ browser }) => {
    const ctxE = await browser.newContext();
    const emp = await ctxE.newPage();
    await ingresarCon(emp, EMPLEADA, "Sofi");
    await expect(emp).toHaveURL(/\/pendiente/);
    await expect(emp.getByText("Tu acceso está pendiente")).toBeVisible();

    const ctxA = await browser.newContext();
    const adm = await ctxA.newPage();
    await ingresarCon(adm, ADMIN, "Pato");
    await ir(adm, "/panel/usuarios");
    await adm.locator(`li[data-email="${EMPLEADA}"]`).getByRole("button", { name: "Aprobar" }).click();
    await expect(adm.getByText("Usuario actualizado")).toBeVisible();

    await emp.reload();
    await emp.waitForLoadState("networkidle");
    await expect(emp).toHaveURL(/\/panel$/);
    // una cargadora no ve Usuarios
    await expect(emp.getByRole("link", { name: "Usuarios" })).toHaveCount(0);
    await ctxE.close();
    await ctxA.close();
  });

  test("escanear un código existente y marcarlo agotado", async ({ page }) => {
    await ingresarCon(page, ADMIN, "Pato");
    await page.getByLabel("Código").fill("WIL225199");
    await page.getByRole("button", { name: "Buscar" }).click();
    const r = page.getByTestId("resultado");
    await expect(r).toContainText("BILLETERA HOMBRE NAUTICA");
    await r.getByRole("button", { name: "Agotado" }).click();
    await expect(page.getByText("Actualizado ✔")).toBeVisible();
    await ir(page, "/p/PB-000001");
    await expect(page.getByText("Agotado").first()).toBeVisible();
  });

  test("código desconocido → artículo nuevo con foto y marca nueva → aparece en la web", async ({ page }) => {
    test.skip(FOTOS.length < 1, "Definí E2E_FOTOS con rutas de imágenes");
    await ingresarCon(page, ADMIN, "Pato");
    await page.getByLabel("Modo continuo: después de guardar, vuelve a abrir la cámara").uncheck();
    await page.getByLabel("Código").fill("7790000000017");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("link", { name: /Crear artículo nuevo/ }).click();
    await expect(page.getByTestId("codigos")).toContainText("7790000000017");
    await page.getByLabel("Nombre *").fill("Auto de prueba e2e");
    await page.getByLabel("Marca").fill("Marca E2E");
    await page.getByLabel("Precio de venta").fill("12500");
    await page.getByLabel("Mostrar precio").check();
    await page.getByTestId("input-galeria").setInputFiles(FOTOS[0]!);
    await expect(page.getByText(/KB$/).first()).toBeVisible();
    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByText(/Publicado ✔ PB-\d{6}/)).toBeVisible();
    await expect(page).toHaveURL(/\/panel\/articulos\/[0-9a-f-]{36}$/);

    await ir(page, "/?q=auto%20de%20prueba%20e2e");
    const tarjeta = page.locator("article").first();
    await expect(tarjeta).toContainText("AUTO DE PRUEBA E2E");
    await expect(tarjeta).toContainText("MARCA E2E");
    await expect(tarjeta).toContainText("12.500");
    const src = await tarjeta.locator("img").getAttribute("src");
    expect(src).toMatch(/storage\/v1\/object\/public\/productos\/\d{4}-\d{2}\/.+-t\.webp$/);
    const foto = await page.request.get(src!);
    expect(foto.status()).toBe(200);
    expect((await foto.body()).length).toBeLessThan(60_000);
  });

  test("código de una lista de proveedor → nombre y precio sugerido completados", async ({ page }) => {
    await ingresarCon(page, ADMIN, "Pato");
    await ir(page, `/panel/articulos/nuevo?codigo=${process.env.E2E_CODIGO_LISTA ?? "ILU202226"}`);
    await expect(page.getByText(/Encontrado en la lista de/)).toBeVisible();
    await expect(page.getByLabel("Nombre *")).not.toHaveValue("");
    await expect(page.getByLabel("Precio de venta")).not.toHaveValue("");
  });

  test("autocompletar desde las listas al escribir el nombre", async ({ page }) => {
    await ingresarCon(page, ADMIN, "Pato");
    await ir(page, "/panel/articulos/nuevo");
    await page.getByLabel("Nombre *").fill("aromatizador textil");
    const sug = page.getByTestId("sugerencias");
    await expect(sug).toBeVisible();
    await sug.getByRole("button").first().click();
    await expect(page.getByLabel("Nombre *")).toHaveValue(/AROMATIZADOR/);
    await expect(page.getByTestId("codigos")).toContainText(/\w+/);
  });

  test("carga masiva: publica los que tienen nombre y marca el que falta", async ({ page }) => {
    test.skip(FOTOS.length < 3, "Definí E2E_FOTOS con 3 imágenes");
    await ingresarCon(page, ADMIN, "Pato");
    await ir(page, "/panel/masiva");
    await page.getByTestId("input-masiva").setInputFiles(FOTOS.slice(0, 3));
    await expect(page.locator('[data-estado="listo"]')).toHaveCount(3, { timeout: 20_000 });
    await page.getByLabel("Nombre del artículo 1").fill("Peluche masivo uno");
    await page.getByLabel("Nombre del artículo 2").fill("Peluche masivo dos");
    await page.getByLabel("Código del artículo 2").fill("7791111111116");
    await page.getByRole("button", { name: /Publicar 3 artículos/ }).click();
    await expect(page.locator('[data-estado="ok"]')).toHaveCount(2, { timeout: 20_000 });
    await expect(page.locator('[data-estado="error"]')).toContainText("Falta el nombre");
  });

  test("artículos: asignar marca en lote y filtrar", async ({ page }) => {
    await ingresarCon(page, ADMIN, "Pato");
    await ir(page, "/panel/articulos?f=sinmarca");
    const lista = page.getByTestId("lista-articulos");
    await expect(lista.locator("li").first()).toBeVisible();
    await lista.locator('input[type="checkbox"]').nth(0).check();
    await lista.locator('input[type="checkbox"]').nth(1).check();
    await page.getByTestId("barra-lote").getByLabel("Cambiar marca").selectOption({ label: "DURAVIT" });
    await expect(page.getByText("2 artículos actualizados ✔")).toBeVisible();
  });

  test("el historial muestra quién hizo cada cambio", async ({ page }) => {
    await ingresarCon(page, ADMIN, "Pato");
    await ir(page, "/panel/historial");
    const h = page.getByTestId("historial");
    await expect(h).toContainText("Pato");
    await expect(h).toContainText("stock: disponible → agotado");
  });
});
