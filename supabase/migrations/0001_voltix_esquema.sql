-- =============================================================================
-- Voltix price monitor - esquema base (Fase 2)
--
-- Proyecto Supabase compartido del portafolio: todo lleva prefijo voltix_.
-- Modelo de acceso:
--   * anon / authenticated  -> solo lectura (dashboard con la clave pública)
--   * service_role          -> escritura (scraper en GitHub Actions; bypassea RLS)
-- Idempotente: se puede volver a correr completo en el SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Catálogo de referencia
-- -----------------------------------------------------------------------------
create table if not exists public.voltix_productos (
  sku            text primary key,
  nombre         text          not null,
  categoria      text          not null,
  precio_voltix  numeric(10,2) not null check (precio_voltix >= 0),
  orden          smallint      not null default 0,
  creado_en      timestamptz   not null default now()
);

comment on table public.voltix_productos is
  'Voltix: catálogo maestro. El SKU es el identificador compartido con las tiendas competidoras (atributo data-sku).';

-- -----------------------------------------------------------------------------
-- Historial: un renglón por producto, por tienda, por corrida del scraper
-- -----------------------------------------------------------------------------
create table if not exists public.voltix_historial_precios (
  id              bigint generated always as identity primary key,
  sku             text          not null references public.voltix_productos (sku) on delete cascade,
  tienda          text          not null check (tienda in ('gigabazar', 'electroexpress')),
  precio          numeric(10,2) not null check (precio >= 0),
  -- Precio del snapshot inmediatamente anterior para el mismo sku+tienda.
  -- Lo resuelve el scraper al insertar; el dashboard solo compara precio vs precio_anterior.
  precio_anterior numeric(10,2)          check (precio_anterior >= 0),
  stock           text          not null default '',
  fecha_scrape    timestamptz   not null default now()
);

comment on table public.voltix_historial_precios is
  'Voltix: snapshots de precios de la competencia. Se trunca y re-siembra a diario (voltix_restaurar_demo).';

create index if not exists voltix_historial_sku_tienda_fecha_idx
  on public.voltix_historial_precios (sku, tienda, fecha_scrape desc, id desc);

-- -----------------------------------------------------------------------------
-- Estado del botón "Ejecutar monitoreo ahora" (fila única, id = 1)
-- Vive en la base y no en memoria porque el dashboard corre en serverless.
-- -----------------------------------------------------------------------------
create table if not exists public.voltix_disparos (
  id              smallint primary key default 1 check (id = 1),
  ultimo_disparo  timestamptz
);

insert into public.voltix_disparos (id, ultimo_disparo)
values (1, null)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Vista: último snapshot por sku+tienda
-- security_invoker = true para que la vista respete el RLS de la tabla base
-- (por defecto una vista corre con los permisos de su dueño y lo saltaría).
-- -----------------------------------------------------------------------------
create or replace view public.voltix_ultimos_precios
with (security_invoker = true) as
select distinct on (h.sku, h.tienda)
  h.sku,
  h.tienda,
  h.precio,
  h.precio_anterior,
  h.stock,
  h.fecha_scrape
from public.voltix_historial_precios h
order by h.sku, h.tienda, h.fecha_scrape desc, h.id desc;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.voltix_productos         enable row level security;
alter table public.voltix_historial_precios enable row level security;
alter table public.voltix_disparos          enable row level security;

drop policy if exists voltix_productos_lectura on public.voltix_productos;
create policy voltix_productos_lectura
  on public.voltix_productos for select
  to anon, authenticated
  using (true);

drop policy if exists voltix_historial_lectura on public.voltix_historial_precios;
create policy voltix_historial_lectura
  on public.voltix_historial_precios for select
  to anon, authenticated
  using (true);

-- El timestamp del último disparo no es sensible y el dashboard lo necesita
-- para mostrar cuánto falta de cooldown.
drop policy if exists voltix_disparos_lectura on public.voltix_disparos;
create policy voltix_disparos_lectura
  on public.voltix_disparos for select
  to anon, authenticated
  using (true);

-- Sin políticas de INSERT/UPDATE/DELETE: con RLS activo, anon y authenticated
-- quedan denegados. Además se retiran los privilegios que Supabase concede por
-- defecto en el esquema public (defensa en profundidad; TRUNCATE no pasa por RLS).
revoke insert, update, delete, truncate, references, trigger
  on public.voltix_productos, public.voltix_historial_precios, public.voltix_disparos
  from anon, authenticated;
-- La vista también hereda los privilegios por defecto (TRUNCATE, TRIGGER,
-- REFERENCES...): se retiran todos y abajo se concede solo SELECT.
revoke all on public.voltix_ultimos_precios from anon, authenticated;

grant select
  on public.voltix_productos, public.voltix_historial_precios, public.voltix_disparos,
     public.voltix_ultimos_precios
  to anon, authenticated;

grant select, insert, update, delete
  on public.voltix_productos, public.voltix_historial_precios, public.voltix_disparos
  to service_role;
grant select on public.voltix_ultimos_precios to service_role;
