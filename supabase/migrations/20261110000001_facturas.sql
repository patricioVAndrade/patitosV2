-- Cargar artículos desde una factura / detalle de pedido del proveedor.
--  · El PDF se lee en el navegador; acá llegan solo los renglones (código, descripción, costo).
--  · analizar_factura: para cada renglón dice si ya lo tenemos (por código), si hay uno con nombre
--    casi igual (para confirmar a mano) o si es nuevo, y sugiere categoría, marca y precio.
--  · cargar_factura: crea los nuevos OCULTOS y sin foto, suma códigos a los existentes y actualiza
--    costos. Todo junto: o se guarda todo, o nada.
--  · facturas_cargadas: registro de lo cargado, para avisar si la misma factura se carga dos veces.

create table public.facturas_cargadas (
  id            bigint generated always as identity primary key,
  proveedor_id  smallint not null references public.proveedores(id),
  numero        text,
  fecha         timestamptz not null default now(),
  usuario_id    uuid default auth.uid() references auth.users(id) on delete set null,
  renglones     integer not null default 0,
  creados       integer not null default 0,
  vinculados    integer not null default 0,
  costos        integer not null default 0,
  total         numeric(14,2)
);
create index facturas_cargadas_numero on public.facturas_cargadas (proveedor_id, numero);
alter table public.facturas_cargadas enable row level security;
revoke all on public.facturas_cargadas from anon;
create policy facturas_staff on public.facturas_cargadas for all to authenticated
  using (public.es_staff()) with check (public.es_staff());

-- "PARAGUAS INFANTIL 65CM TRENDY - 53563" → la marca registrada que aparezca como palabra entera
-- (la más larga, así "PLAY DOH" gana a "PLAY")
create or replace function public.marca_en_nombre(p_nombre text)
returns integer language sql stable security invoker set search_path = '' as $$
  select m.id
    from public.marcas m
   where m.activa
     and char_length(m.nombre) >= 3
     and ' ' || regexp_replace(public.normalizar(p_nombre), '[^a-z0-9]+', ' ', 'g') || ' '
         like '% ' || btrim(regexp_replace(public.normalizar(m.nombre), '[^a-z0-9]+', ' ', 'g')) || ' %'
   order by char_length(m.nombre) desc
   limit 1
$$;

