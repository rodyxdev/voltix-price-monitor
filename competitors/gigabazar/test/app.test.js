'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const tienda = require('../src/tienda');
const CATALOGO = require('../src/catalogo');
const { crearApp, combinar } = require('../src/app');
const { paginaCatalogo } = require('../src/render');
const { cargarConfig } = require('../src/config');

const BASE = new Map(Object.entries(tienda.preciosBase));

async function levantar(fuente) {
  const app = crearApp({ tienda, fuente });
  const srv = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  return { url: 'http://127.0.0.1:' + srv.address().port, cerrar: () => new Promise((r) => srv.close(r)) };
}

async function silenciar(fn) {
  const original = console.error;
  const lineas = [];
  console.error = (...a) => lineas.push(a.map(String).join(' '));
  try { await fn(); } finally { console.error = original; }
  return lineas.join('\n');
}

test('el snapshot index.html es exactamente lo que renderiza la app con precios base', () => {
  const html = paginaCatalogo(tienda, combinar(BASE));
  const snapshot = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.equal(html, snapshot, 'corre `npm run snapshot` si el cambio de marcado es intencional');
});

test('el catálogo muestra el precio y stock vigentes de Supabase con el marcado del scraper', async (t) => {
  const precios = new Map(BASE);
  precios.set('NMB-A1', { precio: 1188.5, stock: 'Pocas piezas' });
  const srv = await levantar({ obtenerPrecios: async () => precios });
  t.after(srv.cerrar);

  const r = await fetch(srv.url + '/');
  const html = await r.text();
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-powered-by'), null);

  assert.equal((html.match(/class="product-card"/g) || []).length, CATALOGO.length);
  assert.match(html, /<li class="product-card" data-sku="NMB-A1">[\s\S]*?<p class="product-price" data-currency="MXN">\$ 1,188\.50<\/p>\s*<p class="product-stock" data-stock="pocas-piezas">Pocas piezas<\/p>/);
  assert.equal(await (await fetch(srv.url + '/index.html')).text(), html);
});

test('detalle de producto, 404 y CSS estático', async (t) => {
  const srv = await levantar({ obtenerPrecios: async () => BASE });
  t.after(srv.cerrar);

  const detalle = await fetch(srv.url + '/productos/teclado-mecanico-k65.html');
  const html = await detalle.text();
  assert.equal(detalle.status, 200);
  assert.match(html, /<div class="product-detail" data-sku="KBD-K65">/);
  assert.match(html, /href="\.\.\/css\/estilos\.css"/);

  for (const ruta of ['/productos/no-existe.html', '/productos/../server.js', '/otra-cosa']) {
    assert.equal((await fetch(srv.url + ruta)).status, 404, ruta);
  }

  const css = await fetch(srv.url + '/css/estilos.css');
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /text\/css/);
});

test('un producto sin precio en Supabase no se lista', async (t) => {
  const precios = new Map(BASE);
  precios.delete('CBL-CH2');
  const srv = await levantar({ obtenerPrecios: async () => precios });
  t.after(srv.cerrar);
  const html = await (await fetch(srv.url + '/')).text();
  assert.ok(!html.includes('data-sku="CBL-CH2"'));
  assert.match(html, /7 productos disponibles/);
  assert.equal((await fetch(srv.url + '/productos/cable-usb-c-hdmi-4k.html')).status, 404);
});

test('si Supabase falla: 503 genérico, sin detalle interno, detalle solo en el log', async (t) => {
  const srv = await levantar({
    obtenerPrecios: async () => { throw new Error('Supabase falló: permission denied for table voltix_precios_simulados (code 42501)'); }
  });
  t.after(srv.cerrar);
  let r;
  let html;
  const log = await silenciar(async () => {
    r = await fetch(srv.url + '/');
    html = await r.text();
  });
  assert.equal(r.status, 503);
  assert.ok(!html.includes('42501') && !html.includes('voltix_precios_simulados') && !html.includes('product-card'));
  assert.match(html, /Catálogo no disponible/);
  assert.ok(log.includes('42501'));
});

test('config: se niega a arrancar con la service role', () => {
  const base = { SUPABASE_URL: 'https://x.supabase.co' };
  assert.throws(() => cargarConfig({ ...base, SUPABASE_ANON_KEY: 'sb_secret_x' }), /service_role/);
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from('{"role":"service_role"}').toString('base64url') + '.firma';
  assert.throws(() => cargarConfig({ ...base, SUPABASE_ANON_KEY: jwt }), /service_role/);
  assert.equal(cargarConfig({ ...base, SUPABASE_ANON_KEY: 'sb_publishable_x' }, 8081).puerto, 8081);
});
