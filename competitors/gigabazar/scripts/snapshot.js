/**
 * Regenera index.html (snapshot del catálogo con los precios base).
 *
 *   npm run snapshot
 *
 * index.html no se publica (Vercel solo sirve public/): existe porque las
 * pruebas del scraper parsean este archivo sin red. test/app.test.js
 * comprueba que el render actual lo reproduce byte a byte.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const tienda = require('../src/tienda');
const { combinar } = require('../src/app');
const { paginaCatalogo } = require('../src/render');

const precios = new Map(Object.entries(tienda.preciosBase));
const destino = path.join(__dirname, '..', 'index.html');
fs.writeFileSync(destino, paginaCatalogo(tienda, combinar(precios)), 'utf8');
console.log('Escrito ' + destino);
