"""Punto de entrada del scraper de Voltix.

Recorre las tiendas de /competitors, extrae los productos y los imprime en
consola. Con --guardar además inserta el snapshot en Supabase (es lo que corre
el workflow de monitoreo en GitHub Actions).

Uso:
    python main.py              # solo consola
    python main.py --json       # consola, en JSON
    python main.py --guardar    # consola + snapshot en voltix_historial_precios
"""
import argparse
import json
import sys
from collections import defaultdict

import config
import persistencia
import scraper
from supabase_rest import ErrorSupabase, cliente_desde_config

# Consolas de Windows: sin esto los acentos salen como "?" o basura.
for _flujo in (sys.stdout, sys.stderr):
    if hasattr(_flujo, "reconfigure"):
        _flujo.reconfigure(encoding="utf-8", errors="replace")


def imprimir_por_tienda(productos):
    por_tienda = defaultdict(list)
    for producto in productos:
        por_tienda[producto.tienda].append(producto)

    for tienda, items in por_tienda.items():
        print(f"\n{tienda} — {len(items)} productos")
        print("-" * 72)
        for p in items:
            print(f"  {p.sku:<8} {p.nombre:<38} {p.moneda} {p.precio:>9,.2f}   [{p.stock}]")


def imprimir_comparativa(productos):
    """Empareja productos por SKU y muestra cuál tienda es más barata."""
    por_sku = defaultdict(dict)
    for p in productos:
        por_sku[p.sku][p.tienda] = p

    print("\nComparativa por SKU")
    print("-" * 72)
    for sku in sorted(por_sku):
        lecturas = por_sku[sku]
        nombre = next(iter(lecturas.values())).nombre
        precios = {t: p.precio for t, p in lecturas.items()}
        detalle = "  ".join(f"{t}: {v:,.2f}" for t, v in precios.items())

        if len(precios) > 1:
            barata = min(precios, key=precios.get)
            diferencia = max(precios.values()) - min(precios.values())
            print(f"  {sku} {nombre}\n    {detalle}  ->  más barato: {barata} (dif. {diferencia:,.2f})")
        else:
            print(f"  {sku} {nombre}\n    {detalle}  ->  solo en una tienda")


def guardar(productos):
    """Inserta el snapshot. Devuelve True si todo salió bien."""
    try:
        resultado = persistencia.guardar_snapshot(cliente_desde_config(), productos)
    except ErrorSupabase as exc:
        print(f"\n[ERROR] No se pudo guardar en Supabase: {exc}", file=sys.stderr)
        return False

    print(f"\nSupabase: {resultado.insertados} renglones insertados ({resultado.fecha_scrape})")
    if resultado.sku_desconocidos:
        print(
            "[AVISO] SKU que no están en voltix_productos (omitidos): "
            + ", ".join(resultado.sku_desconocidos),
            file=sys.stderr,
        )
    if resultado.duplicados:
        print(
            "[AVISO] sku+tienda repetidos en la página (se tomó el primero): "
            + ", ".join(resultado.duplicados),
            file=sys.stderr,
        )
    return resultado.insertados > 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="Scraper de precios de Voltix")
    parser.add_argument("--json", action="store_true", help="imprime el resultado como JSON")
    parser.add_argument(
        "--guardar", action="store_true", help="inserta el snapshot en Supabase (service role)"
    )
    args = parser.parse_args(argv)

    # En modo --json el encabezado va a stderr para que stdout sea JSON válido.
    print(
        f"Monitoreando {len(config.TIENDAS)} tiendas en {config.BASE_COMPETIDORES}",
        file=sys.stderr if args.json else sys.stdout,
    )
    productos, errores = scraper.scrapear_todas()

    if args.json:
        print(json.dumps([p.como_dict() for p in productos], ensure_ascii=False, indent=2))
    else:
        imprimir_por_tienda(productos)
        imprimir_comparativa(productos)

    for error in errores:
        print(f"\n[ERROR] {error}", file=sys.stderr)

    if not productos:
        print(
            "\nNo se extrajo ningún producto. ¿Está corriendo el servidor de /competitors?",
            file=sys.stderr,
        )
        return 1

    # Si una tienda falló igual se guarda lo que sí se leyó: un hueco en el
    # historial de una tienda es mejor que perder la lectura de la otra.
    guardado_ok = guardar(productos) if args.guardar else True

    return 0 if (guardado_ok and not errores) else 1


if __name__ == "__main__":
    raise SystemExit(main())
