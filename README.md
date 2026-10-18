# Patito's Bebé · Catálogo en vivo + panel de carga

Sistema nuevo, desde cero, que reemplaza al generador estático (`build.py` + GitHub Pages) y a la carga desde la PC.

- **Catálogo público** (`/`): se actualiza en el momento en que alguien carga u oculta algo. Tiene página propia por artículo (aparece en Google), búsqueda sin importar tildes, categorías, ofertas, novedades, agotados al final y botón de WhatsApp.
- **Panel del local** (`/panel`): pensado para el celular.
  - **Escanear** con la cámara o una lectora.
  - **Alta con fotos**: se comprimen en el celular a unos 20 + 90 KB.
  - **Autocompletar** desde las listas de proveedores.
  - **Carga masiva** a partir de varias fotos juntas.
  - **Cambios en lote**, **historial** de quién cambió qué y **usuarios con roles**.
- **Ingreso con Google**: la primera vez, el usuario queda *pendiente* hasta que un admin lo aprueba.

```
Next.js 16 + React 19 + TypeScript   →  app web (catálogo + panel), se aloja en cualquier lado
Supabase (Postgres + Auth + Storage) →  datos, login con Google, fotos
GitHub Actions                       →  pruebas automáticas, migraciones, backup diario
```

Arquitectura, decisiones y cómo sumar módulos: **[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)**.

---

## Puesta en marcha (una sola vez)

### 1. Supabase: dos proyectos (gratis)
Creá en <https://supabase.com> dos proyectos en la región **São Paulo**: `patitos-prueba` y `patitos` (producción). El plan gratis permite dos proyectos activos. Todo cambio se prueba primero en "prueba".

En cada proyecto:
1. **Aplicar el esquema.** Con la CLI: `npx supabase link --project-ref <ref>` y después `npx supabase db push`. También sirve pegar en el SQL Editor, en orden, los archivos de `supabase/migrations/`.
2. **Authentication → Sign In / Providers**:
   - **Desactivá Email**: solo se entra con Google.
   - **Dejá activado "Allow new users to sign up"**. Hace falta para el primer ingreso con Google; los usuarios nuevos quedan pendientes.
3. **Authentication → URL Configuration**:
   - *Site URL*: `https://admin.patitosbebe.com.ar`.
   - *Redirect URLs*: `https://admin.patitosbebe.com.ar/auth/callback` y `http://localhost:3000/auth/callback`.
4. **El admin inicial** es el mail de `config.emails_admin` (migración `…005_datos_iniciales.sql`: `pato08070@gmail.com`). Ese mail entra directo como admin.

### 2. Google (login)
1. En <https://console.cloud.google.com>: *APIs y servicios* → *Pantalla de consentimiento* (externa, con nombre "Patito's Bebé").
2. *Credenciales* → *Crear ID de cliente OAuth* → *Aplicación web*.
3. *URI de redireccionamiento autorizado*: `https://<ref>.supabase.co/auth/v1/callback`. Tenés que agregar uno por cada proyecto de Supabase.
4. Copiá el *Client ID* y el *Secret* en Supabase → *Authentication → Providers → Google*.

### 3. Migrar tus datos (desde tu PC con Windows)
```bat
cd herramientas
pip install -r requirements.txt
copy supabase.env.ejemplo supabase.env
:: completar supabase.env con la URL y la "service_role / secret key" (¡no se comparte!)

python migrar.py --excel "..\..\Lista_precios_estatico\stock_real.xlsx" ^
  --db "..\..\Gestion_Stock\productos_general.db" ^
  --fotos "..\..\Lista_precios_estatico\static\img" "..\..\ScrappingCoronel\resultados" ^
          "..\..\ScrappingPopeye\resultados" "..\..\ScrappingDyG\resultados" --prueba
```
`--prueba` no sube nada: comprime las fotos en `salida_prueba/` y genera **`informe_migracion.csv`** con lo que conviene revisar (nombres repetidos, sin foto, costos de relleno, códigos corregidos). Si el resultado está bien, corré el mismo comando **sin** `--prueba`. Corrélo primero contra el proyecto de prueba y después contra producción. Se puede repetir sin duplicar artículos.

