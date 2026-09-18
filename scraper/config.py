"""Configuración del scraper de Voltix.

En la Fase 1 las URLs apuntan al servidor estático local de /competitors.
En la Fase 3 se sustituyen por las URLs desplegadas (y se leerán de variables
de entorno, junto con las credenciales de Supabase).
"""
import os

# Servidor estático local de /competitors (ver competitors/README.md).
BASE_COMPETIDORES = os.environ.get("VOLTIX_COMPETIDORES_URL", "http://localhost:8081")

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
USER_AGENT = "VoltixPriceMonitor/0.1 (+https://github.com/rodyxdev/voltix-price-monitor)"
