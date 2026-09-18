/**
 * Manejo de errores uniforme (mismo patrón que Café Altiplano).
 *
 * Regla: al cliente nunca le llega el detalle interno. Un fallo de Postgres,
 * de PostgREST, de la API de GitHub o un stack trace se registran completos
 * en el log del servidor y al navegador solo le llega un mensaje genérico con
 * un identificador para cruzarlo con el log.
 */
'use strict';

const crypto = require('crypto');

/** Error con código HTTP y mensaje pensado para mostrarse al usuario. */
class ErrorHttp extends Error {
  constructor(estado, mensaje, extra, cabeceras) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.estado = estado;
    this.extra = extra || null;
    this.cabeceras = cabeceras || null;
    this.esPublico = true;
  }
}

/** Envuelve un handler async para que sus rechazos lleguen al middleware (Express 4). */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** 404 para rutas de API que no existen. */
function noEncontrado(req, res, next) {
  next(new ErrorHttp(404, 'Recurso no encontrado.'));
}

/** Middleware final de errores. Debe registrarse al último. */
function manejadorErrores(err, req, res, _next) {
  const id = crypto.randomBytes(6).toString('hex');

  // Un reporte que falla a media descarga ya envió cabeceras: no se puede
  // responder JSON. Se registra y se corta la conexión para que el navegador
  // marque la descarga como fallida en vez de guardar un archivo truncado.
  if (res.headersSent) {
    console.error('[error ' + id + '] ' + req.method + ' ' + req.originalUrl + ' (respuesta en curso)\n',
      err && err.stack ? err.stack : err);
    res.destroy();
    return;
  }

  if (err && err.esPublico) {
    if (err.cabeceras) res.set(err.cabeceras);
    const cuerpo = { error: err.message };
    if (err.extra) Object.assign(cuerpo, err.extra);
    return res.status(err.estado).json(cuerpo);
  }

  // Errores de express.json(): son culpa de la petición, no del servidor.
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El cuerpo de la petición es demasiado grande.' });
  }

  console.error('[error ' + id + '] ' + req.method + ' ' + req.originalUrl + '\n',
    err && err.stack ? err.stack : err);
  return res.status(500).json({
    error: 'Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.',
    referencia: id
  });
}

/**
 * Traduce un error de supabase-js a un fallo interno, dejando el detalle en
 * el log. Se usa en cada punto donde hablamos con la base.
 */
function fallaSupabase(contexto, error) {
  const e = new Error(
    'Supabase falló en ' + contexto + ': ' +
    (error && error.message ? error.message : 'sin mensaje') +
    (error && error.code ? ' (code ' + error.code + ')' : '') +
    (error && error.details ? ' - ' + error.details : '')
  );
  e.causa = error;
  return e;
}

module.exports = { ErrorHttp, asyncHandler, noEncontrado, manejadorErrores, fallaSupabase };
