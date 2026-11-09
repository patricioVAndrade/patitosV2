-- =====================================================================
-- Pruebas de: búsqueda que perdona errores, marcas públicas, aumentos de
-- precio, "¿Sigue habiendo?" y repetidos. Corre en una transacción que se
-- descarta al final.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/novedades.test.sql
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
  ('00000000-0000-0000-0000-00000000e001', 'empleada.novedades@x.com', '{"full_name": "Empleada"}'),
  ('00000000-0000-0000-0000-00000000e002', 'pendiente.novedades@x.com', '{"full_name": "Pendiente"}');
update perfiles set estado = 'activo' where id = '00000000-0000-0000-0000-00000000e001';
insert into marcas (nombre, slug) values ('DURAVIT PRUEBA', 'duravit-prueba'), ('WILSON PRUEBA', 'wilson-prueba');

select pg_temp.como('00000000-0000-0000-0000-00000000e001');
create temp table p on commit drop as
select x.clave, (guardar_producto(jsonb_build_object(
          'nombre', x.nombre, 'categoria_id', (select id from categorias where slug = 'jugueteria'),
          'marca_id', (select id from marcas where slug = x.marca), 'precio', x.precio, 'mostrar_precio', true,
          'estado', x.estado, 'costo', x.costo,
          'codigos', jsonb_build_array(jsonb_build_object('codigo', x.codigo, 'tipo', 'legado')))) ->> 'id')::uuid as id
  from (values
    ('pelota',  'PELOTA DE FUTBOL NRO 5 PRUEBA',          'duravit-prueba', 10000, 'publicado', 5000, 'NOV-1'),
    ('moch9',   'MOCHILA 9″ ESPALDA CAPIBARA PRUEBA',     null,             20000, 'publicado', null, 'NOV-2'),
    ('moch11',  'MOCHILA 11″ ESPALDA CAPIBARA PRUEBA',    null,             21000, 'publicado', null, 'NOV-3'),
    ('wil_a',   'MOCHILA 17″ URBANA WILSON PRUEBA - 65.AD009', 'wilson-prueba', 30000, 'publicado', 15000, 'NOV-4'),
    ('wil_b',   'MOCHILA 17″ URBAN WILSON PRUEBA',        'wilson-prueba',  null,  'publicado', null, 'NOV-5'),
    ('oculto',  'PELOTA OCULTA PRUEBA',                   'duravit-prueba', 9000,  'borrador',  4000, 'NOV-6')
  ) as x(clave, nombre, marca, precio, estado, costo, codigo);
grant select on p to anon, authenticated;
reset role;
create function pg_temp.id(c text) returns uuid language sql as $$ select id from p where clave = c $$;
create function pg_temp.sku(c text) returns text language sql as $$ select sku from productos where id = (select id from p where clave = c) $$;
grant execute on function pg_temp.id(text), pg_temp.sku(text) to anon, authenticated;

-- ------------------------------------------------- búsqueda que perdona errores
select pg_temp.como(null);
select pg_temp.ok((select (buscar_catalogo('pelpta futbol') ->> 'total')::int >= 1), 'búsqueda: "pelpta futbol" encuentra la pelota');
select pg_temp.ok((select buscar_catalogo('pelpta futbol') ->> 'corregida' = 'pelota futbol'), 'búsqueda: devuelve la búsqueda corregida');
select pg_temp.ok((select (buscar_catalogo('pelpta futbol') ->> 'exactos')::int = 0), 'búsqueda: una palabra mal escrita no cuenta como coincidencia exacta');
select pg_temp.ok((select (buscar_catalogo('futbol prueba') ->> 'exactos')::int >= 1), 'búsqueda: las coincidencias exactas se cuentan');
select pg_temp.ok((select (buscar_catalogo('duravit prueba') ->> 'total')::int = 1), 'búsqueda: encuentra por marca aunque no esté en el nombre');
select pg_temp.ok((select not exists (select 1 from jsonb_array_elements(buscar_catalogo('pelota oculta prueba') -> 'items') i where i ->> 'nombre' like '%OCULTA%')),
  'búsqueda: no muestra artículos ocultos');
select pg_temp.ok((select not (buscar_catalogo('pelota') -> 'items' -> 0 ? 'costo')), 'búsqueda: no expone costos');
select pg_temp.ok((select (buscar_catalogo(null, null, 'wilson-prueba') ->> 'total')::int = 2), 'búsqueda: filtra por marca');

