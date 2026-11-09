-- Aumentos (o rebajas) de precio en lote: por marca, proveedor o categoría, en porcentaje.
-- 1) Vista previa: ajustar_precios(..., p_aplicar => false) devuelve cómo quedaría cada artículo.
-- 2) Aplicar: crea el registro en ajustes_precio, guarda el antes/después de cada artículo y
--    actualiza todo en una sola transacción. El trigger de precios lo deja en historial_precios.
-- 3) Deshacer: revertir_ajuste(id) vuelve cada artículo a su precio anterior, salvo los que
--    alguien cambió a mano después del ajuste (esos se respetan y se informan).

create table public.ajustes_detalle (
  ajuste_id        bigint not null references public.ajustes_precio(id) on delete cascade,
  producto_id      uuid   not null references public.productos(id) on delete cascade,
  precio_antes     numeric(12,2),
  precio_nuevo     numeric(12,2),
  anterior_antes   numeric(12,2),   -- precio tachado de las ofertas
  anterior_nuevo   numeric(12,2),
  costo_antes      numeric(12,2),
  costo_nuevo      numeric(12,2),
  primary key (ajuste_id, producto_id)
);
alter table public.ajustes_detalle enable row level security;
revoke all on public.ajustes_detalle from anon;
create policy ajustes_detalle_leer on public.ajustes_detalle for select to authenticated using (public.es_staff());
create policy ajustes_detalle_crear on public.ajustes_detalle for insert to authenticated with check (public.es_staff());

create or replace function public.redondear_precio(p_valor numeric, p_redondeo integer)
returns numeric language sql immutable set search_path = '' as $$
  select case when p_valor is null then null
              when coalesce(p_redondeo, 1) <= 1 then round(p_valor, 2)
              else greatest(p_redondeo, round(p_valor / p_redondeo) * p_redondeo) end
$$;

create or replace function public.ajustar_precios(
  p_criterio      jsonb,             -- {"marca_id": 3} · {"proveedor_id": 1} · {"categoria_id": 2} (se pueden combinar)
  p_porcentaje    numeric,           -- 12 = +12 % · -10 = rebaja del 10 %
  p_redondeo      integer default null,  -- null = el de config (100)
  p_tambien_costo boolean default false,
  p_aplicar       boolean default false
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_marca integer := nullif(p_criterio ->> 'marca_id', '')::integer;
  v_proveedor smallint := nullif(p_criterio ->> 'proveedor_id', '')::smallint;
  v_categoria smallint := nullif(p_criterio ->> 'categoria_id', '')::smallint;
  v_redondeo integer;
  v_factor numeric;
  v_ajuste bigint;
  v_items jsonb;
  v_cantidad integer;
  v_desc text;
begin
  if not public.es_staff() then
    raise exception 'Solo el personal puede cambiar precios' using errcode = '42501';
  end if;
  if v_marca is null and v_proveedor is null and v_categoria is null then
    raise exception 'Elegí una marca, un proveedor o una categoría' using errcode = '22023';
  end if;
  if p_porcentaje is null or p_porcentaje = 0 or p_porcentaje < -90 or p_porcentaje > 300 then
    raise exception 'El porcentaje tiene que estar entre -90 y 300 (y no ser 0)' using errcode = '22023';
  end if;
  v_redondeo := coalesce(p_redondeo, (select valor::integer from public.config where clave = 'redondeo'), 100);
  v_factor := 1 + p_porcentaje / 100;

  drop table if exists _ajuste;
  create temp table _ajuste on commit drop as
  select p.id, p.sku, p.nombre, p.estado,
         p.precio as precio_antes,
         public.redondear_precio(p.precio * v_factor, v_redondeo) as precio_nuevo,
         p.precio_anterior as anterior_antes,
         public.redondear_precio(p.precio_anterior * v_factor, v_redondeo) as anterior_nuevo,
         pp.costo as costo_antes,
         case when p_tambien_costo then round(pp.costo * v_factor, 2) else pp.costo end as costo_nuevo
    from public.productos p
    left join public.productos_privado pp on pp.producto_id = p.id
   where p.estado <> 'archivado'
     and (v_marca is null or p.marca_id = v_marca)
     and (v_proveedor is null or p.proveedor_id = v_proveedor)
     and (v_categoria is null or p.categoria_id = v_categoria)
     and (p.precio is not null or (p_tambien_costo and pp.costo is not null));

  select count(*), coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'sku', sku, 'nombre', nombre, 'estado', estado,
           'precio_antes', precio_antes, 'precio_nuevo', precio_nuevo,
           'costo_antes', costo_antes, 'costo_nuevo', costo_nuevo) order by nombre), '[]')
    into v_cantidad, v_items from _ajuste;

  if not p_aplicar or v_cantidad = 0 then
    return jsonb_build_object('cantidad', v_cantidad, 'redondeo', v_redondeo, 'items', v_items, 'ajuste_id', null);
  end if;

  v_desc := concat_ws(' · ',
    (select nombre from public.marcas where id = v_marca),
    (select nombre from public.proveedores where id = v_proveedor),
    (select nombre from public.categorias where id = v_categoria))
    || ' ' || case when p_porcentaje > 0 then '+' else '' end || trim(to_char(p_porcentaje, 'FM9990.##')) || '%'
    || case when p_tambien_costo then ' (precio y costo)' else '' end;

  insert into public.ajustes_precio (descripcion, criterio, porcentaje, redondeo, cantidad)
  values (v_desc, p_criterio, p_porcentaje, v_redondeo, v_cantidad)
  returning id into v_ajuste;

  insert into public.ajustes_detalle
  select v_ajuste, id, precio_antes, precio_nuevo, anterior_antes, anterior_nuevo, costo_antes, costo_nuevo from _ajuste;

  -- el trigger registrar_precio toma este ajuste_id para el historial de precios
  perform set_config('patitos.ajuste_id', v_ajuste::text, true);
  update public.productos p
     set precio = a.precio_nuevo, precio_anterior = a.anterior_nuevo
    from _ajuste a where a.id = p.id and a.precio_antes is not null;
  if p_tambien_costo then
    update public.productos_privado pp
       set costo = a.costo_nuevo, actualizado = now()
      from _ajuste a where a.id = pp.producto_id and a.costo_antes is not null;
  end if;
  perform set_config('patitos.ajuste_id', '', true);

  return jsonb_build_object('cantidad', v_cantidad, 'redondeo', v_redondeo, 'items', v_items, 'ajuste_id', v_ajuste);
