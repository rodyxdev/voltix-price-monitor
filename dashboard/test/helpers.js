'use strict';

const { crearApp } = require('../src/app');
const { construirVista } = require('../src/lib/vista');

const PRODUCTOS = [
  { sku: 'NMB-A1', nombre: 'Audífonos Inalámbricos Nimbus A1', categoria: 'Audio', precio_voltix: '1279.00', orden: 1 },
  { sku: 'PLS-S2', nombre: 'Smartwatch Pulse S2', categoria: 'Wearables', precio_voltix: 2549, orden: 2 },
  { sku: 'KBD-K65', nombre: 'Teclado Mecánico Compacto K65', categoria: 'Periféricos', precio_voltix: 1549, orden: 3 }
];

const ULTIMOS = [
  { sku: 'NMB-A1', tienda: 'gigabazar', precio: 1299, precio_anterior: 1299, stock: 'En stock', fecha_scrape: '2026-09-17T12:00:00+00:00' },
  { sku: 'NMB-A1', tienda: 'electroexpress', precio: 1249, precio_anterior: 1299, stock: 'En stock', fecha_scrape: '2026-09-17T12:00:05+00:00' },
  { sku: 'PLS-S2', tienda: 'gigabazar', precio: 2499, precio_anterior: 2599, stock: 'En stock', fecha_scrape: '2026-09-17T12:00:00+00:00' },
  { sku: 'PLS-S2', tienda: 'electroexpress', precio: 2599, precio_anterior: 2499, stock: 'Pocas piezas', fecha_scrape: '2026-09-17T12:00:00+00:00' },
  { sku: 'KBD-K65', tienda: 'gigabazar', precio: 1599, precio_anterior: null, stock: 'Agotado', fecha_scrape: '2026-09-17T11:00:00+00:00' }
];

function vistaDeEjemplo() {
  return construirVista(PRODUCTOS, ULTIMOS);
}

/** Levanta la app en un puerto libre. Devuelve { url, cerrar }. */
async function levantar(deps) {
  const app = crearApp({
    fuenteDatos: { obtenerVista: async () => vistaDeEjemplo() },
    monitoreo: {
      estado: async () => ({ disponible: true, estado: 'inactivo', cooldownSegundos: 0, ultimaCorrida: null }),
      ejecutar: async () => ({ estado: 'en_cola', cooldownSegundos: 600 })
    },
    ...deps
  });
  const servidor = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  return {
    url: 'http://127.0.0.1:' + servidor.address().port,
    cerrar: () => new Promise((resolve) => servidor.close(resolve))
  };
}

/** Silencia console.error durante fn y devuelve lo que se registró. */
async function capturarLog(fn) {
  const original = console.error;
  const lineas = [];
  console.error = (...args) => lineas.push(args.map(String).join(' '));
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return lineas.join('\n');
}

module.exports = { PRODUCTOS, ULTIMOS, vistaDeEjemplo, levantar, capturarLog };
