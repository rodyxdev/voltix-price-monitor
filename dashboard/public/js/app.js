/**
 * Voltix dashboard - render del cascarón estático (Fase 1).
 *
 * Toda la data viene de window.VOLTIX_DATOS_EJEMPLO (js/datos-ejemplo.js).
 * En la Fase 2 solo hay que cambiar `cargarDatos()` por un fetch al backend;
 * el resto del render se queda igual.
 */
(function () {
  'use strict';

  var COMPETIDORES = ['gigabazar', 'electroexpress'];
  var SIMBOLO_TENDENCIA = { baja: '▼', alza: '▲', igual: '=' };

  function cargarDatos() {
    // Fase 2: return fetch('/api/productos').then(function (r) { return r.json(); });
    return Promise.resolve(window.VOLTIX_DATOS_EJEMPLO);
  }

  function formatoMoneda(valor) {
    return valor.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    });
  }

  function celdaCompetidor(datos, precioVoltix) {
    var td = document.createElement('td');
    td.className = 'num';
    td.setAttribute('data-label', '');

    var precio = document.createElement('span');
    precio.className = 'precio';
    precio.textContent = formatoMoneda(datos.precio);
    if (datos.precio < precioVoltix) {
      precio.classList.add('precio--menor');
    }

    var tendencia = document.createElement('span');
    tendencia.className = 'tendencia tendencia--' + datos.tendencia;
    tendencia.textContent = SIMBOLO_TENDENCIA[datos.tendencia] || '=';
    tendencia.title = 'Precio ' + datos.tendencia + ' respecto al monitoreo anterior';

    var stock = document.createElement('span');
    stock.className = 'stock';
    stock.textContent = datos.stock;

    td.appendChild(precio);
    td.appendChild(tendencia);
    td.appendChild(stock);
    return td;
  }

  function posicion(producto) {
    var precios = COMPETIDORES.map(function (key) {
      return producto.competidores[key].precio;
    });
    var menorCompetencia = Math.min.apply(null, precios);
    if (producto.precioVoltix < menorCompetencia) {
      return { texto: 'Voltix es el más barato', clase: 'badge--ok' };
    }
    if (producto.precioVoltix === menorCompetencia) {
      return { texto: 'Empatados', clase: 'badge--neutro' };
    }
    return { texto: 'Nos ganan por ' + formatoMoneda(producto.precioVoltix - menorCompetencia), clase: 'badge--alerta' };
  }

  function fila(producto) {
    var tr = document.createElement('tr');

    var tdNombre = document.createElement('th');
    tdNombre.scope = 'row';
    tdNombre.className = 'producto';
    tdNombre.innerHTML =
      '<span class="producto__nombre"></span><span class="producto__sku"></span>';
    tdNombre.querySelector('.producto__nombre').textContent = producto.nombre;
    tdNombre.querySelector('.producto__sku').textContent = 'SKU ' + producto.sku;
    tr.appendChild(tdNombre);

    var tdCategoria = document.createElement('td');
    tdCategoria.className = 'categoria';
    tdCategoria.setAttribute('data-label', 'Categoría');
    tdCategoria.textContent = producto.categoria;
    tr.appendChild(tdCategoria);

    var tdVoltix = document.createElement('td');
    tdVoltix.className = 'num';
    tdVoltix.setAttribute('data-label', 'Voltix');
    tdVoltix.innerHTML = '<span class="precio precio--propio"></span>';
    tdVoltix.querySelector('.precio').textContent = formatoMoneda(producto.precioVoltix);
    tr.appendChild(tdVoltix);

    COMPETIDORES.forEach(function (key) {
      var celda = celdaCompetidor(producto.competidores[key], producto.precioVoltix);
      celda.setAttribute('data-label', key === 'gigabazar' ? 'GigaBazar' : 'ElectroExpress');
      tr.appendChild(celda);
    });

    var estado = posicion(producto);
    var tdPosicion = document.createElement('td');
    tdPosicion.setAttribute('data-label', 'Posición');
    tdPosicion.innerHTML = '<span class="badge ' + estado.clase + '"></span>';
    tdPosicion.querySelector('.badge').textContent = estado.texto;
    tr.appendChild(tdPosicion);

    return tr;
  }

  function contarTendencias(productos, tipo) {
    return productos.filter(function (p) {
      return COMPETIDORES.some(function (key) {
        return p.competidores[key].tendencia === tipo;
      });
    }).length;
  }

  function render(datos) {
    var tbody = document.getElementById('tabla-body');
    tbody.innerHTML = '';
    datos.productos.forEach(function (producto) {
      tbody.appendChild(fila(producto));
    });

    document.getElementById('ultimo-monitoreo').textContent = datos.ultimoMonitoreo;
    document.getElementById('kpi-productos').textContent = datos.productos.length;
    document.getElementById('kpi-bajas').textContent = contarTendencias(datos.productos, 'baja');
    document.getElementById('kpi-alzas').textContent = contarTendencias(datos.productos, 'alza');
    document.getElementById('kpi-mas-barato').textContent = datos.productos.filter(function (p) {
      return posicion(p).clase !== 'badge--ok';
    }).length;
  }

  function conectarBotonMonitoreo() {
    var boton = document.getElementById('btn-monitoreo');
    var estado = document.getElementById('estado-monitoreo');
    var textoOriginal = estado.textContent;

    boton.addEventListener('click', function () {
      // Fase 2: POST /api/monitoreo y refrescar la tabla con la respuesta.
      boton.disabled = true;
      estado.textContent = 'Esta acción se conecta al scraper en la Fase 2.';
      window.setTimeout(function () {
        boton.disabled = false;
        estado.textContent = textoOriginal;
      }, 2500);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    cargarDatos().then(render);
    conectarBotonMonitoreo();
  });
})();
