# Pruebas de punta a punta

Corren la app real contra un "Supabase de prueba" armado con piezas reales:
**Postgres + PostgREST** (las políticas RLS se prueban de verdad) y un pequeño simulador
de login con Google y de almacenamiento de fotos (`supabase-falso.mjs`).

En GitHub Actions se ejecutan solas en cada cambio (ver `.github/workflows/ci.yml`).

Local (Linux/Mac, con Postgres 15+ y el binario de PostgREST v12):

```bash
psql "$DB_URL" -f supabase/tests/00_stubs_locales.sql
for f in supabase/migrations/*.sql; do psql "$DB_URL" -f "$f"; done
POSTGREST_BIN=./postgrest ./e2e/iniciar-entorno.sh
# migrar datos de ejemplo (opcional) y compilar con las claves de prueba:
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=$(cat e2e/.tmp/anon_key) npm run build
npm start &
E2E_FOTOS=foto1.jpg,foto2.jpg,foto3.jpg npm run e2e
./e2e/detener-entorno.sh
```
