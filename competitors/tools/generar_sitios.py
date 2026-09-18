# -*- coding: utf-8 -*-
"""Generador de los sitios estáticos de /competitors.

Los HTML generados se versionan en el repo; este script solo se vuelve a correr
cuando hay que cambiar precios, stock o el catálogo de las tiendas ficticias.

Uso:  python competitors/tools/generar_sitios.py
"""
import os
import io

# /competitors (carpeta padre de /competitors/tools)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PRODUCTS = [
    # slug, nombre, categoria, sku, precio_giga, stock_giga, precio_electro, stock_electro, descripcion
    ("audifonos-inalambricos", "Audífonos Inalámbricos Nimbus A1", "Audio", "NMB-A1",
     1299.00, "En stock", 1249.00, "En stock",
     "Audífonos over-ear con cancelación activa de ruido y 30 h de batería."),
    ("smartwatch-pulse-s2", "Smartwatch Pulse S2", "Wearables", "PLS-S2",
     2499.00, "En stock", 2599.00, "Pocas piezas",
     "Reloj inteligente con GPS, medición de ritmo cardiaco y resistencia 5 ATM."),
    ("power-bank-volt-20000", "Power Bank Volt 20000 mAh", "Energía", "VLT-20K",
     699.00, "En stock", 679.50, "En stock",
     "Batería portátil de 20000 mAh con dos puertos USB-A y uno USB-C PD."),
    ("cargador-usb-c-65w", "Cargador Rápido USB-C 65W", "Energía", "CRG-65W",
     549.00, "Pocas piezas", 499.00, "En stock",
     "Cargador GaN de 65 W compatible con laptops ligeras, tablets y teléfonos."),
    ("bocina-bluetooth-boom-mini", "Bocina Bluetooth Boom Mini", "Audio", "BOM-MIN",
     899.00, "En stock", 949.00, "En stock",
     "Bocina portátil IPX7 con 12 h de reproducción y emparejamiento estéreo."),
    ("mouse-inalambrico-glide-m3", "Mouse Inalámbrico Glide M3", "Periféricos", "GLD-M3",
     399.00, "En stock", 375.00, "En stock",
     "Mouse silencioso de 2.4 GHz y Bluetooth con sensor de 4000 DPI."),
    ("teclado-mecanico-k65", "Teclado Mecánico Compacto K65", "Periféricos", "KBD-K65",
     1599.00, "Agotado", 1689.00, "En stock",
     "Teclado 65% hot-swappable con switches lineales y retroiluminación RGB."),
    ("cable-usb-c-hdmi-4k", "Cable USB-C a HDMI 4K 2m", "Cables", "CBL-CH2",
     329.00, "En stock", 299.00, "Pocas piezas",
     "Cable trenzado de 2 m con salida 4K a 60 Hz y carcasa de aluminio."),
]

STORES = {
    "gigabazar": {
        "nombre": "GigaBazar",
        "tagline": "Todo para tu vida digital, al mayoreo y al menudeo",
        "claim": "Envío gratis en compras mayores a $599",
        "precio_idx": 4, "stock_idx": 5,
        "moneda": "MXN",
        "footer": "GigaBazar es una tienda ficticia creada como entorno de pruebas para Voltix.",
    },
    "electroexpress": {
        "nombre": "ElectroExpress",
        "tagline": "Gadgets seleccionados a mano, entrega el mismo día",
        "claim": "Asesoría personalizada por WhatsApp",
        "precio_idx": 6, "stock_idx": 7,
        "moneda": "MXN",
        "footer": "ElectroExpress es una tienda ficticia creada como entorno de pruebas para Voltix.",
    },
}

