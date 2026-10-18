# Publicar en Cloudflare (catálogo + panel en dominios separados)

```
www.patitosbebe.com.ar     → catálogo (público). /panel, /ingresar y /auth NO existen (404).
patitosbebe.com.ar         → redirige a www.
admin.patitosbebe.com.ar   → panel de carga. Opcional y recomendado: protegido además con Cloudflare Access.
```

Un solo Worker atiende los tres dominios. `next.config.ts` decide qué se ve en cada uno con reglas estáticas, sin middleware. La sesión del panel vive en cookies del subdominio `admin`, así que nunca viaja al dominio público.

## Plan de Cloudflare
- **Workers Free**: 100.000 pedidos por día y **10 ms de CPU por pedido**. El panel son páginas estáticas, así que no gasta CPU. El catálogo, en cambio, se arma en el servidor en cada visita y puede pasarse de esos 10 ms: si pasa, el visitante ve un error.
- **Workers Paid (US$ 5/mes)**: 30 s de CPU por pedido y 10 millones de pedidos al mes incluidos. **Recomendado** para un negocio.

## Pasos (una sola vez)

1. **DNS**: el dominio ya está en Cloudflare. Borrá los registros viejos de `www` y de `patitosbebe.com.ar` que apuntan a GitHub Pages (tipo CNAME/A). El despliegue crea los nuevos solo, por los `routes` de `wrangler.jsonc`.
2. **Token**: en *Mi perfil → API Tokens → Create token*, usá la plantilla **"Edit Cloudflare Workers"**. Copiá también tu **Account ID** (aparece en la página de inicio de Workers).
3. **GitHub** (Settings → Secrets and variables → Actions):
   - *Secrets*: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
   - *Variables*:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `NEXT_PUBLIC_SITIO_URL=https://www.patitosbebe.com.ar`
     - `NEXT_PUBLIC_ADMIN_URL=https://admin.patitosbebe.com.ar`
     - `NEXT_PUBLIC_WHATSAPP=5493582405970`
4. **Supabase → Authentication → URL Configuration**:
   - *Site URL*: `https://admin.patitosbebe.com.ar`.
   - *Redirect URLs*: `https://admin.patitosbebe.com.ar/auth/callback` (más `http://localhost:3000/auth/callback` para desarrollo).
5. **Primer despliegue**: *Actions → Desplegar → Run workflow*. Desde ahí, cada merge a `main` con CI en verde se publica solo.

Desde tu PC también se puede: `npx wrangler login` y después `npm run cf:deploy`, con las variables `NEXT_PUBLIC_*` en `.env.local`.

## Capa extra: Cloudflare Access sobre el panel (gratis hasta 50 personas)

Con esto, quien no esté en tu lista **ni siquiera ve la pantalla de ingreso** de `admin.patitosbebe.com.ar`: Cloudflare lo frena antes de llegar a la app.

1. *Zero Trust → Access → Applications → Add an application → Self-hosted*.
2. *Application domain*: `admin.patitosbebe.com.ar`. *Session duration*: 1 mes, para no pedirlo todos los días.
3. *Policy* "Personal del local": *Action: Allow*, *Include → Emails*: los mails de los empleados (o *Emails ending in* si tienen dominio propio).
4. *Login methods*: "One-time PIN" (llega un código por mail) o Google.

Después, el empleado pasa dos puertas: Cloudflare Access y el login con Google de la app, que define su rol. Para sumar a alguien: agregás su mail en la política y lo aprobás en *Usuarios*.

## Probar localmente con el motor de Cloudflare
```bash
npm run cf:preview      # compila con OpenNext y levanta workerd (el mismo runtime de producción)
```
