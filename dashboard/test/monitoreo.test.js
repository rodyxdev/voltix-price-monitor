'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { crearServicioMonitoreo } = require('../src/lib/monitoreo');
const { crearClienteGithub } = require('../src/lib/github');
const { cargarConfig } = require('../src/config');
const { capturarLog } = require('./helpers');

const AHORA = new Date('2026-09-17T12:00:00Z');
const hace = (seg) => new Date(AHORA.getTime() - seg * 1000);

function servicio({ ultimoDisparo = null, corrida = null, reserva, githubFalla, configurado = true } = {}) {
  const llamadas = { disparos: 0 };
  const svc = crearServicioMonitoreo({
    cooldownMinutos: 10,
    ahora: () => AHORA,
    datos: {
      ultimoDisparo: async () => ultimoDisparo,
      reservarDisparo: async () => reserva
    },
    github: {
      configurado,
      ultimaCorrida: async () => {
        if (githubFalla) throw new Error('HTTP 500');
        return corrida;
      },
      disparar: async () => {
        llamadas.disparos += 1;
        if (githubFalla) throw new Error('HTTP 401 Bad credentials ghp_xxx');
      }
    }
  });
  return { svc, llamadas };
}

test('estado: sin token de GitHub el botón no está disponible', async () => {
  const { svc } = servicio({ configurado: false });
  assert.deepEqual(await svc.estado(), {
    disponible: false, estado: 'no_configurado', cooldownSegundos: 0, ultimaCorrida: null
  });
});

test('estado: corrida activa en GitHub = en_progreso', async () => {
  const { svc } = servicio({
    ultimoDisparo: hace(120),
    corrida: { estado: 'in_progress', creada: hace(110).toISOString() }
  });
  const e = await svc.estado();
  assert.equal(e.estado, 'en_progreso');
  assert.equal(e.cooldownSegundos, 480);
});

test('estado: recién disparado y GitHub aún no crea la corrida = en_cola', async () => {
  const { svc } = servicio({
    ultimoDisparo: hace(5),
    corrida: { estado: 'completed', conclusion: 'success', creada: hace(6 * 3600).toISOString() }
  });
  assert.equal((await svc.estado()).estado, 'en_cola');
});

test('estado: corrida posterior al disparo ya terminó = inactivo', async () => {
  const { svc } = servicio({
    ultimoDisparo: hace(90),
    corrida: { estado: 'completed', conclusion: 'success', creada: hace(85).toISOString() }
  });
  const e = await svc.estado();
  assert.equal(e.estado, 'inactivo');
  assert.equal(e.cooldownSegundos, 510);
});

test('estado: si GitHub falla el dashboard sigue respondiendo', async () => {
  const { svc } = servicio({ githubFalla: true });
  let e;
  await capturarLog(async () => { e = await svc.estado(); });
  assert.equal(e.disponible, true);
  assert.equal(e.ultimaCorrida, null);
});

test('ejecutar: dispara cuando el cooldown lo permite', async () => {
  const { svc, llamadas } = servicio({ reserva: { permitido: true, ultimoDisparo: AHORA, segundosRestantes: 0 } });
  const r = await svc.ejecutar();
  assert.equal(r.estado, 'en_cola');
  assert.equal(llamadas.disparos, 1);
});

test('ejecutar: en cooldown responde 429 y no llama a GitHub', async () => {
  const { svc, llamadas } = servicio({ reserva: { permitido: false, ultimoDisparo: hace(60), segundosRestantes: 540 } });
  await assert.rejects(svc.ejecutar(), (e) => {
    assert.equal(e.estado, 429);
    assert.equal(e.extra.cooldownSegundos, 540);
    assert.equal(e.cabeceras['Retry-After'], '540');
    assert.match(e.message, /9 minutos/);
    return true;
  });
  assert.equal(llamadas.disparos, 0);
});

test('ejecutar: fallo de GitHub es 502 genérico (el detalle solo va al log)', async () => {
  const { svc } = servicio({ githubFalla: true, reserva: { permitido: true, ultimoDisparo: AHORA, segundosRestantes: 0 } });
  const log = await capturarLog(async () => {
    await assert.rejects(svc.ejecutar(), (e) => {
      assert.equal(e.estado, 502);
      assert.ok(!e.message.includes('Bad credentials'));
      return true;
    });
  });
  assert.ok(log.includes('Bad credentials'));
});

test('cliente GitHub: dispatch con el ref configurado y lectura de la última corrida', async () => {
  const peticiones = [];
  const fetchFalso = async (url, opciones) => {
    peticiones.push({ url, opciones });
    if (url.endsWith('/dispatches')) return new Response(null, { status: 204 });
    return Response.json({
      workflow_runs: [{ status: 'queued', conclusion: null, event: 'workflow_dispatch', created_at: 'c', updated_at: 'u', html_url: 'h' }]
    });
  };
  const gh = crearClienteGithub({ token: 't0k', repo: 'rodyxdev/voltix-price-monitor', workflow: 'monitoreo.yml', ref: 'main' }, fetchFalso);

  await gh.disparar();
  const corrida = await gh.ultimaCorrida();
  await gh.ultimaCorrida(); // segunda llamada sale del caché

  assert.equal(peticiones.length, 2);
  assert.equal(peticiones[0].url, 'https://api.github.com/repos/rodyxdev/voltix-price-monitor/actions/workflows/monitoreo.yml/dispatches');
  assert.equal(peticiones[0].opciones.method, 'POST');
  assert.deepEqual(JSON.parse(peticiones[0].opciones.body), { ref: 'main' });
  assert.equal(peticiones[0].opciones.headers.Authorization, 'Bearer t0k');
  assert.deepEqual(corrida, { estado: 'queued', conclusion: null, evento: 'workflow_dispatch', creada: 'c', actualizada: 'u', url: 'h' });
});

test('config: el dashboard se niega a arrancar con la service role', () => {
  const base = { SUPABASE_URL: 'https://x.supabase.co' };
  assert.throws(() => cargarConfig({ ...base, SUPABASE_ANON_KEY: 'sb_secret_abc' }), /service_role/);
  // JWT legacy con {"role":"service_role"}
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from('{"role":"service_role"}').toString('base64url') + '.firma';
  assert.throws(() => cargarConfig({ ...base, SUPABASE_ANON_KEY: jwt }), /service_role/);
  assert.throws(() => cargarConfig({}), /SUPABASE_URL, SUPABASE_ANON_KEY/);

  const ok = cargarConfig({ ...base, SUPABASE_ANON_KEY: 'sb_publishable_abc', VOLTIX_COOLDOWN_MINUTOS: '0' });
  assert.equal(ok.cooldownMinutos, 1);
  assert.equal(ok.github.token, '');
  assert.equal(ok.github.workflow, 'monitoreo.yml');
});
