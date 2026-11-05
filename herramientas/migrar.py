"""
Migración del sistema viejo (stock_real.xlsx + productos_general.db + fotos) a Supabase.

Qué hace:
  · Cada artículo del Excel recibe un SKU propio (PB-000001, PB-000002, …).
  · El código viejo (WIL225199, 90007…) queda asociado como "código del proveedor" o "código viejo":
    escanearlo o buscarlo sigue encontrando el artículo.
  · Detecta la MARCA por el nombre (lista en marcas_conocidas.txt) → aumentos por marca en el futuro.
  · Asocia el PROVEEDOR (Coronel / Popeye / DyG) cruzando el código con productos_general.db.
  · Corrige: códigos "74711.0", costos de relleno (0, 1…), costos mal leídos (4.728 → 4728), categorías.
  · Comprime las fotos (WebP ~20 KB + ~90 KB) y las sube.
  · Guarda el costo aparte (lo ve el personal, nunca el público) y el precio de venta = costo × 2 redondeado.
  · Migra SOLO lo publicado (estado SI): se arranca limpio. Las listas de proveedores (≈23.000)
    se suben solo con --con-listas (productos_general.db se usa igual para reconocer el proveedor).
  · Las fotos quedan cuadradas, fondo blanco y centradas (igual que las que se suben desde el celular).
  · Genera informe_migracion.csv con todo lo que conviene revisar (duplicados, sin foto, sin precio…).

Uso:
  pip install -r requirements.txt
  python migrar.py --excel RUTA\\stock_real.xlsx --db RUTA\\productos_general.db --fotos CARPETA1 CARPETA2 --prueba
  python migrar.py ...  (sin --prueba, con supabase.env configurado)

Es re-ejecutable: los artículos que ya se migraron (mismo código viejo) no se duplican.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import math
import os
import re
import sqlite3
import sys
import unicodedata
from dataclasses import dataclass, field
from datetime import date, timedelta

import pandas as pd
from PIL import Image, ImageChops, ImageOps

AQUI = os.path.dirname(os.path.abspath(__file__))
BUCKET = "productos"
TAMANIOS = {"t": (400, 72), "f": (1000, 78)}
EXT_FOTOS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}

CATEGORIAS = {  # nombre en el sistema viejo (normalizado) -> slug nuevo
    "jugueteria": "jugueteria", "juguetes": "jugueteria",
    "pelucheria": "pelucheria", "peluches": "pelucheria",
    "libreria": "libreria", "cartucheras_carpetas": "libreria", "cartucheras": "libreria", "libros": "libreria",
    "arte_manualidades": "libreria", "escolar": "libreria", "papeleria": "libreria", "carpetas": "libreria",
    "marroquineria": "mochilas-y-bolsos", "mochilas_maletines": "mochilas-y-bolsos", "mochilas": "mochilas-y-bolsos",
    "articulos_viaje": "mochilas-y-bolsos", "bandoleras": "mochilas-y-bolsos",
    "hogar": "hogar", "bazar_cocina": "hogar", "deco_hogar": "hogar", "aromatizacion_velas": "hogar",
    "textil": "hogar", "higiene_limpieza": "hogar", "bazar": "hogar",
    "belleza y accesorios": "belleza-y-accesorios", "belleza_accesorios": "belleza-y-accesorios",
    "belleza": "belleza-y-accesorios", "accesorios": "belleza-y-accesorios",
    "electro": "electro", "verano": "verano", "cotillon": "cotillon", "navidad": "cotillon",
    "simbolos_patrios": "cotillon", "regaleria": "regaleria", "varios": "varios",
}
PROVEEDORES = {"coronel": "Coronel", "popeye": "Popeye", "dyg": "DyG"}


# ----------------------------------------------------------------------------- utilidades
def normalizar(t: str) -> str:
    t = unicodedata.normalize("NFD", t or "")
    return "".join(c for c in t if unicodedata.category(c) != "Mn").lower()


def slugify(t: str) -> str:  # igual que public.slugify en la base
    return re.sub(r"[^a-z0-9]+", "-", normalizar(t)).strip("-")[:80]


def texto(v) -> str:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return ""
    s = str(v).strip()
    return "" if s.lower() in ("nan", "none") else s


def limpiar_codigo(v) -> tuple[str, bool]:
    s = re.sub(r"\s+", "", texto(v)).upper()
    s2 = re.sub(r"^(\d+)\.0$", r"\1", s)
    return s2, s2 != s


def a_numero(v) -> float | None:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = texto(v).replace("$", "").replace(" ", "")
    if not s:
        return None
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"\d{1,3}(\.\d{3})+", s):
        s = s.replace(".", "")
    try:
        return float(s)
    except ValueError:
        return None


def corregir_miles(c: float | None) -> float | None:
    """4.728 (mal leído) -> 4728. Solo si tiene exactamente 3 decimales y es < 100."""
    if c is not None and 0 < c < 100:
        x = round(c * 1000)
        if abs(c * 1000 - x) < 1e-6 and x % 10 != 0:
            return float(x)
    return c


def precio_venta(costo: float | None, margen=2.0, redondeo=100, minimo=100) -> float | None:
    if costo is None or costo < minimo:
        return None
    return float(int(costo * margen / redondeo + 0.5) * redondeo)


def es_si(v) -> bool:
    return texto(v).upper() in ("SI", "SÍ", "S", "1", "TRUE", "X")


def nombre_limpio(n: str) -> str:
    return re.sub(r"\s+", " ", texto(n).replace('"', "″")).strip().upper()


def cargar_marcas() -> list[str]:
    ruta = os.path.join(AQUI, "marcas_conocidas.txt")
    marcas = []
    for linea in open(ruta, encoding="utf-8"):
        linea = linea.strip()
        if linea and not linea.startswith("#"):
            marcas.append(linea.upper())
    return sorted(set(marcas), key=len, reverse=True)  # las más largas primero ("FISHER PRICE" antes que…)


def detectar_marca(nombre: str, marcas: list[str]) -> str | None:
    n = " " + re.sub(r"[^A-Z0-9 ]", " ", normalizar(nombre).upper()) + " "
    for m in marcas:
        if f" {m} " in n:
            return m
    return None


# ----------------------------------------------------------------------------- fotos
def indexar_fotos(carpetas: list[str]) -> dict[str, str]:
    indice: dict[str, str] = {}
    for c in carpetas:
        if not os.path.isdir(c):
            print(f"  ⚠️  No existe la carpeta de fotos: {c}")
            continue
        for raiz, _, archivos in os.walk(c):
            for a in archivos:
                if os.path.splitext(a)[1].lower() in EXT_FOTOS:
                    indice.setdefault(a.lower(), os.path.join(raiz, a))
    return indice


def area_util(im: Image.Image, umbral: int = 242) -> tuple[int, int, int, int] | None:
    """Rectángulo del producto ignorando bordes casi blancos (igual que src/lib/encuadre.ts)."""
    canales = [c.point(lambda v: 255 if v < umbral else 0) for c in im.split()[:3]]
    mascara = ImageChops.lighter(ImageChops.lighter(canales[0], canales[1]), canales[2])
    return mascara.getbbox()


def lienzo_cuadrado(w: int, h: int, lado: int, margen: float = 0.05) -> tuple[int, int, int, int, int]:
    util = round(lado * (1 - 2 * margen))
    escala = min(1.0, util / max(w, h))  # nunca agranda
    nw, nh = max(1, round(w * escala)), max(1, round(h * escala))
    lienzo = max(1, round(max(nw, nh) / (1 - 2 * margen)))
    return lienzo, nw, nh, round((lienzo - nw) / 2), round((lienzo - nh) / 2)


def estandarizar(im: Image.Image, lado: int) -> Image.Image:
    """Foto cuadrada, fondo blanco, producto centrado y sin bordes blancos de más."""
    caja = area_util(im)
    if caja:
        x0, y0, x1, y1 = max(0, caja[0] - 2), max(0, caja[1] - 2), min(im.width, caja[2] + 2), min(im.height, caja[3] + 2)
        if (x1 - x0) * (y1 - y0) <= im.width * im.height * 0.97:
            im = im.crop((x0, y0, x1, y1))
    lienzo, nw, nh, x, y = lienzo_cuadrado(im.width, im.height, lado)
    salida = Image.new("RGB", (lienzo, lienzo), (255, 255, 255))
    salida.paste(im.resize((nw, nh), Image.LANCZOS), (x, y))
    return salida


def comprimir(ruta: str) -> tuple[dict[str, bytes], int, int]:
    with Image.open(ruta) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            fondo = Image.new("RGB", im.size, (255, 255, 255))
            fondo.paste(im, mask=im.split()[-1])
            im = fondo
        else:
            im = im.convert("RGB")
        salida, ancho, alto = {}, 0, 0
        for suf, (lado, calidad) in TAMANIOS.items():
            c = estandarizar(im, lado)
            if suf == "f":
                ancho, alto = c.size
            b = io.BytesIO()
            c.save(b, "WEBP", quality=calidad, method=6)
            salida[suf] = b.getvalue()
        return salida, ancho, alto


# ----------------------------------------------------------------------------- Supabase (REST)
class Supabase:
    def __init__(self, url: str, clave: str):
        import requests
        self.url = url.rstrip("/")
        self.s = requests.Session()
        self.s.headers["apikey"] = clave
        if not clave.startswith("sb_"):
            self.s.headers["Authorization"] = f"Bearer {clave}"

    def _ok(self, r):
        if r.status_code >= 300:
            raise RuntimeError(f"{r.status_code} {r.request.method} {r.url}\n{r.text[:800]}")
        return r

    def leer(self, tabla: str, columnas: str, filtro: dict | None = None) -> list[dict]:
        filas, desde = [], 0
        while True:
            r = self._ok(self.s.get(f"{self.url}/rest/v1/{tabla}", params={"select": columnas, **(filtro or {})},
                                    headers={"Range": f"{desde}-{desde + 999}"}))
            lote = r.json()
            filas += lote
            if len(lote) < 1000:
                return filas
            desde += 1000

    def insertar(self, tabla: str, filas: list[dict], conflicto: str | None = None, devolver=False, ignorar=False, lote=500):
        salida = []
        for i in range(0, len(filas), lote):
            pref = ["return=representation" if devolver else "return=minimal"]
            if conflicto:
                pref.append("resolution=ignore-duplicates" if ignorar else "resolution=merge-duplicates")
            r = self._ok(self.s.post(f"{self.url}/rest/v1/{tabla}", json=filas[i:i + lote],
                                     params={"on_conflict": conflicto} if conflicto else None,
                                     headers={"Prefer": ",".join(pref)}))
            if devolver:
                salida += r.json()
        return salida

    def rpc(self, funcion: str, args: dict):
        return self._ok(self.s.post(f"{self.url}/rest/v1/rpc/{funcion}", json=args)).json()

    def subir(self, ruta: str, datos: bytes):
        self._ok(self.s.post(f"{self.url}/storage/v1/object/{BUCKET}/{ruta}", data=datos, headers={
            "Content-Type": "image/webp", "x-upsert": "true", "cache-control": "max-age=31536000"}))


def cargar_config() -> tuple[str, str]:
    url, clave = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_KEY", "")
    archivo = os.path.join(AQUI, "supabase.env")
    if os.path.exists(archivo):
        for linea in open(archivo, encoding="utf-8"):
            if "=" in linea and not linea.strip().startswith("#"):
                k, v = (x.strip().strip('"').strip("'") for x in linea.split("=", 1))
                if k == "SUPABASE_URL" and not url:
                    url = v
                if k == "SUPABASE_SERVICE_KEY" and not clave:
                    clave = v
    if not url or not clave or "TU-PROYECTO" in url:
        sys.exit("❌ Falta configurar herramientas/supabase.env (SUPABASE_URL y SUPABASE_SERVICE_KEY). Ver README.")
    return url, clave


# ----------------------------------------------------------------------------- lectura de datos viejos
@dataclass
class Articulo:
    codigo_viejo: str
    nombre: str
    categoria_slug: str
    costo: float | None
    precio: float | None
    visible: bool
    oferta: bool
    nuevo: bool
    foto: str
    marca: str | None = None
    proveedor: str | None = None
    problemas: list[str] = field(default_factory=list)


def leer_maestro(ruta: str, marcas: list[str]) -> list[dict]:
    con = sqlite3.connect(ruta)
    df = pd.read_sql("select codigo, nombre, categoria, precio, proveedor from productos_maestros", con)
    con.close()
    filas, vistos = [], set()
    for _, r in df.iterrows():
        codigo, _ = limpiar_codigo(r["codigo"])
        nombre = nombre_limpio(r["nombre"])
        prov = PROVEEDORES.get(texto(r["proveedor"]).lower().replace(" ", ""))
        if not codigo or not nombre or not prov or (prov, codigo) in vistos:
            continue
        vistos.add((prov, codigo))
        cat_slug = CATEGORIAS.get(normalizar(texto(r["categoria"])))
        filas.append({
            "proveedor": prov, "codigo": codigo, "nombre": nombre,
            "categoria": cat_slug, "marca": detectar_marca(nombre, marcas),
            "costo": corregir_miles(a_numero(r["precio"])),
        })
    return filas


def leer_excel(ruta: str, marcas: list[str], prov_por_codigo: dict[str, str]) -> list[Articulo]:
    df = pd.read_excel(ruta, dtype=str)
    df.columns = df.columns.str.strip().str.lower()
    arts, vistos = [], set()
    for _, f in df.iterrows():
        codigo, corregido = limpiar_codigo(f.get("codigo"))
        nombre = nombre_limpio(f.get("nombre"))
        if not codigo or not nombre:
            continue
        if codigo in vistos:
            print(f"  ⚠️  Código repetido en el Excel, se usa la primera fila: {codigo}")
            continue
        vistos.add(codigo)
        cat_original = texto(f.get("categoria"))
        cat = CATEGORIAS.get(normalizar(cat_original), "varios")
        costo = a_numero(f.get("precio"))
        a = Articulo(
            codigo_viejo=codigo, nombre=nombre, categoria_slug=cat,
            costo=costo if costo and costo >= 100 else None,
            precio=precio_venta(costo),
            visible=texto(f.get("estado")).upper() != "NO",
            oferta=es_si(f.get("oferta")), nuevo=es_si(f.get("nuevo")),
            foto=texto(f.get("foto")),
            marca=detectar_marca(nombre, marcas),
            proveedor=prov_por_codigo.get(codigo),
        )
        if corregido:
            a.problemas.append("código corregido (.0)")
        if costo is not None and costo < 100:
            a.problemas.append(f"costo de relleno ({costo:g}) → sin precio")
        if cat_original and normalizar(cat_original) not in CATEGORIAS:
            a.problemas.append(f"categoría desconocida '{cat_original}' → Varios")
        arts.append(a)
    # nombres repetidos
    por_nombre: dict[str, list[Articulo]] = {}
    for a in arts:
        por_nombre.setdefault(normalizar(a.nombre), []).append(a)
    for lista in por_nombre.values():
        if len(lista) > 1:
            for a in lista:
                a.problemas.append(f"nombre repetido ({len(lista)} artículos): revisar si es el mismo")
    return arts


# ----------------------------------------------------------------------------- principal
def main():
    ap = argparse.ArgumentParser(description="Migrar el catálogo viejo a Supabase")
    ap.add_argument("--excel", required=True, help="stock_real.xlsx")
    ap.add_argument("--db", required=True, help="productos_general.db (listas de proveedores)")
    ap.add_argument("--fotos", nargs="*", default=[], help="Carpetas donde buscar las fotos")
    ap.add_argument("--prueba", action="store_true", help="No sube nada: comprime en ./salida_prueba y genera el informe")
    ap.add_argument("--con-listas", action="store_true",
                    help="Subir también las listas de proveedores (≈23.000). Por defecto NO: se arranca limpio")
    ap.add_argument("--incluir-ocultos", action="store_true",
                    help="Migrar también los artículos con estado NO (ocultos). Por defecto solo los publicados")
    args = ap.parse_args()

    for r in [args.excel, args.db]:
        if not os.path.exists(r):
            sys.exit(f"❌ No encuentro {r}")

    marcas = cargar_marcas()
    print("📂 Leyendo listas de proveedores…")
    maestro = leer_maestro(args.db, marcas)
    prov_por_codigo = {}
    for m in maestro:
        prov_por_codigo.setdefault(m["codigo"], m["proveedor"])
    print(f"   {len(maestro):,} artículos de proveedores")

    print("📂 Leyendo el Excel del catálogo…")
    arts = leer_excel(args.excel, marcas, prov_por_codigo)
    if not args.incluir_ocultos:
        ocultos = sum(1 for a in arts if not a.visible)
        arts = [a for a in arts if a.visible]
        print(f"   Solo publicados: se dejan afuera {ocultos} ocultos (usá --incluir-ocultos para traerlos)")
    print(f"   {len(arts):,} artículos · con marca detectada: {sum(1 for a in arts if a.marca):,} · "
          f"con proveedor: {sum(1 for a in arts if a.proveedor):,}")

    sb = None if args.prueba else Supabase(*cargar_config())

    # --- categorías / marcas / proveedores ------------------------------------------------
    cat_id: dict[str, int] = {}
    marca_id: dict[str, int] = {}
    prov_id: dict[str, int] = {}
    if sb:
        for c in sb.leer("categorias", "id,slug"):
            cat_id[c["slug"]] = c["id"]
        faltan = {a.categoria_slug for a in arts} - set(cat_id)
        if faltan:
            sys.exit(f"❌ Faltan categorías en la base: {faltan}")
        nombres_marcas = sorted({a.marca for a in arts if a.marca} | ({m["marca"] for m in maestro if m["marca"]} if args.con_listas else set()))
        sb.insertar("marcas", [{"nombre": m, "slug": slugify(m)} for m in nombres_marcas], conflicto="slug", ignorar=True)
        for m in sb.leer("marcas", "id,slug"):
            marca_id[m["slug"]] = m["id"]
        sb.insertar("proveedores", [{"nombre": p} for p in PROVEEDORES.values()], conflicto="nombre", ignorar=True)
        for p in sb.leer("proveedores", "id,nombre"):
            prov_id[p["nombre"]] = p["id"]

    # --- ¿ya migrados? (re-ejecutable) ---------------------------------------------------
    ya = {}
    if sb:
        for c in sb.leer("codigos", "codigo,producto_id", {"tipo": "in.(proveedor,legado)"}):
            ya[c["codigo"]] = c["producto_id"]
    nuevos = [a for a in arts if a.codigo_viejo not in ya]
    print(f"➕ A migrar: {len(nuevos):,} (ya migrados antes: {len(arts) - len(nuevos):,})")

    # --- fotos ------------------------------------------------------------------------------
    print("🖼️  Buscando y comprimiendo fotos…")
    indice = indexar_fotos(args.fotos)
    salida_prueba = os.path.join(AQUI, "salida_prueba")
    if args.prueba:
        os.makedirs(salida_prueba, exist_ok=True)
    fotos: dict[str, dict] = {}
    peso_antes = peso_despues = 0
    for n, a in enumerate(nuevos, 1):
        archivo = indice.get(os.path.basename(a.foto).lower()) if a.foto else None
        if not archivo:
            a.problemas.append("sin foto")
            continue
        try:
            datos, ancho, alto = comprimir(archivo)
        except Exception as e:  # noqa: BLE001
            a.problemas.append(f"foto ilegible: {e}")
            continue
        h = hashlib.sha1(open(archivo, "rb").read()).hexdigest()[:10]
        rutas = {s: f"migracion/{h}-{s}.webp" for s in datos}   # misma foto = mismo archivo (no se duplica)
        peso_antes += os.path.getsize(archivo)
        if rutas["t"] not in {f["ruta_thumb"] for f in fotos.values()}:
            peso_despues += sum(len(d) for d in datos.values())
            for s, d in datos.items():
                if sb:
                    sb.subir(rutas[s], d)
                else:
                    open(os.path.join(salida_prueba, rutas[s].replace("/", "_")), "wb").write(d)
        fotos[a.codigo_viejo] = {"ruta_thumb": rutas["t"], "ruta_full": rutas["f"], "ancho": ancho, "alto": alto}
        if n % 100 == 0:
            print(f"   … {n}/{len(nuevos)}")
    print(f"   {len(fotos):,} con foto · {peso_antes / 1048576:.1f} MB → {peso_despues / 1048576:.1f} MB")

    # --- artículos ----------------------------------------------------------------------------
    hoy = date.today()
    skus: dict[str, str] = {}
    if sb and nuevos:
        max_sku = sb.leer("productos", "sku", {"order": "sku.desc", "limit": "1"})
        siguiente = int(max_sku[0]["sku"].split("-")[1]) + 1 if max_sku else 1
    else:
        siguiente = 1
    filas = []
    for a in nuevos:
        sku = f"PB-{siguiente:06d}"
        siguiente += 1
        skus[a.codigo_viejo] = sku
        filas.append({
            "sku": sku,
            "nombre": a.nombre,
            "categoria_id": cat_id.get(a.categoria_slug),
            "marca_id": marca_id.get(slugify(a.marca)) if a.marca else None,
            "proveedor_id": prov_id.get(a.proveedor) if a.proveedor else None,
            "precio": a.precio,
            "mostrar_precio": False,
            "en_oferta": a.oferta,
            "estado": "publicado" if a.visible else "borrador",
            "disponibilidad": "disponible",
            "nuevo_hasta": (hoy + timedelta(days=30)).isoformat() if a.nuevo else None,
        })

    if sb and filas:
        print("⬆️  Guardando artículos…")
        guardados = sb.insertar("productos", filas, devolver=True)
        id_por_sku = {g["sku"]: g["id"] for g in guardados}
        sb.rpc("ajustar_secuencia_sku", {})
        codigos, imagenes, privados = [], [], []
        for a in nuevos:
            pid = id_por_sku[skus[a.codigo_viejo]]
            codigos.append({"codigo": a.codigo_viejo, "producto_id": pid,
                            "tipo": "proveedor" if a.proveedor else "legado",
                            "proveedor_id": prov_id.get(a.proveedor) if a.proveedor else None})
            if a.codigo_viejo in fotos:
                imagenes.append({"producto_id": pid, "orden": 0, **fotos[a.codigo_viejo]})
            if a.costo is not None:
                privados.append({"producto_id": pid, "costo": a.costo})
        sb.insertar("codigos", codigos)
        sb.insertar("imagenes", imagenes)
        sb.insertar("productos_privado", privados)
        print(f"   ✔ {len(guardados):,} artículos · {len(codigos):,} códigos · {len(imagenes):,} fotos · {len(privados):,} costos")

    if sb and args.con_listas:
        print("⬆️  Subiendo listas de proveedores (autocompletar)…")
        sb.insertar("lista_proveedores", [{
            "proveedor_id": prov_id[m["proveedor"]], "codigo": m["codigo"], "nombre": m["nombre"],
            "categoria": next((c for c, s in [("Juguetería", "jugueteria"), ("Peluchería", "pelucheria"), ("Librería", "libreria"),
                                              ("Mochilas y bolsos", "mochilas-y-bolsos"), ("Hogar", "hogar"), ("Belleza y Accesorios", "belleza-y-accesorios"),
                                              ("Electro", "electro"), ("Verano", "verano"), ("Cotillón", "cotillon"), ("Regalería", "regaleria")]
                              if s == m["categoria"]), None),
            "marca": m["marca"], "costo": m["costo"],
        } for m in maestro], conflicto="proveedor_id,codigo", lote=1000)
        print(f"   ✔ {len(maestro):,} artículos de proveedores")

    # --- informe ----------------------------------------------------------------------------
    informe = os.path.join(AQUI, "informe_migracion.csv")
    with open(informe, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["sku", "codigo_viejo", "nombre", "categoria", "marca_detectada", "proveedor", "precio_venta", "visible", "a_revisar"])
        for a in nuevos:
            w.writerow([skus.get(a.codigo_viejo, f"(prueba) PB-{nuevos.index(a) + 1:06d}"), a.codigo_viejo, a.nombre, a.categoria_slug,
                        a.marca or "", a.proveedor or "", f"{a.precio:.0f}" if a.precio else "", "sí" if a.visible else "no",
                        " | ".join(a.problemas)])
    resumen = {}
    for a in nuevos:
        for p in a.problemas:
            k = p.split("(")[0].split(":")[0].strip()
            resumen[k] = resumen.get(k, 0) + 1
    print("\n📋 Para revisar (detalle en informe_migracion.csv):")
    for k, v in sorted(resumen.items(), key=lambda x: -x[1]):
        print(f"   · {k}: {v}")
    print(f"\n{'🧪 PRUEBA: no se subió nada.' if args.prueba else '✅ Migración terminada. Ya se ve en la web.'}  Informe: {informe}")


if __name__ == "__main__":
    main()
