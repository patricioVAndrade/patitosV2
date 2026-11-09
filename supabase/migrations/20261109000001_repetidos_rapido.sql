-- Posibles repetidos más rápido: con miles de fotos analizadas, la comparación de todas contra
-- todas superaba el tiempo máximo de una consulta en Supabase y la pantalla quedaba en
-- "Buscando…". Ahora compara solo las fotos que comparten algún tramo de la huella (mismo
-- resultado). También un índice para buscar fotos por archivo.

create index if not exists imagenes_ruta_thumb on public.imagenes (ruta_thumb);

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
  -- Fotos: en vez de comparar todas contra todas (con 2000 fotos son 2 millones de pares y
  -- superaba el tiempo máximo de Supabase), la huella se parte en 19 tramos. Si dos fotos
  -- difieren en 18 bits o menos, al menos un tramo les queda idéntico (no alcanzan los bits
  -- distintos para tocar los 19): solo se comparan las que comparten algún tramo. Mismo
  -- resultado, sin perder ningún par.
  fotos as (
    select i.producto_id, i.ruta_thumb, i.huella
      from public.imagenes i
     where i.huella is not null and bit_count(i.huella) > 0
       and i.producto_id in (select id from vivos)
  ),
  tramos as (
    select f.producto_id, f.ruta_thumb, f.huella, t as tramo,
           substring(f.huella from t * 13 + 1 for case when t = 18 then 22 else 13 end)::text as valor
      from fotos f cross join generate_series(0, 18) as t
  ),
  candidatos as (
    select distinct x.producto_id as a, y.producto_id as b, x.huella as ha, y.huella as hb
      from tramos x
      join tramos y on y.tramo = x.tramo and y.valor = x.valor
                   and x.producto_id < y.producto_id and x.ruta_thumb <> y.ruta_thumb
  ),
  por_foto as (
    select a, b, 'foto'::text as motivo, 1.0 + (18 - min(public.distancia_huella(ha, hb))) / 36.0 as puntaje
      from candidatos
     where public.distancia_huella(ha, hb) <= 18
     group by a, b
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
