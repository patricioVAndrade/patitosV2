-- =====================================================================
-- Pruebas de "Cargar desde factura": analizar_factura y cargar_factura.
-- Corre en una transacción que se descarta al final.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/facturas.test.sql
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
create function pg_temp.falla(sentencia text, estado text, msg text) returns void language plpgsql as $$
begin
  execute sentencia;
  raise exception 'FALLÓ: % (no dio error)', msg;
exception when others then
  if sqlstate <> estado then
    raise exception 'FALLÓ: % (error % "%", se esperaba %)', msg, sqlstate, sqlerrm, estado;
  end if;
  raise notice 'ok - % (%)', msg, sqlerrm;
end $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(uuid), pg_temp.falla(text, text, text) to anon, authenticated;

-- ------------------------------------------------------------- datos
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000f001', 'empleada.facturas@x.com', '{"full_name": "Empleada Facturas"}'),
  ('00000000-0000-0000-0000-00000000f002', 'pendiente.facturas@x.com', '{"full_name": "Pendiente"}');
update perfiles set estado = 'activo' where id = '00000000-0000-0000-0000-00000000f001';
insert into proveedores (nombre) values ('Coronel') on conflict do nothing;
insert into marcas (nombre, slug) values ('MARCAFACT', 'marcafact'), ('ZZTOYS', 'zztoys'), ('ZZTOYS KIDS', 'zztoys-kids');
insert into lista_proveedores (proveedor_id, codigo, nombre, categoria, marca, costo)
select id, 'FAC900003', 'MOCHILA ESCOLAR FACTPRUEBA 16″', 'Mochilas y bolsos', 'MARCAFACT', 9000 from proveedores where nombre = 'Coronel';

select pg_temp.como('00000000-0000-0000-0000-00000000f001');
create temp table p on commit drop as
select x.clave, (guardar_producto(jsonb_build_object(
          'nombre', x.nombre, 'categoria_id', (select id from categorias where slug = x.cat),
          'precio', x.precio, 'costo', x.costo, 'estado', 'publicado',
          'codigos', jsonb_build_array(jsonb_build_object('codigo', x.codigo, 'tipo', 'legado')))) ->> 'id')::uuid as id
  from (values
    ('existe',  'PELOTA FACTPRUEBA NRO 5 - 1234',           'jugueteria', 10000, 5000, 'FAC900001'),
    ('sincod',  'BALDE FACTPRUEBA PLAYERO 30CM CON PALA',   'verano',     8000,  4000, 'FACVIEJO1')
  ) as x(clave, nombre, cat, precio, costo, codigo);
grant select on p to anon, authenticated;
reset role;
create function pg_temp.id(c text) returns uuid language sql as $$ select id from p where clave = c $$;

-- --------------------------------------------------- marca en el nombre
select pg_temp.ok(marca_en_nombre('PARAGUAS INFANTIL 65CM ZZTOYS - 53563') = (select id from marcas where slug = 'zztoys'), 'marca por palabra entera');
select pg_temp.ok(marca_en_nombre('PARAGUAS ZZTOYS KIDS 65CM') = (select id from marcas where slug = 'zztoys-kids'), 'gana la marca más larga');
select pg_temp.ok(marca_en_nombre('PARAGUAS ZZTOYSKIDS 65CM') is null, 'no toma pedazos de palabra');

-- --------------------------------------------------- analizar
select pg_temp.como('00000000-0000-0000-0000-00000000f001');
create temp table a on commit drop as
select analizar_factura('coronel', 'F-1', '[
  {"codigo": "fac900001", "descripcion": "PELOTA FACTPRUEBA NRO 5 - 1234", "costo": 5500},
  {"codigo": "FAC900002", "descripcion": "BALDE FACTPRUEBA PLAYERO 30CM CON PALA - 777", "costo": 4100},
  {"codigo": "FAC900003", "descripcion": "MOCHILA ESCOLAR FACTPRUEBA 16″ - 88", "costo": 9100},
  {"codigo": "FAC900004", "descripcion": "PARAGUAS FACTPRUEBA ZZTOYS 70CM - 30886", "costo": 5398},
  {"codigo": "FAC900005", "descripcion": "BALDE FACTPRUEBA PLAYERO 40CM CON PALA - 778", "costo": 50}
]'::jsonb) as r;
grant select on a to authenticated;
create function pg_temp.item(c text) returns jsonb language sql as $$
  select i from a, jsonb_array_elements(a.r -> 'items') i where i ->> 'codigo' = c $$;
