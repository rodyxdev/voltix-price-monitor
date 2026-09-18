/**
 * Rutas de la API del dashboard.
 *
 *   GET  /api/productos                     vista comparativa (datos vivos)
 *   GET  /api/monitoreo                     estado del botón / última corrida
 *   POST /api/monitoreo                     dispara el workflow (con cooldown)
 *   GET  /api/reportes/comparativa.xlsx     Excel generado al vuelo
 *   GET  /api/reportes/comparativa.pdf      PDF generado al vuelo
 */
'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/errores');
const { escribirExcel, escribirPdf, nombreArchivo } = require('../lib/reportes');

const TIPOS = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf'
};

function crearRutasApi({ fuenteDatos, monitoreo }) {
  const router = express.Router();

  router.get('/productos', asyncHandler(async (req, res) => {
    res.json(await fuenteDatos.obtenerVista());
  }));

  router.get('/monitoreo', asyncHandler(async (req, res) => {
    res.json(await monitoreo.estado());
  }));

  router.post('/monitoreo', asyncHandler(async (req, res) => {
    res.status(202).json(await monitoreo.ejecutar());
  }));

  function reporte(extension, escribir) {
    return asyncHandler(async (req, res) => {
      // Los datos se leen ANTES de enviar cabeceras: si Supabase falla, el
      // cliente recibe el 500 genérico en lugar de un archivo corrupto.
      const vista = await fuenteDatos.obtenerVista();
      res.status(200);
      res.setHeader('Content-Type', TIPOS[extension]);
      res.setHeader('Content-Disposition', 'attachment; filename="' + nombreArchivo(extension) + '"');
      await escribir(vista, res);
    });
  }

  router.get('/reportes/comparativa.xlsx', reporte('xlsx', escribirExcel));
  router.get('/reportes/comparativa.pdf', reporte('pdf', escribirPdf));

  return router;
}

module.exports = { crearRutasApi };
