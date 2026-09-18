/**
 * Arma la vista comparativa a partir de lo que devuelve Supabase.
 *
 * Funciones puras (sin red) para que el dashboard, el Excel y el PDF usen
 * exactamente la misma lógica de tendencias, "más barato" y posición.
 */
'use strict';

const TIENDAS = [
  { slug: 'gigabazar', nombre: 'GigaBazar' },
  { slug: 'electroexpress', nombre: 'ElectroExpress' }
];

// Los precios se comparan en centavos enteros: 0.1 + 0.2 no debe dar "subió".
function centavos(valor) {
  return Math.round(Number(valor) * 100);
}

/** 'baja' | 'alza' | 'igual' | 'sin_historial' respecto al snapshot anterior. */
function tendencia(precio, precioAnterior) {
  if (precioAnterior === null || precioAnterior === undefined) return 'sin_historial';
  const delta = centavos(precio) - centavos(precioAnterior);
  if (delta < 0) return 'baja';
  if (delta > 0) return 'alza';
  return 'igual';
}

function lecturaCompetidor(fila) {
  if (!fila) return null;
  const precio = Number(fila.precio);
  const precioAnterior = fila.precio_anterior === null ? null : Number(fila.precio_anterior);
  return {
    precio,
    precioAnterior,
    tendencia: tendencia(precio, precioAnterior),
    variacion: precioAnterior === null ? null : (centavos(precio) - centavos(precioAnterior)) / 100,
    stock: fila.stock || '',
    fecha: fila.fecha_scrape
  };
}

/** Quién vende más barato entre Voltix y los competidores con lectura. */
function masBarato(precioVoltix, competidores) {
  const ofertas = [{ clave: 'voltix', nombre: 'Voltix', precio: precioVoltix }];
  for (const t of TIENDAS) {
    if (competidores[t.slug]) ofertas.push({ clave: t.slug, nombre: t.nombre, precio: competidores[t.slug].precio });
  }
  const minimo = Math.min(...ofertas.map((o) => centavos(o.precio)));
  const ganadores = ofertas.filter((o) => centavos(o.precio) === minimo);
  return {
    claves: ganadores.map((o) => o.clave),
    nombre: ganadores.map((o) => o.nombre).join(' / '),
    precio: minimo / 100
  };
}

/** Posición de Voltix contra el competidor más barato. */
function posicion(precioVoltix, competidores) {
  const precios = TIENDAS.map((t) => competidores[t.slug]).filter(Boolean).map((c) => centavos(c.precio));
  if (!precios.length) {
    return { clave: 'sin_datos', texto: 'Sin lecturas de competencia', diferencia: null };
  }
  const diferencia = (centavos(precioVoltix) - Math.min(...precios)) / 100;
  if (diferencia < 0) return { clave: 'ganamos', texto: 'Voltix es el más barato', diferencia: -diferencia };
  if (diferencia === 0) return { clave: 'empate', texto: 'Empatados con el más barato', diferencia: 0 };
  return { clave: 'perdemos', texto: 'Nos ganan por', diferencia };
}

/**
 * productos: filas de voltix_productos
 * ultimos:   filas de voltix_ultimos_precios (último snapshot por sku+tienda)
 */
function construirVista(productos, ultimos) {
  const porSku = new Map();
  let ultimoMonitoreo = null;

  for (const fila of ultimos) {
    if (!porSku.has(fila.sku)) porSku.set(fila.sku, {});
    porSku.get(fila.sku)[fila.tienda] = fila;
    if (!ultimoMonitoreo || new Date(fila.fecha_scrape) > new Date(ultimoMonitoreo)) {
      ultimoMonitoreo = fila.fecha_scrape;
    }
  }

  const filas = productos.map((p) => {
    const lecturas = porSku.get(p.sku) || {};
    const competidores = {};
    for (const t of TIENDAS) competidores[t.slug] = lecturaCompetidor(lecturas[t.slug]);
    const precioVoltix = Number(p.precio_voltix);

    return {
      sku: p.sku,
      nombre: p.nombre,
      categoria: p.categoria,
      precioVoltix,
      competidores,
      masBarato: masBarato(precioVoltix, competidores),
      posicion: posicion(precioVoltix, competidores)
    };
  });

  const conTendencia = (tipo) =>
    filas.filter((f) => TIENDAS.some((t) => f.competidores[t.slug] && f.competidores[t.slug].tendencia === tipo)).length;

  return {
    ultimoMonitoreo,
    tiendas: TIENDAS,
    productos: filas,
    resumen: {
      productos: filas.length,
      conBajas: conTendencia('baja'),
      conAlzas: conTendencia('alza'),
      noSomosMasBaratos: filas.filter((f) => f.posicion.clave === 'perdemos' || f.posicion.clave === 'empate').length
    }
  };
}

module.exports = { TIENDAS, tendencia, masBarato, posicion, construirVista };
