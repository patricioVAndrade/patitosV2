-- =====================================================================
-- 0002 · FUNCIONES DE APOYO Y TRIGGERS
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permisos (security definer: leen perfiles sin chocar con RLS)
-- ---------------------------------------------------------------------
create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = '' as $$
  select rol from public.perfiles where id = auth.uid() and estado = 'activo'
$$;

create or replace function public.es_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and estado = 'activo')
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and estado = 'activo' and rol = 'admin')
$$;

-- ---------------------------------------------------------------------
-- Alta automática de perfil al entrar por primera vez (Google o email)
-- Los mails listados en config.emails_admin entran directo como admin.
-- ---------------------------------------------------------------------
create or replace function public.al_crear_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_admins jsonb;
  v_es_admin boolean;
begin
  select valor into v_admins from public.config where clave = 'emails_admin';
  v_es_admin := coalesce(v_admins ? lower(new.email), false);
  insert into public.perfiles (id, email, nombre, avatar_url, rol, estado)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    case when v_es_admin then 'admin' else 'empleado' end,
    case when v_es_admin then 'activo' else 'pendiente' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.al_crear_usuario();

-- Nunca quedarse sin un admin activo
create or replace function public.proteger_ultimo_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.rol = 'admin' and old.estado = 'activo'
     and (tg_op = 'DELETE' or new.rol <> 'admin' or new.estado <> 'activo')
     and not exists (select 1 from public.perfiles
                     where rol = 'admin' and estado = 'activo' and id <> old.id) then
    raise exception 'Tiene que quedar al menos un administrador activo.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;

create trigger proteger_ultimo_admin before update or delete on public.perfiles
  for each row execute function public.proteger_ultimo_admin();

-- ---------------------------------------------------------------------
-- Productos: slug, marcas de tiempo
-- ---------------------------------------------------------------------
create or replace function public.productos_antes()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.nombre := regexp_replace(btrim(new.nombre), '\s+', ' ', 'g');
  new.slug := public.slugify(new.nombre);
  if tg_op = 'UPDATE' then
    new.actualizado := now();
    new.actualizado_por := coalesce(auth.uid(), new.actualizado_por);
    new.sku := old.sku;                 -- el SKU no se cambia nunca
    new.creado := old.creado;
    new.creado_por := old.creado_por;
  end if;
  return new;
end $$;

create trigger productos_antes before insert or update on public.productos
  for each row execute function public.productos_antes();

create or replace function public.tocar_actualizado()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado := now();
  return new;
end $$;

create trigger perfiles_tocar before update on public.perfiles
  for each row execute function public.tocar_actualizado();
create trigger privado_tocar before update on public.productos_privado
  for each row execute function public.tocar_actualizado();

create or replace function public.slug_desde_nombre()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.nombre := btrim(new.nombre);
  if new.slug is null or new.slug = '' or (tg_op = 'UPDATE' and new.nombre is distinct from old.nombre) then
    new.slug := public.slugify(new.nombre);
  end if;
  return new;
end $$;

create trigger categorias_slug before insert or update on public.categorias for each row execute function public.slug_desde_nombre();
create trigger marcas_slug     before insert or update on public.marcas     for each row execute function public.slug_desde_nombre();
create trigger etiquetas_slug  before insert or update on public.etiquetas  for each row execute function public.slug_desde_nombre();

-- Códigos siempre en mayúsculas y sin espacios
create or replace function public.codigos_normalizar()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.codigo := upper(btrim(new.codigo));
  return new;
end $$;

create trigger codigos_normalizar before insert or update on public.codigos
  for each row execute function public.codigos_normalizar();
create trigger lista_codigos_normalizar before insert or update on public.lista_proveedores
  for each row execute function public.codigos_normalizar();

-- Si cambia una foto, un código o una etiqueta, el producto queda "actualizado"
create or replace function public.tocar_producto()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.productos set actualizado = now()
  where id = coalesce(new.producto_id, old.producto_id);
  return coalesce(new, old);
end $$;

create trigger imagenes_tocar  after insert or update or delete on public.imagenes           for each row execute function public.tocar_producto();
create trigger codigos_tocar   after insert or update or delete on public.codigos            for each row execute function public.tocar_producto();
create trigger etiquetas_tocar after insert or delete           on public.producto_etiquetas for each row execute function public.tocar_producto();

-- ---------------------------------------------------------------------
-- Historial de precios (cada cambio, venga de donde venga)
-- ---------------------------------------------------------------------
create or replace function public.registrar_precio()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.precio is distinct from old.precio then
    insert into public.historial_precios (producto_id, precio_antes, precio_nuevo, ajuste_id, usuario_id)
    values (new.id, case when tg_op = 'UPDATE' then old.precio end, new.precio,
            nullif(current_setting('patitos.ajuste_id', true), '')::bigint, auth.uid());
  end if;
  return new;
end $$;

create trigger productos_precio after insert or update of precio on public.productos
  for each row execute function public.registrar_precio();

-- ---------------------------------------------------------------------
-- Historial general (auditoría)
-- ---------------------------------------------------------------------
create or replace function public.auditar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_fila jsonb;
  v_ignorar text[] := array['actualizado', 'actualizado_por', 'busqueda', 'slug', 'creado', 'creado_por'];
  v_cambios jsonb := '{}'::jsonb;
  v_usuario text;
  v_producto uuid;
  k text;
begin
  v_fila := coalesce(v_new, v_old);
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if not (k = any (v_ignorar)) and (v_old -> k) is distinct from (v_new -> k) then
        v_cambios := v_cambios || jsonb_build_object(k, jsonb_build_object('antes', v_old -> k, 'ahora', v_new -> k));
      end if;
    end loop;
    if v_cambios = '{}'::jsonb then
      return new;
    end if;
  else
    v_cambios := v_fila - v_ignorar;
  end if;

  select coalesce(nullif(p.nombre, ''), p.email) into v_usuario from public.perfiles p where p.id = auth.uid();
  v_usuario := coalesce(v_usuario, case when auth.uid() is null then 'sistema' else 'desconocido' end);

  v_producto := case
    when tg_table_name = 'productos' then (v_fila ->> 'id')::uuid
    when v_fila ? 'producto_id' then (v_fila ->> 'producto_id')::uuid
  end;

  insert into public.historial (usuario_id, usuario, tabla, registro_id, producto_id, accion, etiqueta, cambios)
  values (
    auth.uid(), v_usuario, tg_table_name,
    coalesce(v_fila ->> 'id', v_fila ->> 'codigo', v_fila ->> 'producto_id'),
    v_producto,
    case tg_op when 'INSERT' then 'alta' when 'UPDATE' then 'edicion' else 'baja' end,
    case tg_table_name
      when 'productos' then (v_fila ->> 'sku') || ' · ' || (v_fila ->> 'nombre')
      when 'codigos' then 'código ' || (v_fila ->> 'codigo')
      when 'imagenes' then 'foto'
      when 'perfiles' then coalesce(v_fila ->> 'email', v_fila ->> 'nombre')
      when 'productos_privado' then 'costo'
      else v_fila ->> 'nombre'
    end,
    v_cambios
  );
  return coalesce(new, old);
end $$;

create trigger auditar after insert or update or delete on public.productos         for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.codigos           for each row execute function public.auditar();
create trigger auditar after insert or delete           on public.imagenes          for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.productos_privado for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.perfiles          for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.categorias        for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.marcas            for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.proveedores       for each row execute function public.auditar();
