-- Detección de artículos repetidos y "Unir".
--  · Por nombre: nombres muy parecidos (pg_trgm) Y con los mismos números. Así "Mochila 9″" y
--    "Mochila 11″", o "x10" y "x6", NO se marcan como repetidos (son productos distintos).
--  · Por foto: cada foto guarda una "huella" de 256 bits (dHash, calculada en el celular al
--    comprimirla). Con las fotos reales del catálogo: la misma foto re-guardada, agrandada o
--    recortada quedó a 5-6 bits; productos distintos, a 24 o más. Se toma ≤ 18 como "casi igual".
--  · Unir: pasa códigos, fotos y etiquetas al artículo que queda, completa datos que le falten
--    y archiva el otro. El link viejo redirige al que queda.

alter table public.productos add column unido_a uuid references public.productos(id) on delete set null;
alter table public.imagenes  add column huella bit(256);
create index imagenes_huella on public.imagenes (producto_id) where huella is not null;

-- "MOCHILA 17″ URBAN WILSON - 65.AD009" → "mochila 17″ urban wilson" (sin código de proveedor al final)
create or replace function public.nombre_comparable(t text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select btrim(regexp_replace(
           regexp_replace(public.normalizar(t), '\s+-\s+[a-z0-9./-]*[0-9][a-z0-9./-]*$', ''),
           '\s+', ' ', 'g'))
$$;

-- números del nombre, ordenados: "balde 120pzs 30cm" → {120, 30}
create or replace function public.numeros_nombre(t text)
returns text[] language sql immutable parallel safe set search_path = '' as $$
  select coalesce(array(select m[1] from regexp_matches(public.nombre_comparable(t), '(\d+(?:[.,]\d+)?)', 'g') as m order by 1), '{}')
$$;

create index productos_nombre_trgm on public.productos using gin (public.nombre_comparable(nombre) extensions.gin_trgm_ops);

create table public.repetidos_descartados (
  a      uuid not null references public.productos(id) on delete cascade,
  b      uuid not null references public.productos(id) on delete cascade,
  fecha  timestamptz not null default now(),
  por    uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (a, b),
  check (a < b)
);
alter table public.repetidos_descartados enable row level security;
revoke all on public.repetidos_descartados from anon;
create policy descartados_staff on public.repetidos_descartados for all to authenticated
  using (public.es_staff()) with check (public.es_staff());

-- Distancia entre huellas (cantidad de bits distintos)
create or replace function public.distancia_huella(a bit, b bit)
returns integer language sql immutable parallel safe set search_path = '' as $$
  select bit_count(a # b)::integer
$$;

-- texto hexadecimal de 64 caracteres → bit(256); cualquier otra cosa → null
create or replace function public.huella_desde_texto(t text)
returns bit(256) language sql immutable parallel safe set search_path = '' as $$
  select case when t ~ '^[0-9a-f]{64}$' then ('x' || t)::bit(256) end
$$;

-- Ficha corta de un artículo para mostrar en los avisos
create or replace function public.ficha_corta(p_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'sku', p.sku, 'nombre', p.nombre, 'estado', p.estado, 'disponibilidad', p.disponibilidad,
    'precio', p.precio, 'marca', m.nombre,
    'ruta_thumb', (select i.ruta_thumb from public.imagenes i where i.producto_id = p.id order by i.orden, i.creado limit 1),
    'codigos', (select coalesce(array_agg(c.codigo order by c.codigo), '{}') from public.codigos c where c.producto_id = p.id))
  from public.productos p left join public.marcas m on m.id = p.marca_id
  where p.id = p_id
$$;

-- Mientras se carga un artículo: ¿ya hay uno con un nombre así?
create or replace function public.posibles_repetidos(p_nombre text, p_excluir uuid default null, p_limite integer default 3)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_nc text := public.nombre_comparable(p_nombre);
  v_nums text[] := public.numeros_nombre(p_nombre);
  v jsonb;
begin
  if char_length(v_nc) < 6 then return '[]'::jsonb; end if;
  -- con el umbral en 0.6, el operador % usa el índice de trigramas (rápido aunque haya miles)
  perform set_config('pg_trgm.similarity_threshold', '0.6', true);
  select coalesce(jsonb_agg(public.ficha_corta(x.id) || jsonb_build_object('parecido', round(x.s::numeric, 2)) order by x.s desc), '[]'::jsonb)
    into v
    from (
      select p.id, extensions.similarity(public.nombre_comparable(p.nombre), v_nc) as s
        from public.productos p
       where public.nombre_comparable(p.nombre) operator(extensions.%) v_nc
         and p.estado <> 'archivado'
         and (p_excluir is null or p.id <> p_excluir)
         and public.numeros_nombre(p.nombre) = v_nums
       order by 2 desc
       limit least(p_limite, 10)
    ) x;
  return v;
end $$;

-- ¿Alguna de estas fotos ya está en otro artículo? (huellas a ≤ 18 bits de 256)
create or replace function public.fotos_parecidas(p_huellas text[], p_excluir uuid default null, p_limite integer default 3)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(public.ficha_corta(x.producto_id) || jsonb_build_object('distancia', x.d) order by x.d), '[]'::jsonb)
  from (
    select i.producto_id, min(public.distancia_huella(i.huella, hs.h)) as d
      from public.imagenes i
      join public.productos p on p.id = i.producto_id and p.estado <> 'archivado'
      cross join (select public.huella_desde_texto(t) as h from unnest(p_huellas) t) hs
     where i.huella is not null and bit_count(i.huella) > 0 and hs.h is not null and bit_count(hs.h) > 0  -- 0 = foto lisa o ilegible
       and (p_excluir is null or i.producto_id <> p_excluir)
       and public.distancia_huella(i.huella, hs.h) <= 18
     group by i.producto_id
     order by 2
     limit least(p_limite, 10)
  ) x
$$;

-- Guarda las huellas de fotos ya subidas: [{"ruta_thumb": "...", "huella": "<64 hex>"}]
create or replace function public.guardar_huellas(p_datos jsonb)
returns integer language sql security invoker set search_path = '' as $$
  with h as (
    update public.imagenes i set huella = coalesce(public.huella_desde_texto(d ->> 'huella'), repeat('0', 256)::bit(256))
      from jsonb_array_elements(p_datos) d
     where i.ruta_thumb = d ->> 'ruta_thumb' and i.huella is null
    returning 1
  )
  select count(*)::integer from h
$$;

create or replace function public.fotos_sin_huella(p_limite integer default 200)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'total', (select count(distinct ruta_thumb) from public.imagenes where huella is null),
    'rutas', coalesce((select jsonb_agg(r) from (select distinct ruta_thumb as r from public.imagenes where huella is null order by 1 limit p_limite) z), '[]'::jsonb))
