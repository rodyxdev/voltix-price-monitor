/**
 * Datos de ejemplo del dashboard (Fase 1).
 *
 * Los precios coinciden con los de las tiendas ficticias de /competitors,
 * para que la vista se parezca a lo que devolverá el scraper en la Fase 2.
 * `tendencia` es el cambio respecto al monitoreo anterior: "baja" | "alza" | "igual".
 *
 * Fase 2: este archivo se elimina y los datos llegan de GET /api/productos.
 */
window.VOLTIX_DATOS_EJEMPLO = {
  ultimoMonitoreo: '17 de septiembre de 2026, 07:03',
  moneda: 'MXN',
  productos: [
    {
      sku: 'NMB-A1',
      nombre: 'Audífonos Inalámbricos Nimbus A1',
      categoria: 'Audio',
      precioVoltix: 1279.0,
      competidores: {
        gigabazar: { precio: 1299.0, tendencia: 'igual', stock: 'En stock' },
        electroexpress: { precio: 1249.0, tendencia: 'baja', stock: 'En stock' }
      }
    },
    {
      sku: 'PLS-S2',
      nombre: 'Smartwatch Pulse S2',
      categoria: 'Wearables',
      precioVoltix: 2549.0,
      competidores: {
        gigabazar: { precio: 2499.0, tendencia: 'baja', stock: 'En stock' },
        electroexpress: { precio: 2599.0, tendencia: 'alza', stock: 'Pocas piezas' }
      }
    },
    {
      sku: 'VLT-20K',
      nombre: 'Power Bank Volt 20000 mAh',
      categoria: 'Energía',
      precioVoltix: 689.0,
      competidores: {
        gigabazar: { precio: 699.0, tendencia: 'igual', stock: 'En stock' },
        electroexpress: { precio: 679.5, tendencia: 'baja', stock: 'En stock' }
      }
    },
    {
      sku: 'CRG-65W',
      nombre: 'Cargador Rápido USB-C 65W',
      categoria: 'Energía',
      precioVoltix: 529.0,
      competidores: {
        gigabazar: { precio: 549.0, tendencia: 'alza', stock: 'Pocas piezas' },
        electroexpress: { precio: 499.0, tendencia: 'baja', stock: 'En stock' }
      }
    },
    {
      sku: 'BOM-MIN',
      nombre: 'Bocina Bluetooth Boom Mini',
      categoria: 'Audio',
      precioVoltix: 879.0,
      competidores: {
        gigabazar: { precio: 899.0, tendencia: 'igual', stock: 'En stock' },
        electroexpress: { precio: 949.0, tendencia: 'alza', stock: 'En stock' }
      }
    },
    {
      sku: 'GLD-M3',
      nombre: 'Mouse Inalámbrico Glide M3',
      categoria: 'Periféricos',
      precioVoltix: 389.0,
      competidores: {
        gigabazar: { precio: 399.0, tendencia: 'igual', stock: 'En stock' },
        electroexpress: { precio: 375.0, tendencia: 'baja', stock: 'En stock' }
      }
    },
    {
      sku: 'KBD-K65',
      nombre: 'Teclado Mecánico Compacto K65',
      categoria: 'Periféricos',
      precioVoltix: 1549.0,
      competidores: {
        gigabazar: { precio: 1599.0, tendencia: 'igual', stock: 'Agotado' },
        electroexpress: { precio: 1689.0, tendencia: 'alza', stock: 'En stock' }
      }
    },
    {
      sku: 'CBL-CH2',
      nombre: 'Cable USB-C a HDMI 4K 2m',
      categoria: 'Cables',
      precioVoltix: 319.0,
      competidores: {
        gigabazar: { precio: 329.0, tendencia: 'igual', stock: 'En stock' },
        electroexpress: { precio: 299.0, tendencia: 'baja', stock: 'Pocas piezas' }
      }
    }
  ]
};
