"""Restaura la demo pública de Voltix a su snapshot base.

    python restaurar.py

El botón "Ejecutar monitoreo ahora" del dashboard es público, así que los
visitantes pueden acumular corridas en el historial. Este script, que corre a
diario en GitHub Actions, llama a la función voltix_restaurar_demo() (solo
ejecutable con la service role), que:

  a) re-sincroniza voltix_productos con el catálogo base (incluye precio Voltix)
  b) trunca voltix_historial_precios
  c) lo re-siembra con dos snapshots fijos (ayer y hoy) para las 2 tiendas
  d) limpia el timestamp del último disparo (reinicia el cooldown)

y al final comprueba que la base quedó en ese estado. Si no, sale con código 1
para que el workflow se marque como fallido.
"""
import sys

from supabase_rest import ErrorSupabase, cliente_desde_config

PRODUCTOS_BASE = 8
TIENDAS_BASE = 2
SNAPSHOTS_BASE = 2


def falla(mensaje):
    print(f"ERROR: {mensaje}", file=sys.stderr)
    return 1


def verificar(cliente):
    problemas = []

    productos = cliente.select("voltix_productos", "sku")
    if len(productos) != PRODUCTOS_BASE:
        problemas.append(f"hay {len(productos)} productos, se esperaban {PRODUCTOS_BASE}")

    historial = cliente.select("voltix_historial_precios", "id")
    esperados = PRODUCTOS_BASE * TIENDAS_BASE * SNAPSHOTS_BASE
    if len(historial) != esperados:
        problemas.append(f"hay {len(historial)} renglones de historial, se esperaban {esperados}")

    ultimos = cliente.select("voltix_ultimos_precios", "sku,tienda,precio_anterior")
    if len(ultimos) != PRODUCTOS_BASE * TIENDAS_BASE:
        problemas.append(f"la vista de últimos precios trae {len(ultimos)} renglones")
    sin_anterior = [f"{u['tienda']}:{u['sku']}" for u in ultimos if u["precio_anterior"] is None]
    if sin_anterior:
        problemas.append("snapshots de hoy sin precio_anterior: " + ", ".join(sin_anterior))

    disparos = cliente.select("voltix_disparos", "ultimo_disparo")
    if not disparos or disparos[0]["ultimo_disparo"] is not None:
        problemas.append("el cooldown del botón no quedó reiniciado")

    return problemas


def main():
    try:
        cliente = cliente_desde_config()
        filas = cliente.rpc("voltix_restaurar_demo")
        print(f"Historial re-sembrado: {filas} renglones")
        problemas = verificar(cliente)
    except ErrorSupabase as exc:
        return falla(str(exc))

    if problemas:
        return falla("la base no quedó igual al snapshot base: " + "; ".join(problemas))

    print(
        f"OK: {PRODUCTOS_BASE} productos, {PRODUCTOS_BASE * TIENDAS_BASE} precios actuales "
        f"con historial y cooldown reiniciado."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
