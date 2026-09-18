/**
 * Punto de entrada en Vercel (mismo patrón que Café Altiplano): Vercel acepta
 * una app de Express como handler, así que basta con exportarla. La app se
 * construye una vez por instancia; las invocaciones en caliente la reutilizan.
 */
'use strict';

module.exports = require('../server');