CSS_COMMON = """/* {nombre} - hoja de estilos unica, mobile-first, sin dependencias externas */
*, *::before, *::after {{ box-sizing: border-box; }}
body {{
  margin: 0;
  font-family: {font};
  color: {texto};
  background: {fondo};
  line-height: 1.5;
}}
a {{ color: inherit; }}
.site-header {{
  background: {header_bg};
  color: {header_texto};
  padding: 1rem 1rem 1.25rem;
}}
.site-header a {{ text-decoration: none; }}
.brand {{
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: {brand_spacing};
  margin: 0;
}}
.tagline {{ margin: .25rem 0 0; font-size: .85rem; opacity: .85; }}
.claim {{
  margin-top: .85rem;
  display: inline-block;
  background: {claim_bg};
  color: {claim_texto};
  font-size: .78rem;
  font-weight: 600;
  padding: .35rem .7rem;
  border-radius: {radio};
}}
main {{ padding: 1.25rem 1rem 2.5rem; max-width: 1080px; margin: 0 auto; }}
h2 {{ font-size: 1.15rem; margin: 0 0 .25rem; }}
.section-note {{ margin: 0 0 1.25rem; font-size: .85rem; color: {texto_suave}; }}
.product-grid {{
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  list-style: none;
  margin: 0;
  padding: 0;
}}
.product-card {{
  background: {tarjeta_bg};
  border: 1px solid {borde};
  border-radius: {radio};
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: .4rem;
}}
.product-category {{
  font-size: .7rem;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: {texto_suave};
}}
.product-name {{ font-size: 1rem; font-weight: 600; margin: 0; }}
.product-name a {{ text-decoration: none; }}
.product-price {{ font-size: 1.3rem; font-weight: 700; color: {precio}; margin: .2rem 0 0; }}
.product-stock {{ font-size: .8rem; font-weight: 600; }}
.product-stock[data-stock="agotado"] {{ color: {agotado}; }}
.product-stock[data-stock="pocas-piezas"] {{ color: {bajo}; }}
.product-stock[data-stock="en-stock"] {{ color: {disponible}; }}
.product-sku {{ font-size: .72rem; color: {texto_suave}; }}
.product-link {{
  margin-top: .5rem;
  font-size: .85rem;
  font-weight: 600;
  color: {precio};
  text-decoration: none;
}}
.breadcrumb {{ font-size: .8rem; margin: 0 0 1rem; color: {texto_suave}; }}
.product-detail {{
  background: {tarjeta_bg};
  border: 1px solid {borde};
  border-radius: {radio};
  padding: 1.25rem;
}}
.product-detail .product-name {{ font-size: 1.35rem; }}
.product-description {{ font-size: .92rem; color: {texto}; }}
.buy-button {{
  display: inline-block;
  margin-top: 1rem;
  background: {boton_bg};
  color: {boton_texto};
  border: none;
  border-radius: {radio};
  padding: .7rem 1.2rem;
  font-size: .95rem;
  font-weight: 600;
  cursor: pointer;
}}
.site-footer {{
  border-top: 1px solid {borde};
  padding: 1.25rem 1rem 2rem;
  font-size: .78rem;
  color: {texto_suave};
  text-align: center;
}}
@media (min-width: 600px) {{
  .product-grid {{ grid-template-columns: repeat(2, 1fr); }}
}}
@media (min-width: 900px) {{
  .product-grid {{ grid-template-columns: repeat(3, 1fr); }}
  main {{ padding-top: 2rem; }}
}}
"""

THEMES = {
    "gigabazar": dict(
        font='"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        texto="#1f2430", texto_suave="#6b7280", fondo="#f4f6fb",
        header_bg="#1d4ed8", header_texto="#ffffff",
        claim_bg="#fbbf24", claim_texto="#1f2430",
        tarjeta_bg="#ffffff", borde="#dde3ee", radio="8px",
        precio="#1d4ed8", boton_bg="#1d4ed8", boton_texto="#ffffff",
        disponible="#15803d", bajo="#b45309", agotado="#b91c1c",
        brand_spacing="-0.02em",
    ),
    "electroexpress": dict(
        font='Georgia, "Times New Roman", serif',
        texto="#2b2b2b", texto_suave="#7a7268", fondo="#fbf8f4",
        header_bg="#0f766e", header_texto="#f7fdfb",
        claim_bg="#f7fdfb", claim_texto="#0f766e",
        tarjeta_bg="#ffffff", borde="#e7ded2", radio="14px",
        precio="#0f766e", boton_bg="#0f766e", boton_texto="#ffffff",
        disponible="#0f766e", bajo="#a16207", agotado="#9f1239",
        brand_spacing="0.04em",
    ),
}