-- p_articulos: [{"codigo": "SBG266465", "descripcion": "ALFOMBRA …", "costo": 12000}, …]
-- security definer (adentro se valida que sea del personal; solo lee, salvo dar de alta el
-- proveedor si no existía): con los permisos por fila
-- de cada tabla, la búsqueda por nombre parecido no puede usar el índice y con 60 renglones
-- tardaba 5 segundos; así tarda décimas.
create or replace function public.analizar_factura(p_proveedor text, p_numero text, p_articulos jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_prov    smallint;
  v_varios  smallint := (select id from public.categorias where slug = 'varios');
  v_a       jsonb;
  v_cod     text;
  v_desc    text;
  v_costo   numeric;
  v_id      uuid;
  v_lista   record;
  v_parecido record;
  v_parecidos jsonb;
  v_cat     smallint;
  v_marca   integer;
  v_items   jsonb := '[]'::jsonb;
  v_previa  jsonb;
begin
  if not public.es_staff() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  select id into v_prov from public.proveedores where public.normalizar(nombre) = public.normalizar(p_proveedor);
  if v_prov is null then
    insert into public.proveedores (nombre) values (btrim(p_proveedor)) returning id into v_prov;
  end if;

  select jsonb_build_object('fecha', f.fecha, 'usuario', coalesce(pe.nombre, pe.email), 'creados', f.creados)
    into v_previa
    from public.facturas_cargadas f left join public.perfiles pe on pe.id = f.usuario_id
   where f.proveedor_id = v_prov and f.numero = nullif(btrim(p_numero), '')
   order by f.fecha desc limit 1;

  for v_a in select * from jsonb_array_elements(coalesce(p_articulos, '[]'::jsonb)) loop
    v_cod := upper(regexp_replace(coalesce(v_a ->> 'codigo', ''), '\s+', '', 'g'));
    v_desc := btrim(coalesce(v_a ->> 'descripcion', ''));
    v_costo := nullif(v_a ->> 'costo', '')::numeric;
    continue when v_cod = '';

    -- 1) ¿Ya lo tenemos? (el código del proveedor quedó guardado al cargarlo)
    select coalesce(
             (select c.producto_id from public.codigos c where c.codigo = v_cod),
             (select p.id from public.productos p where p.sku = v_cod))
      into v_id;
    if v_id is not null then
      v_items := v_items || jsonb_build_object(
        'codigo', v_cod, 'estado', 'existe',
        'producto', public.ficha_corta(v_id) || jsonb_build_object(
          'costo', (select pp.costo from public.productos_privado pp where pp.producto_id = v_id)),
        'precio_sugerido', public.precio_sugerido(v_costo));
      continue;
    end if;

    -- 2) En la lista del proveedor (trae su categoría y marca)
    select l.nombre, l.categoria, l.marca into v_lista
      from public.lista_proveedores l where l.codigo = v_cod
      order by (l.proveedor_id = v_prov) desc, l.actualizado desc limit 1;

    -- 3) Nombre casi igual y con los mismos números: ¿será el mismo cargado sin este código?
    v_parecidos := public.posibles_repetidos(v_desc, null, 2);

    -- Categoría: la de la lista del proveedor; si no, la del artículo más parecido; si no, Varios
    v_cat := (select c.id from public.categorias c where v_lista.categoria is not null
                and public.normalizar(c.nombre) = public.normalizar(v_lista.categoria) limit 1);
    if v_cat is null and char_length(public.nombre_comparable(v_desc)) >= 6 then
      perform set_config('pg_trgm.similarity_threshold', '0.3', true);
      select p.categoria_id into v_cat
        from public.productos p
       where public.nombre_comparable(p.nombre) operator(extensions.%) public.nombre_comparable(v_desc)
         and p.estado <> 'archivado'
       order by extensions.similarity(public.nombre_comparable(p.nombre), public.nombre_comparable(v_desc)) desc
       limit 1;
    end if;

    v_marca := coalesce(
      public.marca_en_nombre(v_desc),
      (select m.id from public.marcas m where v_lista.marca is not null
          and public.normalizar(m.nombre) = public.normalizar(v_lista.marca) limit 1));

    v_items := v_items || jsonb_build_object(
      'codigo', v_cod,
      'estado', case when jsonb_array_length(v_parecidos) > 0 then 'parecido' else 'nuevo' end,
      'parecidos', v_parecidos,
      'en_lista', v_lista.nombre is not null,
      'categoria_id', coalesce(v_cat, v_varios),
      'marca_id', v_marca,
      'precio_sugerido', public.precio_sugerido(v_costo));
  end loop;

  return jsonb_build_object('proveedor_id', v_prov, 'ya_cargada', v_previa, 'items', v_items);
end $$;

