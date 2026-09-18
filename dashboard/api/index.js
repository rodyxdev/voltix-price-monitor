/**
 * Punto de entrada en Vercel (mismo patrón que Café Altiplano): Vercel acepta
 * una app de Express como handler, así que basta con exportarla. server.js
 * arma las dependencias reales y solo llama a listen() cuando se ejecuta
 * directo (npm start), no al importarse aquí.
 */
'use strict';

module.exports = require('../server');
