-- Páginas por marca (/m/duravit): el público puede ver las marcas que tienen artículos publicados.
create view public.v_marcas with (security_barrier = true) as
select m.slug, m.nombre, count(*)::integer as cantidad
  from public.marcas m
  join public.v_catalogo v on v.marca_slug = m.slug
 where m.activa
 group by m.slug, m.nombre;

grant select on public.v_marcas to anon, authenticated;