-- p_datos: {
--   "proveedor_id": 1, "numero": "123456", "renglones": 62, "total": 1245800.6,
--   "crear":    [{"codigo", "nombre", "categoria_id", "marca_id", "costo", "precio"}],
--   "vincular": [{"producto_id", "codigo", "costo"}],   ← "es este": se le suma el código
--   "costos":   [{"producto_id", "costo", "precio"}]    ← precio opcional
-- }
create or replace function public.cargar_factura(p_datos jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_prov     smallint := (p_datos ->> 'proveedor_id')::smallint;
  v_x        jsonb;
  v_cod      text;
  v_res      jsonb;
  v_creados  jsonb := '[]'::jsonb;
  v_dueno    record;
  v_nv       integer := 0;
  v_nc       integer := 0;
begin
  if not public.es_staff() then
    raise exception 'No tenés permiso para cargar artículos.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.proveedores where id = v_prov) then
    raise exception 'Proveedor desconocido.' using errcode = '22023';
  end if;

  -- Nuevos: ocultos (borrador) hasta que tengan foto y se publiquen
  for v_x in select * from jsonb_array_elements(coalesce(p_datos -> 'crear', '[]'::jsonb)) loop
    v_cod := upper(regexp_replace(coalesce(v_x ->> 'codigo', ''), '\s+', '', 'g'));
    v_res := public.guardar_producto(jsonb_build_object(
      'nombre', btrim(v_x ->> 'nombre'),
      'categoria_id', v_x -> 'categoria_id',
      'marca_id', coalesce(v_x ->> 'marca_id', ''),
      'proveedor_id', v_prov,
      'precio', coalesce(v_x ->> 'precio', ''),
      'costo', coalesce(v_x ->> 'costo', ''),
      'estado', 'borrador',
      'codigos', case when v_cod = '' then '[]'::jsonb
                      else jsonb_build_array(jsonb_build_object('codigo', v_cod, 'tipo', 'proveedor', 'proveedor_id', v_prov)) end));
    v_creados := v_creados || jsonb_build_object('id', v_res -> 'id', 'sku', v_res -> 'sku', 'nombre', btrim(v_x ->> 'nombre'));
  end loop;

  -- "Es este": el artículo ya estaba cargado sin el código del proveedor
  for v_x in select * from jsonb_array_elements(coalesce(p_datos -> 'vincular', '[]'::jsonb)) loop
    v_cod := upper(regexp_replace(coalesce(v_x ->> 'codigo', ''), '\s+', '', 'g'));
    continue when v_cod = '';
    select p.sku, p.nombre into v_dueno
      from public.codigos c join public.productos p on p.id = c.producto_id
     where c.codigo = v_cod and c.producto_id <> (v_x ->> 'producto_id')::uuid;
    if found then
      raise exception 'El código % ya pertenece a "%" (%).', v_cod, v_dueno.nombre, v_dueno.sku using errcode = '23505';
    end if;
    insert into public.codigos (codigo, producto_id, tipo, proveedor_id)
    values (v_cod, (v_x ->> 'producto_id')::uuid, 'proveedor', v_prov)
    on conflict (codigo) do nothing;
    update public.productos set proveedor_id = v_prov
     where id = (v_x ->> 'producto_id')::uuid and proveedor_id is null;
    if nullif(v_x ->> 'costo', '') is not null then
      insert into public.productos_privado (producto_id, costo)
      values ((v_x ->> 'producto_id')::uuid, (v_x ->> 'costo')::numeric)
      on conflict (producto_id) do update set costo = excluded.costo
        where public.productos_privado.costo is distinct from excluded.costo;
    end if;
    v_nv := v_nv + 1;
  end loop;

  -- Costos (y precio, si se pidió) de los que ya teníamos
  for v_x in select * from jsonb_array_elements(coalesce(p_datos -> 'costos', '[]'::jsonb)) loop
    insert into public.productos_privado (producto_id, costo)
    values ((v_x ->> 'producto_id')::uuid, (v_x ->> 'costo')::numeric)
    on conflict (producto_id) do update set costo = excluded.costo
      where public.productos_privado.costo is distinct from excluded.costo;
    if nullif(v_x ->> 'precio', '') is not null then
      update public.productos set precio = (v_x ->> 'precio')::numeric
       where id = (v_x ->> 'producto_id')::uuid and precio is distinct from (v_x ->> 'precio')::numeric;
    end if;
    v_nc := v_nc + 1;
  end loop;

  insert into public.facturas_cargadas (proveedor_id, numero, renglones, creados, vinculados, costos, total)
  values (v_prov, nullif(btrim(p_datos ->> 'numero'), ''), coalesce((p_datos ->> 'renglones')::integer, 0),
          jsonb_array_length(v_creados), v_nv, v_nc, nullif(p_datos ->> 'total', '')::numeric);

  return jsonb_build_object('creados', v_creados, 'vinculados', v_nv, 'costos', v_nc);
end $$;

revoke all on function public.marca_en_nombre(text) from public, anon;
revoke all on function public.analizar_factura(text, text, jsonb) from public, anon;
revoke all on function public.cargar_factura(jsonb) from public, anon;
grant execute on function public.marca_en_nombre(text), public.analizar_factura(text, text, jsonb), public.cargar_factura(jsonb) to authenticated;
