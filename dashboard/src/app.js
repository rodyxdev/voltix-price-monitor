/**
 * Construcción de la aplicación Express.
 *
 * Separada de server.js y con las dependencias inyectadas para poder montarla
 * en pruebas (con fuentes falsas) o en un handler serverless (Fase 3) sin
 * arrancar un listener.
 */
'use strict';

const path = require('path');
const express = require('express');

const { cabecerasSeguridad, sinCache } = require('./middleware/seguridad');
const { noEncontrado, manejadorErrores } = require('./lib/errores');
const { crearRutasApi } = require('./routes/api');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function crearApp({ fuenteDatos, monitoreo }) {
  const app = express();

  // Express anuncia "X-Powered-By: Express" por defecto.
  app.disable('x-powered-by');

  app.use(cabecerasSeguridad);
  app.use(express.json({ limit: '8kb' }));

  // Chequeo de salud: no toca la base, sirve para el deploy de Fase 3.
  app.get('/health', (req, res) => {
    res.set('Cache-Control', 'no-store').json({ ok: true, servicio: 'voltix-dashboard' });
  });

  const api = express.Router();
  api.use(sinCache);
  api.use(crearRutasApi({ fuenteDatos, monitoreo }));
  api.use(noEncontrado);
  app.use('/api', api);

  app.use(express.static(PUBLIC_DIR));

  // Cualquier otra ruta: el dashboard es una sola página.
  app.use((req, res) => {
    res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  app.use(manejadorErrores);

  return app;
}

module.exports = { crearApp };
