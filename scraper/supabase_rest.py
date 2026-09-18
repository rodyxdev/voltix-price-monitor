"""Cliente mínimo de PostgREST (la API REST de Supabase) sobre requests.

Por qué no una conexión Postgres directa: el scraper corre en GitHub Actions y
el dashboard en serverless; hablar por HTTPS con PostgREST evita abrir
conexiones al pool de Postgres del proyecto compartido del portafolio. Es el
mismo camino que usa @supabase/supabase-js en el dashboard.

Solo implementa lo que el scraper necesita: select, insert y rpc.
"""
import base64
import json

import requests

import config


class ErrorSupabase(Exception):
    """Fallo al hablar con Supabase. El mensaje incluye el detalle de PostgREST."""


def rol_de_llave(llave):
    """Devuelve el rol que otorga una llave de Supabase, o '' si no se reconoce.

    Llaves nuevas: sb_secret_... / sb_publishable_...
    Llaves legacy: JWT con el claim "role" (service_role / anon).
    """
    if llave.startswith("sb_secret_"):
        return "service_role"
    if llave.startswith("sb_publishable_"):
        return "anon"
    partes = llave.split(".")
    if len(partes) != 3:
        return ""
    try:
        carga = partes[1] + "=" * (-len(partes[1]) % 4)
        return json.loads(base64.urlsafe_b64decode(carga)).get("role", "")
    except (ValueError, json.JSONDecodeError):
        return ""


class ClienteSupabase:
    def __init__(self, url, llave, timeout=config.TIMEOUT_SEGUNDOS, sesion=None):
        if not url or not llave:
            raise ErrorSupabase("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.")
        if rol_de_llave(llave) != "service_role":
            # Con la clave pública las escrituras fallarían por RLS con un 401/403
            # poco claro; mejor detenerse aquí con un mensaje explícito.
            raise ErrorSupabase(
                "SUPABASE_SERVICE_ROLE_KEY no es una llave service_role/secret. "
                "El scraper necesita permisos de escritura."
            )
        self.base = f"{url.rstrip('/')}/rest/v1"
        self.timeout = timeout
        self.sesion = sesion or requests.Session()
        self.sesion.headers.update(
            {
                "apikey": llave,
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": config.USER_AGENT,
            }
        )
        # Las llaves legacy son JWT y van también en Authorization. Las nuevas
        # (sb_secret_) no son JWT: el gateway de Supabase las toma de apikey.
        if llave.startswith("eyJ"):
            self.sesion.headers["Authorization"] = f"Bearer {llave}"

    def _peticion(self, metodo, ruta, **kwargs):
        try:
            respuesta = self.sesion.request(
                metodo, f"{self.base}/{ruta}", timeout=self.timeout, **kwargs
            )
        except requests.RequestException as exc:
            raise ErrorSupabase(f"{metodo} {ruta}: sin respuesta ({exc})") from exc
        if respuesta.status_code >= 400:
            raise ErrorSupabase(
                f"{metodo} {ruta}: HTTP {respuesta.status_code} {respuesta.text[:500]}"
            )
        return respuesta

    def select(self, tabla, columnas="*", **filtros):
        """GET /tabla?select=...  Los filtros van en sintaxis PostgREST (sku='eq.X')."""
        params = {"select": columnas, **filtros}
        return self._peticion("GET", tabla, params=params).json()

    def insert(self, tabla, filas):
        """Inserta en bloque. Una sola petición = una sola transacción en Postgres."""
        if not filas:
            return 0
        self._peticion(
            "POST", tabla, data=json.dumps(filas), headers={"Prefer": "return=minimal"}
        )
        return len(filas)

    def rpc(self, funcion, argumentos=None):
        respuesta = self._peticion("POST", f"rpc/{funcion}", data=json.dumps(argumentos or {}))
        return respuesta.json() if respuesta.content else None


def cliente_desde_config():
    return ClienteSupabase(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
