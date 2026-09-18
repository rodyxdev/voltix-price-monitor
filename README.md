# Voltix — Monitor de precios de competencia

Bot de monitoreo de precios para **Voltix**, una tienda ficticia de electrónica y
gadgets. El sistema revisa periódicamente los precios de dos tiendas
"competidoras" (también ficticias, construidas dentro de este mismo repo para no
depender de sitios de terceros) y, en fases posteriores, generará reportes
automáticos en Excel y PDF.

> Proyecto 6 del portafolio freelance. **Estado actual: Fase 1 completada**
> (scaffolding + frontend estático + scraper de prueba).

## Estructura del repo

```
/competitors   Sitios estáticos de las tiendas ficticias (GigaBazar, ElectroExpress)
/dashboard     Servidor Node/Express + frontend del dashboard de Voltix
/scraper       Proyecto Python que extrae precios de las tiendas
```

Cada carpeta tiene su propio README con instrucciones de ejecución local.

## Arranque rápido (los tres módulos en local)

Se necesitan tres terminales:

```bash
# 1. Tiendas de competencia en http://localhost:8081
cd competitors && python -m http.server 8081
```

```bash
# 2. Dashboard en http://localhost:3000
cd dashboard && npm install && npm start
```

```bash
# 3. Scraper (requiere la terminal 1 corriendo)
cd scraper && pip install -r requirements.txt && python main.py
```

## Alcance por fases

| Fase | Contenido | Estado |
| --- | --- | --- |
| 1 | Estructura del repo, tiendas ficticias, dashboard estático, scraper de prueba | Hecha |
| 2 | Supabase (tablas `voltix_*`), histórico de precios, detección de cambios, reportes Excel/PDF, endpoint de "ejecutar ahora" | Pendiente |
| 3 | Deploy a Vercel, hosting de `/competitors`, cron con GitHub Actions, rutina de limpieza de datos | Pendiente |

## Stack

- **Backend/dashboard:** Node 20+ / Express
- **Automatización:** Python 3.11+ (`requests` + `BeautifulSoup4`)
- **Base de datos:** Supabase (Postgres), prefijo de tablas `voltix_` — Fase 2
- **Deploy:** Vercel — Fase 3
- **Ejecución programada:** GitHub Actions (cron) — Fase 3

## Nota legal

Las tiendas de `/competitors` son ficticias y forman parte de este repositorio.
El scraper no apunta a sitios reales de terceros, por lo que no hay problemas de
términos de servicio en la demo.
