/**
 * Arranque local de la tienda.
 *
 *   npm start    (lee .env de esta carpeta)
 *
 * En Vercel el punto de entrada es api/index.js, que usa la misma app.
 */
'use strict';

const tienda = require('./src/tienda');
const { cargarConfig } = require('./src/config');
const { crearApp } = require('./src/app');
const { crearFuenteSupabase } = require('./src/datos');

const config = cargarConfig(process.env, tienda.puertoLocal);
const app = crearApp({ tienda, fuente: crearFuenteSupabase(config, tienda.slug) });

if (require.main === module) {
  app.listen(config.puerto, () => {
    console.log(tienda.nombre + ' escuchando en http://localhost:' + config.puerto);
  });
}

module.exports = app;
