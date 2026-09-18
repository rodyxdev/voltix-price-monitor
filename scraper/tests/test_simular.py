"""Simulación de precios: rangos, independencia entre tiendas y reproducibilidad."""
import random
import unittest
from decimal import Decimal

from simular import ESTADOS_STOCK, redondear, simular


def filas_base():
    precios = {
        ("NMB-A1", "gigabazar"): "1299.00", ("NMB-A1", "electroexpress"): "1249.00",
        ("PLS-S2", "gigabazar"): "2499.00", ("PLS-S2", "electroexpress"): "2599.00",
        ("VLT-20K", "gigabazar"): "699.00", ("VLT-20K", "electroexpress"): "679.50",
        ("CBL-CH2", "gigabazar"): "329.00", ("CBL-CH2", "electroexpress"): "299.00",
    }
    return [
        {"sku": s, "tienda": t, "precio_base": p, "precio_actual": p, "stock_base": "En stock", "stock_actual": "En stock"}
        for (s, t), p in precios.items()
    ]


class SimularTests(unittest.TestCase):
    def test_redondeo_a_cincuenta_centavos(self):
        self.assertEqual(redondear(Decimal("1234.24")), Decimal("1234.00"))
        self.assertEqual(redondear(Decimal("1234.26")), Decimal("1234.50"))
        self.assertEqual(redondear(Decimal("0.10")), Decimal("0.50"))

    def test_variacion_entre_5_y_15_por_ciento_sobre_la_base(self):
        rng = random.Random(7)
        vistos = 0
        for _ in range(300):
            for c in simular(filas_base(), rng, probabilidad=1.0, prob_stock=0):
                base = Decimal(c["precio_base"])
                pct = abs(Decimal(c["precio_actual"]) - base) / base
                # ±0.50 de redondeo sobre el rango nominal.
                self.assertGreaterEqual(pct, Decimal("0.05") - Decimal("0.5") / base)
                self.assertLessEqual(pct, Decimal("0.15") + Decimal("0.5") / base)
                vistos += 1
        self.assertEqual(vistos, 300 * 8)

    def test_no_se_acumula_corrida_tras_corrida(self):
        rng = random.Random(3)
        filas = filas_base()
        for _ in range(200):
            for c in simular(filas, rng, probabilidad=1.0, prob_stock=0):
                f = next(f for f in filas if (f["sku"], f["tienda"]) == (c["sku"], c["tienda"]))
                f["precio_actual"] = c["precio_actual"]
        for f in filas:
            base = Decimal(f["precio_base"])
            self.assertLessEqual(abs(Decimal(f["precio_actual"]) - base) / base, Decimal("0.16"))

    def test_probabilidad_por_producto_e_independencia_entre_tiendas(self):
        rng = random.Random(11)
        cambiados = 0
        solo_una_tienda = 0
        total = 0
        for _ in range(500):
            cambios = simular(filas_base(), rng, probabilidad=0.4, prob_stock=0)
            cambiados += len(cambios)
            total += 8
            por_sku = {}
            for c in cambios:
                por_sku.setdefault(c["sku"], set()).add(c["tienda"])
            solo_una_tienda += sum(1 for tiendas in por_sku.values() if len(tiendas) == 1)
        self.assertAlmostEqual(cambiados / total, 0.4, delta=0.03)
        # Con 40 % independiente por tienda, "cambia solo una" pasa ~48 % de las veces por SKU.
        self.assertGreater(solo_una_tienda, 500 * 4 * 0.4)

    def test_un_cambio_siempre_es_visible_y_el_stock_es_valido(self):
        rng = random.Random(5)
        filas = filas_base()
        for f in filas:
            f["precio_actual"] = str(redondear(Decimal(f["precio_base"]) * Decimal("1.10")))
        for _ in range(200):
            for c in simular(filas, rng, probabilidad=1.0, prob_stock=1.0):
                antes = next(f for f in filas if (f["sku"], f["tienda"]) == (c["sku"], c["tienda"]))
                self.assertNotEqual(Decimal(c["precio_actual"]), Decimal(antes["precio_actual"]))
                self.assertIn(c["stock_actual"], ESTADOS_STOCK)
                self.assertNotEqual(c["stock_actual"], antes["stock_actual"])

    def test_misma_semilla_mismo_resultado(self):
        a = simular(filas_base(), random.Random(99))
        b = simular(filas_base(), random.Random(99))
        self.assertEqual(a, b)


if __name__ == "__main__":
    unittest.main()
