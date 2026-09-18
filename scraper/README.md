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

Con el servidor de `/competitors` corriendo (ver su README):

```bash
python main.py              # imprime por tienda y la comparativa por SKU
python main.py --json       # stdout con JSON válido
python main.py --guardar    # además inserta el snapshot en Supabase
python restaurar.py         # re-siembra el historial con el snapshot base
python -m unittest discover -s tests -t .
```

`main.py` sale con `0` si todo salió bien y con `1` si alguna tienda falló, no
se extrajo nada o no se pudo guardar.

## Variables de entorno

| Variable | Para qué |
| --- | --- |
| `VOLTIX_COMPETIDORES_URL` | Raíz de las tiendas (por defecto `http://localhost:8081`) |
| `SUPABASE_URL` | Project URL (solo `--guardar` y `restaurar.py`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key (`sb_secret_...`) o service_role legacy. Si recibe la clave pública, el cliente se detiene con un error explícito |

## Estructura

```
main.py            Punto de entrada (consola / --json / --guardar)
restaurar.py       Restauración diaria del demo + verificación
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
