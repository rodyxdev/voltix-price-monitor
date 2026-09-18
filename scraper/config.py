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


# Raíz donde viven las tiendas. En local: el http.server de /competitors.
# En Actions: la URL pública que se defina en la Fase 3.
BASE_COMPETIDORES = _env("VOLTIX_COMPETIDORES_URL", "http://localhost:8081").rstrip("/")

TIENDAS = [
    {
        "slug": "gigabazar",
        "nombre": "GigaBazar",
        "url": f"{BASE_COMPETIDORES}/gigabazar/index.html",
    },
    {
        "slug": "electroexpress",
        "nombre": "ElectroExpress",
        "url": f"{BASE_COMPETIDORES}/electroexpress/index.html",
    },
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
