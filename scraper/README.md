# /scraper — Scraper de precios de Voltix

Proyecto Python que descarga los catálogos de las tiendas de `/competitors`,
extrae SKU, nombre, precio, categoría y disponibilidad, y (con `--guardar`)
inserta el snapshot en Supabase. Lo ejecuta GitHub Actions cada 6 horas y
cuando alguien usa el botón "Ejecutar monitoreo ahora".

## Correr en local

```bash
cd scraper
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env         # solo hace falta para --guardar / restaurar.py
```

En macOS/Linux el activate es `source .venv/bin/activate`.

Con las dos tiendas de `/competitors` corriendo (ver su README):

```bash
python main.py              # imprime por tienda y la comparativa por SKU
python main.py --json       # stdout con JSON válido
python main.py --guardar    # además inserta el snapshot en Supabase
python simular.py --dry-run # qué precios movería la simulación (sin escribir)
python simular.py           # mueve precios en voltix_precios_simulados
python restaurar.py         # re-siembra historial y regresa las tiendas a su base
python -m unittest discover -s tests -t .
```

`main.py` sale con `0` si todo salió bien y con `1` si alguna tienda falló, no
se extrajo nada o no se pudo guardar.

## Variables de entorno

| Variable | Para qué |
| --- | --- |
| `VOLTIX_COMPETIDORES_URL` | Un host por tienda: `gigabazar=https://…,electroexpress=https://…` (por defecto, los puertos locales 8081 y 8082). También acepta una sola raíz con una carpeta por tienda |
| `SUPABASE_URL` | Project URL (solo `--guardar`, `simular.py` y `restaurar.py`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key (`sb_secret_...`) o service_role legacy. Si recibe la clave pública, el cliente se detiene con un error explícito |

## Estructura

```
main.py            Punto de entrada (consola / --json / --guardar)
restaurar.py       Restauración diaria del demo + verificación
simular.py         Simulación de cambios de precio/stock en las tiendas
scraper.py         Descarga, parseo y el dataclass Producto
persistencia.py    Arma y guarda el snapshot (precio_anterior incluido)
supabase_rest.py   Cliente mínimo de PostgREST sobre requests
config.py          URLs, selectores, variables de entorno
tests/             unittest sin red (HTML de /competitors + cliente falso)
```

## Cómo se guarda un snapshot

1. Se leen los SKU válidos (`voltix_productos`) y el último precio por
   sku+tienda (vista `voltix_ultimos_precios`).
2. Cada producto scrapeado se empareja **por SKU** (`data-sku`), no por
   nombre. Los SKU que no están en el catálogo se omiten con un aviso.
3. Se insertan todos los renglones en una sola petición (una transacción),
   con la misma `fecha_scrape` y con `precio_anterior` = último precio conocido.
   La dirección del cambio la calcula el dashboard.

Si una tienda falla, igual se guarda lo que sí se leyó de la otra y el proceso
sale con `1` para que la corrida aparezca como fallida en Actions.

¿Por qué `requests` y no supabase-py? El scraper solo necesita tres llamadas a
PostgREST. Es el mismo camino HTTPS que usa supabase-js en el dashboard, sin
conexión Postgres directa y sin sumar dependencias.

## Simulación de precios

`simular.py` corre en Actions 30 minutos antes de cada monitoreo. Por cada
producto de cada tienda, de forma independiente:

- con 40 % de probabilidad el precio se mueve entre 5 % y 15 %, arriba o
  abajo, **respecto al precio base**, así que no se acumula corrida tras
  corrida;
- con 15 % de probabilidad cambia la disponibilidad.

Los precios se redondean a múltiplos de $0.50. El script vuelve a leer lo que
escribió para verificarlo, y `restaurar.py` regresa todo a la base una vez al
día.