def stock_slug(texto):
    return texto.lower().replace(" ", "-")


def money(valor):
    return "$ {:,.2f}".format(valor)


def card(store_key, p, en_detalle=False):
    cfg = STORES[store_key]
    precio = p[cfg["precio_idx"]]
    stock = p[cfg["stock_idx"]]
    href = "productos/{}.html".format(p[0])
    tag = "div" if en_detalle else "li"
    clase = "product-detail" if en_detalle else "product-card"
    if en_detalle:
        nombre = '<h1 class="product-name">{}</h1>'.format(p[1])
        extra = ('\n      <p class="product-description">{}</p>'.format(p[8]) +
                 '\n      <button class="buy-button" type="button">Agregar al carrito</button>')
    else:
        nombre = '<h3 class="product-name"><a href="{}">{}</a></h3>'.format(href, p[1])
        extra = '\n      <a class="product-link" href="{}">Ver detalle</a>'.format(href)
    return (
        '    <{tag} class="{clase}" data-sku="{sku}">\n'
        '      <span class="product-category">{cat}</span>\n'
        '      {nombre}\n'
        '      <p class="product-price" data-currency="{mon}">{precio}</p>\n'
        '      <p class="product-stock" data-stock="{sslug}">{stock}</p>\n'
        '      <span class="product-sku">SKU: {sku}</span>{extra}\n'
        '    </{tag}>'
    ).format(tag=tag, clase=clase, sku=p[3], cat=p[2], nombre=nombre,
             mon=cfg["moneda"], precio=money(precio), sslug=stock_slug(stock),
             stock=stock, extra=extra)


def page(store_key, title, body, css_path, home_href):
    cfg = STORES[store_key]
    return """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{nombre} - tienda ficticia de gadgets usada como entorno de pruebas del monitor de precios Voltix.">
  <link rel="stylesheet" href="{css}">
</head>
<body>
  <header class="site-header">
    <a href="{home}">
      <p class="brand">{nombre}</p>
    </a>
    <p class="tagline">{tagline}</p>
    <span class="claim">{claim}</span>
  </header>
  <main>
{body}
  </main>
  <footer class="site-footer">
    <p>{footer}</p>
  </footer>
</body>
</html>
""".format(title=title, nombre=cfg["nombre"], tagline=cfg["tagline"], claim=cfg["claim"],
           css=css_path, home=home_href, body=body, footer=cfg["footer"])


def write(path, contenido):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with io.open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(contenido)


for key, cfg in STORES.items():
    base = os.path.join(ROOT, key)
    write(os.path.join(base, "css", "estilos.css"),
          CSS_COMMON.format(nombre=cfg["nombre"], **THEMES[key]))

    cards = "\n".join(card(key, p) for p in PRODUCTS)
    body = (
        '    <h2>Catálogo de gadgets</h2>\n'
        '    <p class="section-note">{} productos disponibles. Precios en {} con IVA incluido.</p>\n'
        '    <ul class="product-grid">\n{}\n    </ul>'
    ).format(len(PRODUCTS), cfg["moneda"], cards)
    write(os.path.join(base, "index.html"),
          page(key, "{} | Catálogo de gadgets".format(cfg["nombre"]), body,
               "css/estilos.css", "index.html"))

    for p in PRODUCTS:
        detalle = (
            '    <p class="breadcrumb"><a href="../index.html">Catálogo</a> / {}</p>\n{}'
        ).format(p[2], card(key, p, en_detalle=True))
        write(os.path.join(base, "productos", "{}.html".format(p[0])),
              page(key, "{} | {}".format(p[1], cfg["nombre"]), detalle,
                   "../css/estilos.css", "../index.html"))

print("Generadas 2 tiendas x {} productos".format(len(PRODUCTS)))
