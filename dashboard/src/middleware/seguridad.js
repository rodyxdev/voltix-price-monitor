/**
 * Cabeceras de seguridad, escritas a mano en vez de usar helmet.
 *
 * Son pocas y conviene saber exactamente qué manda el servidor; helmet traería
 * una dependencia y valores por defecto que aquí no aplican.
 */
'use strict';

// Todo el JS y el CSS del dashboard es propio y se sirve del mismo origen, así
// que la política puede ser estricta. No hay scripts ni estilos en línea.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src 'self'",
  "object-src 'none'"
].join('; ');

function cabecerasSeguridad(req, res, next) {
  // El navegador respeta el Content-Type declarado y no adivina.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Nadie puede meter el dashboard en un iframe (clickjacking).
  res.setHeader('X-Frame-Options', 'DENY');
  // No filtrar la URL completa hacia otros orígenes.
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  res.setHeader('Content-Security-Policy', CSP);
  // Segunda capa: app.disable('x-powered-by') ya lo evita en crearApp().
  res.removeHeader('X-Powered-By');
  next();
}

/** Las respuestas de la API nunca deben cachearse. */
function sinCache(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  next();
}

module.exports = { cabecerasSeguridad, sinCache, CSP };
