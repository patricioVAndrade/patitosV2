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
   - *Site URL*: `https://www.patitosbebe.com.ar`.
   - *Redirect URLs*: `https://www.patitosbebe.com.ar/auth/callback` y `http://localhost:3000/auth/callback`.
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
- Asocia el **proveedor** (Coronel, Popeye, DyG) y guarda el **costo** aparte; solo lo ven los admins.
- Calcula el precio de venta: costo × 2 redondeado a la centena.
- Corrige los códigos tipo `74711.0`, los costos de relleno (0 o 1) y los costos mal leídos (`4.728` → 4728).
- Sube las **≈23.000 líneas de las listas de proveedores**. No se publican: sirven para que al escanear o escribir un nombre se complete solo.

### 4. Alojar la app
La app es un servidor Next.js estándar (`output: "standalone"`), sin depender de un proveedor. Opciones:

| Opción | Costo aprox. | Comentario |
|---|---|---|
| **Vercel Pro** | US$ 20/mes | La más simple para Next.js: vista previa por cada cambio. El plan Hobby gratis **no permite uso comercial**. |
| **Railway / Render** | US$ 5–7/mes | Con el `Dockerfile` incluido. |
| **VPS propio** (Docker) | US$ 5/mes | Máximo control, más mantenimiento. |

Variables de entorno (ver `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITIO_URL`, `NEXT_PUBLIC_WHATSAPP`.

Copiá tu logo y favicon a `public/logo.png` y `public/favicon.png`. Después apuntá el dominio `www.patitosbebe.com.ar` al hosting elegido.

### 5. GitHub Actions (secrets)
| Secret | Para qué |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Migraciones automáticas |
| `SUPABASE_REF_PRUEBA`, `SUPABASE_DB_PASSWORD_PRUEBA` | Base de prueba |
| `SUPABASE_REF_PRODUCCION`, `SUPABASE_DB_PASSWORD_PRODUCCION` | Base de producción |
| `SUPABASE_DB_URL_PRODUCCION` | Backup diario |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Que Supabase no pause el proyecto |

---

## Trabajo diario

- **Empleados**: entran a `/panel` desde el celular con Google. Las tareas principales:
  - **Escanear**: si el artículo existe, botones rápidos de *Disponible / Pocas / Agotado* y *Ocultar*. Si está en una lista de proveedor, se completa solo. Si no existe, *Crear nuevo* o *Asignar este código a un artículo existente*.
  - **Modo continuo**: escanear → foto → publicar → vuelve a abrir la cámara.
  - **Masiva**: elegir varias fotos, escribir los nombres (Enter pasa al siguiente) y *Publicar todos*.
- **Vos (admin)**: además aprobás usuarios, ves costos y podés eliminar. Los demás *ocultan* o *archivan*, que se puede deshacer.

## Desarrollo

```bash
npm install
cp .env.example .env.local      # apuntando al proyecto de PRUEBA
npm run dev                     # http://localhost:3000
npm run typecheck && npm test   # tipos + pruebas unitarias
```
Para cambiar la base:
1. `npm run db:nueva nombre_del_cambio` crea un archivo nuevo en `supabase/migrations/`.
2. Escribí el SQL en ese archivo.
3. Hacé el push.

GitHub prueba la migración y la aplica a **prueba**. A producción se aplica a mano desde *Actions → Base de datos → produccion*. Nunca se editan migraciones ya aplicadas.

Pruebas automáticas, en cada cambio:
- 46 de permisos y reglas en la base.
- 11 unitarias de TypeScript.
- 3 de la migración en Python.
- 12 de punta a punta en un navegador: catálogo, login con Google, aprobación, escaneo, alta con foto, autocompletar, carga masiva, cambios en lote e historial.

Ver `e2e/README.md`.
