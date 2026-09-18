# /supabase — Esquema de base de datos

Voltix vive en el **proyecto Supabase compartido del portafolio** (el mismo que
Café Altiplano). Todo lo suyo lleva el prefijo `voltix_`.

## Aplicar el esquema

En el panel de Supabase → **SQL Editor**, pega y ejecuta en orden:

1. `migrations/0001_voltix_esquema.sql`: tablas, vista, RLS y privilegios
2. `migrations/0002_voltix_funciones.sql`: funciones RPC
3. `migrations/0003_voltix_precios_simulados.sql`: precios de las tiendas
   (Fase 3) y restauración ampliada
4. Siembra inicial:

   ```sql
   select public.voltix_restaurar_demo();
   ```

Todos los pasos son idempotentes, así que se pueden volver a correr sin problema.

## Objetos

| Objeto | Tipo | Para qué |
| --- | --- | --- |
| `voltix_productos` | tabla | Catálogo maestro: `sku` (PK), `nombre`, `categoria`, `precio_voltix`, `orden` |
| `voltix_historial_precios` | tabla | Un renglón por sku+tienda por corrida: `precio`, `precio_anterior`, `stock`, `fecha_scrape` |
| `voltix_precios_simulados` | tabla | Precio y stock vigentes por sku+tienda que muestran GigaBazar y ElectroExpress (`precio_base` / `precio_actual`) |
| `voltix_disparos` | tabla (1 fila) | Timestamp del último "Ejecutar monitoreo ahora" (cooldown) |
| `voltix_ultimos_precios` | vista | Último snapshot por sku+tienda (`security_invoker`, respeta RLS) |
| `voltix_reservar_disparo(minutos)` | RPC | Reserva atómica del cooldown; la única escritura permitida a anon |
| `voltix_restaurar_demo()` | RPC | Trunca y re-siembra el historial y regresa los precios simulados a su base; solo `service_role` |

## Modelo de acceso

| Rol | Quién lo usa | Puede |
| --- | --- | --- |
| `anon` / `authenticated` | Dashboard y tiendas (clave pública) | `SELECT` en las tablas y la vista; ejecutar `voltix_reservar_disparo` |
| `service_role` | Scraper, simulación y restauración (GitHub Actions) | Todo; bypassea RLS |

- RLS está activo en las cuatro tablas y solo hay políticas de `SELECT`, así que
  `INSERT`/`UPDATE`/`DELETE` quedan denegados para anon y authenticated.
- Además se les revocan esos privilegios (y `TRUNCATE`, que no pasa por RLS).
- La vista usa `security_invoker = true`: sin eso, una vista corre con los
  permisos de su dueño y se saltaría el RLS.
- Las funciones `SECURITY DEFINER` fijan `search_path = ''`.

### Sobre `voltix_reservar_disparo`

El dashboard necesita guardar el timestamp del último disparo, pero solo tiene
la clave pública. En lugar de darle la service role, esta función es la única
escritura que anon puede hacer: toca una columna de una fila y acota el
cooldown a entre 1 y 1440 minutos. Como la clave pública es visible, alguien
podría llamarla directo y "gastar" el cooldown; lo peor que eso provoca es que
el botón quede bloqueado unos minutos. Disparar el workflow sigue requiriendo el
token de GitHub, que solo vive en el servidor.
