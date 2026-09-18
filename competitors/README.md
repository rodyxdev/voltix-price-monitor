# /competitors — Tiendas ficticias de competencia

Dos apps Node/Express, **GigaBazar** y **ElectroExpress**, que hacen de
"competencia" de Voltix y son el objetivo del scraper. Muestran el mismo HTML
de la Fase 1 (mismas clases y el atributo `data-sku`), pero el precio y el
stock salen en cada petición de Supabase (`voltix_precios_simulados`), así que
cambian cuando corre la simulación.

| Tienda | Carpeta | Tono | Puerto local | Proyecto Vercel |
| --- | --- | --- | --- | --- |
| GigaBazar | `gigabazar/` | Tienda grande genérica, azul, sans-serif | 8081 | Root Directory `competitors/gigabazar` |
| ElectroExpress | `electroexpress/` | Boutique pequeña, verde, serif | 8082 | Root Directory `competitors/electroexpress` |

Ambas listan **los mismos 8 productos (mismo SKU)** con precios y
disponibilidad propios.

## Correr en local

```bash
cd competitors/gigabazar
npm install
cp .env.example .env     # SUPABASE_URL + SUPABASE_ANON_KEY (clave pública)
npm start                # http://localhost:8081
```

Lo mismo en `competitors/electroexpress`, que usa el puerto 8082. Pruebas:
`npm test` en cada carpeta (sin red).

## Acceso a datos

- Solo **lectura** con la clave pública (anon/publishable), vía supabase-js.
  Si reciben la service role, se niegan a arrancar.
- Quien mueve los precios es el workflow de simulación
  (`scraper/simular.py`, con la service role), y la restauración diaria los
  regresa a su base.
- Sin caché (`Cache-Control: no-store`): el scraper siempre ve el precio
  vigente.
- Si Supabase falla, la página responde 503 con un mensaje genérico. El
  detalle queda solo en el log.

## Estructura (idéntica en las dos tiendas)

```
api/index.js          Entrada serverless en Vercel (exporta la app)
server.js             Arranque local (listen) y armado de dependencias
src/tienda.js         Identidad y precios base: LO ÚNICO propio de cada tienda en src/
src/catalogo.js       Productos fijos: slug, SKU, nombre, categoría, descripción
src/render.js         HTML (mismo marcado de la Fase 1, byte a byte)
src/app.js            Rutas: /, /index.html, /productos/<slug>.html, /health
src/datos.js          Lectura de voltix_precios_simulados
src/config.js         Variables de entorno y validación de la clave
src/seguridad.js      Cabeceras de seguridad
public/css/           Tema de la tienda (servido por la CDN en Vercel)
index.html            Snapshot con precios base (NO se publica; lo usan las pruebas del scraper)
vercel.json           Rewrites a api/index y cabeceras para los estáticos
```

## Código compartido

Cada tienda es un proyecto de Vercel con su propio Root Directory, así que
ninguna puede importar código de la carpeta hermana. GigaBazar es la fuente y
ElectroExpress es una copia:

```bash
node competitors/tools/sincronizar.js              # copia gigabazar -> electroexpress
node competitors/tools/sincronizar.js --verificar  # falla si difieren
```

## Contrato HTML para el scraper

No renombres estas clases sin actualizar `scraper/config.py`:

```html
<li class="product-card" data-sku="NMB-A1">
  <span class="product-category">Audio</span>
  <h3 class="product-name"><a href="...">Audífonos Inalámbricos Nimbus A1</a></h3>
  <p class="product-price" data-currency="MXN">$ 1,299.00</p>
  <p class="product-stock" data-stock="en-stock">En stock</p>
  <span class="product-sku">SKU: NMB-A1</span>
</li>
```

La prueba de snapshot compara el render con `index.html` byte a byte. Si
cambias el marcado a propósito, corre `npm run snapshot` en las dos tiendas.
