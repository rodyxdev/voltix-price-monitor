/**
 * Voltix dashboard - frontend.
 *
 * Lee la vista comparativa de GET /api/productos (datos vivos de Supabase) y
 * maneja el botón "Ejecutar monitoreo ahora" contra /api/monitoreo. Toda la
 * lógica de tendencias y posición viene calculada del servidor; aquí solo se
 * pinta.
 */
(function () {
  'use strict';

  var TENDENCIA = {
    baja: { simbolo: '▼', texto: 'bajó' },
    alza: { simbolo: '▲', texto: 'subió' },
    igual: { simbolo: '=', texto: 'sin cambio' },
    sin_historial: { simbolo: '—', texto: 'sin lectura anterior' }
  };
  var CLASE_POSICION = { ganamos: 'badge--ok', empate: 'badge--neutro', perdemos: 'badge--alerta', sin_datos: 'badge--neutro' };
  var SONDEO_ACTIVO_MS = 8000;
  var SONDEO_INACTIVO_MS = 60000;

  var estadoPrevio = null;
  var temporizadorSondeo = null;
  // Cada consulta de estado lleva un número. Al disparar un monitoreo se
  // incrementa, así se descarta una respuesta de GET /api/monitoreo que salió
  // antes del POST y llega después (volvería a pintar el botón habilitado).
  var versionEstado = 0;
  var disparando = false;
  var temporizadorCuenta = null;

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------

  function $(id) { return document.getElementById(id); }

  function moneda(valor) {
    return Number(valor).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
  }

  function fecha(iso) {
    if (!iso) return 'sin lecturas';
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function hace(iso) {
    var minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutos < 1) return 'hace un momento';
    if (minutos < 60) return 'hace ' + minutos + ' min';
    var horas = Math.round(minutos / 60);
    if (horas < 24) return 'hace ' + horas + ' h';
    return fecha(iso);
  }

  function mmss(segundos) {
    var m = Math.floor(segundos / 60);
    var s = segundos % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function elemento(tag, clase, texto) {
    var el = document.createElement(tag);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function pedirJson(url, opciones) {
    return fetch(url, opciones).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (cuerpo) {
        if (!r.ok) {
          var error = new Error(cuerpo.error || 'Error ' + r.status);
          error.estado = r.status;
          error.cuerpo = cuerpo;
          throw error;
        }
        return cuerpo;
      });
    });
  }

  // ---------------------------------------------------------------------
  // Tabla y KPIs
  // ---------------------------------------------------------------------

  function celdaCompetidor(lectura, precioVoltix, nombreTienda) {
    var td = elemento('td', 'num');
    td.setAttribute('data-label', nombreTienda);

    if (!lectura) {
      td.appendChild(elemento('span', 'stock', 'Sin lectura'));
      return td;
    }

    var precio = elemento('span', 'precio', moneda(lectura.precio));
    if (lectura.precio < precioVoltix) precio.classList.add('precio--menor');

    var info = TENDENCIA[lectura.tendencia] || TENDENCIA.sin_historial;
    var tendencia = elemento('span', 'tendencia tendencia--' + lectura.tendencia, info.simbolo);
    tendencia.title = lectura.precioAnterior === null
      ? info.texto
      : 'Antes ' + moneda(lectura.precioAnterior) + ' (' + info.texto + ')';

    td.appendChild(precio);
    td.appendChild(tendencia);
    td.appendChild(elemento('span', 'stock', lectura.stock));
    return td;
  }

  function fila(producto, tiendas) {
    var tr = document.createElement('tr');

    var th = elemento('th', 'producto');
    th.scope = 'row';
    th.appendChild(elemento('span', 'producto__nombre', producto.nombre));
    th.appendChild(elemento('span', 'producto__sku', 'SKU ' + producto.sku));
    tr.appendChild(th);

    var categoria = elemento('td', 'categoria', producto.categoria);
    categoria.setAttribute('data-label', 'Categoría');
    tr.appendChild(categoria);

    var voltix = elemento('td', 'num');
    voltix.setAttribute('data-label', 'Voltix');
    voltix.appendChild(elemento('span', 'precio precio--propio', moneda(producto.precioVoltix)));
    tr.appendChild(voltix);

    tiendas.forEach(function (t) {
      tr.appendChild(celdaCompetidor(producto.competidores[t.slug], producto.precioVoltix, t.nombre));
    });

    var pos = producto.posicion;
    var texto = pos.clave === 'perdemos' ? pos.texto + ' ' + moneda(pos.diferencia) : pos.texto;
    var tdPos = elemento('td');
    tdPos.setAttribute('data-label', 'Posición');
    tdPos.appendChild(elemento('span', 'badge ' + (CLASE_POSICION[pos.clave] || 'badge--neutro'), texto));
    tr.appendChild(tdPos);

    return tr;
  }

  function mensajeTabla(texto) {
    var tbody = $('tabla-body');
    tbody.innerHTML = '';
    var tr = document.createElement('tr');
    var td = elemento('td', 'vacio', texto);
    td.colSpan = 6;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function renderVista(vista) {
    var tbody = $('tabla-body');
    tbody.innerHTML = '';
    if (!vista.productos.length) {
      mensajeTabla('Todavía no hay productos en el catálogo.');
    }
    vista.productos.forEach(function (p) { tbody.appendChild(fila(p, vista.tiendas)); });

    $('ultimo-monitoreo').textContent = fecha(vista.ultimoMonitoreo);
    $('kpi-productos').textContent = vista.resumen.productos;
    $('kpi-bajas').textContent = vista.resumen.conBajas;
    $('kpi-alzas').textContent = vista.resumen.conAlzas;
    $('kpi-mas-barato').textContent = vista.resumen.noSomosMasBaratos;
  }

  function cargarProductos() {
    return pedirJson('/api/productos')
      .then(renderVista)
      .catch(function () {
        mensajeTabla('No se pudieron cargar los precios. Intenta recargar la página en un momento.');
      });
  }

  // ---------------------------------------------------------------------
  // Botón "Ejecutar monitoreo ahora"
  // ---------------------------------------------------------------------

  function pintarBoton(texto, habilitado, ocupado) {
    var boton = $('btn-monitoreo');
    boton.disabled = !habilitado;
    boton.classList.toggle('btn--ocupado', Boolean(ocupado));
    boton.setAttribute('aria-busy', ocupado ? 'true' : 'false');
    $('btn-monitoreo-texto').textContent = texto;
  }

  function pintarUltimaCorrida(corrida) {
    var p = $('ultima-corrida');
    if (!corrida) { p.hidden = true; return; }
    var resultado = corrida.estado !== 'completed' ? 'en curso'
      : corrida.conclusion === 'success' ? 'completada' : 'con error';
    var origen = corrida.evento === 'schedule' ? 'automática' : 'manual';
    p.textContent = '';
    p.appendChild(document.createTextNode('Última corrida ' + origen + ' ' + resultado + ', ' + hace(corrida.creada) + ' · '));
    var enlace = elemento('a', null, 'ver en GitHub');
    enlace.href = corrida.url;
    enlace.target = '_blank';
    enlace.rel = 'noopener noreferrer';
    p.appendChild(enlace);
    p.hidden = false;
  }

  function iniciarCuentaRegresiva(segundos) {
    window.clearInterval(temporizadorCuenta);
    var restantes = segundos;
    pintarBoton('Disponible en ' + mmss(restantes), false, false);
    temporizadorCuenta = window.setInterval(function () {
      restantes -= 1;
      if (restantes <= 0) {
        window.clearInterval(temporizadorCuenta);
        pintarBoton('Ejecutar monitoreo ahora', true, false);
        return;
      }
      pintarBoton('Disponible en ' + mmss(restantes), false, false);
    }, 1000);
  }

  function aplicarEstado(estado) {
    var nota = $('estado-monitoreo');
    window.clearInterval(temporizadorCuenta);
    pintarUltimaCorrida(estado.ultimaCorrida);

    var activo = estado.estado === 'en_progreso' || estado.estado === 'en_cola';

    if (!estado.disponible) {
      pintarBoton('Ejecutar monitoreo ahora', false, false);
      nota.textContent = 'El monitoreo manual no está disponible por ahora. El automático corre cada 6 horas.';
    } else if (activo) {
      pintarBoton(estado.estado === 'en_cola' ? 'Monitoreo en cola…' : 'Monitoreo en progreso…', false, true);
      nota.textContent = 'Revisando precios en GigaBazar y ElectroExpress. La tabla se actualiza sola al terminar.';
    } else if (estado.cooldownSegundos > 0) {
      iniciarCuentaRegresiva(estado.cooldownSegundos);
      nota.textContent = 'Para no saturar a las tiendas, el monitoreo manual se puede ejecutar una vez cada pocos minutos.';
    } else {
      pintarBoton('Ejecutar monitoreo ahora', true, false);
      nota.textContent = 'El monitoreo automático corre cada 6 horas.';
    }

    // Al terminar una corrida se recargan los precios.
    if (estadoPrevio && (estadoPrevio === 'en_progreso' || estadoPrevio === 'en_cola') && !activo) {
      cargarProductos();
    }
    estadoPrevio = estado.estado;

    programarSondeo(activo ? SONDEO_ACTIVO_MS : SONDEO_INACTIVO_MS);
  }

  function programarSondeo(ms) {
    window.clearTimeout(temporizadorSondeo);
    temporizadorSondeo = window.setTimeout(consultarEstado, ms);
  }

  function consultarEstado(forzar) {
    // Pestaña en segundo plano: el sondeo no gasta peticiones y se retoma al
    // volver. La primera consulta (forzar) se hace siempre, para no dejar la
    // página en "Consultando…" si se abrió en una pestaña de fondo.
    if (document.hidden && forzar !== true) { programarSondeo(SONDEO_ACTIVO_MS); return; }
    // Durante el POST el estado lo pinta ejecutarMonitoreo() con su respuesta.
    if (disparando) return;
    var version = versionEstado;
    pedirJson('/api/monitoreo')
      .then(function (estado) {
        if (version === versionEstado) aplicarEstado(estado);
      })
      .catch(function () {
        $('estado-monitoreo').textContent = 'No se pudo consultar el estado del monitoreo.';
        programarSondeo(SONDEO_INACTIVO_MS);
      });
  }

  function ejecutarMonitoreo() {
    if (disparando) return;
    disparando = true;
    versionEstado += 1;
    window.clearTimeout(temporizadorSondeo);
    pintarBoton('Iniciando…', false, true);
    pedirJson('/api/monitoreo', { method: 'POST' })
      .then(function (respuesta) {
        disparando = false;
        aplicarEstado({
          disponible: true,
          estado: respuesta.estado,
          cooldownSegundos: respuesta.cooldownSegundos,
          ultimaCorrida: null
        });
      })
      .catch(function (error) {
        disparando = false;
        programarSondeo(SONDEO_INACTIVO_MS);
        $('estado-monitoreo').textContent = error.message;
        if (error.estado === 429 && error.cuerpo && error.cuerpo.cooldownSegundos) {
          iniciarCuentaRegresiva(error.cuerpo.cooldownSegundos);
        } else {
          pintarBoton('Ejecutar monitoreo ahora', true, false);
        }
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('btn-monitoreo').addEventListener('click', ejecutarMonitoreo);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) consultarEstado();
    });
    cargarProductos();
    consultarEstado(true);
  });
})();
