/**
 * Identidad de GigaBazar. Es el ÚNICO archivo de src/ que cambia entre
 * tiendas: el resto es código compartido (ver competitors/tools/sincronizar.js).
 */
'use strict';

module.exports = {
  slug: 'gigabazar',
  nombre: 'GigaBazar',
  tagline: 'Todo para tu vida digital, al mayoreo y al menudeo',
  claim: 'Envío gratis en compras mayores a $599',
  footer: 'GigaBazar es una tienda ficticia creada como entorno de pruebas para Voltix.',
  moneda: 'MXN',
  puertoLocal: 8081,

  // Espejo de la siembra de voltix_restaurar_demo() (supabase/migrations/0003).
  // En producción los precios salen de voltix_precios_simulados; estos solo se
  // usan para generar el snapshot index.html y en las pruebas.
  preciosBase: {
    'NMB-A1': { precio: 1299.00, stock: 'En stock' },
    'PLS-S2': { precio: 2499.00, stock: 'En stock' },
    'VLT-20K': { precio: 699.00, stock: 'En stock' },
    'CRG-65W': { precio: 549.00, stock: 'Pocas piezas' },
    'BOM-MIN': { precio: 899.00, stock: 'En stock' },
    'GLD-M3': { precio: 399.00, stock: 'En stock' },
    'KBD-K65': { precio: 1599.00, stock: 'Agotado' },
    'CBL-CH2': { precio: 329.00, stock: 'En stock' }
  }
};
