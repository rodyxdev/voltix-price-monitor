"""Extracción de productos de las tiendas de /competitors.

Fase 1: solo descarga y parseo. No hay persistencia ni comparación histórica;
eso entra en la Fase 2 junto con Supabase.
"""
from dataclasses import dataclass, asdict
from decimal import Decimal, InvalidOperation
import re

import requests
from bs4 import BeautifulSoup

import config


@dataclass
class Producto:
    tienda: str
    sku: str
    nombre: str
    categoria: str
    precio: Decimal
    moneda: str
    stock: str

    def como_dict(self):
        datos = asdict(self)
        datos["precio"] = float(self.precio)
        return datos


class ErrorScraping(Exception):
    """La tienda no se pudo descargar o su HTML no tiene la forma esperada."""


_NO_NUMERICO = re.compile(r"[^\d.,]")


def parsear_precio(texto):
    """'$ 1,299.00' -> Decimal('1299.00'). Devuelve None si no hay número."""
    limpio = _NO_NUMERICO.sub("", texto or "").replace(",", "")
    if not limpio:
        return None
    try:
        return Decimal(limpio)
    except InvalidOperation:
        return None


def descargar(url):
    respuesta = requests.get(
        url,
        timeout=config.TIMEOUT_SEGUNDOS,
        headers={"User-Agent": config.USER_AGENT},
    )
    respuesta.raise_for_status()
    # requests asume latin-1 cuando el servidor no declara charset (caso del
    # `http.server` local), así que solo respetamos el charset si viene explícito.
    if "charset=" not in respuesta.headers.get("Content-Type", "").lower():
        respuesta.encoding = "utf-8"
    return respuesta.text


def _texto(tarjeta, selector):
    nodo = tarjeta.select_one(selector)
    return nodo.get_text(strip=True) if nodo else ""


def parsear_catalogo(html, tienda_nombre):
    """Convierte el HTML de un catálogo en una lista de Producto."""
    sel = config.SELECTORES
    sopa = BeautifulSoup(html, "html.parser")
    tarjetas = sopa.select(sel["tarjeta"])
    if not tarjetas:
        raise ErrorScraping(
            f"{tienda_nombre}: no se encontró ningún '{sel['tarjeta']}' en el HTML"
        )

    productos = []
    for tarjeta in tarjetas:
        nodo_precio = tarjeta.select_one(sel["precio"])
        precio = parsear_precio(nodo_precio.get_text() if nodo_precio else "")
        nombre = _texto(tarjeta, sel["nombre"])
        if not nombre or precio is None:
            # Tarjeta incompleta: se ignora en lugar de tumbar la corrida.
            continue

        productos.append(
            Producto(
                tienda=tienda_nombre,
                sku=tarjeta.get("data-sku", ""),
                nombre=nombre,
                categoria=_texto(tarjeta, sel["categoria"]),
                precio=precio,
                moneda=(nodo_precio.get("data-currency") if nodo_precio else "") or "MXN",
                stock=_texto(tarjeta, sel["stock"]),
            )
        )

    return productos


def scrapear_tienda(tienda):
    """Descarga y parsea una tienda de config.TIENDAS."""
    try:
        html = descargar(tienda["url"])
    except requests.RequestException as exc:
        raise ErrorScraping(f"{tienda['nombre']}: no se pudo descargar {tienda['url']} ({exc})") from exc
    return parsear_catalogo(html, tienda["nombre"])


def scrapear_todas(tiendas=None):
    """Devuelve (productos, errores) sin abortar si una tienda falla."""
    productos = []
    errores = []
    for tienda in tiendas or config.TIENDAS:
        try:
            productos.extend(scrapear_tienda(tienda))
        except ErrorScraping as exc:
            errores.append(str(exc))
    return productos, errores
