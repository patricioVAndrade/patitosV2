-- "¿Sigue habiendo?" y "Datos que faltan" (panel › Revisar).
-- La fecha de revisión va en una tabla aparte: confirmar que un artículo sigue en el local no
-- lo "toca" (no cambia su fecha de actualización ni su lugar en el catálogo, ni llena el historial).

create table public.revisiones (
  producto_id  uuid primary key references public.productos(id) on delete cascade,
  revisado     timestamptz not null default now(),
  revisado_por uuid default auth.uid() references auth.users(id) on delete set null
);
alter table public.revisiones enable row level security;
revoke all on public.revisiones from anon;
create policy revisiones_staff on public.revisiones for all to authenticated
  using (public.es_staff()) with check (public.es_staff());

-- Artículos publicados que nadie tocó ni confirmó en `p_dias` días (los más viejos primero)
create or replace function public.pendientes_revision(p_dias integer default 60, p_limite integer default 50)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with base as (
    select p.id, p.sku, p.nombre, p.disponibilidad, p.precio,
           greatest(p.actualizado, r.revisado) as ultima_vez,
           (select i.ruta_thumb from public.imagenes i where i.producto_id = p.id order by i.orden, i.creado limit 1) as ruta_thumb
      from public.productos p
      left join public.revisiones r on r.producto_id = p.id
     where p.estado = 'publicado'
       and greatest(p.actualizado, r.revisado) < now() - make_interval(days => greatest(p_dias, 1))
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'items', coalesce((select jsonb_agg(to_jsonb(b) order by b.ultima_vez) from (select * from base order by ultima_vez limit least(p_limite, 200)) b), '[]'::jsonb)
  )
$$;

create or replace function public.marcar_revisado(p_ids uuid[])
returns integer
language sql security invoker set search_path = '' as $$
  with h as (
    insert into public.revisiones (producto_id, revisado, revisado_por)
    select unnest(p_ids), now(), auth.uid()
    on conflict (producto_id) do update set revisado = now(), revisado_por = auth.uid()
    returning 1
  )
  select count(*)::integer from h
$$;

-- Lo que conviene completar o corregir, con cantidad y los primeros artículos de cada grupo
create or replace function public.datos_faltantes(p_limite integer default 40)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with pub as (
    select p.*, c.slug as cat_slug,
           (select i.ruta_thumb from public.imagenes i where i.producto_id = p.id order by i.orden, i.creado limit 1) as ruta_thumb
      from public.productos p join public.categorias c on c.id = p.categoria_id
     where p.estado = 'publicado'
  ),
  grupos as (
    select 'sin_foto' as grupo, id, sku, nombre, ruta_thumb, actualizado from pub where ruta_thumb is null
    union all select 'sin_precio', id, sku, nombre, ruta_thumb, actualizado from pub where precio is null
    union all select 'sin_marca', id, sku, nombre, ruta_thumb, actualizado from pub where marca_id is null
    union all select 'nombre_corto', id, sku, nombre, ruta_thumb, actualizado from pub where char_length(btrim(nombre)) < 15
    union all select 'en_varios', id, sku, nombre, ruta_thumb, actualizado from pub where cat_slug = 'varios'
    union all select 'oferta_sin_antes', id, sku, nombre, ruta_thumb, actualizado from pub where en_oferta and precio_anterior is null
    union all select 'agotado_viejo', id, sku, nombre, ruta_thumb, actualizado from pub
               where disponibilidad = 'agotado' and actualizado < now() - interval '45 days'
  )
  select coalesce(jsonb_object_agg(grupo, jsonb_build_object('total', total, 'items', items)), '{}'::jsonb)
    from (
      select grupo, count(*) as total,
             coalesce(jsonb_agg(jsonb_build_object('id', id, 'sku', sku, 'nombre', nombre, 'ruta_thumb', ruta_thumb)
                                order by actualizado) filter (where n <= p_limite), '[]'::jsonb) as items
        from (select g.*, row_number() over (partition by grupo order by actualizado) as n from grupos g) z
       group by grupo
    ) t
$$;

revoke all on function public.pendientes_revision(integer, integer) from public, anon;
revoke all on function public.marcar_revisado(uuid[]) from public, anon;
revoke all on function public.datos_faltantes(integer) from public, anon;
grant execute on function public.pendientes_revision(integer, integer) to authenticated;
grant execute on function public.marcar_revisado(uuid[]) to authenticated;
grant execute on function public.datos_faltantes(integer) to authenticated;
