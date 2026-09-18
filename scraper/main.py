"""Punto de entrada del scraper de Voltix.

Fase 1: recorre las tiendas de /competitors, extrae nombre y precio de cada
producto y lo imprime en consola, junto con una comparativa por producto.
No escribe en base de datos ni genera reportes (eso es Fase 2).

Uso:
    python main.py
    python main.py --json
"""
import argparse
import json
import sys
from collections import defaultdict

import config
import scraper

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
        print("-" * 64)
        for p in items:
            print(f"  {p.nombre:<40} {p.moneda} {p.precio:>9,.2f}   [{p.stock}]")


def imprimir_comparativa(productos):
    """Empareja productos por nombre normalizado y muestra la diferencia."""
    por_nombre = defaultdict(dict)
    for p in productos:
        por_nombre[p.nombre.strip().lower()][p.tienda] = p

    print("\nComparativa por producto")
    print("-" * 64)
    for clave in sorted(por_nombre):
        lecturas = por_nombre[clave]
        nombre = next(iter(lecturas.values())).nombre
        precios = {t: p.precio for t, p in lecturas.items()}
        detalle = "  ".join(f"{t}: {v:,.2f}" for t, v in precios.items())

        if len(precios) > 1:
            barata = min(precios, key=precios.get)
            diferencia = max(precios.values()) - min(precios.values())
            print(f"  {nombre}\n    {detalle}  ->  más barato: {barata} (dif. {diferencia:,.2f})")
        else:
            print(f"  {nombre}\n    {detalle}  ->  solo en una tienda")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Scraper de prueba de Voltix (Fase 1)")
    parser.add_argument("--json", action="store_true", help="imprime el resultado como JSON")
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
    return 1 if errores else 0


if __name__ == "__main__":
    raise SystemExit(main())
