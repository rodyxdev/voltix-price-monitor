/**
 * Configuración desde variables de entorno.
 *
 * Igual que el dashboard, la tienda solo LEE de Supabase con la clave pública:
 * si recibe la service role por error, se niega a arrancar.
 */
'use strict';

const path = require('path');

// En Vercel no hay .env: las variables llegan del entorno y dotenv no hace nada.
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

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

function cargarConfig(env, puertoPorDefecto) {
  const fuente = env || process.env;
  const url = String(fuente.SUPABASE_URL || '').trim();
  const anonKey = String(fuente.SUPABASE_ANON_KEY || '').trim();

  const faltantes = [];
  if (!url) faltantes.push('SUPABASE_URL');
  if (!anonKey) faltantes.push('SUPABASE_ANON_KEY');
  if (faltantes.length) {
    throw new Error('Faltan variables de entorno: ' + faltantes.join(', ') + '. Copia .env.example a .env.');
  }
  if (rolDeLlave(anonKey) === 'service_role') {
    throw new Error('SUPABASE_ANON_KEY contiene una llave service_role/secret. La tienda solo usa la clave pública.');
  }

  return {
    puerto: Number(fuente.PORT) || puertoPorDefecto || 3000,
    supabase: { url, anonKey }
  };
}

module.exports = { cargarConfig, rolDeLlave };
