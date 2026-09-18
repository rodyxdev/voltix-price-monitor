/**
 * Lectura de precios vigentes desde Supabase (voltix_precios_simulados), solo
 * con la clave pública y vía PostgREST (supabase-js): sin conexión Postgres
 * directa, que en serverless agotaría el pool del proyecto compartido.
 */
'use strict';

const { createClient } = require('@supabase/supabase-js');

function crearFuenteSupabase(config, slugTienda) {
  const db = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  return {
    /** Map sku -> { precio, stock } de esta tienda. */
    async obtenerPrecios() {
      const r = await db
        .from('voltix_precios_simulados')
        .select('sku, precio_actual, stock_actual')
        .eq('tienda', slugTienda);
      if (r.error) {
        const e = new Error('Supabase falló al leer voltix_precios_simulados: ' + r.error.message +
          (r.error.code ? ' (code ' + r.error.code + ')' : ''));
        e.causa = r.error;
        throw e;
      }
      return new Map(r.data.map((f) => [f.sku, { precio: Number(f.precio_actual), stock: f.stock_actual }]));
    }
  };
}

module.exports = { crearFuenteSupabase };
