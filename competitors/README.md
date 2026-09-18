# /competitors — Tiendas ficticias de competencia

Dos sitios estáticos (HTML + CSS, sin frameworks ni backend) que hacen de
"competencia" de Voltix. Son el objetivo del scraper.

| Tienda | Carpeta | Tono | Catálogo |
| --- | --- | --- | --- |
| GigaBazar | `gigabazar/` | Tienda grande genérica, azul, sans-serif | Los mismos 8 productos |
| ElectroExpress | `electroexpress/` | Boutique pequeña, verde, serif | Los mismos 8 productos |

Ambas listan **los mismos 8 productos con el mismo nombre** (para que el scraper
pueda emparejarlos) pero con **precios y disponibilidad distintos**.

## Correr en local

```bash
cd competitors
python -m http.server 8081
```

- GigaBazar: http://localhost:8081/gigabazar/index.html
- ElectroExpress: http://localhost:8081/electroexpress/index.html

El scraper espera exactamente este puerto (configurable con la variable de
entorno `VOLTIX_COMPETIDORES_URL`).

## Estructura de cada tienda

```
<tienda>/
  index.html            Catálogo con las 8 tarjetas de producto
  css/estilos.css       Hoja de estilos única, mobile-first
  productos/<slug>.html Página de detalle por producto (8 archivos)
```

## Contrato HTML para el scraper

Las clases CSS son idénticas en ambas tiendas y **no deben renombrarse** sin
actualizar `scraper/config.py`:

```html
<li class="product-card" data-sku="NMB-A1">
  <span class="product-category">Audio</span>
  <h3 class="product-name"><a href="...">Audífonos Inalámbricos Nimbus A1</a></h3>
  <p class="product-price" data-currency="MXN">$ 1,299.00</p>
  <p class="product-stock" data-stock="en-stock">En stock</p>
  <span class="product-sku">SKU: NMB-A1</span>
</li>
```

Las páginas de detalle usan las mismas clases dentro de `.product-detail`.

## Regenerar los sitios

Los HTML se versionan en el repo, pero se generan desde un solo script con el
catálogo y los precios. Para cambiar precios, stock o productos:

1. Edita `PRODUCTS` / `STORES` en `tools/generar_sitios.py`.
2. Corre:

```bash
python competitors/tools/generar_sitios.py
```

Esto reescribe los 18 archivos de ambas tiendas. Es útil en la Fase 2 para
simular cambios de precio entre corridas del scraper.

## Deploy (Fase 3)

Cada tienda es autocontenida y sin dependencias de backend, así que puede
publicarse como sitio estático independiente.
