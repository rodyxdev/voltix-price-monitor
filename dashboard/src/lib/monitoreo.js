/**
 * Lógica del botón "Ejecutar monitoreo ahora".
 *
 * ejecutar(): reserva el cooldown en Supabase (atómico, sobrevive entre
 *             invocaciones serverless) y dispara el workflow en GitHub.
 * estado():   combina el último disparo guardado con la última corrida del
 *             workflow para decirle al frontend si hay algo en curso.
 */
'use strict';

const { ErrorHttp } = require('./errores');

// Después de un dispatch, GitHub tarda unos segundos en crear la corrida. En
// esa ventana el estado se reporta como "en_cola".
const VENTANA_COLA_MS = 3 * 60 * 1000;
// Tolerancia entre el reloj de Supabase (ultimo_disparo) y el de GitHub (created_at).
const TOLERANCIA_RELOJ_MS = 30 * 1000;

const ESTADOS_ACTIVOS = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);

function crearServicioMonitoreo({ datos, github, cooldownMinutos, ahora }) {
  const reloj = ahora || (() => new Date());

  function segundosCooldown(ultimoDisparo) {
    if (!ultimoDisparo) return 0;
    const fin = ultimoDisparo.getTime() + cooldownMinutos * 60 * 1000;
    return Math.max(0, Math.ceil((fin - reloj().getTime()) / 1000));
  }

  return {
    async estado() {
      if (!github.configurado) {
        return { disponible: false, estado: 'no_configurado', cooldownSegundos: 0, ultimaCorrida: null };
      }

      const [ultimoDisparo, corrida] = await Promise.all([
        datos.ultimoDisparo(),
        // Si GitHub no responde el dashboard sigue funcionando: solo se pierde
        // el detalle de la última corrida. El error queda en el log.
        github.ultimaCorrida().catch((e) => {
          console.error('[monitoreo] no se pudo consultar la última corrida:', e.message);
          return null;
        })
      ]);

      let estado = 'inactivo';
      if (corrida && ESTADOS_ACTIVOS.has(corrida.estado)) {
        estado = 'en_progreso';
      } else if (ultimoDisparo && reloj() - ultimoDisparo < VENTANA_COLA_MS) {
        const corridaEsAnterior = !corrida ||
          new Date(corrida.creada).getTime() < ultimoDisparo.getTime() - TOLERANCIA_RELOJ_MS;
        if (corridaEsAnterior) estado = 'en_cola';
      }

      return {
        disponible: true,
        estado,
        cooldownSegundos: segundosCooldown(ultimoDisparo),
        ultimoDisparo: ultimoDisparo ? ultimoDisparo.toISOString() : null,
        ultimaCorrida: corrida
      };
    },

    async ejecutar() {
      if (!github.configurado) {
        throw new ErrorHttp(503, 'El monitoreo manual no está disponible en este momento.');
      }

      const reserva = await datos.reservarDisparo(cooldownMinutos);
      if (!reserva.permitido) {
        const minutos = Math.ceil(reserva.segundosRestantes / 60);
        throw new ErrorHttp(
          429,
          'Ya se ejecutó un monitoreo hace poco. Podrás volver a ejecutarlo en ' +
            minutos + (minutos === 1 ? ' minuto.' : ' minutos.'),
          { cooldownSegundos: reserva.segundosRestantes },
          { 'Retry-After': String(Math.max(1, reserva.segundosRestantes)) }
        );
      }

      try {
        await github.disparar();
      } catch (e) {
        // El cooldown queda consumido a propósito: liberar el turno requeriría
        // otra RPC escribible con la clave pública, y abriría la puerta a
        // saltarse el cooldown llamándola directo.
        console.error('[monitoreo] falló el workflow_dispatch:', e.message);
        throw new ErrorHttp(502, 'No se pudo iniciar el monitoreo. Inténtalo de nuevo más tarde.');
      }

      return {
        estado: 'en_cola',
        ultimoDisparo: reserva.ultimoDisparo ? reserva.ultimoDisparo.toISOString() : null,
        cooldownSegundos: cooldownMinutos * 60
      };
    }
  };
}

module.exports = { crearServicioMonitoreo };
