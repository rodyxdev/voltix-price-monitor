"""Simula movimientos de precio en GigaBazar y ElectroExpress.

    python simular.py                     # aplica en Supabase (service role)
    python simular.py --dry-run           # solo muestra qué cambiaría
    python simular.py --semilla 42        # reproducible

Corre en GitHub Actions poco antes de cada monitoreo. Por cada producto de
cada tienda (de forma independiente, para que a veces solo una cambie):

  * con probabilidad --probabilidad (40 % por defecto) el precio se mueve
    entre 5 % y 15 % arriba o abajo del PRECIO BASE (no se acumula corrida
    tras corrida: siempre oscila alrededor del precio de la Fase 1);
  * con probabilidad --prob-stock (15 %) cambia la disponibilidad.

Los precios se redondean a múltiplos de $0.50. La restauración diaria
(voltix_restaurar_demo) los devuelve a su base.
"""
import argparse
import random
import sys
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from supabase_rest import ErrorSupabase, cliente_desde_config

TABLA = "voltix_precios_simulados"
ESTADOS_STOCK = ("En stock", "Pocas piezas", "Agotado")
CENTAVO = Decimal("0.01")

for _flujo in (sys.stdout, sys.stderr):
    if hasattr(_flujo, "reconfigure"):
        _flujo.reconfigure(encoding="utf-8", errors="replace")


def redondear(valor):
    """Al múltiplo de 0.50 más cercano, sin bajar de 0.50."""
    medio = (Decimal(valor) * 2).quantize(Decimal("1"), rounding=ROUND_HALF_UP) / 2
    return max(medio, Decimal("0.50")).quantize(Decimal("0.01"))


def simular(filas, rng, probabilidad=0.4, var_min=0.05, var_max=0.15, prob_stock=0.15):
    """Función pura: devuelve solo las filas que cambian, listas para upsert."""
    cambios = []
    for f in filas:
        # PostgREST devuelve numeric como número JSON (375.0): se normaliza a centavos.
        base = Decimal(str(f["precio_base"])).quantize(CENTAVO)
        actual = Decimal(str(f["precio_actual"])).quantize(CENTAVO)
        precio, stock = actual, f["stock_actual"]

        if rng.random() < probabilidad:
            pct = Decimal(str(round(rng.uniform(var_min, var_max), 4)))
            signo = 1 if rng.random() < 0.5 else -1
            precio = redondear(base * (1 + signo * pct))
            if precio == actual:
                # Si "se movió" al mismo precio que ya tenía, se va al otro lado
                # de la base para que el cambio sea visible.
                precio = redondear(base * (1 - signo * pct))

        if rng.random() < prob_stock:
            stock = rng.choice([s for s in ESTADOS_STOCK if s != f["stock_actual"]])

        if precio != actual or stock != f["stock_actual"]:
            cambios.append(
                {
                    "sku": f["sku"],
                    "tienda": f["tienda"],
                    # Todas las NOT NULL van en la fila (lo exige el upsert).
                    "precio_base": str(base),
                    "stock_base": f["stock_base"],
                    "precio_actual": str(precio),
                    "stock_actual": stock,
                    "_antes": (actual, f["stock_actual"]),
                }
            )
    return cambios


def main(argv=None):
    parser = argparse.ArgumentParser(description="Simula cambios de precio en las tiendas ficticias")
    parser.add_argument("--probabilidad", type=float, default=0.4, help="por producto y tienda (0-1)")
    parser.add_argument("--prob-stock", type=float, default=0.15, help="cambio de disponibilidad (0-1)")
    parser.add_argument("--semilla", type=int, default=None)
    parser.add_argument("--dry-run", action="store_true", help="no escribe en Supabase")
    args = parser.parse_args(argv)

    try:
        cliente = cliente_desde_config()
        filas = cliente.select(TABLA, "sku,tienda,precio_base,precio_actual,stock_base,stock_actual")
    except ErrorSupabase as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    if not filas:
        print(f"ERROR: {TABLA} está vacía; corre restaurar.py primero.", file=sys.stderr)
        return 1

    cambios = simular(filas, random.Random(args.semilla), args.probabilidad, prob_stock=args.prob_stock)

    print(f"{len(cambios)} de {len(filas)} precios/stock cambian:")
    for c in sorted(cambios, key=lambda x: (x["tienda"], x["sku"])):
        (precio_antes, stock_antes) = c["_antes"]
        base = Decimal(c["precio_base"])
        variacion = (Decimal(c["precio_actual"]) - base) / base * 100
        stock = f"  stock: {stock_antes} -> {c['stock_actual']}" if stock_antes != c["stock_actual"] else ""
        print(
            f"  {c['tienda']:<15} {c['sku']:<8} {precio_antes:>9} -> {c['precio_actual']:>9}"
            f"  ({variacion:+.1f} % vs base){stock}"
        )

    if args.dry_run or not cambios:
        return 0

    ahora = datetime.now(timezone.utc).isoformat()
    filas_upsert = [{**{k: v for k, v in c.items() if k != "_antes"}, "actualizado_en": ahora} for c in cambios]
    try:
        cliente.upsert(TABLA, filas_upsert, on_conflict="sku,tienda")
        # Verificación: lo escrito es lo que ahora se lee.
        leidas = {(f["sku"], f["tienda"]): f for f in cliente.select(TABLA, "sku,tienda,precio_actual,stock_actual")}
    except ErrorSupabase as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    fallidas = [
        f"{c['tienda']}:{c['sku']}"
        for c in cambios
        if Decimal(str(leidas[(c["sku"], c["tienda"])]["precio_actual"])) != Decimal(c["precio_actual"])
        or leidas[(c["sku"], c["tienda"])]["stock_actual"] != c["stock_actual"]
    ]
    if fallidas:
        print("ERROR: no quedaron aplicados: " + ", ".join(fallidas), file=sys.stderr)
        return 1
    print(f"OK: {len(cambios)} cambios aplicados en {TABLA}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
