# Arquitectura

## Principios

1. **La base de datos manda.** Las reglas que no se pueden romper viven en Postgres como restricciones, permisos (RLS) y funciones transaccionales. Por ejemplo: códigos únicos, precios ≥ 0, un SKU que nunca cambia, quién puede ver costos. Si mañana se suma una app de caja o un script, las reglas siguen valiendo.
2. **Nada atado a un proveedor.** Next.js corre como servidor Node estándar (`output: "standalone"`) y Supabase es Postgres puro. Se puede mudar el hosting o la base sin reescribir.
3. **Cambios rápidos pero seguros.** Las migraciones están versionadas en git y cada cambio se prueba automáticamente: tipos, permisos, flujo completo en navegador. Se aplica primero a un proyecto de prueba y recién después a producción.
4. **Todo cambio deja rastro.** El historial lo llenan triggers de la base, así que es imposible "olvidarse" de registrar algo.

## Capas

```
Clientes ──► www.patitosbebe.com.ar ──┐
Personal ──► admin.patitosbebe.com.ar ┤  (opcional: Cloudflare Access delante)
                                      ▼
            Next.js en Cloudflare Workers (un solo Worker; next.config.ts separa por dominio)
              ├─ Catálogo público: Server Components → vistas v_catalogo / v_producto (solo lectura, anónimo)
              └─ Panel (solo en admin.*): app en el navegador → Supabase con la sesión del usuario (RLS) + RPC
                                    │
Supabase ────────────────────────────┤
  ├─ Postgres: tablas, RLS, triggers (historial, precios), funciones (guardar_producto, buscar_codigo…)
  ├─ Auth: Google → perfil "pendiente" → admin aprueba
  └─ Storage: bucket "productos" (WebP comprimido en el celular, caché 1 año)
```

## Modelo de datos

```
productos ─┬─< codigos            (barras / proveedor / legado: todos encuentran el mismo artículo)
  │ sku    ├─< imagenes           (varias, ordenadas; la primera es la principal)
  │        ├─< producto_etiquetas >─ etiquetas   (campañas: Día del Niño, Navidad…)
  │        ├─1 productos_privado  (costo: lo ve el personal, nunca el público)
  │        ├─< historial_precios  (cada cambio de precio, con el ajuste masivo que lo causó)
  │        └─< movimientos_stock  (etapa 2)
  ├─> categorias
  ├─> marcas          ← aumentos masivos por marca (etapa 3)
  └─> proveedores     ← aumentos por proveedor; lista_proveedores = 23.000 artículos para autocompletar

perfiles (rol: empleado | admin · estado: pendiente | activo | bloqueado)
historial (quién, qué tabla, qué cambió: antes → ahora)
ajustes_precio (registro de cada aumento masivo, con criterio y %; permite revertir)
ubicaciones (Local, Depósito… para stock por lugar)
config (margen, redondeo, admins iniciales)
```

**Identidad del artículo**: el `sku` (PB-000123) lo genera la base y no cambia nunca, ni aunque se intente. La URL pública usa el SKU (`/p/PB-000123/nombre`); si cambia el nombre, el link viejo redirige.

## Seguridad (tres capas)

| Capa | Qué hace |
|---|---|
| **RLS en Postgres** (la que importa) | El público no lee tablas: solo las vistas `v_catalogo` y `v_producto`, que muestran lo publicado y sin costos. Un usuario *pendiente* o *bloqueado* no puede nada. El personal (empleado o admin) ve costos y listas de proveedores. Solo el admin ve el historial, administra usuarios y borra definitivamente. Siempre queda al menos un admin. Una foto compartida entre artículos (duplicados) solo se borra del storage cuando ya no la usa nadie (`fotos_sin_uso`). |
| **Dominios separados** | En `www` el panel, el login y `/auth` responden 404; viven solo en `admin.`. Las cookies de sesión son del subdominio `admin` y nunca viajan al público. Opcional: Cloudflare Access delante de `admin.` (docs/CLOUDFLARE.md). |
| **Panel** | `GuardiaPanel` exige sesión y perfil activo antes de mostrar nada. Igual, sin RLS no habría datos que mostrar. |
| **Interfaz** | Oculta botones según el rol (`src/lib/permisos.ts`). Es solo comodidad: no es seguridad. |

Las vistas públicas son *security definer* a propósito: el linter de Supabase las va a marcar, pero filtran por `estado = 'publicado'` y exponen solo columnas seguras.

Las 46 pruebas de `supabase/tests/permisos.test.sql` verifican todo esto en cada cambio.

## Estructura del código

