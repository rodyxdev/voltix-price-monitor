/**
 * Cabeceras de seguridad (mismo criterio que el dashboard, sin helmet).
 * Las páginas no tienen scripts ni estilos en línea: la CSP puede ser estricta.
 * En Vercel, los archivos de public/ los sirve la CDN sin pasar por Express;
 * por eso vercel.json repite estas cabeceras.
 */
'use strict';

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
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  res.setHeader('Content-Security-Policy', CSP);
  res.removeHeader('X-Powered-By');
  next();
}

module.exports = { cabecerasSeguridad, CSP };
