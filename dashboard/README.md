# /dashboard — Dashboard de Voltix

Servidor Node/Express que sirve el dashboard del monitor de precios y su API.
Lee los datos vivos de Supabase **solo con la clave pública** y genera los
reportes Excel/PDF al vuelo.

## Correr en local

Requiere Node 22+ (supabase-js necesita el WebSocket nativo) y el esquema de
`/supabase` aplicado.

```bash
cd dashboard
npm install
cp .env.example .env    # y llena SUPABASE_URL + SUPABASE_ANON_KEY
npm start
```

- Dashboard: http://localhost:3000
- Health check: http://localhost:3000/health
- Pruebas: `npm test` (no necesitan red ni Supabase)

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `SUPABASE_URL` | sí | Project URL |
| `SUPABASE_ANON_KEY` | sí | Clave **pública** (`sb_publishable_...` o anon legacy). Si recibe la service role, el servidor no arranca |
| `VOLTIX_GITHUB_TOKEN` | no | Fine-grained PAT, solo este repo, permiso *Actions: Read and write*. Sin él, el botón de monitoreo queda deshabilitado |
| `VOLTIX_GITHUB_REPO` | no | Por defecto `rodyxdev/voltix-price-monitor` |
| `VOLTIX_GITHUB_WORKFLOW` | no | Por defecto `monitoreo.yml` |
| `VOLTIX_GITHUB_REF` | no | Por defecto `main` |
| `VOLTIX_COOLDOWN_MINUTOS` | no | Por defecto `10` (rango 1 a 1440) |
| `PORT` | no | Por defecto `3000` |

## API

| Método y ruta | Respuesta |
| --- | --- |
| `GET /api/productos` | Vista comparativa: precio Voltix, último precio por tienda, tendencia, más barato y posición |
| `GET /api/monitoreo` | Estado del botón: `no_configurado`, `inactivo`, `en_cola` o `en_progreso`, cooldown restante y última corrida |
| `POST /api/monitoreo` | `202` si disparó el workflow, `429` + `Retry-After` en cooldown, `503` sin token, `502` si GitHub falló |
| `GET /api/reportes/comparativa.xlsx` | Excel generado en streaming |
| `GET /api/reportes/comparativa.pdf` | PDF generado en streaming |

## Cómo funciona el botón "Ejecutar monitoreo ahora"

1. `POST /api/monitoreo` llama a la RPC `voltix_reservar_disparo`, que decide
   de forma atómica si ya pasó el cooldown y guarda el timestamp en Supabase.
   Se guarda ahí y no en memoria porque en serverless cada invocación puede
   ser un proceso distinto.
2. Si el cooldown lo permite, dispara `monitoreo.yml` con la API de GitHub
   (`workflow_dispatch`).
3. El frontend consulta `GET /api/monitoreo` cada 8 s mientras hay una corrida
   `en_cola` o `en_progreso`, y al terminar recarga la tabla sola.

## Estructura

```
server.js                   Arranque: arma dependencias reales y escucha
src/app.js                  crearApp({ fuenteDatos, monitoreo }), sin listener
src/config.js               Variables de entorno y validación de la clave
src/middleware/seguridad.js Cabeceras de seguridad (sin helmet)
src/routes/api.js           Rutas /api/*
src/lib/supabase.js         Cliente supabase-js (clave pública) y lecturas
src/lib/vista.js            Tendencias, más barato y posición (funciones puras)
src/lib/monitoreo.js        Cooldown + estado del botón
src/lib/github.js           workflow_dispatch y última corrida
src/lib/reportes.js         Excel (ExcelJS en streaming) y PDF (PDFKit)
src/lib/errores.js          ErrorHttp y manejador de errores
public/                     Frontend estático (HTML, CSS, JS sin frameworks)
test/                       node:test con fuentes de datos falsas
```

## Errores y seguridad

- Ningún error expone detalle interno. Un fallo de Supabase, de GitHub o
  cualquier excepción responde un mensaje genérico con una `referencia`, y el
  detalle completo solo se escribe en el log del servidor con esa misma
  referencia.
- Los reportes leen los datos **antes** de mandar cabeceras. Si Supabase
  falla, el cliente recibe el 500 genérico en vez de un archivo corrupto.
- Cabeceras en todas las respuestas: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy` y una `Content-Security-Policy` estricta (`'self'`). No
  se envía `X-Powered-By`.
