"""Pruebas de las reglas de limpieza de la migración:  python -m pytest herramientas  (o  python herramientas/test_migrar.py)"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from migrar import a_numero, corregir_miles, detectar_marca, estandarizar, lienzo_cuadrado, limpiar_codigo, precio_venta, slugify  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402


def test_codigos():
    assert limpiar_codigo("74711.0") == ("74711", True)
    assert limpiar_codigo(" wil225199 ") == ("WIL225199", False)


def test_numeros_y_precios():
    assert a_numero("1.234") == 1234
    assert a_numero("1.234,50") == 1234.5
    assert a_numero("$ 2.000") == 2000
    assert corregir_miles(4.728) == 4728
    assert corregir_miles(9.5) == 9.5
    assert precio_venta(2349) == 4700
    assert precio_venta(1) is None


def test_marcas_y_slugs():
    marcas = ["FISHER PRICE", "DURAVIT", "TINY"]
    assert detectar_marca("CAMION VOLCADOR DURAVIT - 202", marcas) == "DURAVIT"
    assert detectar_marca("AROS APILABLES FISHER PRICE EN CAJA", marcas) == "FISHER PRICE"
    assert detectar_marca("DESTINY PELOTA", marcas) is None  # no confunde "TINY" dentro de otra palabra
    assert slugify("Pelota de Fútbol Nº5") == "pelota-de-futbol-n-5"


def test_foto_cuadrada():
    assert lienzo_cuadrado(1600, 800, 1000) == (1000, 900, 450, 50, 275)  # igual que encuadre.ts
    im = Image.new("RGB", (1600, 900), "white")
    ImageDraw.Draw(im).rectangle((700, 200, 899, 699), fill=(200, 30, 30))  # producto de 200x500 centrado a medias
    out = estandarizar(im, 400)
    assert out.width == out.height == 400
    caja = Image.eval(out, lambda v: 255 - v).getbbox()  # zona no blanca
    alto = caja[3] - caja[1]
    assert 350 <= alto <= 365, alto  # el producto ocupa ~90% (margen 5% arriba y abajo)


if __name__ == "__main__":
    test_codigos(); test_numeros_y_precios(); test_marcas_y_slugs(); test_foto_cuadrada()
    print("✔ pruebas de migración OK")
