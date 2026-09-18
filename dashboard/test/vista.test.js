'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { tendencia, construirVista } = require('../src/lib/vista');
const { PRODUCTOS, ULTIMOS } = require('./helpers');

test('tendencia compara en centavos', () => {
  assert.equal(tendencia(99.9, 100), 'baja');
  assert.equal(tendencia(100.01, 100), 'alza');
  assert.equal(tendencia(0.1 + 0.2, 0.3), 'igual');
  assert.equal(tendencia(100, null), 'sin_historial');
});

test('construirVista: tendencias, más barato y posición por SKU', () => {
  const vista = construirVista(PRODUCTOS, ULTIMOS);
  const [audifonos, reloj, teclado] = vista.productos;

  assert.equal(vista.ultimoMonitoreo, '2026-09-17T12:00:05+00:00');

  assert.equal(audifonos.precioVoltix, 1279);
  assert.equal(audifonos.competidores.gigabazar.tendencia, 'igual');
  assert.equal(audifonos.competidores.electroexpress.tendencia, 'baja');
  assert.equal(audifonos.competidores.electroexpress.variacion, -50);
  assert.deepEqual(audifonos.masBarato.claves, ['electroexpress']);
  assert.deepEqual(audifonos.posicion, { clave: 'perdemos', texto: 'Nos ganan por', diferencia: 30 });

  assert.equal(reloj.competidores.gigabazar.tendencia, 'baja');
  assert.equal(reloj.competidores.electroexpress.tendencia, 'alza');
  assert.equal(reloj.posicion.clave, 'perdemos');

  // Sin lectura de ElectroExpress y sin historial en GigaBazar.
  assert.equal(teclado.competidores.electroexpress, null);
  assert.equal(teclado.competidores.gigabazar.tendencia, 'sin_historial');
  assert.equal(teclado.posicion.clave, 'ganamos');
  assert.equal(teclado.posicion.diferencia, 50);
  assert.equal(teclado.masBarato.nombre, 'Voltix');

  assert.deepEqual(vista.resumen, { productos: 3, conBajas: 2, conAlzas: 1, noSomosMasBaratos: 2 });
});

test('construirVista: empate lista a todos los más baratos', () => {
  const vista = construirVista(
    [{ sku: 'X', nombre: 'X', categoria: 'C', precio_voltix: 100 }],
    [{ sku: 'X', tienda: 'gigabazar', precio: '100.00', precio_anterior: '110.00', stock: '', fecha_scrape: '2026-01-01T00:00:00Z' }]
  );
  const [p] = vista.productos;
  assert.deepEqual(p.masBarato.claves, ['voltix', 'gigabazar']);
  assert.equal(p.masBarato.nombre, 'Voltix / GigaBazar');
  assert.equal(p.posicion.clave, 'empate');
});

test('construirVista: producto sin ninguna lectura', () => {
  const vista = construirVista([{ sku: 'Y', nombre: 'Y', categoria: 'C', precio_voltix: 10 }], []);
  assert.equal(vista.productos[0].posicion.clave, 'sin_datos');
  assert.equal(vista.ultimoMonitoreo, null);
});
