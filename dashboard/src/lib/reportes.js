/**
 * Reportes Excel y PDF generados al vuelo y escritos directo a la respuesta.
 *
 * Nada toca el disco: en Vercel el filesystem es de solo lectura (salvo /tmp,
 * que no persiste entre invocaciones). ExcelJS usa su WorkbookWriter en modo
 * streaming y PDFKit se conecta con pipe() a la respuesta.
 */
'use strict';

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const ZONA = 'America/Mexico_City';

const TEXTO_TENDENCIA = { baja: 'Bajó', alza: 'Subió', igual: 'Igual', sin_historial: '—' };
const FLECHA_TENDENCIA = { baja: '▼', alza: '▲', igual: '=', sin_historial: '—' };

function fechaLegible(iso) {
  if (!iso) return 'sin lecturas';
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: ZONA, dateStyle: 'long', timeStyle: 'short'
  });
}

function moneda(valor) {
  if (valor === null || valor === undefined) return '—';
  return '$' + Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function textoPosicion(p) {
  if (p.clave === 'perdemos') return p.texto + ' ' + moneda(p.diferencia);
  if (p.clave === 'ganamos') return p.texto + ' (por ' + moneda(p.diferencia) + ')';
  return p.texto;
}

/** Nombre de archivo con la fecha local: voltix-comparativa-2026-09-17.xlsx */
function nombreArchivo(extension, ahora) {
  const fecha = (ahora || new Date()).toLocaleDateString('en-CA', { timeZone: ZONA });
  return 'voltix-comparativa-' + fecha + '.' + extension;
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

async function escribirExcel(vista, salida) {
  const libro = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: salida, useStyles: true });
  libro.creator = 'Voltix';
  libro.created = new Date();

  const hoja = libro.addWorksheet('Comparativa', { views: [{ state: 'frozen', ySplit: 4 }] });
  const columnas = [
    ['SKU', 10], ['Producto', 36], ['Categoría', 14], ['Precio Voltix', 14]
  ];
  for (const t of vista.tiendas) {
    columnas.push([t.nombre, 15], ['Cambio', 9], ['Stock ' + t.nombre, 18]);
  }
  columnas.push(['Más barato', 24], ['Posición Voltix', 34]);
  hoja.columns = columnas.map(([, ancho]) => ({ width: ancho }));

  const titulo = hoja.addRow(['Voltix — Comparativa de precios de competencia']);
  titulo.font = { bold: true, size: 14 };
  titulo.commit();
  hoja.addRow(['Último monitoreo: ' + fechaLegible(vista.ultimoMonitoreo)]).commit();
  hoja.addRow([]).commit();

  const encabezado = hoja.addRow(columnas.map(([nombre]) => nombre));
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.eachCell((celda) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D28D9' } };
  });
  encabezado.commit();

  const FORMATO_MONEDA = '"$"#,##0.00';
  for (const p of vista.productos) {
    const valores = [p.sku, p.nombre, p.categoria, p.precioVoltix];
    for (const t of vista.tiendas) {
      const c = p.competidores[t.slug];
      valores.push(c ? c.precio : null, c ? FLECHA_TENDENCIA[c.tendencia] : '—', c ? c.stock : 'Sin lectura');
    }
    valores.push(p.masBarato.nombre + ' (' + moneda(p.masBarato.precio) + ')', textoPosicion(p.posicion));

    const fila = hoja.addRow(valores);
    fila.getCell(4).numFmt = FORMATO_MONEDA;
    vista.tiendas.forEach((t, i) => {
      fila.getCell(5 + i * 3).numFmt = FORMATO_MONEDA;
      const c = p.competidores[t.slug];
      if (c && (c.tendencia === 'baja' || c.tendencia === 'alza')) {
        fila.getCell(6 + i * 3).font = { bold: true, color: { argb: c.tendencia === 'baja' ? 'FF15803D' : 'FFB91C1C' } };
      }
    });
    fila.commit();
  }

  hoja.commit();
  await libro.commit();
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

