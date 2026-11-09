-- Búsqueda del catálogo que perdona errores de tipeo.
--   "spidermna" → spiderman · "pelpta" → pelota · "spider man" → spiderman · "capivara" → capibara
-- Cada palabra buscada se compara con el vocabulario del propio catálogo (pg_trgm) y se suman
-- las palabras parecidas. Primero salen los artículos que coinciden tal cual y después los
-- "parecidos". Si nada coincide tal cual, devuelve la búsqueda corregida para mostrarla.
-- También busca por la marca (antes solo por nombre, código y descripción).

create or replace function public.buscar_catalogo(
  p_q          text    default null,
  p_categoria  text    default null,
  p_marca      text    default null,
  p_filtro     text    default null,
  p_desde      integer default 0,
  p_cantidad   integer default 24
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_palabras text[];
  v_compacta text;
  v_resultado jsonb;
begin
  p_cantidad := least(greatest(coalesce(p_cantidad, 24), 1), 100);
  p_desde := greatest(coalesce(p_desde, 0), 0);
  -- palabras sin repetir, en el orden en que se escribieron
  select coalesce(array_agg(w order by primera), '{}') into v_palabras
    from (select w, min(n) as primera
            from unnest(regexp_split_to_array(public.normalizar(coalesce(left(p_q, 80), '')), '[\s,;]+')) with ordinality as t(w, n)
           where w <> '' group by w) x;
  v_compacta := array_to_string(v_palabras, '');

  with base as (
    select v.*, v.busqueda || ' ' || coalesce(public.normalizar(v.marca), '') as texto
      from public.v_catalogo v
     where (p_categoria is null or v.categoria_slug = p_categoria)
       and (p_marca is null or v.marca_slug = p_marca)
       and (p_filtro is null or (p_filtro = 'ofertas' and v.en_oferta) or (p_filtro = 'nuevos' and v.es_nuevo))
  ),
  vocabulario as (
    select distinct t.palabra
      from base b, regexp_split_to_table(b.texto, '[^a-z0-9ñ]+') t(palabra)
     where length(t.palabra) >= 3
  ),
  -- para cada palabra buscada: ella misma + hasta 3 palabras del catálogo que se le parecen
  alternativas as (
    select w as palabra, w as alternativa, 1.0::real as parecido from unnest(v_palabras) w
    union all
    select w, x.palabra, x.sim
      from unnest(v_palabras) w
      cross join lateral (
        select voc.palabra, extensions.similarity(w, voc.palabra) as sim
          from vocabulario voc
         where length(w) >= 4 and voc.palabra <> w and extensions.similarity(w, voc.palabra) >= 0.4
         order by 2 desc limit 3
      ) x
  ),
  puntuados as (
    select b.*,
           (v_compacta <> '' and array_length(v_palabras, 1) > 1
             and replace(b.texto, ' ', '') like '%' || v_compacta || '%') as junto,
           (select bool_and(b.texto like '%' || w || '%') from unnest(v_palabras) w) as exacto,
           (select sum(m.mejor) from (
              select max(a.parecido) as mejor from alternativas a
               where b.texto like '%' || a.alternativa || '%'
               group by a.palabra) m) as puntos,
           (select count(distinct a.palabra) from alternativas a where b.texto like '%' || a.alternativa || '%') as palabras_ok
      from base b
  ),
  filtrados as (
    select * from puntuados
     where cardinality(v_palabras) = 0 or junto or palabras_ok = cardinality(v_palabras)
  ),
  ordenados as (
    select f.*, row_number() over (
             order by agotado,
                      (junto or coalesce(exacto, true)) desc,
                      case when cardinality(v_palabras) > 0 then puntos end desc nulls last,
                      es_nuevo desc, actualizado desc, id) as ord
      from filtrados f
  ),
  pagina as (
    select * from ordenados where ord > p_desde and ord <= p_desde + p_cantidad
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrados),
    'exactos', (select count(*) from filtrados where junto or coalesce(exacto, true)),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'sku', sku, 'slug', slug, 'nombre', nombre, 'categoria', categoria, 'categoria_slug', categoria_slug,
        'marca', marca, 'marca_slug', marca_slug, 'precio', precio, 'precio_anterior', precio_anterior,
        'en_oferta', en_oferta, 'es_nuevo', es_nuevo, 'disponibilidad', disponibilidad, 'agotado', agotado,
        'edad_desde_meses', edad_desde_meses, 'edad_hasta_meses', edad_hasta_meses,
        'ruta_thumb', ruta_thumb, 'ruta_full', ruta_full, 'actualizado', actualizado, 'creado', creado, 'busqueda', busqueda
      ) order by ord) from pagina), '[]'::jsonb),
    -- búsqueda corregida: la mejor alternativa de cada palabra (solo si cambia algo)
    'corregida', (
      select nullif(string_agg(m.alt, ' ' order by array_position(v_palabras, m.palabra)), array_to_string(v_palabras, ' '))
        from (select distinct on (a.palabra) a.palabra, a.alternativa as alt
                from alternativas a
               where exists (select 1 from filtrados f where f.texto like '%' || a.alternativa || '%')
               order by a.palabra, a.parecido desc) m)
  ) into v_resultado;
  return v_resultado;
end $$;

revoke all on function public.buscar_catalogo(text, text, text, text, integer, integer) from public;
grant execute on function public.buscar_catalogo(text, text, text, text, integer, integer) to anon, authenticated;
