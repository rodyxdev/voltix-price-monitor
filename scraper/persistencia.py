"""Guarda en Supabase el snapshot de una corrida del scraper.

Por cada producto de cada tienda se inserta un renglón en
voltix_historial_precios. Antes de insertar se consulta el último precio
conocido por sku+tienda (vista voltix_ultimos_precios) y se guarda como
precio_anterior. La dirección del cambio (subió/bajó/igual) NO se calcula
aquí: el dashboard la deriva comparando precio contra precio_anterior.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal


@dataclass
class ResultadoGuardado:
    insertados: int = 0
    fecha_scrape: str = ""
    # Productos cuyo SKU no existe en voltix_productos (el FK los rechazaría).
    sku_desconocidos: list = field(default_factory=list)
    # Mismo sku+tienda repetido en la página: se conserva la primera lectura.
    duplicados: list = field(default_factory=list)


def _decimal(valor):
    return None if valor is None else Decimal(str(valor))


def construir_filas(productos, catalogo, ultimos, fecha_scrape):
    """Arma los renglones a insertar. Función pura para poder probarla sin red.

    productos: lista de scraper.Producto
    catalogo:  set de SKUs válidos (voltix_productos)
    ultimos:   dict {(sku, tienda_slug): Decimal} con el último precio guardado
    """
    resultado = ResultadoGuardado(fecha_scrape=fecha_scrape)
    filas = []
    vistos = set()

    for p in productos:
        clave = (p.sku, p.tienda_slug)
        if p.sku not in catalogo:
            resultado.sku_desconocidos.append(f"{p.tienda_slug}:{p.sku}")
            continue
        if clave in vistos:
            resultado.duplicados.append(f"{p.tienda_slug}:{p.sku}")
            continue
        vistos.add(clave)

        anterior = ultimos.get(clave)
        filas.append(
            {
                "sku": p.sku,
                "tienda": p.tienda_slug,
                # PostgREST recibe numeric como texto sin perder precisión.
                "precio": str(p.precio),
                "precio_anterior": None if anterior is None else str(anterior),
                "stock": p.stock,
                "fecha_scrape": fecha_scrape,
            }
        )

    return filas, resultado


def guardar_snapshot(cliente, productos, ahora=None):
    """Inserta la corrida completa en una sola petición (atómica en Postgres)."""
    fecha_scrape = (ahora or datetime.now(timezone.utc)).isoformat()

    catalogo = {fila["sku"] for fila in cliente.select("voltix_productos", "sku")}
    ultimos = {
        (fila["sku"], fila["tienda"]): _decimal(fila["precio"])
        for fila in cliente.select("voltix_ultimos_precios", "sku,tienda,precio")
    }

    filas, resultado = construir_filas(productos, catalogo, ultimos, fecha_scrape)
    resultado.insertados = cliente.insert("voltix_historial_precios", filas)
    return resultado
