-- =====================================================================
-- 0004 · FUNCIONES DE NEGOCIO (RPC)
-- Las operaciones que tocan varias tablas van en una sola función:
-- o se guarda todo, o no se guarda nada (transacción).
-- =====================================================================

-- Precio sugerido a partir de un costo, según config (margen y redondeo)
create or replace function public.precio_sugerido(p_costo numeric)
returns numeric language sql stable security definer set search_path = '' as $$
  select case
    when p_costo is null or p_costo < coalesce((select (valor)::numeric from public.config where clave = 'costo_minimo'), 100) then null
    else round(p_costo * coalesce((select (valor)::numeric from public.config where clave = 'margen'), 2)
               / coalesce((select (valor)::numeric from public.config where clave = 'redondeo'), 100))
         * coalesce((select (valor)::numeric from public.config where clave = 'redondeo'), 100)
  end
$$;

-- ---------------------------------------------------------------------
-- Buscar un código escaneado: ¿es un artículo nuestro? ¿está en alguna
-- lista de proveedor? Devuelve lo necesario para decidir qué mostrar.
-- ---------------------------------------------------------------------
create or replace function public.buscar_codigo(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_cod text := upper(btrim(p_codigo));
  v_id uuid;
  v_res jsonb;
begin
  if not public.es_staff() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if v_cod is null or v_cod = '' then
    return jsonb_build_object('tipo', 'nada');
  end if;

  select id into v_id from public.productos where sku = v_cod;
  if v_id is null then
    select producto_id into v_id from public.codigos where codigo = v_cod;
  end if;
  if v_id is not null then
    select jsonb_build_object('tipo', 'producto', 'producto_id', v_id) into v_res;
    return v_res;
  end if;

  select jsonb_build_object(
           'tipo', 'lista',
           'item', jsonb_build_object(
             'codigo', l.codigo, 'nombre', l.nombre, 'categoria', l.categoria, 'marca', l.marca,
             'proveedor_id', l.proveedor_id, 'proveedor', pr.nombre,
             'precio_sugerido', public.precio_sugerido(l.costo)))
    into v_res
  from public.lista_proveedores l
  join public.proveedores pr on pr.id = l.proveedor_id
  where l.codigo = v_cod
  order by l.actualizado desc
  limit 1;

  return coalesce(v_res, jsonb_build_object('tipo', 'nada', 'codigo', v_cod));
end $$;

-- ---------------------------------------------------------------------
-- Autocompletar desde las listas de proveedores (sin mostrar costos)
-- ---------------------------------------------------------------------
create or replace function public.buscar_en_listas(p_texto text, p_limite int default 8)
returns table (codigo text, nombre text, categoria text, marca text, proveedor_id smallint, proveedor text, precio_sugerido numeric, ya_cargado boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_patrones text[];
begin
  if not public.es_staff() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  select array_agg('%' || w || '%') into v_patrones
  from regexp_split_to_table(public.normalizar(p_texto), '\s+') w
  where length(w) >= 2;
  if v_patrones is null then
    return;
  end if;
  return query
    select l.codigo, l.nombre, l.categoria, l.marca, l.proveedor_id, pr.nombre,
           public.precio_sugerido(l.costo),
           exists (select 1 from public.codigos c where c.codigo = l.codigo)
    from public.lista_proveedores l
    join public.proveedores pr on pr.id = l.proveedor_id
    where l.busqueda like all (v_patrones)
    order by length(l.nombre)
    limit least(greatest(p_limite, 1), 30);
end $$;

-- ---------------------------------------------------------------------
-- Guardar un artículo completo (alta o edición) en una sola transacción:
-- datos + códigos + fotos + etiquetas + costo (si es admin).
-- Corre con los permisos del usuario (security invoker): RLS aplica.
-- Devuelve el id, el SKU y las fotos que se quitaron (para borrarlas del storage).
-- ---------------------------------------------------------------------
create or replace function public.guardar_producto(datos jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_id      uuid := nullif(datos ->> 'id', '')::uuid;
  v_prod    public.productos;
  v_item    jsonb;
  v_codigo  text;
  v_dueno   record;
  v_lista   text[] := '{}';
  v_orden   smallint := 0;
  v_quitadas jsonb := '[]'::jsonb;
begin
  if not public.es_staff() then
    raise exception 'No tenés permiso para cargar artículos.' using errcode = '42501';
  end if;

  if v_id is null then
    insert into public.productos (
      nombre, descripcion, categoria_id, marca_id, proveedor_id, precio, precio_anterior,
      mostrar_precio, en_oferta, estado, disponibilidad, nuevo_hasta, edad_desde_meses, edad_hasta_meses)
    values (
      datos ->> 'nombre',
      nullif(btrim(datos ->> 'descripcion'), ''),
      (datos ->> 'categoria_id')::smallint,
      nullif(datos ->> 'marca_id', '')::integer,
      nullif(datos ->> 'proveedor_id', '')::smallint,
      nullif(datos ->> 'precio', '')::numeric,
      nullif(datos ->> 'precio_anterior', '')::numeric,
      coalesce((datos ->> 'mostrar_precio')::boolean, false),
      coalesce((datos ->> 'en_oferta')::boolean, false),
      coalesce(datos ->> 'estado', 'publicado'),
      coalesce(datos ->> 'disponibilidad', 'disponible'),
      case when datos ? 'nuevo_hasta' then nullif(datos ->> 'nuevo_hasta', '')::date else current_date + 30 end,
      nullif(datos ->> 'edad_desde_meses', '')::smallint,
      nullif(datos ->> 'edad_hasta_meses', '')::smallint)
    returning * into v_prod;
  else
    update public.productos p set
      nombre           = case when datos ? 'nombre'           then datos ->> 'nombre' else p.nombre end,
      descripcion      = case when datos ? 'descripcion'      then nullif(btrim(datos ->> 'descripcion'), '') else p.descripcion end,
      categoria_id     = case when datos ? 'categoria_id'     then (datos ->> 'categoria_id')::smallint else p.categoria_id end,
      marca_id         = case when datos ? 'marca_id'         then nullif(datos ->> 'marca_id', '')::integer else p.marca_id end,
      proveedor_id     = case when datos ? 'proveedor_id'     then nullif(datos ->> 'proveedor_id', '')::smallint else p.proveedor_id end,
      precio           = case when datos ? 'precio'           then nullif(datos ->> 'precio', '')::numeric else p.precio end,
      precio_anterior  = case when datos ? 'precio_anterior'  then nullif(datos ->> 'precio_anterior', '')::numeric else p.precio_anterior end,
      mostrar_precio   = case when datos ? 'mostrar_precio'   then (datos ->> 'mostrar_precio')::boolean else p.mostrar_precio end,
      en_oferta        = case when datos ? 'en_oferta'        then (datos ->> 'en_oferta')::boolean else p.en_oferta end,
      estado           = case when datos ? 'estado'           then datos ->> 'estado' else p.estado end,
      disponibilidad   = case when datos ? 'disponibilidad'   then datos ->> 'disponibilidad' else p.disponibilidad end,
      nuevo_hasta      = case when datos ? 'nuevo_hasta'      then nullif(datos ->> 'nuevo_hasta', '')::date else p.nuevo_hasta end,
      edad_desde_meses = case when datos ? 'edad_desde_meses' then nullif(datos ->> 'edad_desde_meses', '')::smallint else p.edad_desde_meses end,
      edad_hasta_meses = case when datos ? 'edad_hasta_meses' then nullif(datos ->> 'edad_hasta_meses', '')::smallint else p.edad_hasta_meses end
    where p.id = v_id
    returning * into v_prod;
    if v_prod.id is null then
      raise exception 'El artículo no existe o no tenés permiso.' using errcode = 'P0002';
    end if;
  end if;

  -- Códigos: la lista enviada reemplaza a la anterior
  if datos ? 'codigos' then
    for v_item in select * from jsonb_array_elements(datos -> 'codigos') loop
      v_codigo := upper(btrim(v_item ->> 'codigo'));
      continue when v_codigo is null or v_codigo = '' or v_codigo = v_prod.sku;
      select p.sku, p.nombre into v_dueno
      from public.codigos c join public.productos p on p.id = c.producto_id
      where c.codigo = v_codigo and c.producto_id <> v_prod.id;
      if found then
        raise exception 'El código % ya pertenece a "%" (%).', v_codigo, v_dueno.nombre, v_dueno.sku using errcode = '23505';
      end if;
      if exists (select 1 from public.productos where sku = v_codigo and id <> v_prod.id) then
        raise exception 'El código % es el SKU de otro artículo.', v_codigo using errcode = '23505';
      end if;
      insert into public.codigos (codigo, producto_id, tipo, proveedor_id)
      values (v_codigo, v_prod.id, coalesce(v_item ->> 'tipo', 'barras'), nullif(v_item ->> 'proveedor_id', '')::smallint)
      on conflict (codigo) do update
        set tipo = excluded.tipo, proveedor_id = excluded.proveedor_id
        where public.codigos.tipo is distinct from excluded.tipo
           or public.codigos.proveedor_id is distinct from excluded.proveedor_id;
      v_lista := v_lista || v_codigo;
    end loop;
    delete from public.codigos where producto_id = v_prod.id and not (codigo = any (v_lista));
  end if;

  -- Fotos: el orden de la lista es el orden en la web (la primera es la principal)
  if datos ? 'imagenes' then
    v_lista := '{}';
    for v_item in select * from jsonb_array_elements(datos -> 'imagenes') loop
      v_lista := v_lista || (v_item ->> 'ruta_thumb');
      insert into public.imagenes (producto_id, ruta_thumb, ruta_full, orden, ancho, alto)
      values (v_prod.id, v_item ->> 'ruta_thumb', v_item ->> 'ruta_full', v_orden,
              nullif(v_item ->> 'ancho', '')::smallint, nullif(v_item ->> 'alto', '')::smallint)
      on conflict (producto_id, ruta_thumb) do update set orden = excluded.orden
        where public.imagenes.orden <> excluded.orden;
      v_orden := v_orden + 1;
    end loop;
    with borradas as (
      delete from public.imagenes
      where producto_id = v_prod.id and not (ruta_thumb = any (v_lista))
      returning ruta_thumb, ruta_full
    )
    select coalesce(jsonb_agg(r), '[]'::jsonb) into v_quitadas
    from (select ruta_thumb as r from borradas union all select ruta_full from borradas) x;
  end if;

  -- Etiquetas
  if datos ? 'etiquetas' then
    delete from public.producto_etiquetas pe
    where pe.producto_id = v_prod.id
      and not (pe.etiqueta_id = any (array(select (jsonb_array_elements_text(datos -> 'etiquetas'))::integer)));
    insert into public.producto_etiquetas (producto_id, etiqueta_id)
    select v_prod.id, (e)::integer from jsonb_array_elements_text(datos -> 'etiquetas') e
    on conflict do nothing;
  end if;

  -- Costo (solo admin; para el resto se ignora en silencio)
  if datos ? 'costo' and public.es_admin() then
    insert into public.productos_privado (producto_id, costo)
    values (v_prod.id, nullif(datos ->> 'costo', '')::numeric)
    on conflict (producto_id) do update set costo = excluded.costo
      where public.productos_privado.costo is distinct from excluded.costo;
  end if;

  return jsonb_build_object('id', v_prod.id, 'sku', v_prod.sku, 'fotos_quitadas', v_quitadas);
end $$;

-- ---------------------------------------------------------------------
-- Cambios rápidos en lote (ocultar, agotar, cambiar categoría/marca)
-- ---------------------------------------------------------------------
create or replace function public.cambiar_productos(p_ids uuid[], p_cambios jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_permitidos text[] := array['estado', 'disponibilidad', 'categoria_id', 'marca_id', 'en_oferta', 'mostrar_precio'];
  k text;
  v_n integer;
begin
  if not public.es_staff() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  for k in select jsonb_object_keys(p_cambios) loop
    if not (k = any (v_permitidos)) then
      raise exception 'Campo no permitido en cambios en lote: %', k using errcode = '22023';
    end if;
  end loop;
  update public.productos p set
    estado         = coalesce(p_cambios ->> 'estado', p.estado),
    disponibilidad = coalesce(p_cambios ->> 'disponibilidad', p.disponibilidad),
    categoria_id   = coalesce((p_cambios ->> 'categoria_id')::smallint, p.categoria_id),
    marca_id       = case when p_cambios ? 'marca_id' then nullif(p_cambios ->> 'marca_id', '')::integer else p.marca_id end,
    en_oferta      = coalesce((p_cambios ->> 'en_oferta')::boolean, p.en_oferta),
    mostrar_precio = coalesce((p_cambios ->> 'mostrar_precio')::boolean, p.mostrar_precio)
  where p.id = any (p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- Resumen para la pantalla de inicio del panel
-- ---------------------------------------------------------------------
create or replace function public.resumen_panel()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'publicados', count(*) filter (where estado = 'publicado'),
    'borradores', count(*) filter (where estado = 'borrador'),
    'archivados', count(*) filter (where estado = 'archivado'),
    'agotados',   count(*) filter (where estado = 'publicado' and disponibilidad = 'agotado'),
    'sin_foto',   count(*) filter (where estado = 'publicado' and not exists (select 1 from public.imagenes i where i.producto_id = p.id)),
    'sin_marca',  count(*) filter (where estado = 'publicado' and marca_id is null),
    'hoy',        count(*) filter (where creado >= date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires')
  )
  from public.productos p
$$;

-- Permisos de ejecución: solo usuarios logueados (y adentro se valida el rol)
revoke all on function public.precio_sugerido(numeric)          from public, anon;
revoke all on function public.buscar_codigo(text)               from public, anon;
revoke all on function public.buscar_en_listas(text, int)       from public, anon;
revoke all on function public.guardar_producto(jsonb)           from public, anon;
revoke all on function public.cambiar_productos(uuid[], jsonb)  from public, anon;
revoke all on function public.resumen_panel()                   from public, anon;
grant execute on function public.precio_sugerido(numeric), public.buscar_codigo(text), public.buscar_en_listas(text, int),
  public.guardar_producto(jsonb), public.cambiar_productos(uuid[], jsonb), public.resumen_panel() to authenticated;

-- ---------------------------------------------------------------------
-- Uso interno (script de migración): deja el contador de SKU después del mayor existente
-- ---------------------------------------------------------------------
create or replace function public.ajustar_secuencia_sku()
returns bigint language sql security definer set search_path = '' as $$
  select case when m is null then setval('public.sku_seq', 1, false) else setval('public.sku_seq', m, true) end
  from (select max(substring(sku from 4)::bigint) as m from public.productos where sku ~ '^PB-[0-9]+$') x
$$;
revoke all on function public.ajustar_secuencia_sku() from public, anon, authenticated;
grant execute on function public.ajustar_secuencia_sku() to service_role;
