-- =====================================================================
-- 0003 · SEGURIDAD (RLS), VISTAS PÚBLICAS Y FOTOS
-- Principio: el público (anon) NO toca tablas. Solo lee dos vistas
-- preparadas (v_catalogo y v_producto) y las categorías/marcas.
-- =====================================================================

-- Activar RLS en todas las tablas
alter table public.config             enable row level security;
alter table public.perfiles           enable row level security;
alter table public.categorias         enable row level security;
alter table public.marcas             enable row level security;
alter table public.proveedores        enable row level security;
alter table public.etiquetas          enable row level security;
alter table public.productos          enable row level security;
alter table public.codigos            enable row level security;
alter table public.imagenes           enable row level security;
alter table public.producto_etiquetas enable row level security;
alter table public.productos_privado  enable row level security;
alter table public.ajustes_precio     enable row level security;
alter table public.historial_precios  enable row level security;
alter table public.ubicaciones        enable row level security;
alter table public.movimientos_stock  enable row level security;
alter table public.lista_proveedores  enable row level security;
alter table public.historial          enable row level security;

-- El rol anónimo no tiene acceso directo a ninguna tabla (defensa en profundidad)
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon, public;

-- ---------------------------------------------------------------------
-- Políticas
-- ---------------------------------------------------------------------
-- Config: la lee el personal, la cambia el admin
create policy config_leer   on public.config for select to authenticated using (public.es_staff());
create policy config_admin  on public.config for all    to authenticated using (public.es_admin()) with check (public.es_admin());

-- Perfiles: cada uno ve el suyo; el admin ve y edita todos
create policy perfiles_leer  on public.perfiles for select to authenticated using (id = auth.uid() or public.es_admin());
create policy perfiles_admin on public.perfiles for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- Clasificación: el personal lee y administra; borrar marcas solo admin
create policy categorias_leer on public.categorias for select to authenticated using (true);
create policy categorias_edit on public.categorias for all to authenticated using (public.es_staff()) with check (public.es_staff());
create policy marcas_leer     on public.marcas for select to authenticated using (public.es_staff());
create policy marcas_alta     on public.marcas for insert to authenticated with check (public.es_staff());
create policy marcas_edit     on public.marcas for update to authenticated using (public.es_staff()) with check (public.es_staff());
create policy marcas_baja     on public.marcas for delete to authenticated using (public.es_admin());
create policy proveedores_leer on public.proveedores for select to authenticated using (public.es_staff());
create policy proveedores_edit on public.proveedores for all to authenticated using (public.es_staff()) with check (public.es_staff());
create policy etiquetas_leer  on public.etiquetas for select to authenticated using (public.es_staff());
create policy etiquetas_edit  on public.etiquetas for all to authenticated using (public.es_staff()) with check (public.es_staff());

-- Productos y sus partes: el personal carga y edita; borrar definitivamente solo admin
create policy productos_leer  on public.productos for select to authenticated using (public.es_staff());
create policy productos_alta  on public.productos for insert to authenticated with check (public.es_staff());
create policy productos_edit  on public.productos for update to authenticated using (public.es_staff()) with check (public.es_staff());
create policy productos_baja  on public.productos for delete to authenticated using (public.es_admin());

create policy codigos_todo    on public.codigos            for all to authenticated using (public.es_staff()) with check (public.es_staff());
create policy imagenes_todo   on public.imagenes           for all to authenticated using (public.es_staff()) with check (public.es_staff());
create policy prodetiq_todo   on public.producto_etiquetas for all to authenticated using (public.es_staff()) with check (public.es_staff());

-- Costos: los ve y carga todo el personal. Listas de proveedores: el personal lee; las carga el script (service_role) o un admin
create policy privado_staff   on public.productos_privado for all to authenticated using (public.es_staff()) with check (public.es_staff());
create policy listas_leer     on public.lista_proveedores for select to authenticated using (public.es_staff());
create policy listas_admin    on public.lista_proveedores for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Precios: historial de precios y ajustes masivos para todo el personal
create policy hprecios_leer   on public.historial_precios for select to authenticated using (public.es_staff());
create policy ajustes_leer    on public.ajustes_precio for select to authenticated using (public.es_staff());
create policy ajustes_edit    on public.ajustes_precio for all to authenticated using (public.es_staff()) with check (public.es_staff());

