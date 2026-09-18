/**
 * Configuración del dashboard desde variables de entorno.
 *
 * Supabase es obligatorio: sin él no hay nada que mostrar y es mejor fallar al
 * arrancar que con un error opaco a media petición. GitHub es opcional: sin
 * token el dashboard funciona y el botón "Ejecutar monitoreo ahora" aparece
 * como no disponible.
 */
'use strict';

// En Vercel no hay .env: las variables llegan del entorno y dotenv no hace nada.
// Ruta fija a dashboard/.env para que funcione sin importar desde dónde se arranque.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

function limpio(valor) {
  return String(valor || '').trim();
}

/** Rol que otorga una llave de Supabase ('' si no se reconoce). */
function rolDeLlave(llave) {
  if (llave.startsWith('sb_secret_')) return 'service_role';
  if (llave.startsWith('sb_publishable_')) return 'anon';
  const partes = llave.split('.');
  if (partes.length !== 3) return '';
  try {
    return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')).role || '';
  } catch (e) {
    return '';
  }
}

function cargarConfig(env) {
  const fuente = env || process.env;
  const url = limpio(fuente.SUPABASE_URL);
  const anonKey = limpio(fuente.SUPABASE_ANON_KEY);

  const faltantes = [];
  if (!url) faltantes.push('SUPABASE_URL');
  if (!anonKey) faltantes.push('SUPABASE_ANON_KEY');
  if (faltantes.length) {
    throw new Error(
      'Faltan variables de entorno: ' + faltantes.join(', ') +
      '\nCopia dashboard/.env.example a dashboard/.env y llena los valores.'
    );
  }

  // Separación de claves: el dashboard es público y solo lee. Si alguien pega
  // aquí la service role por error, el servidor se niega a arrancar.
  if (rolDeLlave(anonKey) === 'service_role') {
    throw new Error(
      'SUPABASE_ANON_KEY contiene una llave service_role/secret. El dashboard solo ' +
      'debe usar la clave pública (anon o sb_publishable_).'
    );
  }

  const cooldown = Number.parseInt(limpio(fuente.VOLTIX_COOLDOWN_MINUTOS) || '10', 10);

  return {
    puerto: Number(fuente.PORT) || 3000,
    supabase: { url, anonKey },
    github: {
      token: limpio(fuente.VOLTIX_GITHUB_TOKEN),
      repo: limpio(fuente.VOLTIX_GITHUB_REPO) || 'rodyxdev/voltix-price-monitor',
      workflow: limpio(fuente.VOLTIX_GITHUB_WORKFLOW) || 'monitoreo.yml',
      ref: limpio(fuente.VOLTIX_GITHUB_REF) || 'main'
    },
    // Mismo rango que acepta la función voltix_reservar_disparo en la base.
    cooldownMinutos: Number.isFinite(cooldown) ? Math.min(Math.max(cooldown, 1), 1440) : 10
  };
}

module.exports = { cargarConfig, rolDeLlave };
