// =====================================================================
// "Supabase de prueba" para las pruebas de punta a punta (sin Docker).
//  - /rest/v1/*      → PostgREST REAL contra Postgres (las políticas RLS se prueban de verdad)
//  - /auth/v1/*      → login con "Google" simulado (pantalla para elegir cuenta), flujo PKCE real
//  - /storage/v1/*   → fotos guardadas en disco; para subir/borrar se consulta es_staff() en la base
// Uso: node e2e/supabase-falso.mjs   (ver e2e/README.md)
// =====================================================================
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const PUERTO = Number(process.env.PUERTO_SUPABASE ?? 54321);
const POSTGREST = process.env.POSTGREST_URL ?? "http://127.0.0.1:3001";
const SECRETO = process.env.JWT_SECRET ?? "secreto-de-prueba-de-al-menos-32-caracteres!!";
const DIR = process.env.STORAGE_DIR ?? path.resolve("e2e/.tmp/storage");
const db = new pg.Pool({ connectionString: process.env.DB_URL ?? "postgres://postgres@127.0.0.1:54322/patitos" });
fs.mkdirSync(DIR, { recursive: true });

// ---------- JWT HS256 ----------
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
export function firmar(payload) {
  const cuerpo = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}`;
  return `${cuerpo}.${crypto.createHmac("sha256", SECRETO).update(cuerpo).digest("base64url")}`;
}
function verificar(token) {
  const [h, p, f] = (token ?? "").split(".");
  if (!f) return null;
  const esperado = crypto.createHmac("sha256", SECRETO).update(`${h}.${p}`).digest("base64url");
  if (f !== esperado) return null;
  const datos = JSON.parse(Buffer.from(p, "base64url").toString());
  return datos.exp && datos.exp < Date.now() / 1000 ? null : datos;
}
export const ANON_KEY = firmar({ role: "anon", iss: "supabase-falso", exp: 4102444800 });

// ---------- utilidades HTTP ----------
const leer = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); });
const json = (res, status, cuerpo, extra = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...cors, ...extra });
  res.end(cuerpo === undefined ? "" : JSON.stringify(cuerpo));
};
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
  "access-control-expose-headers": "content-range, x-supabase-api-version",
};
const bearer = (req) => (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "") || req.headers.apikey;

// ---------- AUTH ----------
const codigos = new Map(); // code -> { usuario, challenge }
const refrescos = new Map(); // refresh_token -> usuario

async function usuarioPorEmail(email, nombre) {
  const r = await db.query("select id, email, raw_user_meta_data from auth.users where lower(email) = lower($1)", [email]);
  if (r.rows[0]) return r.rows[0];
  const n = await db.query(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id, email, raw_user_meta_data",
    [email.toLowerCase(), { full_name: nombre ?? email.split("@")[0], avatar_url: null }],
  );
  return n.rows[0];
}
function objetoUsuario(u) {
  return { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: { provider: "google" },
    user_metadata: u.raw_user_meta_data ?? {}, created_at: new Date().toISOString() };
}
function sesion(u) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const refresh = crypto.randomBytes(16).toString("hex");
  refrescos.set(refresh, u);
  return { access_token: firmar({ sub: u.id, role: "authenticated", aud: "authenticated", email: u.email, exp }),
    token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: refresh, user: objetoUsuario(u) };
}

const pantallaGoogle = (url) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Elegí una cuenta (Google de prueba)</title>
<body style="font-family:sans-serif;max-width:420px;margin:40px auto;padding:0 16px">
<h1 style="font-size:20px">Google de prueba · elegí una cuenta</h1>
<form method="post" action="/auth/v1/simular-google?${url.searchParams}">
  <label>Email <input name="email" type="email" required style="width:100%;padding:8px" value=""></label><br><br>
  <label>Nombre <input name="nombre" style="width:100%;padding:8px"></label><br><br>
  <button style="padding:10px 16px">Continuar</button>
</form></body>`;

async function auth(req, res, url) {
  const ruta = url.pathname.replace("/auth/v1", "");
  if (ruta === "/authorize") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(pantallaGoogle(url));
  }
  if (ruta === "/simular-google" && req.method === "POST") {
    const form = new URLSearchParams((await leer(req)).toString());
    const u = await usuarioPorEmail(form.get("email"), form.get("nombre") || undefined);
    const code = crypto.randomUUID();
    codigos.set(code, { usuario: u, challenge: url.searchParams.get("code_challenge") });
    const destino = new URL(url.searchParams.get("redirect_to"));
    destino.searchParams.set("code", code);
    res.writeHead(302, { location: destino.toString() });
    return res.end();
  }
  if (ruta === "/token" && req.method === "POST") {
    const cuerpo = JSON.parse((await leer(req)).toString() || "{}");
    const tipo = url.searchParams.get("grant_type");
    if (tipo === "pkce") {
      const c = codigos.get(cuerpo.auth_code);
      codigos.delete(cuerpo.auth_code);
      const desafio = crypto.createHash("sha256").update(cuerpo.code_verifier ?? "").digest("base64url");
      if (!c || (c.challenge && c.challenge !== desafio)) return json(res, 400, { code: 400, error_code: "bad_code_verifier", msg: "código inválido" });
      return json(res, 200, sesion(c.usuario));
    }
    if (tipo === "refresh_token") {
      const u = refrescos.get(cuerpo.refresh_token);
      if (!u) return json(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "refresh inválido" });
      return json(res, 200, sesion(u));
    }
    return json(res, 400, { msg: "grant_type no soportado" });
  }
  if (ruta === "/user") {
    const d = verificar(bearer(req));
    if (!d?.sub) return json(res, 401, { code: 401, error_code: "bad_jwt", msg: "token inválido" });
    const r = await db.query("select id, email, raw_user_meta_data from auth.users where id = $1", [d.sub]);
    return r.rows[0] ? json(res, 200, objetoUsuario(r.rows[0])) : json(res, 404, { msg: "usuario no existe" });
  }
  if (ruta === "/logout") return json(res, 204);
  return json(res, 404, { msg: `auth ${ruta} no simulado` });
}

