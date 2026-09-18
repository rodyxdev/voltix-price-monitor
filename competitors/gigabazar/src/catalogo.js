/**
 * Catálogo fijo de las tiendas ficticias: lo que NO cambia entre corridas
 * (nombre, categoría, SKU, descripción, URL). El precio y el stock vigentes
 * vienen de Supabase (voltix_precios_simulados).
 *
 * El SKU es el mismo que usa voltix_productos y que el scraper lee de data-sku.
 */
'use strict';

module.exports = [
  {
    slug: 'audifonos-inalambricos',
    sku: 'NMB-A1',
    nombre: 'Audífonos Inalámbricos Nimbus A1',
    categoria: 'Audio',
    descripcion: 'Audífonos over-ear con cancelación activa de ruido y 30 h de batería.'
  },
  {
    slug: 'smartwatch-pulse-s2',
    sku: 'PLS-S2',
    nombre: 'Smartwatch Pulse S2',
    categoria: 'Wearables',
    descripcion: 'Reloj inteligente con GPS, medición de ritmo cardiaco y resistencia 5 ATM.'
  },
  {
    slug: 'power-bank-volt-20000',
    sku: 'VLT-20K',
    nombre: 'Power Bank Volt 20000 mAh',
    categoria: 'Energía',
    descripcion: 'Batería portátil de 20000 mAh con dos puertos USB-A y uno USB-C PD.'
  },
  {
    slug: 'cargador-usb-c-65w',
    sku: 'CRG-65W',
    nombre: 'Cargador Rápido USB-C 65W',
    categoria: 'Energía',
    descripcion: 'Cargador GaN de 65 W compatible con laptops ligeras, tablets y teléfonos.'
  },
  {
    slug: 'bocina-bluetooth-boom-mini',
    sku: 'BOM-MIN',
    nombre: 'Bocina Bluetooth Boom Mini',
    categoria: 'Audio',
    descripcion: 'Bocina portátil IPX7 con 12 h de reproducción y emparejamiento estéreo.'
  },
  {
    slug: 'mouse-inalambrico-glide-m3',
    sku: 'GLD-M3',
    nombre: 'Mouse Inalámbrico Glide M3',
    categoria: 'Periféricos',
    descripcion: 'Mouse silencioso de 2.4 GHz y Bluetooth con sensor de 4000 DPI.'
  },
  {
    slug: 'teclado-mecanico-k65',
    sku: 'KBD-K65',
    nombre: 'Teclado Mecánico Compacto K65',
    categoria: 'Periféricos',
    descripcion: 'Teclado 65% hot-swappable con switches lineales y retroiluminación RGB.'
  },
  {
    slug: 'cable-usb-c-hdmi-4k',
    sku: 'CBL-CH2',
    nombre: 'Cable USB-C a HDMI 4K 2m',
    categoria: 'Cables',
    descripcion: 'Cable trenzado de 2 m con salida 4K a 60 Hz y carcasa de aluminio.'
  }
];
