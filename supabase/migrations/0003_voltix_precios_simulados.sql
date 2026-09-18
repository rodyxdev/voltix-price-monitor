-- =============================================================================
-- Voltix price monitor - precios simulados de la competencia (Fase 3)
--
-- GigaBazar y ElectroExpress dejan de ser HTML estático: sus apps Express leen
-- de aquí el precio y el stock que muestran. El workflow de simulación (service
-- role) los mueve antes de cada monitoreo; la restauración diaria los regresa a
-- su valor base.
-- Idempotente: se puede volver a correr completo en el SQL Editor.
-- =============================================================================

create table if not exists public.voltix_precios_simulados (
  sku            text          not null references public.voltix_productos (sku) on delete cascade,
  tienda         text          not null check (tienda in ('gigabazar', 'electroexpress')),
  -- Valor de referencia: la simulación varía ±% sobre precio_base (no se
  -- acumula corrida tras corrida) y la restauración vuelve a él.
  precio_base    numeric(10,2) not null check (precio_base > 0),
  precio_actual  numeric(10,2) not null check (precio_actual > 0),
  stock_base     text          not null,
  stock_actual   text          not null,
  actualizado_en timestamptz   not null default now(),
  primary key (sku, tienda)
);

comment on table public.voltix_precios_simulados is
  'Voltix: precio y stock vigentes en las tiendas ficticias. Solo lectura para anon; lo mueve el workflow de simulación.';

alter table public.voltix_precios_simulados enable row level security;

drop policy if exists voltix_precios_simulados_lectura on public.voltix_precios_simulados;
create policy voltix_precios_simulados_lectura
  on public.voltix_precios_simulados for select
  to anon, authenticated
  using (true);

revoke all on public.voltix_precios_simulados from anon, authenticated;
grant select on public.voltix_precios_simulados to anon, authenticated;
grant select, insert, update, delete on public.voltix_precios_simulados to service_role;

-- -----------------------------------------------------------------------------
-- voltix_restaurar_demo(): ahora también regresa los precios simulados a su
-- base. Los precios "hoy" del historial y los precios base de las tiendas son
-- los mismos, así que después de restaurar el siguiente monitoreo parte de un
-- estado coherente.
-- -----------------------------------------------------------------------------
create or replace function public.voltix_restaurar_demo()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ayer  timestamptz := now() - interval '1 day';
  v_hoy   timestamptz := now() - interval '30 minutes';
  v_filas integer;
begin
  insert into public.voltix_productos (sku, nombre, categoria, precio_voltix, orden) values
    ('NMB-A1',  'Audífonos Inalámbricos Nimbus A1', 'Audio',       1279.00, 1),
    ('PLS-S2',  'Smartwatch Pulse S2',              'Wearables',   2549.00, 2),
    ('VLT-20K', 'Power Bank Volt 20000 mAh',        'Energía',      689.00, 3),
    ('CRG-65W', 'Cargador Rápido USB-C 65W',        'Energía',      529.00, 4),
    ('BOM-MIN', 'Bocina Bluetooth Boom Mini',       'Audio',        879.00, 5),
    ('GLD-M3',  'Mouse Inalámbrico Glide M3',       'Periféricos',  389.00, 6),
    ('KBD-K65', 'Teclado Mecánico Compacto K65',    'Periféricos', 1549.00, 7),
    ('CBL-CH2', 'Cable USB-C a HDMI 4K 2m',         'Cables',       319.00, 8)
  on conflict (sku) do update
    set nombre        = excluded.nombre,
        categoria     = excluded.categoria,
        precio_voltix = excluded.precio_voltix,
        orden         = excluded.orden;

  truncate table public.voltix_historial_precios restart identity;

  drop table if exists pg_temp.voltix_base;
  create temporary table voltix_base (
    sku text, tienda text, precio_ayer numeric(10,2), precio_hoy numeric(10,2), stock text
  ) on commit drop;

  insert into pg_temp.voltix_base values
    ('NMB-A1',  'gigabazar',      1299.00, 1299.00, 'En stock'),
    ('PLS-S2',  'gigabazar',      2599.00, 2499.00, 'En stock'),
    ('VLT-20K', 'gigabazar',       699.00,  699.00, 'En stock'),
    ('CRG-65W', 'gigabazar',       529.00,  549.00, 'Pocas piezas'),
    ('BOM-MIN', 'gigabazar',       899.00,  899.00, 'En stock'),
    ('GLD-M3',  'gigabazar',       399.00,  399.00, 'En stock'),
    ('KBD-K65', 'gigabazar',      1599.00, 1599.00, 'Agotado'),
    ('CBL-CH2', 'gigabazar',       329.00,  329.00, 'En stock'),
    ('NMB-A1',  'electroexpress', 1299.00, 1249.00, 'En stock'),
    ('PLS-S2',  'electroexpress', 2499.00, 2599.00, 'Pocas piezas'),
    ('VLT-20K', 'electroexpress',  699.00,  679.50, 'En stock'),
    ('CRG-65W', 'electroexpress',  549.00,  499.00, 'En stock'),
    ('BOM-MIN', 'electroexpress',  899.00,  949.00, 'En stock'),
    ('GLD-M3',  'electroexpress',  399.00,  375.00, 'En stock'),
    ('KBD-K65', 'electroexpress', 1599.00, 1689.00, 'En stock'),
    ('CBL-CH2', 'electroexpress',  329.00,  299.00, 'Pocas piezas');

  insert into public.voltix_historial_precios (sku, tienda, precio, precio_anterior, stock, fecha_scrape)
  select sku, tienda, precio_ayer, null, 'En stock', v_ayer from pg_temp.voltix_base
  union all
  select sku, tienda, precio_hoy, precio_ayer, stock, v_hoy from pg_temp.voltix_base;

  get diagnostics v_filas = row_count;

  -- Las tiendas vuelven a mostrar exactamente el snapshot "hoy" del historial.
  insert into public.voltix_precios_simulados
    (sku, tienda, precio_base, precio_actual, stock_base, stock_actual, actualizado_en)
  select sku, tienda, precio_hoy, precio_hoy, stock, stock, now() from pg_temp.voltix_base
  on conflict (sku, tienda) do update
    set precio_base    = excluded.precio_base,
        precio_actual  = excluded.precio_base,
        stock_base     = excluded.stock_base,
        stock_actual   = excluded.stock_base,
        actualizado_en = excluded.actualizado_en;

  update public.voltix_disparos set ultimo_disparo = null where id = 1;

  return v_filas;
end;
$$;

revoke all on function public.voltix_restaurar_demo() from public, anon, authenticated;
grant execute on function public.voltix_restaurar_demo() to service_role;
