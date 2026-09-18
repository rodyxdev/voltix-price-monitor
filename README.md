# Voltix — Monitor de precios de competencia

Bot de monitoreo de precios para **Voltix**, una tienda ficticia de electrónica y
gadgets. Revisa periódicamente los precios de dos tiendas "competidoras"
(también ficticias, construidas dentro de este repo para no depender de sitios
de terceros), guarda el historial en Supabase y muestra un dashboard con
tendencias y reportes Excel/PDF descargables.

> Proyecto 6 del portafolio freelance. **Estado: Fase 3 completada**, en
> producción.

## En producción

| App | URL |
| --- | --- |
| Dashboard de Voltix | https://voltix-dashboard.vercel.app |
| GigaBazar (competidor ficticio) | https://gigabazar.vercel.app |
| ElectroExpress (competidor ficticio) | https://electroexpress.vercel.app |

Ciclo automático (UTC): simulación de precios a las :30 de las 5, 11, 17 y 23 h;
monitoreo cada 6 h (0, 6, 12, 18 h); restauración de la demo a las 06:30.

## Arquitectura

```
GitHub Actions                                   Vercel (3 proyectos)
  simulación (service role) ──▶ voltix_precios_simulados ──anon──▶ GigaBazar / ElectroExpress
  monitoreo  (service role) ◀── scrapea las dos tiendas ◀──────────┘
        │
        ▼
  voltix_historial_precios ──anon──▶ dashboard: tabla ▼▲=, Excel, PDF
                                      botón "Ejecutar ahora" ──▶ workflow_dispatch
```

## Estructura del repo

```
/competitors          Apps Express de las tiendas ficticias (GigaBazar, ElectroExpress)
/dashboard            Node/Express: API, frontend del dashboard y reportes
/scraper              Python: scraper, persistencia en Supabase y restauración diaria
/supabase/migrations  Esquema, RLS y funciones RPC (prefijo voltix_)
/.github/workflows    simulacion.yml, monitoreo.yml (cada 6 h) y restauracion.yml (diaria)
/scripts              Hook de git que quita la atribución automática de los commits
```

Cada carpeta tiene su propio README.

## Arranque rápido en local

1. Aplica `supabase/migrations/*.sql` en el SQL Editor de Supabase (ver
   `supabase/README.md`).
2. Copia cada `.env.example` → `.env` (dashboard, scraper y las dos tiendas)
   y llena los valores.
3. En varias terminales:

```bash
# Tiendas de competencia en http://localhost:8081 y :8082
cd competitors/gigabazar && npm install && npm start
cd competitors/electroexpress && npm install && npm start
```

```bash
# Dashboard en http://localhost:3000
cd dashboard && npm install && npm start
```

```bash
# Scraper: lee las tiendas y guarda el snapshot en Supabase
cd scraper && pip install -r requirements.txt && python main.py --guardar
```

Después de clonar, instala el hook de commits una vez:

```bash
sh scripts/setup-hooks.sh
```

## Pruebas

```bash
cd dashboard && npm test
cd competitors/gigabazar && npm test
cd competitors/electroexpress && npm test
node competitors/tools/sincronizar.js --verificar
cd scraper && python -m unittest discover -s tests -t .
```

## Alcance por fases

| Fase | Contenido | Estado |
| --- | --- | --- |
| 1 | Estructura, tiendas ficticias, dashboard estático, scraper de prueba | Hecha |
| 2 | Supabase + RLS, snapshots con emparejamiento por SKU, cron de monitoreo y restauración, botón "Ejecutar ahora" con cooldown, reportes Excel/PDF en streaming, manejo de errores y cabeceras de seguridad | Hecha |
| 3 | Tiendas como apps Express con precios en Supabase, simulación de precios, deploy de los 3 proyectos en Vercel, pasada de seguridad final | Hecha |

## Stack

- **Dashboard:** Node 22+ / Express, `@supabase/supabase-js`, ExcelJS, PDFKit
- **Automatización:** Python 3.12 (`requests` + `BeautifulSoup4`)
- **Base de datos:** Supabase (Postgres vía PostgREST), proyecto compartido del
  portafolio, tablas `voltix_*`
- **Ejecución programada:** GitHub Actions
- **Deploy:** Vercel, tres proyectos del mismo repo (`dashboard`,
  `competitors/gigabazar`, `competitors/electroexpress`)

## Deploy

Tres proyectos de Vercel sobre este repo, cada uno con su Root Directory
(`dashboard`, `competitors/gigabazar`, `competitors/electroexpress`) y las
variables `SUPABASE_URL` + `SUPABASE_ANON_KEY` (el dashboard además usa
`VOLTIX_GITHUB_TOKEN` y `VOLTIX_COOLDOWN_MINUTOS`). Ninguno tiene la service
role: esa solo vive en los secrets de GitHub Actions.

## Nota legal

Las tiendas de `/competitors` son ficticias y forman parte de este repositorio.
El scraper no apunta a sitios reales de terceros.
