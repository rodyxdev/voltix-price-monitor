/**
 * Voltix - arranque del dashboard.
 *
 *   npm start        (lee dashboard/.env si existe)
 *
 * Arma las dependencias reales (Supabase con clave pública, API de GitHub) y
 * las inyecta en crearApp(). También exporta la app para el handler
 * serverless de la Fase 3.
 */
'use strict';

const { cargarConfig } = require('./src/config');
const { crearApp } = require('./src/app');
const { crearClienteSupabase, crearFuenteDatos } = require('./src/lib/supabase');
const { crearClienteGithub } = require('./src/lib/github');
const { crearServicioMonitoreo } = require('./src/lib/monitoreo');

const config = cargarConfig();
const fuenteDatos = crearFuenteDatos(crearClienteSupabase(config));
const github = crearClienteGithub(config.github);
const monitoreo = crearServicioMonitoreo({
  datos: fuenteDatos,
  github,
  cooldownMinutos: config.cooldownMinutos
});

const app = crearApp({ fuenteDatos, monitoreo });

if (require.main === module) {
  app.listen(config.puerto, () => {
    console.log('Voltix dashboard escuchando en http://localhost:' + config.puerto);
    if (!github.configurado) {
      console.log('Aviso: sin VOLTIX_GITHUB_TOKEN, el botón "Ejecutar monitoreo ahora" queda deshabilitado.');
    }
  });
}

module.exports = app;