function escribirPdf(vista, salida) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      layout: 'landscape',
      margin: 36,
      info: { Title: 'Voltix - Comparativa de precios', Author: 'Voltix' }
    });
    doc.on('error', reject);
    salida.on('error', reject);
    salida.on('finish', resolve);
    doc.pipe(salida);

    // Las fuentes estándar de PDF (Helvetica) no traen ▲▼: se usa texto.
    const columnas = [
      { titulo: 'Producto', ancho: 174 },
      { titulo: 'Voltix', ancho: 62, derecha: true }
    ];
    for (const t of vista.tiendas) {
      columnas.push({ titulo: t.nombre, ancho: 78, derecha: true }, { titulo: 'Cambio', ancho: 44 });
    }
    columnas.push({ titulo: 'Más barato', ancho: 110 }, { titulo: 'Posición Voltix', ancho: 128 });

    const x0 = doc.page.margins.left;
    const anchoTotal = columnas.reduce((s, c) => s + c.ancho, 0);

    doc.font('Helvetica-Bold').fontSize(18).fillColor('#4c1d95')
      .text('Voltix — Comparativa de precios de competencia', x0, 36);
    doc.font('Helvetica').fontSize(10).fillColor('#475569')
      .text('Último monitoreo: ' + fechaLegible(vista.ultimoMonitoreo) +
        '   ·   Generado: ' + fechaLegible(new Date().toISOString()));

    const r = vista.resumen;
    doc.moveDown(0.6).fillColor('#10151f').fontSize(10).text(
      r.productos + ' productos monitoreados   ·   ' + r.conBajas + ' con bajas de precio   ·   ' +
      r.conAlzas + ' con alzas   ·   Voltix no es el más barato en ' + r.noSomosMasBaratos
    );

    let y = doc.y + 14;

    function fila(celdas, opciones) {
      const alto = 30;
      if (opciones.fondo) doc.rect(x0, y, anchoTotal, alto).fill(opciones.fondo);
      let x = x0;
      celdas.forEach((texto, i) => {
        const col = columnas[i];
        const color = (opciones.colores && opciones.colores[i]) || opciones.color || '#10151f';
        doc.font(opciones.negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(opciones.tamano || 8.5)
          .fillColor(color)
          .text(String(texto), x + 4, y + 6, {
            width: col.ancho - 8, height: alto - 8, align: col.derecha ? 'right' : 'left', ellipsis: true
          });
        x += col.ancho;
      });
      y += alto;
    }

    fila(columnas.map((c) => c.titulo), { negrita: true, color: '#ffffff', fondo: '#6d28d9', tamano: 9 });

    vista.productos.forEach((p, indice) => {
      const celdas = [p.nombre + '\n' + p.sku + ' · ' + p.categoria, moneda(p.precioVoltix)];
      const colores = [];
      for (const t of vista.tiendas) {
        const c = p.competidores[t.slug];
        celdas.push(c ? moneda(c.precio) : 'Sin lectura', c ? TEXTO_TENDENCIA[c.tendencia] : '—');
        colores[celdas.length - 1] = c && c.tendencia === 'baja' ? '#15803d'
          : c && c.tendencia === 'alza' ? '#b91c1c' : '#64748b';
      }
      celdas.push(p.masBarato.nombre + '\n' + moneda(p.masBarato.precio), textoPosicion(p.posicion));
      colores[celdas.length - 1] = p.posicion.clave === 'perdemos' ? '#b91c1c'
        : p.posicion.clave === 'ganamos' ? '#15803d' : '#475569';

      fila(celdas, { fondo: indice % 2 ? '#f5f3ff' : null, colores });
    });

    doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(
      'Cambio: comparación contra el snapshot anterior de cada tienda. ' +
      'GigaBazar y ElectroExpress son tiendas ficticias creadas para la demo de Voltix.',
      x0, y + 12, { width: anchoTotal }
    );

    doc.end();
  });
}

module.exports = { escribirExcel, escribirPdf, nombreArchivo };