$$;

-- Pantalla "Posibles repetidos": pares para revisar (foto casi igual o nombre casi igual con los mismos números)
create or replace function public.pares_repetidos(p_limite integer default 60)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v jsonb;
begin
  perform set_config('pg_trgm.similarity_threshold', '0.8', true);
  with vivos as (
    select id, nombre, public.nombre_comparable(nombre) as nc, public.numeros_nombre(nombre) as nums
      from public.productos where estado <> 'archivado'
  ),
  por_nombre as (
    select a.id as a, b.id as b, 'nombre'::text as motivo, extensions.similarity(a.nc, b.nc) as puntaje
      from vivos a join vivos b on a.id < b.id and a.nc operator(extensions.%) b.nc and a.nums = b.nums
  ),
  por_foto as (
    select least(ia.producto_id, ib.producto_id) as a, greatest(ia.producto_id, ib.producto_id) as b, 'foto'::text as motivo,
           1.0 + (18 - min(public.distancia_huella(ia.huella, ib.huella))) / 36.0 as puntaje
      from public.imagenes ia
      join public.imagenes ib on ia.producto_id < ib.producto_id and ia.ruta_thumb <> ib.ruta_thumb
     where ia.huella is not null and ib.huella is not null and bit_count(ia.huella) > 0 and bit_count(ib.huella) > 0
       and public.distancia_huella(ia.huella, ib.huella) <= 18
       and ia.producto_id in (select id from vivos) and ib.producto_id in (select id from vivos)
     group by 1, 2
  ),
  pares as (
    select a, b, array_agg(distinct motivo order by motivo) as motivos, max(puntaje) as puntaje
      from (select * from por_nombre union all select * from por_foto) t
     where not exists (select 1 from public.repetidos_descartados d where d.a = t.a and d.b = t.b)
       -- si comparten la misma foto es porque se usó "Duplicar" a propósito (otro color/modelo)
       and not exists (select 1 from public.imagenes x join public.imagenes y on y.ruta_thumb = x.ruta_thumb
                        where x.producto_id = t.a and y.producto_id = t.b)
     group by a, b
  )
  select jsonb_build_object(
    'total', (select count(*) from pares),
    'pares', coalesce((select jsonb_agg(jsonb_build_object(
                'a', public.ficha_corta(a), 'b', public.ficha_corta(b), 'motivos', motivos, 'puntaje', round(puntaje::numeric, 2))
              order by puntaje desc)
            from (select * from pares order by puntaje desc limit least(p_limite, 200)) z), '[]'::jsonb))
    into v;
  return v;
