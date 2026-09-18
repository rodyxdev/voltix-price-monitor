/**
 * Cliente mínimo de la API de GitHub Actions para el botón "Ejecutar
 * monitoreo ahora": disparar el workflow (workflow_dispatch) y consultar su
 * última corrida.
 *
 * El token es un fine-grained PAT limitado a este repositorio con el permiso
 * "Actions: Read and write" y nada más.
 */
'use strict';

const API = 'https://api.github.com';
const CACHE_MS = 5000;

class ErrorGithub extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.name = 'ErrorGithub';
    this.estado = estado;
  }
}

function crearClienteGithub(opciones, fetchImpl) {
  const { token, repo, workflow, ref } = opciones;
  const hacerFetch = fetchImpl || globalThis.fetch;
  const base = API + '/repos/' + repo + '/actions/workflows/' + encodeURIComponent(workflow);
  // Caché corto de la última corrida: con varios visitantes sondeando el
  // estado a la vez, evita gastar el rate limit del token. En serverless es
  // por instancia, lo cual basta.
  let cache = { hasta: 0, valor: null };

  async function peticion(metodo, url, cuerpo) {
    let respuesta;
    try {
      respuesta = await hacerFetch(url, {
        method: metodo,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ' + token,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'voltix-dashboard',
          ...(cuerpo ? { 'Content-Type': 'application/json' } : {})
        },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        signal: AbortSignal.timeout(10000)
      });
    } catch (e) {
      throw new ErrorGithub(metodo + ' ' + url + ': sin respuesta (' + e.message + ')');
    }
    if (!respuesta.ok) {
      const texto = await respuesta.text().catch(() => '');
      throw new ErrorGithub(metodo + ' ' + url + ': HTTP ' + respuesta.status + ' ' + texto.slice(0, 300), respuesta.status);
    }
    return respuesta;
  }

  return {
    configurado: Boolean(token && repo && workflow),

    /** POST .../dispatches. GitHub responde 204 sin el id de la corrida. */
    async disparar() {
      await peticion('POST', base + '/dispatches', { ref });
      cache = { hasta: 0, valor: null };
    },

    /** Última corrida del workflow (cualquier evento) o null si nunca ha corrido. */
    async ultimaCorrida() {
      if (Date.now() < cache.hasta) return cache.valor;
      const respuesta = await peticion('GET', base + '/runs?per_page=1');
      const datos = await respuesta.json();
      const run = datos.workflow_runs && datos.workflow_runs[0];
      const valor = run
        ? {
            estado: run.status, // queued | in_progress | completed | waiting | ...
            conclusion: run.conclusion, // success | failure | cancelled | null
            evento: run.event, // schedule | workflow_dispatch
            creada: run.created_at,
            actualizada: run.updated_at,
            url: run.html_url
          }
        : null;
      cache = { hasta: Date.now() + CACHE_MS, valor };
      return valor;
    }
  };
}

module.exports = { crearClienteGithub, ErrorGithub };
