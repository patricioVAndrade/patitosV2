-- =====================================================================
-- Pruebas de reglas y permisos. Todo corre en una transacción que se
-- descarta al final (no deja datos). Si algo falla, corta con error.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/permisos.test.sql
-- =====================================================================
begin;

create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLÓ: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

create function pg_temp.como(usuario uuid) returns void language plpgsql as $$
begin
  if usuario is null then
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
  else
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
  end if;
end $$;

-- Espera un error con cierto SQLSTATE al ejecutar una sentencia
create function pg_temp.falla(sentencia text, estado text, msg text) returns void language plpgsql as $$
begin
  execute sentencia;
  raise exception 'FALLÓ: % (no dio error)', msg;
exception when others then
  if sqlstate <> estado and not (estado = 'cualquiera') then
    raise exception 'FALLÓ: % (error % "%", se esperaba %)', msg, sqlstate, sqlerrm, estado;
  end if;
  raise notice 'ok - % (%)', msg, sqlerrm;
end $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(uuid), pg_temp.falla(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------- usuarios
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'Pato08070@gmail.com', '{"full_name": "Pato"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'sofi@gmail.com', '{"full_name": "Sofi Empleada"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'intruso@gmail.com', '{"name": "Intruso"}');

select pg_temp.ok((select rol = 'admin' and estado = 'activo' from perfiles where email = 'pato08070@gmail.com'),
  'el mail de config.emails_admin entra como admin activo (sin importar mayúsculas)');
select pg_temp.ok((select rol = 'empleado' and estado = 'pendiente' and nombre = 'Sofi Empleada' from perfiles where email = 'sofi@gmail.com'),
  'un usuario nuevo de Google queda pendiente, con su nombre de Google');

-- --------------------------------------------------- pendiente no puede nada
select pg_temp.como('00000000-0000-0000-0000-0000000000c1');
select pg_temp.falla($$select guardar_producto('{"nombre":"HACK","categoria_id":1}')$$, '42501', 'un usuario pendiente no puede cargar');
select pg_temp.ok((select count(*) = 0 from productos), 'un usuario pendiente no ve artículos');
update perfiles set estado = 'activo' where email = 'sofi@gmail.com';   -- RLS lo ignora
reset role;
select pg_temp.ok((select estado = 'pendiente' from perfiles where email = 'sofi@gmail.com'), 'sigue pendiente después de intentar autoactivarse');

-- ------------------------------------------------- admin activa a la empleada
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
update perfiles set estado = 'activo' where email = 'sofi@gmail.com';
reset role;
select pg_temp.ok((select estado = 'activo' from perfiles where email = 'sofi@gmail.com'), 'el admin activa a una empleada');

-- --------------------------------------------- empleada: alta completa
select pg_temp.como('00000000-0000-0000-0000-0000000000c1');
create temp table r on commit drop as
select guardar_producto(jsonb_build_object(
  'nombre', '  Pelota  de   Fútbol Nº5 ',
  'categoria_id', (select id from categorias where slug = 'jugueteria'),
  'precio', 15000, 'mostrar_precio', true, 'variantes', ' rojo, azul ',
  'codigos', jsonb_build_array(jsonb_build_object('codigo', ' 7791234567890 ', 'tipo', 'barras'),
                               jsonb_build_object('codigo', 'cor123', 'tipo', 'proveedor')),
  'imagenes', jsonb_build_array(jsonb_build_object('ruta_thumb', '2026-10/a-t.webp', 'ruta_full', '2026-10/a-f.webp'),
                                jsonb_build_object('ruta_thumb', '2026-10/b-t.webp', 'ruta_full', '2026-10/b-f.webp')),
  'costo', 7000)) as res;
grant select on r to anon, authenticated;
select pg_temp.ok((select res ->> 'sku' ~ '^PB-[0-9]{6}$' from r), 'el SKU propio se genera solo (PB-000123)');
select pg_temp.ok((select nombre = 'Pelota de Fútbol Nº5' and slug = 'pelota-de-futbol-n-5' from productos), 'el nombre se limpia y el slug se genera');
select pg_temp.ok((select array_agg(codigo order by codigo) = array['7791234567890', 'COR123'] from codigos), 'los códigos se guardan normalizados');
select pg_temp.ok((select count(*) = 2 from imagenes), 'se guardan las 2 fotos');
select pg_temp.ok((select costo = 7000 from productos_privado), 'una empleada carga el costo');
select pg_temp.ok((select variantes = 'rojo, azul' from productos), 'se guardan los colores/modelos (texto libre)');
select pg_temp.ok((select count(*) = 1 from productos where busqueda like '%azul%'), 'los colores entran en la búsqueda');
select pg_temp.ok((select (buscar_codigo('7791234567890') ->> 'tipo') = 'producto'), 'buscar_codigo encuentra por código de barras');
select pg_temp.ok((select (buscar_codigo(lower(res ->> 'sku')) ->> 'tipo') = 'producto' from r), 'buscar_codigo encuentra por SKU (sin importar mayúsculas)');

-- código repetido en otro artículo
select pg_temp.falla($$select guardar_producto(jsonb_build_object('nombre','OTRO','categoria_id',1,
  'codigos', jsonb_build_array(jsonb_build_object('codigo','7791234567890'))))$$, '23505', 'no se puede repetir un código en otro artículo');
select pg_temp.ok((select count(*) = 1 from productos), 'el artículo con código repetido no quedó a medias (transacción)');

-- edición: saco una foto y un código
create temp table r2 on commit drop as
select guardar_producto(jsonb_build_object('id', (select res ->> 'id' from r), 'precio', 16000,
  'codigos', jsonb_build_array(jsonb_build_object('codigo', '7791234567890')),
  'imagenes', jsonb_build_array(jsonb_build_object('ruta_thumb', '2026-10/b-t.webp', 'ruta_full', '2026-10/b-f.webp')))) as res;
grant select on r2 to anon, authenticated;
select pg_temp.ok((select jsonb_array_length(res -> 'fotos_quitadas') = 2 from r2), 'al quitar una foto devuelve sus 2 archivos para borrarlos');
select pg_temp.ok((select ruta_thumb = '2026-10/b-t.webp' and orden = 0 from imagenes), 'la foto que queda pasa a ser la principal');
select pg_temp.ok((select count(*) = 1 from codigos), 'el código quitado se elimina');
select pg_temp.ok((select count(*) = 2 from historial_precios), 'cada cambio de precio queda en el historial de precios');

-- el SKU no se puede cambiar
update productos set sku = 'PB-999999';
select pg_temp.ok((select sku = (select res ->> 'sku' from r) from productos), 'el SKU no cambia aunque se intente');

-- cambios en lote
select pg_temp.ok((select cambiar_productos(array[(select id from productos)], '{"disponibilidad":"agotado"}') = 1), 'cambio en lote: marcar agotado');
select pg_temp.falla($$select cambiar_productos(array[(select id from productos)], '{"precio":1}')$$, '22023', 'en lote no se puede tocar el precio');

-- borrar: solo admin
delete from productos;
select pg_temp.ok((select count(*) = 1 from productos), 'una empleada no puede borrar definitivamente (la fila sigue)');
select pg_temp.ok((select count(*) = 1 from productos_privado), 'una empleada lee costos');
select pg_temp.ok((select count(*) = 0 from historial), 'una empleada NO ve el historial (logs)');
select pg_temp.ok((select count(*) = 1 from perfiles), 'una empleada solo ve su propio perfil');
select pg_temp.falla($$insert into lista_proveedores (proveedor_id, codigo, nombre) values (1, 'X', 'Y')$$, '42501', 'una empleada no carga listas de proveedores a mano');

-- fotos compartidas: un duplicado usa la misma foto; quitarla de uno NO la borra del storage
create temp table dup on commit drop as
select guardar_producto(jsonb_build_object('nombre', 'PELOTA AZUL', 'categoria_id', 1,
  'imagenes', jsonb_build_array(jsonb_build_object('ruta_thumb', '2026-10/b-t.webp', 'ruta_full', '2026-10/b-f.webp')))) as res;
grant select on dup to anon, authenticated;
select pg_temp.ok((select jsonb_array_length(res -> 'fotos_quitadas') = 0 from (
  select guardar_producto(jsonb_build_object('id', (select res ->> 'id' from dup), 'imagenes', '[]'::jsonb)) as res) x),
  'quitar una foto que usa otro artículo no la manda a borrar');
select pg_temp.ok((select fotos_sin_uso(array['2026-10/b-t.webp', 'no-existe.webp']) = array['no-existe.webp']), 'fotos_sin_uso solo devuelve archivos que nadie usa');
update productos set estado = 'archivado' where id = (select (res ->> 'id')::uuid from dup);   -- que no moleste en las pruebas públicas
reset role;

-- ---------------------------------------------------------- admin y costos
insert into lista_proveedores (proveedor_id, codigo, nombre, categoria, costo)
values ((select id from proveedores where nombre = 'Coronel'), 'wil225199', 'BILLETERA NAUTICA WILSON', 'Marroquineria', 2349),
       ((select id from proveedores where nombre = 'Coronel'), 'X1', 'MOCHILA STITCH', 'Marroquineria', 1);

select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select guardar_producto(jsonb_build_object('id', (select res ->> 'id' from r), 'costo', 7500));
select pg_temp.ok((select costo = 7500 from productos_privado where producto_id = (select (res ->> 'id')::uuid from r)), 'el admin cambia costos');
select pg_temp.ok((select count(*) > 0 from historial where tabla = 'productos'), 'el admin ve el historial');
select pg_temp.ok((select usuario = 'Sofi Empleada' from historial where tabla = 'productos' and accion = 'alta' order by id limit 1), 'el historial guarda quién lo hizo');
select pg_temp.ok((select count(*) > 0 from historial where tabla = 'productos_privado'), 'el historial registra los cambios de costo');
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000000c1');
select pg_temp.ok((select (buscar_codigo('WIL225199') -> 'item' ->> 'costo')::numeric = 2349), 'una empleada ve el costo del proveedor al escanear');
select pg_temp.ok((select (buscar_codigo('WIL225199') -> 'item' ->> 'precio_sugerido')::numeric = 4700), 'código de proveedor: precio sugerido = costo×2 redondeado (2349 → 4700)');
select pg_temp.ok((select precio_sugerido is null from buscar_en_listas('mochila stitch')), 'costo de relleno (1) no sugiere precio');
select pg_temp.ok((select count(*) = 1 from buscar_en_listas('billetera nautica')), 'buscar_en_listas busca por palabras sin importar orden ni tildes');
reset role;

-- -------------------------------------------------------------- público
select pg_temp.como(null);
select pg_temp.ok((select count(*) = 1 from v_catalogo), 'el público ve los artículos publicados');
select pg_temp.ok((select precio = 16000 from v_catalogo), 'el precio se muestra si está marcado "mostrar precio"');
select pg_temp.falla($$select * from productos$$, '42501', 'el público no puede leer la tabla de productos');
select pg_temp.falla($$select * from productos_privado$$, '42501', 'el público no puede leer costos');
select pg_temp.falla($$select * from historial$$, '42501', 'el público no puede leer el historial');
select pg_temp.falla($$select buscar_codigo('X')$$, '42501', 'el público no puede usar buscar_codigo');
select pg_temp.falla($$insert into productos (nombre, categoria_id) values ('HACK', 1)$$, '42501', 'el público no puede cargar');
select pg_temp.ok((select jsonb_array_length(imagenes) = 1 from v_producto), 'la ficha pública trae las fotos');
reset role;

update productos set estado = 'archivado';
select pg_temp.como(null);
select pg_temp.ok((select count(*) = 0 from v_catalogo), 'un artículo archivado desaparece del catálogo');
select pg_temp.ok((select cantidad = 0 from v_categorias where slug = 'jugueteria'), 'el menú de categorías cuenta solo publicados');
reset role;

-- ------------------------------------------------------- último admin
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select pg_temp.falla($$update perfiles set rol = 'empleado' where email = 'pato08070@gmail.com'$$, 'P0001', 'no se puede quitar el último admin');
reset role;

-- ---------------------------------------------------------- borrado admin
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
delete from productos;
select pg_temp.ok((select count(*) = 0 from productos), 'el admin sí puede borrar');
reset role;
select pg_temp.ok((select count(*) >= 1 from historial where accion = 'baja' and tabla = 'productos'), 'el borrado queda registrado en el historial');

rollback;
\echo '✔ Todas las pruebas de permisos pasaron'