-- Stock (etapa 2)
create policy ubicaciones_leer on public.ubicaciones for select to authenticated using (public.es_staff());
create policy ubicaciones_edit on public.ubicaciones for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy movimientos_leer on public.movimientos_stock for select to authenticated using (public.es_staff());
create policy movimientos_alta on public.movimientos_stock for insert to authenticated with check (public.es_staff());
-- (los movimientos no se editan ni borran: se corrigen con otro movimiento)

-- Historial (logs): solo admin. Nadie lo edita.
create policy historial_leer on public.historial for select to authenticated using (public.es_admin());

-- ---------------------------------------------------------------------
-- VISTAS PÚBLICAS (lo único que ve el cliente)
-- Son "security definer" a propósito: corren con permisos del dueño,
-- filtran solo lo publicado y exponen solo columnas seguras.
-- ---------------------------------------------------------------------
create view public.v_catalogo with (security_barrier = true) as
select
  p.id, p.sku, p.slug, p.nombre,
  c.nombre  as categoria,
  c.slug    as categoria_slug,
  m.nombre  as marca,
  m.slug    as marca_slug,
  case when p.mostrar_precio or p.en_oferta then p.precio end          as precio,
  case when p.en_oferta then p.precio_anterior end                     as precio_anterior,
  p.en_oferta,
  coalesce(p.nuevo_hasta >= current_date, false)                       as es_nuevo,
  p.disponibilidad,
  (p.disponibilidad = 'agotado')                                       as agotado,   -- para ordenarlos al final
  p.edad_desde_meses, p.edad_hasta_meses,
  img.ruta_thumb, img.ruta_full,
  p.busqueda,
  p.actualizado,
  p.creado
from public.productos p
join public.categorias c on c.id = p.categoria_id and c.activa
left join public.marcas m on m.id = p.marca_id
left join lateral (
  select i.ruta_thumb, i.ruta_full from public.imagenes i
  where i.producto_id = p.id order by i.orden, i.creado limit 1
) img on true
where p.estado = 'publicado';

create view public.v_producto with (security_barrier = true) as
select
  v.*,
  p.descripcion,
  p.variantes,
  coalesce((
    select jsonb_agg(jsonb_build_object('thumb', i.ruta_thumb, 'full', i.ruta_full, 'ancho', i.ancho, 'alto', i.alto)
                     order by i.orden, i.creado)
    from public.imagenes i where i.producto_id = p.id), '[]'::jsonb) as imagenes,
  coalesce((
    select jsonb_agg(e.nombre order by e.nombre)
    from public.producto_etiquetas pe join public.etiquetas e on e.id = pe.etiqueta_id and e.visible
    where pe.producto_id = p.id), '[]'::jsonb) as etiquetas
from public.v_catalogo v
join public.productos p on p.id = v.id;

-- Categorías con cantidad de artículos publicados (para el menú)
create view public.v_categorias with (security_barrier = true) as
select c.id, c.nombre, c.slug, c.orden,
       (select count(*) from public.productos p where p.categoria_id = c.id and p.estado = 'publicado')::int as cantidad
from public.categorias c
where c.activa;

grant select on public.v_catalogo, public.v_producto, public.v_categorias to anon, authenticated;

-- ---------------------------------------------------------------------
-- FOTOS (Storage): lectura pública; suben/borran solo los del personal
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/webp', 'image/jpeg'];

create policy fotos_subir  on storage.objects for insert to authenticated with check (bucket_id = 'productos' and public.es_staff());
create policy fotos_editar on storage.objects for update to authenticated using (bucket_id = 'productos' and public.es_staff());
create policy fotos_borrar on storage.objects for delete to authenticated using (bucket_id = 'productos' and public.es_staff());