```
src/
  app/
    (tienda)/            catálogo público: inicio, /c/[categoría], /p/[sku]/[slug]
    panel/               panel (protegido): inicio+escaneo, articulos, masiva, historial, usuarios
    ingresar/ auth/      login con Google (PKCE), callback, salir
    api/catalogo/        "ver más" del catálogo
  componentes/
    tienda/  panel/  ui/
  lib/
    supabase/            clientes (navegador / servidor / público) y tipos de la base
    catalogo.ts          consultas del catálogo público
    imagenes.ts          compresión y subida de fotos
    validacion.ts        reglas del formulario (zod)
    permisos.ts formato.ts errores.ts negocio.ts env.ts sesion.ts
supabase/
  migrations/            ÚNICA fuente de verdad del esquema (nunca editar las ya aplicadas)
  tests/                 pruebas de permisos en SQL
herramientas/            migración desde el sistema viejo (Python)
e2e/                     pruebas de punta a punta + Supabase de prueba sin Docker
```

## Cómo sumar un módulo (receta)

Ejemplo: **aumento de precios por marca**, que ya tiene la estructura creada.

1. **Migración** (`npm run db:nueva aumentos_por_marca`). Una función `ajustar_precios(criterio jsonb, porcentaje numeric, redondeo int, solo_vista boolean)` que:
   - verifica `es_staff()`;
   - con `solo_vista = true` devuelve la lista de artículos con precio actual → nuevo (para revisar antes de aplicar);
   - si se aplica, crea la fila en `ajustes_precio`, hace `set_config('patitos.ajuste_id', …)` y actualiza los precios. El trigger ya guarda cada cambio en `historial_precios`, vinculado al ajuste;
   - `revertir_ajuste(id)` vuelve cada precio al `precio_antes` de ese ajuste.
2. **Pruebas SQL**: un usuario pendiente no puede aplicar ajustes; el redondeo es correcto; revertir deja todo igual.
3. **Tipos**: `npm run db:tipos`.
4. **Pantalla**: `src/app/panel/precios/`. Se elige marca, proveedor o categoría, se pone el %, se ve la vista previa y se confirma.
5. **Prueba e2e** del flujo.
6. **PR** → CI en verde → merge → se aplica en *prueba* → se revisa → *produccion*.

## Lo que ya quedó preparado (sin implementar todavía)

| Futuro | Qué ya existe |
|---|---|
| **Aumentos masivos** por marca, proveedor o categoría | `marcas`, `proveedores`, `productos.marca_id/proveedor_id`, `ajustes_precio`, `historial_precios` (registra desde el día 1), `config.margen/redondeo`. La migración ya asigna marcas por nombre. |
| **Stock real** (etapa 2) | `movimientos_stock` (ingreso / venta / ajuste / devolución / conteo / traslado; no se edita ni borra), `ubicaciones`, `productos.controla_stock`. Falta: la función `registrar_movimiento`, el cálculo de disponibilidad cuando `controla_stock` y las pantallas *Ingreso de mercadería* / *Venta rápida* / *Conteo*. |
| **Filtro por edad** en el catálogo | `edad_desde_meses`, `edad_hasta_meses` (ya se cargan en el editor). |
| **Campañas** (Día del Niño, Navidad) | `etiquetas` + `producto_etiquetas`; con `visible = true` se pueden mostrar como filtro público. |
| **Margen por artículo** y reportes | Costo en `productos_privado`; historial de precios. |
| **Etiquetas imprimibles** con código | SKU propio estable; los códigos están en `codigos`. |

## Decisiones (y por qué)

- **Next.js + React + TypeScript**: el ecosistema más usado, que ya conocés; páginas del servidor para Google y componentes interactivos para el panel en la misma app.
- **Cloudflare Workers** (adaptador OpenNext): el dominio ya estaba ahí; el panel queda estático (no gasta CPU) y el catálogo se genera en el servidor. Si algún día hay que mudarse, el mismo código corre en Node (`Dockerfile`).
- **Supabase**: Postgres real (sin lock-in), RLS, login con Google y almacenamiento en un solo servicio, con plan gratis suficiente para empezar.
- **Fotos comprimidas en el celular** y no en el servidor: el plan gratis no transforma imágenes, la subida es más rápida con mala señal y no se paga procesamiento.
- **Funciones RPC para operaciones compuestas** (`guardar_producto`): artículo + códigos + fotos + etiquetas + costo se guardan en una sola transacción. Si algo falla, no queda nada a medias.
- **Lector de códigos**: el nativo del navegador (Android) y, si no existe (iPhone/PC), ZXing en WebAssembly servido desde el propio sitio. No hace falta lectora física ni Python en el celular; una lectora USB también funciona porque se comporta como un teclado.
- **No** se hizo facturación ni carrito: la facturación electrónica conviene integrarla con un sistema que ya exista, y el carrito recién tiene sentido con stock confiable.
