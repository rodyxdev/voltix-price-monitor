"""Configuración del scraper de Voltix.

Todo sale de variables de entorno. En local se pueden poner en scraper/.env
(ver .env.example); en GitHub Actions llegan como secrets/variables.
"""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).with_name(".env"))
except ImportError:  # python-dotenv es opcional: en Actions no hace falta
    pass


def _env(nombre, defecto=""):
    return (os.environ.get(nombre) or defecto).strip()


NOMBRES_TIENDAS = {"gigabazar": "GigaBazar", "electroexpress": "ElectroExpress"}


def urls_tiendas(valor):
    """Resuelve la URL del catálogo de cada tienda a partir de VOLTIX_COMPETIDORES_URL.

    Dos formatos:
      * Un host por tienda (Fase 3, cada tienda es su propia app):
          gigabazar=https://gigabazar.vercel.app,electroexpress=https://electroexpress.vercel.app
        -> <url>/index.html
      * Una sola raíz con una carpeta por tienda (sitios estáticos servidos juntos):
          http://localhost:8000  -> <raíz>/<tienda>/index.html
    """
    valor = valor.strip()
    if "=" not in valor:
        raiz = valor.rstrip("/")
        return {slug: f"{raiz}/{slug}/index.html" for slug in NOMBRES_TIENDAS}

    urls = {}
    for par in filter(None, (p.strip() for p in valor.split(","))):
        slug, _, url = par.partition("=")
        slug = slug.strip().lower()
        if slug not in NOMBRES_TIENDAS or not url.strip():
            raise ValueError(f"VOLTIX_COMPETIDORES_URL: entrada inválida '{par}'")
        urls[slug] = url.strip().rstrip("/") + "/index.html"
    faltan = sorted(set(NOMBRES_TIENDAS) - set(urls))
    if faltan:
        raise ValueError("VOLTIX_COMPETIDORES_URL: falta la URL de " + ", ".join(faltan))
    return urls


# En local cada tienda es una app Express en su puerto (ver competitors/README.md).
BASE_COMPETIDORES = _env(
    "VOLTIX_COMPETIDORES_URL",
    "gigabazar=http://localhost:8081,electroexpress=http://localhost:8082",
)

_URLS = urls_tiendas(BASE_COMPETIDORES)
TIENDAS = [
    {"slug": slug, "nombre": nombre, "url": _URLS[slug]}
    for slug, nombre in NOMBRES_TIENDAS.items()
]

# Selectores CSS del catálogo. Ambas tiendas comparten la misma estructura,
# a propósito, para que el parser sea uno solo.
SELECTORES = {
    "tarjeta": ".product-card",
    "nombre": ".product-name",
    "precio": ".product-price",
    "stock": ".product-stock",
    "categoria": ".product-category",
}

TIMEOUT_SEGUNDOS = 15
USER_AGENT = "VoltixPriceMonitor/0.2 (+https://github.com/rodyxdev/voltix-price-monitor)"

# Supabase: solo se usan con --guardar y en restaurar.py. La service role key
# bypassea RLS; vive únicamente aquí (GitHub Actions), nunca en el dashboard.
SUPABASE_URL = _env("SUPABASE_URL").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = _env("SUPABASE_SERVICE_ROLE_KEY")