Qué hace la migración:
- Le da a cada artículo un **SKU propio** (PB-000001…). El código viejo queda asociado: escanearlo o buscarlo encuentra el artículo.
- Detecta la **marca** por el nombre: Duravit, Wabro, Filgo, Skora… (lista editable en `marcas_conocidas.txt`).
- Migra **solo los artículos publicados** (`estado = SI`): se arranca limpio. Con `--incluir-ocultos` trae también los ocultos.
- Asocia el **proveedor** (Coronel, Popeye, DyG) y guarda el **costo** aparte: lo ve el personal, nunca el público.
- Calcula el precio de venta: costo × 2 redondeado a la centena.
- Corrige los códigos tipo `74711.0`, los costos de relleno (0 o 1) y los costos mal leídos (`4.728` → 4728).
- Deja las fotos **cuadradas, con fondo blanco y centradas**, igual que las que se suben desde el celular.
- **No** sube las ≈23.000 líneas scrapeadas, salvo que agregues `--con-listas`. La base general se va a llenar con los scrapers nuevos.

### 4. Alojar la app en Cloudflare (donde ya tenés el dominio)
Catálogo en `www.patitosbebe.com.ar` y panel separado en **`admin.patitosbebe.com.ar`**. En el dominio público, el panel y el login no existen. Paso a paso, plan recomendado y la capa extra de **Cloudflare Access** sobre el panel: **[docs/CLOUDFLARE.md](docs/CLOUDFLARE.md)**.

Copiá tu logo y favicon a `public/logo.png` y `public/favicon.png`.

La app también corre sin cambios en cualquier servidor Node, con el `Dockerfile` incluido (Railway, Render, VPS), si algún día querés mudarla.

### 5. GitHub Actions (secrets)
| Secret | Para qué |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Migraciones automáticas |
| `SUPABASE_REF_PRUEBA`, `SUPABASE_DB_PASSWORD_PRUEBA` | Base de prueba |
| `SUPABASE_REF_PRODUCCION`, `SUPABASE_DB_PASSWORD_PRODUCCION` | Base de producción |
| `SUPABASE_DB_URL_PRUEBA`, `SUPABASE_DB_URL_PRODUCCION` | Conexión por el *Session pooler* (Supabase → **Connect** → Session pooler → URI, con la contraseña). Si están, las migraciones las usan (GitHub no tiene IPv6). La de producción también hace el backup diario |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Que Supabase no pause el proyecto |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (+ variables `NEXT_PUBLIC_*`) | Publicar en Cloudflare (ver docs/CLOUDFLARE.md) |

---

## Trabajo diario

- **Empleados**: entran a `admin.patitosbebe.com.ar` desde el celular con Google. Las tareas principales:
  - **Escanear**: si el artículo existe, botones rápidos de *Disponible / Pocas / Agotado* y *Ocultar*. Si está en una lista de proveedor, se completa solo. Si no existe, *Crear nuevo* o *Asignar este código a un artículo existente*.
  - **Modo continuo**: escanear → foto → publicar → vuelve a abrir la cámara.
  - **Masiva**: elegir varias fotos, escribir los nombres (Enter pasa al siguiente) y *Publicar todos*.
- **Roles**:
  - **Empleado**: todo el trabajo diario, incluidos costos, precios y cambios en lote.
  - **Admin (vos)**: además ve el **historial**, aprueba **usuarios** y puede **eliminar definitivamente**.
  - Los empleados *ocultan* o *archivan*, que se puede deshacer.
- **Duplicar**: en el editor, para el mismo artículo en otro color o modelo. Copia datos y fotos; la foto no ocupa espacio de más.
- **Colores / modelos**: campo de texto libre opcional ("rojo, azul", "modelos surtidos"). Se muestra en la ficha y entra en la búsqueda. Si un mismo artículo tiene un código por color, se cargan todos los códigos en el mismo artículo.

## Desarrollo

```bash
npm install
cp .env.example .env.local      # apuntando al proyecto de PRUEBA
npm run dev                     # http://localhost:3000
npm run typecheck && npm test   # tipos + pruebas unitarias
```
Las fotos de `e2e/fotos/` son 3 imágenes chicas de prueba (≈45 KB c/u) que usan solo las pruebas automáticas. Las fotos reales de los artículos van a Supabase Storage y **nunca** al repositorio.

Para cambiar la base:
1. `npm run db:nueva nombre_del_cambio` crea un archivo nuevo en `supabase/migrations/`.
2. Escribí el SQL en ese archivo.
3. Hacé el push.

GitHub prueba la migración y la aplica a **prueba**. A producción se aplica a mano desde *Actions → Base de datos → produccion*. Nunca se editan migraciones ya aplicadas.

Pruebas automáticas, en cada cambio:
- 46 de permisos y reglas en la base.
- 11 unitarias de TypeScript.
- 3 de la migración en Python.
- 14 de punta a punta en un navegador: catálogo, separación de dominios, login con Google, aprobación, escaneo, alta con foto, autocompletar, carga masiva, cambios en lote e historial.
- Verificación de que la app compila para Cloudflare Workers.

Ver `e2e/README.md`.