// ---------- STORAGE ----------
async function esStaff(token) {
  const d = verificar(token);
  if (d?.role === "service_role") return true;
  if (!d?.sub) return false;
  const c = await db.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(d)]);
    await c.query("set local role authenticated");
    const r = await c.query("select public.es_staff() as ok");
    await c.query("rollback");
    return r.rows[0].ok === true;
  } finally {
    c.release();
  }
}
function archivoDeMultipart(buf, tipo) {
  const borde = "--" + /boundary=(?:"([^"]+)"|([^;]+))/.exec(tipo)?.slice(1).find(Boolean);
  for (const parte of buf.toString("latin1").split(borde)) {
    const i = parte.indexOf("\r\n\r\n");
    const cab = parte.slice(0, i);
    if (/filename=|name=""/.test(cab) && /content-type/i.test(cab)) {
      const mime = /content-type:\s*([^\r\n]+)/i.exec(cab)[1].trim();
      return { mime, datos: Buffer.from(parte.slice(i + 4, parte.length - 2), "latin1") };
    }
  }
  return null;
}
async function storage(req, res, url) {
  const publico = url.pathname.match(/^\/storage\/v1\/object\/public\/productos\/(.+)$/);
  if (publico && req.method === "GET") {
    const f = path.join(DIR, decodeURIComponent(publico[1]));
    if (!f.startsWith(DIR) || !fs.existsSync(f)) return json(res, 404, { error: "not_found" });
    res.writeHead(200, { "content-type": f.endsWith(".webp") ? "image/webp" : "image/jpeg", "cache-control": "max-age=31536000", ...cors });
    return fs.createReadStream(f).pipe(res);
  }
  const objeto = url.pathname.match(/^\/storage\/v1\/object\/productos\/(.+)$/);
  if (objeto && (req.method === "POST" || req.method === "PUT")) {
    if (!(await esStaff(bearer(req)))) return json(res, 403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
    const tipo = req.headers["content-type"] ?? "";
    const cuerpo = await leer(req);
    const archivo = tipo.startsWith("multipart/") ? archivoDeMultipart(cuerpo, tipo) : { mime: tipo, datos: cuerpo };
    if (!archivo || !["image/webp", "image/jpeg"].includes(archivo.mime)) return json(res, 415, { error: "invalid_mime_type", message: `tipo no permitido: ${archivo?.mime}` });
    if (archivo.datos.length > 1048576) return json(res, 413, { error: "Payload too large" });
    const f = path.join(DIR, decodeURIComponent(objeto[1]));
    if (!f.startsWith(DIR)) return json(res, 400, { error: "ruta inválida" });
    if (fs.existsSync(f) && req.headers["x-upsert"] !== "true") return json(res, 409, { error: "Duplicate", message: "The resource already exists" });
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, archivo.datos);
    return json(res, 200, { Key: `productos/${objeto[1]}`, Id: crypto.randomUUID() });
  }
  if (url.pathname === "/storage/v1/object/productos" && req.method === "DELETE") {
    if (!(await esStaff(bearer(req)))) return json(res, 403, { error: "Unauthorized" });
    const { prefixes = [] } = JSON.parse((await leer(req)).toString() || "{}");
    const borrados = [];
    for (const p of prefixes) {
      const f = path.join(DIR, p);
      if (f.startsWith(DIR) && fs.existsSync(f)) { fs.unlinkSync(f); borrados.push({ name: p }); }
    }
    return json(res, 200, borrados);
  }
  return json(res, 404, { error: "storage no simulado" });
}

// ---------- REST → PostgREST ----------
async function rest(req, res, url) {
  const destino = POSTGREST + url.pathname.replace("/rest/v1", "") + url.search;
  const cabeceras = { ...req.headers };
  delete cabeceras.host;
  delete cabeceras["content-length"];
  const token = bearer(req);
  if (token) cabeceras.authorization = `Bearer ${token}`;
  const cuerpo = ["GET", "HEAD"].includes(req.method) ? undefined : await leer(req);
  const r = await fetch(destino, { method: req.method, headers: cabeceras, body: cuerpo });
  const salida = {};
  r.headers.forEach((v, k) => { if (!["content-encoding", "transfer-encoding", "content-length"].includes(k)) salida[k] = v; });
  res.writeHead(r.status, { ...salida, ...cors });
  res.end(Buffer.from(await r.arrayBuffer()));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
    if (url.pathname.startsWith("/auth/v1")) return await auth(req, res, url);
    if (url.pathname.startsWith("/storage/v1")) return await storage(req, res, url);
    if (url.pathname.startsWith("/rest/v1")) return await rest(req, res, url);
    json(res, 404, { msg: "ruta no simulada" });
  } catch (e) {
    console.error(e);
    json(res, 500, { msg: String(e) });
  }
}).listen(PUERTO, () => {
  console.log(`Supabase de prueba en http://127.0.0.1:${PUERTO}`);
  console.log(`ANON_KEY=${ANON_KEY}`);
});
