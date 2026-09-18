# /dashboard — Dashboard de Voltix

Servidor Node/Express que sirve el frontend del monitor de precios.
En la Fase 1 es **solo el cascarón visual**: los datos son de ejemplo y están
hardcodeados en el cliente.

## Correr en local

```bash
cd dashboard
npm install
npm start
```

- Dashboard: http://localhost:3000
- Health check: http://localhost:3000/health

`npm run dev` usa `node --watch` para reiniciar al guardar cambios.
El puerto se cambia con la variable de entorno `PORT`.

## Estructura

```
server.js                 Express: estáticos + /health (sin API todavía)
public/index.html         Vista única del dashboard
public/css/estilos.css    Estilos mobile-first, sin frameworks
public/js/datos-ejemplo.js Datos hardcodeados (se elimina en Fase 2)
public/js/app.js          Render de la tabla, KPIs y botón de monitoreo
```

## Qué incluye la vista

- **KPIs:** productos monitoreados, cuántos bajaron/subieron, en cuántos Voltix
  no es el más barato.
- **Tabla comparativa:** los 8 productos con el precio de Voltix y el de cada
  competidor, indicador de tendencia (▼ bajó / ▲ subió / = sin cambio),
  disponibilidad y una etiqueta de posición competitiva.
- **Botón "Ejecutar monitoreo ahora":** solo UI; muestra un aviso y se
  rehabilita a los pocos segundos.
- **Sección de reportes:** tres tarjetas con botones de descarga deshabilitados.

En móvil la tabla se convierte en tarjetas apiladas; a partir de 720 px se
muestra como tabla real.

## Pendiente para la Fase 2

- `GET /api/productos` leyendo las tablas `voltix_*` de Supabase, en lugar de
  `public/js/datos-ejemplo.js` (solo hay que cambiar `cargarDatos()` en `app.js`).
- `POST /api/monitoreo` para el botón "Ejecutar monitoreo ahora".
- Endpoints de descarga real de los reportes Excel/PDF.
- Tendencias calculadas contra el histórico en base de datos, no hardcodeadas.
