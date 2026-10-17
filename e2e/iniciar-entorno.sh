#!/usr/bin/env bash
# Levanta el entorno de pruebas SIN Docker: Postgres (ya corriendo) + PostgREST + Supabase de prueba.
# Variables: DB_URL (postgres superusuario), POSTGREST_BIN (ruta al binario de PostgREST v12)
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DB_URL:=postgres://postgres@127.0.0.1:54322/patitos}"
: "${POSTGREST_BIN:=postgrest}"
export JWT_SECRET="secreto-de-prueba-de-al-menos-32-caracteres!!"
mkdir -p e2e/.tmp
AUTH_URL="${DB_URL/postgres@/authenticator:autenticador@}"
cat > e2e/.tmp/postgrest.conf <<CONF
db-uri = "$AUTH_URL"
db-schemas = "public"
db-anon-role = "anon"
db-pool = 10
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 3001
db-max-rows = 1000
CONF
"$POSTGREST_BIN" e2e/.tmp/postgrest.conf > e2e/.tmp/postgrest.log 2>&1 &
echo $! > e2e/.tmp/postgrest.pid
DB_URL="$DB_URL" JWT_SECRET="$JWT_SECRET" node e2e/supabase-falso.mjs > e2e/.tmp/supabase-falso.log 2>&1 &
echo $! > e2e/.tmp/supabase-falso.pid
for i in $(seq 1 30); do
  curl -fsS http://127.0.0.1:3001/ >/dev/null 2>&1 && grep -q ANON_KEY e2e/.tmp/supabase-falso.log && break
  sleep 0.5
done
grep ANON_KEY e2e/.tmp/supabase-falso.log | cut -d= -f2 > e2e/.tmp/anon_key
node -e '
const c=require("crypto");const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
const h=b({alg:"HS256",typ:"JWT"}),p=b({role:"service_role",iss:"supabase-falso",exp:4102444800});
process.stdout.write(h+"."+p+"."+c.createHmac("sha256",process.env.JWT_SECRET).update(h+"."+p).digest("base64url"))' > e2e/.tmp/service_key
echo "✔ Entorno listo: Supabase de prueba en http://127.0.0.1:54321"