-- ------------------------------------------------------------ marcas públicas
select pg_temp.ok((select cantidad = 1 from v_marcas where slug = 'duravit-prueba'), 'marcas públicas: cuentan solo publicados');
select pg_temp.ok((select nombre = 'WILSON PRUEBA' from v_marcas where slug = 'wilson-prueba'), 'marcas públicas: el público ve el nombre');

-- ----------------------------------------------------------------- aumentos
select pg_temp.falla($$select ajustar_precios('{"marca_id": 1}', 10)$$, '42501', 'aumentos: el público no puede');
reset role;
create temp table aj on commit drop as select (select id from marcas where slug = 'duravit-prueba') as marca;
grant select on aj to anon, authenticated;
select pg_temp.como('00000000-0000-0000-0000-00000000e002');
select pg_temp.falla($$select ajustar_precios(jsonb_build_object('marca_id', (select marca from aj)), 10)$$, '42501', 'aumentos: un usuario pendiente no puede');
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000e001');
select pg_temp.ok((select (ajustar_precios(jsonb_build_object('marca_id', marca), 12) ->> 'cantidad')::int = 2 from aj), 'aumentos: la vista previa incluye publicados y ocultos de la marca');
select pg_temp.ok((select precio = 10000 from productos where id = pg_temp.id('pelota')), 'aumentos: la vista previa no cambia nada');
select pg_temp.falla($$select ajustar_precios('{}', 10)$$, '22023', 'aumentos: hay que elegir marca, proveedor o categoría');
select pg_temp.falla(format($$select ajustar_precios('{"marca_id": %s}', 500)$$, (select marca from aj)), '22023', 'aumentos: porcentaje fuera de rango');
create temp table aplicado on commit drop as select ajustar_precios(jsonb_build_object('marca_id', marca), 12, 100, true, true) as r from aj;
select pg_temp.ok((select precio = 11200 from productos where id = pg_temp.id('pelota')), 'aumentos: 10000 +12% redondeado a 100 = 11200');
select pg_temp.ok((select costo = 5600 from productos_privado where producto_id = pg_temp.id('pelota')), 'aumentos: también el costo si se pide (5000 → 5600)');
select pg_temp.ok((select count(*) = 2 from historial_precios h where h.ajuste_id = (select (r ->> 'ajuste_id')::bigint from aplicado)), 'aumentos: el historial de precios guarda qué aumento fue');
update productos set precio = 12345 where id = pg_temp.id('oculto');   -- alguien lo cambia a mano después
select pg_temp.ok((select (revertir_ajuste((r ->> 'ajuste_id')::bigint) ->> 'respetados')::int = 1 from aplicado), 'deshacer: respeta lo que se cambió a mano después');
select pg_temp.ok((select precio = 10000 from productos where id = pg_temp.id('pelota')), 'deshacer: vuelve al precio anterior');
select pg_temp.ok((select costo = 5000 from productos_privado where producto_id = pg_temp.id('pelota')), 'deshacer: vuelve el costo anterior');
select pg_temp.falla($$select revertir_ajuste((select (r ->> 'ajuste_id')::bigint from aplicado))$$, '22023', 'deshacer: no se puede deshacer dos veces');

-- ------------------------------------------------------- ¿sigue habiendo?
reset role;
set session_replication_role = replica;   -- simula que nadie lo tocó hace 100 días
update productos set actualizado = now() - interval '100 days' where id = pg_temp.id('moch9');
set session_replication_role = origin;
select pg_temp.como('00000000-0000-0000-0000-00000000e001');
select pg_temp.ok((select exists (select 1 from jsonb_array_elements(pendientes_revision(60, 200) -> 'items') i where i ->> 'id' = pg_temp.id('moch9')::text)),
  'revisar: aparece lo que nadie tocó hace 60 días');
select pg_temp.ok((select marcar_revisado(array[pg_temp.id('moch9')]) = 1), 'revisar: se marca como revisado');
select pg_temp.ok((select not exists (select 1 from jsonb_array_elements(pendientes_revision(60, 200) -> 'items') i where i ->> 'id' = pg_temp.id('moch9')::text)),
  'revisar: lo revisado deja de aparecer');
select pg_temp.ok((select actualizado < now() - interval '90 days' from productos where id = pg_temp.id('moch9')), 'revisar: confirmar no cambia la fecha del artículo');
select pg_temp.ok((select (datos_faltantes(10) -> 'sin_foto' ->> 'total')::int >= 5), 'datos que faltan: cuenta los artículos sin foto');
reset role;
select pg_temp.como(null);
select pg_temp.falla($$select pendientes_revision()$$, '42501', 'revisar: el público no puede');

