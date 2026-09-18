-- =============================================================================
-- Voltix price monitor - funciones RPC (Fase 2)
--
--   voltix_reservar_disparo(minutos)  -> cooldown atómico del botón
--                                        "Ejecutar monitoreo ahora" (anon)
--   voltix_restaurar_demo()           -> trunca y re-siembra el historial con el
--                                        snapshot base fijo (solo service_role)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Cooldown del botón "Ejecutar monitoreo ahora"
--
-- El dashboard solo tiene la clave pública, que no puede escribir tablas. Esta
-- función SECURITY DEFINER es la única escritura permitida a anon, y solo toca
-- una columna de una fila. El UPDATE condicional es atómico: si dos visitantes
-- pulsan a la vez, solo uno obtiene permitido = true.
-- -----------------------------------------------------------------------------
create or replace function public.voltix_reservar_disparo(p_cooldown_minutos integer default 10)
returns table (permitido boolean, ultimo_disparo timestamptz, segundos_restantes integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- Se acota el parámetro para que una llamada directa con la clave pública no
  -- pueda desactivar el cooldown pasando 0 o un valor negativo.
  v_cooldown interval := make_interval(mins => least(greatest(coalesce(p_cooldown_minutos, 10), 1), 1440));
  v_ahora    timestamptz := now();
  v_previo   timestamptz;
begin
  insert into public.voltix_disparos (id, ultimo_disparo)
  values (1, null)
  on conflict (id) do nothing;

  update public.voltix_disparos as d
     set ultimo_disparo = v_ahora
   where d.id = 1
     and (d.ultimo_disparo is null or d.ultimo_disparo <= v_ahora - v_cooldown);

  if found then
    return query select true, v_ahora, 0;
    return;
  end if;

  select d.ultimo_disparo into v_previo
    from public.voltix_disparos as d
   where d.id = 1;

  return query
    select false,
           v_previo,
           greatest(0, ceil(extract(epoch from (v_previo + v_cooldown - v_ahora))))::integer;
end;
$$;

revoke all on function public.voltix_reservar_disparo(integer) from public;
grant execute on function public.voltix_reservar_disparo(integer) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Restauración diaria del demo
--
-- Deshace la acumulación de corridas provocada por visitantes que usan el botón
-- "Ejecutar monitoreo ahora": deja el catálogo y el historial en un estado base
-- conocido con dos snapshots (ayer y hoy), para que el dashboard muestre
-- subidas y bajadas desde el primer momento.
-- Los precios de "hoy" coinciden con los HTML de /competitors.
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

  with base (sku, tienda, precio_ayer, precio_hoy, stock) as (
    values
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
      ('CBL-CH2', 'electroexpress',  329.00,  299.00, 'Pocas piezas')
  )
  insert into public.voltix_historial_precios (sku, tienda, precio, precio_anterior, stock, fecha_scrape)
  select sku, tienda, precio_ayer, null, 'En stock', v_ayer from base
  union all
  select sku, tienda, precio_hoy, precio_ayer, stock, v_hoy from base;

  get diagnostics v_filas = row_count;

  update public.voltix_disparos set ultimo_disparo = null where id = 1;

  return v_filas;
end;
$$;

revoke all on function public.voltix_restaurar_demo() from public, anon, authenticated;
grant execute on function public.voltix_restaurar_demo() to service_role;