end $$;

create or replace function public.descartar_repetido(p_a uuid, p_b uuid)
returns void language sql security invoker set search_path = '' as $$
  insert into public.repetidos_descartados (a, b) values (least(p_a, p_b), greatest(p_a, p_b))
  on conflict do nothing
$$;

-- Une dos artículos: queda `p_queda`, se archiva `p_sale`. Todo en una transacción.
create or replace function public.unir_productos(p_queda uuid, p_sale uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  q public.productos;
  s public.productos;
  v_orden smallint;
begin
  if not public.es_staff() then
    raise exception 'Solo el personal puede unir artículos' using errcode = '42501';
  end if;
  if p_queda = p_sale then raise exception 'Elegí dos artículos distintos' using errcode = '22023'; end if;
  select * into q from public.productos where id = p_queda for update;
  select * into s from public.productos where id = p_sale for update;
  if q.id is null or s.id is null then raise exception 'No se encontró uno de los artículos' using errcode = 'P0002'; end if;

  -- códigos: todos pasan al que queda (escanear cualquiera lo encuentra)
  update public.codigos set producto_id = q.id where producto_id = s.id;

  -- fotos: se suman al final, sin repetir archivos
  select coalesce(max(orden), -1) into v_orden from public.imagenes where producto_id = q.id;
  delete from public.imagenes i where i.producto_id = s.id
     and exists (select 1 from public.imagenes x where x.producto_id = q.id and x.ruta_thumb = i.ruta_thumb);
  update public.imagenes i set producto_id = q.id, orden = v_orden + 1 + z.n
    from (select id, (row_number() over (order by orden, creado))::smallint as n from public.imagenes where producto_id = s.id) z
   where i.id = z.id;

  insert into public.producto_etiquetas (producto_id, etiqueta_id)
  select q.id, etiqueta_id from public.producto_etiquetas where producto_id = s.id
  on conflict do nothing;

  -- datos que le falten al que queda, se toman del otro
  update public.productos set
    marca_id         = coalesce(q.marca_id, s.marca_id),
    proveedor_id     = coalesce(q.proveedor_id, s.proveedor_id),
    precio           = coalesce(q.precio, s.precio),
    descripcion      = coalesce(q.descripcion, s.descripcion),
    variantes        = coalesce(q.variantes, s.variantes),
    edad_desde_meses = coalesce(q.edad_desde_meses, s.edad_desde_meses),
    edad_hasta_meses = coalesce(q.edad_hasta_meses, s.edad_hasta_meses)
  where id = q.id;
  insert into public.productos_privado (producto_id, costo)
  select q.id, pp.costo from public.productos_privado pp where pp.producto_id = s.id and pp.costo is not null
  on conflict (producto_id) do update set costo = coalesce(public.productos_privado.costo, excluded.costo);

  update public.productos set estado = 'archivado', unido_a = q.id where id = s.id;
  -- si a este ya lo habían unido otros antes, ahora apuntan al que queda
  update public.productos set unido_a = q.id where unido_a = s.id;

  return jsonb_build_object('sku', q.sku, 'archivado', s.sku);
end $$;

-- Para la web: si piden un artículo que se unió a otro, a dónde redirigir
create or replace function public.redireccion_producto(p_sku text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('sku', q.sku, 'slug', q.slug)
    from public.productos s join public.productos q on q.id = s.unido_a
   where s.sku = upper(p_sku) and s.estado = 'archivado' and q.estado = 'publicado'
$$;

revoke all on function public.posibles_repetidos(text, uuid, integer) from public, anon;
revoke all on function public.fotos_parecidas(text[], uuid, integer) from public, anon;
revoke all on function public.guardar_huellas(jsonb) from public, anon;
revoke all on function public.fotos_sin_huella(integer) from public, anon;
revoke all on function public.pares_repetidos(integer) from public, anon;
revoke all on function public.descartar_repetido(uuid, uuid) from public, anon;
revoke all on function public.unir_productos(uuid, uuid) from public, anon;
revoke all on function public.ficha_corta(uuid) from public, anon;
revoke all on function public.redireccion_producto(text) from public;
grant execute on function public.posibles_repetidos(text, uuid, integer), public.fotos_parecidas(text[], uuid, integer),
  public.guardar_huellas(jsonb), public.fotos_sin_huella(integer), public.pares_repetidos(integer),
  public.descartar_repetido(uuid, uuid), public.unir_productos(uuid, uuid), public.ficha_corta(uuid) to authenticated;
grant execute on function public.redireccion_producto(text) to anon, authenticated;