-- ---------------------------------------------------------------- repetidos
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000e001');
select pg_temp.ok((select exists (select 1 from jsonb_array_elements(posibles_repetidos('mochila 17 urbana wilson prueba')) x where x ->> 'id' = pg_temp.id('wil_b')::text)),
  'repetidos: nombre casi igual con los mismos números');
select pg_temp.ok((select not exists (select 1 from jsonb_array_elements(posibles_repetidos('MOCHILA 9″ ESPALDA CAPIBARA PRUEBA', pg_temp.id('moch9'))) x where x ->> 'id' = pg_temp.id('moch11')::text)),
  'repetidos: 9″ y 11″ NO son repetidos (distintos números)');
select pg_temp.ok((select exists (select 1 from jsonb_array_elements(pares_repetidos(200) -> 'pares') x
                                   where (x -> 'a' ->> 'id', x -> 'b' ->> 'id') in ((pg_temp.id('wil_a')::text, pg_temp.id('wil_b')::text), (pg_temp.id('wil_b')::text, pg_temp.id('wil_a')::text)))),
  'repetidos: el par aparece en la lista para revisar');
-- huellas de fotos
insert into imagenes (producto_id, ruta_thumb, ruta_full) values
  (pg_temp.id('moch9'), 'prueba/h1-t.webp', 'prueba/h1-f.webp'),
  (pg_temp.id('pelota'), 'prueba/h2-t.webp', 'prueba/h2-f.webp');
select pg_temp.ok((select guardar_huellas(jsonb_build_array(
    jsonb_build_object('ruta_thumb', 'prueba/h1-t.webp', 'huella', repeat('f0', 32)),
    jsonb_build_object('ruta_thumb', 'prueba/h2-t.webp', 'huella', 'esto no es una huella'))) = 2), 'huellas: se guardan');
select pg_temp.ok((select exists (select 1 from jsonb_array_elements(fotos_parecidas(array[repeat('f0', 28) || 'f1f1f1f1'])) x where x ->> 'id' = pg_temp.id('moch9')::text)),
  'huellas: una foto casi igual (pocos bits distintos) se encuentra');
select pg_temp.ok((select jsonb_array_length(fotos_parecidas(array[repeat('0f', 32)])) = 0), 'huellas: una foto distinta no');
select pg_temp.ok((select jsonb_array_length(fotos_parecidas(array[repeat('0', 64)])) = 0), 'huellas: una huella vacía (ilegible) no se compara');
-- unir
select pg_temp.ok((select unir_productos(pg_temp.id('wil_a'), pg_temp.id('wil_b')) ->> 'sku' = pg_temp.sku('wil_a')), 'unir: queda el elegido');
select pg_temp.ok((select count(*) = 2 from codigos where producto_id = pg_temp.id('wil_a')), 'unir: los códigos pasan al que queda');
select pg_temp.ok((select estado = 'archivado' and unido_a = pg_temp.id('wil_a') from productos where id = pg_temp.id('wil_b')), 'unir: el otro se archiva y apunta al que queda');
select pg_temp.ok((select (buscar_codigo('NOV-5') ->> 'producto_id')::uuid = pg_temp.id('wil_a')), 'unir: escanear el código del otro encuentra al que queda');
select pg_temp.ok((select not exists (select 1 from jsonb_array_elements(pares_repetidos(200) -> 'pares') x where x -> 'a' ->> 'id' = pg_temp.id('wil_b')::text or x -> 'b' ->> 'id' = pg_temp.id('wil_b')::text)),
  'unir: el par ya no aparece');
select descartar_repetido(pg_temp.id('moch9'), pg_temp.id('moch11'));
select pg_temp.ok((select count(*) = 1 from repetidos_descartados), 'no son repetidos: queda registrado');
reset role;
create temp table skus on commit drop as select pg_temp.sku('wil_a') as queda, pg_temp.sku('wil_b') as sale;
grant select on skus to anon;
select pg_temp.como(null);
select pg_temp.ok((select redireccion_producto(lower(sale)) ->> 'sku' = queda from skus), 'unir: el link viejo redirige al que quedó (público)');
select pg_temp.falla(format($$select unir_productos(%L, %L)$$, pg_temp.id('moch9'), pg_temp.id('moch11')), '42501', 'unir: el público no puede');
select pg_temp.falla($$select posibles_repetidos('mochila')$$, '42501', 'repetidos: el público no puede consultar');
select pg_temp.falla($$select * from repetidos_descartados$$, '42501', 'repetidos: el público no lee la tabla');
reset role;

rollback;
\echo '✔ Todas las pruebas de las novedades pasaron'
