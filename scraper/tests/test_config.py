"""Resolución de VOLTIX_COMPETIDORES_URL (un host por tienda o una raíz común)."""
import unittest

from config import urls_tiendas


class UrlsTiendasTests(unittest.TestCase):
    def test_un_host_por_tienda_sin_importar_el_orden(self):
        urls = urls_tiendas(
            " electroexpress=https://electroexpress.vercel.app/ , gigabazar=https://gigabazar.vercel.app"
        )
        self.assertEqual(urls["gigabazar"], "https://gigabazar.vercel.app/index.html")
        self.assertEqual(urls["electroexpress"], "https://electroexpress.vercel.app/index.html")

    def test_raiz_comun_formato_de_fase_2(self):
        urls = urls_tiendas("http://localhost:8000/")
        self.assertEqual(urls["gigabazar"], "http://localhost:8000/gigabazar/index.html")
        self.assertEqual(urls["electroexpress"], "http://localhost:8000/electroexpress/index.html")

    def test_errores_explicitos(self):
        with self.assertRaisesRegex(ValueError, "falta la URL de electroexpress"):
            urls_tiendas("gigabazar=https://a.example")
        with self.assertRaisesRegex(ValueError, "entrada inválida"):
            urls_tiendas("gigabazar=https://a.example,amazon=https://b.example")


if __name__ == "__main__":
    unittest.main()
