'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { levantar, capturarLog } = require('./helpers');
const { ErrorHttp } = require('../src/lib/errores');

test('GET /api/productos devuelve la vista con cabeceras de seguridad', async (t) => {
  const srv = await levantar();
  t.after(srv.cerrar);

  const r = await fetch(srv.url + '/api/productos');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-powered-by'), null);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('cache-control'), 'no-store, max-age=0');

  const cuerpo = await r.json();
  assert.equal(cuerpo.productos.length, 3);
  assert.equal(cuerpo.productos[0].competidores.electroexpress.tendencia, 'baja');
});

test('las páginas estáticas también llevan cabeceras de seguridad', async (t) => {
  const srv = await levantar();
  t.after(srv.cerrar);
  const r = await fetch(srv.url + '/');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('un fallo de Supabase responde 500 genérico sin detalle interno', async (t) => {
  const detalle = 'relation "voltix_productos" does not exist (code 42P01)';
  const srv = await levantar({
    fuenteDatos: {
      obtenerVista: async () => {
        throw new Error('Supabase falló en leer voltix_productos: ' + detalle);
      }
    }
  });
  t.after(srv.cerrar);

  let r;
  let texto;
  const log = await capturarLog(async () => {
    r = await fetch(srv.url + '/api/productos');
    texto = await r.text();
  });

  assert.equal(r.status, 500);
  const cuerpo = JSON.parse(texto);
  assert.equal(cuerpo.error, 'Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.');
  assert.match(cuerpo.referencia, /^[0-9a-f]{12}$/);
  assert.ok(!texto.includes('voltix_productos'), 'la respuesta no debe filtrar el detalle');
  assert.ok(!texto.includes('42P01'));
  assert.ok(!/at .+\.js/.test(texto), 'la respuesta no debe incluir stack trace');
  // El detalle completo sí queda en el log del servidor, con la misma referencia.
  assert.ok(log.includes(detalle));
  assert.ok(log.includes(cuerpo.referencia));
});

test('los reportes con fallo de datos también responden 500 genérico', async (t) => {
  const srv = await levantar({
    fuenteDatos: { obtenerVista: async () => { throw new Error('PGRST301 JWT expired'); } }
  });
  t.after(srv.cerrar);
  await capturarLog(async () => {
    for (const ruta of ['/api/reportes/comparativa.xlsx', '/api/reportes/comparativa.pdf']) {
      const r = await fetch(srv.url + ruta);
      const texto = await r.text();
      assert.equal(r.status, 500);
      assert.equal(r.headers.get('content-type').split(';')[0], 'application/json');
      assert.ok(!texto.includes('PGRST301'));
    }
  });
});

test('POST /api/monitoreo: 202 al disparar y 429 con Retry-After en cooldown', async (t) => {
  let llamadas = 0;
  const srv = await levantar({
    monitoreo: {
      estado: async () => ({}),
      ejecutar: async () => {
        llamadas += 1;
        if (llamadas > 1) {
          throw new ErrorHttp(429, 'Ya se ejecutó un monitoreo hace poco.', { cooldownSegundos: 540 }, { 'Retry-After': '540' });
        }
        return { estado: 'en_cola', cooldownSegundos: 600 };
      }
    }
  });
  t.after(srv.cerrar);

  const primero = await fetch(srv.url + '/api/monitoreo', { method: 'POST' });
  assert.equal(primero.status, 202);
  assert.equal((await primero.json()).estado, 'en_cola');

  const segundo = await fetch(srv.url + '/api/monitoreo', { method: 'POST' });
  assert.equal(segundo.status, 429);
  assert.equal(segundo.headers.get('retry-after'), '540');
  assert.deepEqual(await segundo.json(), { error: 'Ya se ejecutó un monitoreo hace poco.', cooldownSegundos: 540 });
});

test('JSON mal formado es 400, rutas de API inexistentes son 404 JSON', async (t) => {
  const srv = await levantar();
  t.after(srv.cerrar);

  const malo = await fetch(srv.url + '/api/monitoreo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{nope'
  });
  assert.equal(malo.status, 400);
  assert.ok(!(await malo.text()).includes('SyntaxError'));

  const r = await fetch(srv.url + '/api/no-existe');
  assert.equal(r.status, 404);
  assert.deepEqual(await r.json(), { error: 'Recurso no encontrado.' });
});

test('reporte Excel: xlsx válido generado en streaming', async (t) => {
  const srv = await levantar();
  t.after(srv.cerrar);

  const r = await fetch(srv.url + '/api/reportes/comparativa.xlsx');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.match(r.headers.get('content-disposition'), /attachment; filename="voltix-comparativa-\d{4}-\d{2}-\d{2}\.xlsx"/);
  // Chunked: el tamaño no se conoce de antemano porque no hay archivo en disco.
  assert.equal(r.headers.get('transfer-encoding'), 'chunked');

  const bytes = Buffer.from(await r.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString(), 'PK');

  const ExcelJS = require('exceljs');
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes);
  const hoja = libro.getWorksheet('Comparativa');
  assert.equal(hoja.getCell('A4').value, 'SKU');
  assert.equal(hoja.getCell('D4').value, 'Precio Voltix');
  assert.equal(hoja.getCell('A5').value, 'NMB-A1');
  assert.equal(hoja.getCell('D5').value, 1279);
  assert.equal(hoja.getCell('H5').value, 1249);
  assert.match(String(hoja.getCell('K5').value), /^ElectroExpress/);
  assert.match(String(hoja.getCell('L5').value), /^Nos ganan por \$30\.00/);
});

test('reporte PDF: pdf válido generado en streaming', async (t) => {
  const srv = await levantar();
  t.after(srv.cerrar);

  const r = await fetch(srv.url + '/api/reportes/comparativa.pdf');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.match(r.headers.get('content-disposition'), /\.pdf"$/);
  const bytes = Buffer.from(await r.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(bytes.subarray(-8).toString().includes('%%EOF'));
});