grant execute on function pg_temp.item(text) to authenticated;

select pg_temp.ok((select r ->> 'proveedor_id' from a)::smallint = (select id from proveedores where nombre = 'Coronel'), 'reconoce el proveedor sin importar mayúsculas');
select pg_temp.ok((select r -> 'ya_cargada' from a) = 'null'::jsonb, 'factura nueva: no avisa');
select pg_temp.ok(pg_temp.item('FAC900001') ->> 'estado' = 'existe', 'por código (en minúsculas): ya existe');
select pg_temp.ok((pg_temp.item('FAC900001') -> 'producto' ->> 'costo')::numeric = 5000, 'trae el costo actual');
select pg_temp.ok((pg_temp.item('FAC900001') ->> 'precio_sugerido')::numeric = 11000, 'y el precio sugerido con el costo nuevo');
select pg_temp.ok(pg_temp.item('FAC900002') ->> 'estado' = 'parecido', 'nombre casi igual sin el código: para confirmar');
select pg_temp.ok(pg_temp.item('FAC900002') -> 'parecidos' -> 0 ->> 'id' = pg_temp.id('sincod')::text, 'muestra cuál es el parecido');
select pg_temp.ok(pg_temp.item('FAC900005') ->> 'estado' = 'nuevo', 'otros números (40cm vs 30cm): es nuevo');
select pg_temp.ok((pg_temp.item('FAC900005') ->> 'categoria_id')::smallint = (select id from categorias where slug = 'verano'), 'categoría del artículo más parecido');
select pg_temp.ok(pg_temp.item('FAC900005') -> 'precio_sugerido' = 'null'::jsonb, 'costo de relleno: sin precio sugerido');
select pg_temp.ok(pg_temp.item('FAC900003') ->> 'estado' = 'nuevo' and (pg_temp.item('FAC900003') ->> 'en_lista')::boolean, 'nuevo que está en la lista del proveedor');
select pg_temp.ok((pg_temp.item('FAC900003') ->> 'categoria_id')::smallint = (select id from categorias where slug = 'mochilas-y-bolsos'), 'categoría de la lista del proveedor');
select pg_temp.ok((pg_temp.item('FAC900003') ->> 'marca_id')::integer = (select id from marcas where slug = 'marcafact'), 'marca de la lista del proveedor');
select pg_temp.ok((pg_temp.item('FAC900004') ->> 'marca_id')::integer = (select id from marcas where slug = 'zztoys'), 'marca encontrada en el nombre');
select pg_temp.ok((pg_temp.item('FAC900004') ->> 'categoria_id')::smallint = (select id from categorias where slug = 'varios'), 'sin pistas: Varios');
select pg_temp.ok((pg_temp.item('FAC900004') ->> 'precio_sugerido')::numeric = 10800, 'precio sugerido = costo × margen redondeado');

-- --------------------------------------------------- cargar
create temp table c on commit drop as
select cargar_factura(jsonb_build_object(
  'proveedor_id', (select id from proveedores where nombre = 'Coronel'), 'numero', 'F-1', 'renglones', 5, 'total', 123456.5,
  'crear', jsonb_build_array(
    jsonb_build_object('codigo', 'FAC900004', 'nombre', 'PARAGUAS FACTPRUEBA ZZTOYS 70CM - 30886', 'categoria_id', (select id from categorias where slug = 'verano'),
                       'marca_id', (select id from marcas where slug = 'zztoys'), 'costo', 5398, 'precio', 10800),
    jsonb_build_object('codigo', 'fac900003', 'nombre', 'MOCHILA ESCOLAR FACTPRUEBA 16″ - 88', 'categoria_id', (select id from categorias where slug = 'mochilas-y-bolsos'),
                       'marca_id', null, 'costo', 9100, 'precio', null)),
  'vincular', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.id('sincod'), 'codigo', 'FAC900002', 'costo', 4100)),
  'costos', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.id('existe'), 'costo', 5500, 'precio', 11000))
)) as r;
grant select on c to authenticated;

