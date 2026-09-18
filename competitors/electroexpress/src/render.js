/**
 * HTML de la tienda. Reproduce EXACTAMENTE el marcado de los sitios estáticos
 * de la Fase 1 (mismas clases, atributos e indentación): el scraper depende de
 * .product-card, .product-name, .product-price, .product-stock y data-sku.
 * La prueba de snapshot (test/app.test.js) lo garantiza byte a byte.
 */
'use strict';

function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 1299 -> "$ 1,299.00" (mismo formato que "{:,.2f}" de la Fase 1). */
function dinero(valor) {
  return '$ ' + Number(valor).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "Pocas piezas" -> "pocas-piezas" */
function slugStock(texto) {
  return String(texto).toLowerCase().replace(/ /g, '-');
}

/** producto: entrada del catálogo + { precio, stock } vigentes. */
function tarjeta(tienda, producto, enDetalle) {
  const href = 'productos/' + producto.slug + '.html';
  const tag = enDetalle ? 'div' : 'li';
  const clase = enDetalle ? 'product-detail' : 'product-card';
  const nombre = enDetalle
    ? '<h1 class="product-name">' + escapar(producto.nombre) + '</h1>'
    : '<h3 class="product-name"><a href="' + href + '">' + escapar(producto.nombre) + '</a></h3>';
  const extra = enDetalle
    ? '\n      <p class="product-description">' + escapar(producto.descripcion) + '</p>' +
      '\n      <button class="buy-button" type="button">Agregar al carrito</button>'
    : '\n      <a class="product-link" href="' + href + '">Ver detalle</a>';

  return (
    '    <' + tag + ' class="' + clase + '" data-sku="' + escapar(producto.sku) + '">\n' +
    '      <span class="product-category">' + escapar(producto.categoria) + '</span>\n' +
    '      ' + nombre + '\n' +
    '      <p class="product-price" data-currency="' + tienda.moneda + '">' + dinero(producto.precio) + '</p>\n' +
    '      <p class="product-stock" data-stock="' + escapar(slugStock(producto.stock)) + '">' + escapar(producto.stock) + '</p>\n' +
    '      <span class="product-sku">SKU: ' + escapar(producto.sku) + '</span>' + extra + '\n' +
    '    </' + tag + '>'
  );
}

function pagina(tienda, titulo, cuerpo, rutaCss, rutaInicio) {
  return '<!DOCTYPE html>\n' +
    '<html lang="es">\n' +
    '<head>\n' +
    '  <meta charset="utf-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '  <title>' + escapar(titulo) + '</title>\n' +
    '  <meta name="description" content="' + tienda.nombre + ' - tienda ficticia de gadgets usada como entorno de pruebas del monitor de precios Voltix.">\n' +
    '  <link rel="stylesheet" href="' + rutaCss + '">\n' +
    '</head>\n' +
    '<body>\n' +
    '  <header class="site-header">\n' +
    '    <a href="' + rutaInicio + '">\n' +
    '      <p class="brand">' + tienda.nombre + '</p>\n' +
    '    </a>\n' +
    '    <p class="tagline">' + tienda.tagline + '</p>\n' +
    '    <span class="claim">' + tienda.claim + '</span>\n' +
    '  </header>\n' +
    '  <main>\n' +
    cuerpo + '\n' +
    '  </main>\n' +
    '  <footer class="site-footer">\n' +
    '    <p>' + tienda.footer + '</p>\n' +
    '  </footer>\n' +
    '</body>\n' +
    '</html>\n';
}

function paginaCatalogo(tienda, productos) {
  const cuerpo =
    '    <h2>Catálogo de gadgets</h2>\n' +
    '    <p class="section-note">' + productos.length + ' productos disponibles. Precios en ' + tienda.moneda + ' con IVA incluido.</p>\n' +
    '    <ul class="product-grid">\n' +
    productos.map((p) => tarjeta(tienda, p, false)).join('\n') + '\n' +
    '    </ul>';
  return pagina(tienda, tienda.nombre + ' | Catálogo de gadgets', cuerpo, 'css/estilos.css', 'index.html');
}

function paginaDetalle(tienda, producto) {
  const cuerpo =
    '    <p class="breadcrumb"><a href="../index.html">Catálogo</a> / ' + escapar(producto.categoria) + '</p>\n' +
    tarjeta(tienda, producto, true);
  return pagina(tienda, producto.nombre + ' | ' + tienda.nombre, cuerpo, '../css/estilos.css', '../index.html');
}

/** Página de error sin detalle interno (el detalle queda en el log). */
function paginaAviso(tienda, titulo, mensaje, rutaCss, rutaInicio) {
  const cuerpo =
    '    <h2>' + escapar(titulo) + '</h2>\n' +
    '    <p class="section-note">' + escapar(mensaje) + '</p>';
  return pagina(tienda, titulo + ' | ' + tienda.nombre, cuerpo, rutaCss, rutaInicio);
}

module.exports = { paginaCatalogo, paginaDetalle, paginaAviso, dinero, slugStock };
