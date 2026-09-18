"""Pruebas del parser y de la persistencia (sin red: HTML de /competitors y un cliente falso)."""
import unittest
from decimal import Decimal
from pathlib import Path

import persistencia
import scraper
from supabase_rest import ClienteSupabase, ErrorSupabase, rol_de_llave

COMPETITORS = Path(__file__).resolve().parents[2] / "competitors"


def leer(tienda):
    return (COMPETITORS / tienda / "index.html").read_text(encoding="utf-8")


class ParserTests(unittest.TestCase):
    def test_parsea_las_dos_tiendas_con_sku(self):
        giga = scraper.parsear_catalogo(leer("gigabazar"), "GigaBazar", "gigabazar")
        electro = scraper.parsear_catalogo(leer("electroexpress"), "ElectroExpress", "electroexpress")

        self.assertEqual(len(giga), 8)
        self.assertEqual(len(electro), 8)
        # Emparejamiento por SKU: ambas tiendas exponen exactamente los mismos.
        self.assertEqual({p.sku for p in giga}, {p.sku for p in electro})

        audifonos = next(p for p in giga if p.sku == "NMB-A1")
        self.assertEqual(audifonos.precio, Decimal("1299.00"))
        self.assertEqual(audifonos.tienda_slug, "gigabazar")
        self.assertEqual(audifonos.nombre, "Audífonos Inalámbricos Nimbus A1")

        power_bank = next(p for p in electro if p.sku == "VLT-20K")
        self.assertEqual(power_bank.precio, Decimal("679.50"))

    def test_ignora_tarjetas_sin_sku(self):
        html = """
        <ul>
          <li class="product-card"><h3 class="product-name">Sin SKU</h3>
              <p class="product-price">$ 10.00</p></li>
          <li class="product-card" data-sku="X-1"><h3 class="product-name">Con SKU</h3>
              <p class="product-price">$ 1,234.50</p></li>
        </ul>"""
        productos = scraper.parsear_catalogo(html, "T", "t")
        self.assertEqual([p.sku for p in productos], ["X-1"])
        self.assertEqual(productos[0].precio, Decimal("1234.50"))

    def test_html_sin_tarjetas_es_error(self):
        with self.assertRaises(scraper.ErrorScraping):
            scraper.parsear_catalogo("<html></html>", "T", "t")

    def test_parsear_precio(self):
        self.assertEqual(scraper.parsear_precio("$ 2,499.00"), Decimal("2499.00"))
        self.assertIsNone(scraper.parsear_precio("Agotado"))


class ConstruirFilasTests(unittest.TestCase):
    def setUp(self):
        self.productos = scraper.parsear_catalogo(leer("gigabazar"), "GigaBazar", "gigabazar")
        self.catalogo = {p.sku for p in self.productos}

    def test_precio_anterior_sale_del_ultimo_snapshot(self):
        ultimos = {("NMB-A1", "gigabazar"): Decimal("1350.00")}
        filas, resultado = persistencia.construir_filas(
            self.productos, self.catalogo, ultimos, "2026-09-17T12:00:00+00:00"
        )
        self.assertEqual(len(filas), 8)
        fila = next(f for f in filas if f["sku"] == "NMB-A1")
        self.assertEqual(fila["precio"], "1299.00")
        self.assertEqual(fila["precio_anterior"], "1350.00")
        self.assertEqual(fila["tienda"], "gigabazar")
        self.assertEqual(fila["fecha_scrape"], "2026-09-17T12:00:00+00:00")
        # Sin historial previo, precio_anterior queda en NULL.
        self.assertIsNone(next(f for f in filas if f["sku"] == "PLS-S2")["precio_anterior"])
        self.assertEqual(resultado.sku_desconocidos, [])

    def test_omite_sku_fuera_de_catalogo_y_duplicados(self):
        catalogo = self.catalogo - {"CBL-CH2"}
        filas, resultado = persistencia.construir_filas(
            self.productos + self.productos[:1], catalogo, {}, "x"
        )
        self.assertEqual(len(filas), 7)
        self.assertEqual(resultado.sku_desconocidos, ["gigabazar:CBL-CH2"])
        self.assertEqual(resultado.duplicados, ["gigabazar:NMB-A1"])


class ClienteFalso:
    def __init__(self):
        self.insertado = None

    def select(self, tabla, columnas="*", **_):
        if tabla == "voltix_productos":
            return [{"sku": s} for s in ("NMB-A1", "PLS-S2")]
        if tabla == "voltix_ultimos_precios":
            return [{"sku": "NMB-A1", "tienda": "gigabazar", "precio": 1300}]
        raise AssertionError(tabla)

    def insert(self, tabla, filas):
        self.insertado = (tabla, filas)
        return len(filas)


class GuardarSnapshotTests(unittest.TestCase):
    def test_inserta_una_sola_vez_con_precio_anterior(self):
        productos = scraper.parsear_catalogo(leer("gigabazar"), "GigaBazar", "gigabazar")
        cliente = ClienteFalso()
        resultado = persistencia.guardar_snapshot(cliente, productos)

        tabla, filas = cliente.insertado
        self.assertEqual(tabla, "voltix_historial_precios")
        self.assertEqual(resultado.insertados, 2)
        self.assertEqual(len(resultado.sku_desconocidos), 6)
        self.assertEqual(next(f for f in filas if f["sku"] == "NMB-A1")["precio_anterior"], "1300")
        # Todas las filas de la corrida comparten el mismo timestamp.
        self.assertEqual(len({f["fecha_scrape"] for f in filas}), 1)


class LlavesTests(unittest.TestCase):
    def test_rol_de_llave(self):
        self.assertEqual(rol_de_llave("sb_secret_abc"), "service_role")
        self.assertEqual(rol_de_llave("sb_publishable_abc"), "anon")
        # JWT legacy con payload {"role":"anon"}
        self.assertEqual(rol_de_llave("eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.firma"), "anon")
        self.assertEqual(rol_de_llave("basura"), "")

    def test_rechaza_la_clave_publica(self):
        with self.assertRaises(ErrorSupabase):
            ClienteSupabase("https://x.supabase.co", "sb_publishable_abc")
        with self.assertRaises(ErrorSupabase):
            ClienteSupabase("", "sb_secret_abc")


if __name__ == "__main__":
    unittest.main()
