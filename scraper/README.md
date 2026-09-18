# /scraper — Scraper de precios de Voltix

Proyecto Python que descarga los catálogos de las tiendas de `/competitors` y
extrae nombre, precio, categoría, SKU y disponibilidad de cada producto.

En la Fase 1 **solo imprime en consola**: no hay base de datos, credenciales ni
reportes.

## Requisitos

- Python 3.11 o superior
- El servidor estático de `/competitors` corriendo (ver su README)

## Correr en local

```bash
cd scraper
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

En macOS/Linux el activate es `source .venv/bin/activate`.

Salida JSON (útil para inspeccionar la estructura que consumirá la Fase 2):

```bash
python main.py --json
```

Código de salida: `0` si se leyeron ambas tiendas sin errores, `1` si alguna
falló o no se extrajo ningún producto.

## Estructura

```
main.py            Punto de entrada: corre el scraping e imprime el resultado
scraper.py         Descarga, parseo y el dataclass Producto
config.py          URLs de las tiendas, selectores CSS, timeout, user agent
requirements.txt   requests + beautifulsoup4
```

## Configuración

| Variable de entorno | Default | Para qué |
| --- | --- | --- |
| `VOLTIX_COMPETIDORES_URL` | `http://localhost:8081` | Raíz donde viven las tiendas |

Los selectores CSS viven en `config.SELECTORES` y son iguales para ambas tiendas
(mismo contrato HTML, ver `competitors/README.md`).

## Qué imprime

1. Listado por tienda: producto, precio y disponibilidad.
2. Comparativa por producto: emparejamiento por nombre normalizado, cuál tienda
   es más barata y la diferencia.

Si una tienda falla, se reporta el error por `stderr` y la otra se sigue
procesando.

## Pendiente para la Fase 2

- Persistencia en Supabase (tablas `voltix_*`) y lectura de credenciales desde
  variables de entorno.
- Comparación contra la última lectura guardada para detectar subidas/bajadas.
- Generación de reportes Excel y PDF.
- Emparejamiento por SKU/catálogo maestro en lugar de por nombre normalizado.
