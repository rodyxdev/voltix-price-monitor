/**
 * App Express de la tienda. Recibe la identidad de la tienda y la fuente de
 * precios inyectadas, para montarla igual en local (server.js), en Vercel
 * (api/index.js) y en pruebas (con una fuente falsa).
 *
 * Rutas (mismas URLs que los sitios estáticos de la Fase 1):
 *   GET /  y  /index.html          catálogo
 *   GET /productos/<slug>.html     detalle
 *   GET /css/estilos.css           estático (public/)
 */
'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');

const CATALOGO = require('./catalogo');
const { paginaCatalogo, paginaDetalle, paginaAviso } = require('./render');
const { cabecerasSeguridad } = require('./seguridad');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/** Catálogo fijo + precio/stock vigentes. Sin precio, el producto no se lista. */
function combinar(precios) {
  return CATALOGO
    .filter((p) => precios.has(p.sku))
    .map((p) => ({ ...p, ...precios.get(p.sku) }));
}

function crearApp({ tienda, fuente }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cabecerasSeguridad);

  function enviarHtml(res, estado, html) {
    // El scraper debe ver siempre el precio vigente: nada de caché.
    res.status(estado).set('Cache-Control', 'no-store').type('html').send(html);
  }

  function falla(res, err, req, rutaCss, rutaInicio) {
    const id = crypto.randomBytes(6).toString('hex');
    console.error('[error ' + id + '] ' + req.method + ' ' + req.originalUrl + '\n', err && err.stack ? err.stack : err);
    enviarHtml(res, 503, paginaAviso(tienda, 'Catálogo no disponible',
      'No pudimos cargar los precios en este momento. Intenta de nuevo en unos minutos. (Referencia ' + id + ')',
      rutaCss, rutaInicio));
  }

  async function catalogo(req, res) {
    try {
      enviarHtml(res, 200, paginaCatalogo(tienda, combinar(await fuente.obtenerPrecios())));
    } catch (err) {
      falla(res, err, req, 'css/estilos.css', 'index.html');
    }
  }

  app.get(['/', '/index.html'], catalogo);

  app.get('/productos/:archivo', async (req, res) => {
    const m = /^([a-z0-9-]+)\.html$/.exec(req.params.archivo);
    const base = CATALOGO.find((p) => m && p.slug === m[1]);
    const noEncontrado = () => enviarHtml(res, 404, paginaAviso(tienda, 'Producto no encontrado',
      'El producto que buscas no existe en nuestro catálogo.', '../css/estilos.css', '../index.html'));
    if (!base) return noEncontrado();
    try {
      const precios = await fuente.obtenerPrecios();
      if (!precios.has(base.sku)) return noEncontrado();
      enviarHtml(res, 200, paginaDetalle(tienda, { ...base, ...precios.get(base.sku) }));
    } catch (err) {
      falla(res, err, req, '../css/estilos.css', '../index.html');
    }
  });

  app.get('/health', (req, res) => {
    res.set('Cache-Control', 'no-store').json({ ok: true, tienda: tienda.slug });
  });

  app.use(express.static(PUBLIC_DIR));

  app.use((req, res) => {
    enviarHtml(res, 404, paginaAviso(tienda, 'Página no encontrada',
      'La página que buscas no existe.', '/css/estilos.css', '/index.html'));
  });

  return app;
}

module.exports = { crearApp, combinar };