select pg_temp.ok(jsonb_array_length((select r -> 'creados' from c)) = 2, 'crea los nuevos');
select pg_temp.ok((select bool_and(estado = 'borrador') from productos where id in (select (x ->> 'id')::uuid from c, jsonb_array_elements(c.r -> 'creados') x)), 'los nuevos quedan ocultos');
select pg_temp.ok((select p.proveedor_id = (select id from proveedores where nombre = 'Coronel') and pp.costo = 5398 and p.precio = 10800
                     and p.marca_id = (select id from marcas where slug = 'zztoys')
                   from codigos k join productos p on p.id = k.producto_id join productos_privado pp on pp.producto_id = p.id
                   where k.codigo = 'FAC900004' and k.tipo = 'proveedor'), 'nuevo con código, proveedor, marca, costo y precio');
select pg_temp.ok((select p.precio is null from codigos k join productos p on p.id = k.producto_id where k.codigo = 'FAC900003'), 'código en mayúsculas y sin precio si no se pidió');
select pg_temp.ok((select producto_id from codigos where codigo = 'FAC900002') = pg_temp.id('sincod'), '"es este": le suma el código');
select pg_temp.ok((select costo from productos_privado where producto_id = pg_temp.id('sincod')) = 4100, '"es este": y le actualiza el costo');
select pg_temp.ok((select costo from productos_privado where producto_id = pg_temp.id('existe')) = 5500, 'actualiza el costo de los existentes');
select pg_temp.ok((select precio from productos where id = pg_temp.id('existe')) = 11000, 'y el precio si se pidió');
select pg_temp.ok((select vinculados = 1 and costos = 1 and creados = 2 and renglones = 5 from facturas_cargadas where numero = 'F-1'), 'queda registrada la factura');

-- la próxima vez avisa y reconoce todo por código
select pg_temp.ok((analizar_factura('Coronel', 'F-1', '[{"codigo": "FAC900002", "descripcion": "x", "costo": 1}]'::jsonb) -> 'ya_cargada' ->> 'creados')::integer = 2, 'misma factura: avisa que ya se cargó');
select pg_temp.ok((analizar_factura('Coronel', 'F-2', '[{"codigo": "FAC900002", "descripcion": "x", "costo": 1}]'::jsonb) -> 'items' -> 0 ->> 'estado') = 'existe', 'el vinculado ahora se reconoce por código');

-- un código que ya es de otro artículo: no se guarda nada
select pg_temp.falla($$select cargar_factura(jsonb_build_object('proveedor_id', (select id from proveedores where nombre = 'Coronel'),
  'crear', jsonb_build_array(jsonb_build_object('codigo', 'FAC900001', 'nombre', 'OTRA PELOTA', 'categoria_id', 1))))$$, '23505', 'código repetido al crear');
select pg_temp.falla($$select cargar_factura(jsonb_build_object('proveedor_id', (select id from proveedores where nombre = 'Coronel'),
  'vincular', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.id('sincod'), 'codigo', 'FAC900001'))))$$, '23505', 'código repetido al vincular');

-- --------------------------------------------------- permisos
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000f002');
select pg_temp.falla($$select analizar_factura('Coronel', null, '[]')$$, '42501', 'pendiente no puede analizar');
select pg_temp.falla($$select cargar_factura('{"proveedor_id": 1}')$$, '42501', 'pendiente no puede cargar');
select pg_temp.ok((select count(*) from facturas_cargadas) = 0, 'pendiente no ve las facturas cargadas');
select pg_temp.como(null);
select pg_temp.falla($$select analizar_factura('Coronel', null, '[]')$$, '42501', 'anónimo no puede');
reset role;

rollback;
