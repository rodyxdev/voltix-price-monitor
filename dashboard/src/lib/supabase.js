/**
 * Acceso a Supabase del dashboard: SOLO la clave pública (anon/publishable).
 *
 * Todo pasa por PostgREST vía @supabase/supabase-js (HTTPS), sin conexión
 * Postgres directa: en serverless cada invocación abriría su propia conexión
 * y agotaría el pool del proyecto compartido del portafolio.
 *
 * Lo que anon puede hacer lo decide RLS en la base: leer las tablas voltix_ y
 * llamar a voltix_reservar_disparo(). Cualquier otra escritura es rechazada.
 */
'use strict';

const { createClient } = require('@supabase/supabase-js');
const { construirVista } = require('./vista');
const { fallaSupabase } = require('./errores');

function crearClienteSupabase(config) {
  return createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

/** Lecturas del dashboard y los reportes, sobre un cliente supabase-js. */
function crearFuenteDatos(db) {
  return {
    async obtenerVista() {
      const [productos, ultimos] = await Promise.all([
        db.from('voltix_productos')
          .select('sku, nombre, categoria, precio_voltix, orden')
          .order('orden', { ascending: true })
          .order('sku', { ascending: true }),
        db.from('voltix_ultimos_precios')
          .select('sku, tienda, precio, precio_anterior, stock, fecha_scrape')
      ]);
      if (productos.error) throw fallaSupabase('leer voltix_productos', productos.error);
      if (ultimos.error) throw fallaSupabase('leer voltix_ultimos_precios', ultimos.error);
      return construirVista(productos.data, ultimos.data);
    },

    async ultimoDisparo() {
      const r = await db.from('voltix_disparos').select('ultimo_disparo').eq('id', 1).maybeSingle();
      if (r.error) throw fallaSupabase('leer voltix_disparos', r.error);
      return r.data && r.data.ultimo_disparo ? new Date(r.data.ultimo_disparo) : null;
    },

    /** Reserva atómica del cooldown. Devuelve { permitido, ultimoDisparo, segundosRestantes }. */
    async reservarDisparo(cooldownMinutos) {
      const r = await db.rpc('voltix_reservar_disparo', { p_cooldown_minutos: cooldownMinutos });
      if (r.error) throw fallaSupabase('voltix_reservar_disparo', r.error);
      const fila = Array.isArray(r.data) ? r.data[0] : r.data;
      if (!fila) throw fallaSupabase('voltix_reservar_disparo', { message: 'respuesta vacía' });
      return {
        permitido: Boolean(fila.permitido),
        ultimoDisparo: fila.ultimo_disparo ? new Date(fila.ultimo_disparo) : null,
        segundosRestantes: Number(fila.segundos_restantes) || 0
      };
    }
  };
}

module.exports = { crearClienteSupabase, crearFuenteDatos };
