/**
 * Identidad de ElectroExpress. Es el ÚNICO archivo de src/ que cambia entre
 * tiendas: el resto es código compartido (ver competitors/tools/sincronizar.js).
 */
'use strict';

module.exports = {
  slug: 'electroexpress',
  nombre: 'ElectroExpress',
  tagline: 'Gadgets seleccionados a mano, entrega el mismo día',
  claim: 'Asesoría personalizada por WhatsApp',
  footer: 'ElectroExpress es una tienda ficticia creada como entorno de pruebas para Voltix.',
  moneda: 'MXN',
  puertoLocal: 8082,

  // Espejo de la siembra de voltix_restaurar_demo() (supabase/migrations/0003).
  // En producción los precios salen de voltix_precios_simulados; estos solo se
  // usan para generar el snapshot index.html y en las pruebas.
  preciosBase: {
    'NMB-A1': { precio: 1249.00, stock: 'En stock' },
    'PLS-S2': { precio: 2599.00, stock: 'Pocas piezas' },
    'VLT-20K': { precio: 679.50, stock: 'En stock' },
    'CRG-65W': { precio: 499.00, stock: 'En stock' },
    'BOM-MIN': { precio: 949.00, stock: 'En stock' },
    'GLD-M3': { precio: 375.00, stock: 'En stock' },
    'KBD-K65': { precio: 1689.00, stock: 'En stock' },
    'CBL-CH2': { precio: 299.00, stock: 'Pocas piezas' }
  }
};
