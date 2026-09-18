# Voltix — Monitor de precios de competencia

Bot de monitoreo de precios para **Voltix**, una tienda ficticia de electrónica y
gadgets. Revisa periódicamente los precios de dos tiendas "competidoras"
(también ficticias, construidas dentro de este repo para no depender de sitios
de terceros), guarda el historial en Supabase y muestra un dashboard con
tendencias y reportes Excel/PDF descargables.

> Proyecto 6 del portafolio freelance. **Estado: Fase 2 completada** (datos
> reales, cron, botón de monitoreo y reportes). La Fase 3 cubre el deploy.

## Arquitectura

```
GitHub Actions (cron 6 h / botón)          Vercel (Fase 3)
  scraper Python ──service role──▶ Supabase ◀──clave pública── dashboard Express
       │                           voltix_*                        │
       ▼                                                          ▼
 GigaBazar / ElectroExpress                          tabla, ▼▲=, Excel, PDF
 (sitios estáticos de /competitors)       botón "Ejecutar ahora" ──▶ workflow_dispatch
```

## Estructura del repo

```
/competitors          Sitios estáticos de las tiendas ficticias (GigaBazar, ElectroExpress)
/dashboard            Node/Express: API, frontend del dashboard y reportes
/scraper              Python: scraper, persistencia en Supabase y restauración diaria
/supabase/migrations  Esquema, RLS y funciones RPC (prefijo voltix_)
/.github/workflows    monitoreo.yml (cada 6 h) y restauracion.yml (diaria)
/scripts              Hook de git que quita la atribución automática de los commits
```

Cada carpeta tiene su propio README.

## Arranque rápido en local

1. Aplica `supabase/migrations/*.sql` en el SQL Editor de Supabase (ver
   `supabase/README.md`).
2. Copia `dashboard/.env.example` → `dashboard/.env` y
   `scraper/.env.example` → `scraper/.env`, y llena los valores.
3. En tres terminales:

```bash
# Tiendas de competencia en http://localhost:8081
cd competitors && python -m http.server 8081
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
cd scraper && python -m unittest discover -s tests -t .
```

## Alcance por fases

| Fase | Contenido | Estado |
| --- | --- | --- |
| 1 | Estructura, tiendas ficticias, dashboard estático, scraper de prueba | Hecha |
| 2 | Supabase + RLS, snapshots con emparejamiento por SKU, cron de monitoreo y restauración, botón "Ejecutar ahora" con cooldown, reportes Excel/PDF en streaming, manejo de errores y cabeceras de seguridad | Hecha |
| 3 | Deploy del dashboard a Vercel, hosting de `/competitors`, secrets y variables, pasada de seguridad final | Pendiente |

## Stack

- **Dashboard:** Node 22+ / Express, `@supabase/supabase-js`, ExcelJS, PDFKit
- **Automatización:** Python 3.12 (`requests` + `BeautifulSoup4`)
- **Base de datos:** Supabase (Postgres vía PostgREST), proyecto compartido del
  portafolio, tablas `voltix_*`
- **Ejecución programada:** GitHub Actions
- **Deploy:** Vercel (Fase 3)

## Nota legal

Las tiendas de `/competitors` son ficticias y forman parte de este repositorio.
El scraper no apunta a sitios reales de terceros.