end $$;

create or replace function public.revertir_ajuste(p_ajuste bigint)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_revertidos integer;
  v_respetados integer;
begin
  if not public.es_staff() then
    raise exception 'Solo el personal puede cambiar precios' using errcode = '42501';
  end if;
  if not exists (select 1 from public.ajustes_precio where id = p_ajuste and not revertido) then
    raise exception 'Ese ajuste no existe o ya se deshizo' using errcode = '22023';
  end if;

  perform set_config('patitos.ajuste_id', p_ajuste::text, true);
  -- solo vuelve atrás lo que sigue como lo dejó el ajuste (si alguien lo cambió a mano, se respeta)
  with vueltos as (
    update public.productos p
       set precio = d.precio_antes, precio_anterior = d.anterior_antes
      from public.ajustes_detalle d
     where d.ajuste_id = p_ajuste and d.producto_id = p.id
       and d.precio_antes is not null and p.precio is not distinct from d.precio_nuevo
    returning p.id
  )
  select count(*) into v_revertidos from vueltos;
  update public.productos_privado pp
     set costo = d.costo_antes, actualizado = now()
    from public.ajustes_detalle d
   where d.ajuste_id = p_ajuste and d.producto_id = pp.producto_id
     and d.costo_nuevo is distinct from d.costo_antes and pp.costo is not distinct from d.costo_nuevo;
  perform set_config('patitos.ajuste_id', '', true);

  select count(*) into v_respetados
    from public.ajustes_detalle d join public.productos p on p.id = d.producto_id
   where d.ajuste_id = p_ajuste and d.precio_antes is not null and p.precio is distinct from d.precio_antes;

  update public.ajustes_precio set revertido = true where id = p_ajuste;
  return jsonb_build_object('revertidos', v_revertidos, 'respetados', v_respetados);
end $$;

revoke all on function public.ajustar_precios(jsonb, numeric, integer, boolean, boolean) from public, anon;
revoke all on function public.revertir_ajuste(bigint) from public, anon;
revoke all on function public.redondear_precio(numeric, integer) from public, anon;
grant execute on function public.ajustar_precios(jsonb, numeric, integer, boolean, boolean) to authenticated;
grant execute on function public.revertir_ajuste(bigint) to authenticated;
grant execute on function public.redondear_precio(numeric, integer) to authenticated;
