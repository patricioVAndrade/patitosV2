-- =====================================================================
-- 0005 · DATOS INICIALES
-- =====================================================================

insert into public.config (clave, valor, descripcion) values
  ('margen',       '2',    'Precio sugerido = costo × margen'),
  ('redondeo',     '100',  'Redondeo del precio sugerido (a la centena)'),
  ('costo_minimo', '100',  'Costos menores a esto se consideran "de relleno" y no generan precio'),
  ('emails_admin', '["pato08070@gmail.com"]', 'Estos mails entran como admin activo la primera vez que inician sesión')
on conflict (clave) do nothing;

insert into public.categorias (nombre, slug, orden) values
  ('Juguetería',            'jugueteria',            10),
  ('Peluchería',            'pelucheria',            20),
  ('Librería',              'libreria',              30),
  ('Marroquinería',         'marroquineria',         40),
  ('Hogar',                 'hogar',                 50),
  ('Belleza y Accesorios',  'belleza-y-accesorios',  60),
  ('Electro',               'electro',               70),
  ('Verano',                'verano',                80),
  ('Cotillón',              'cotillon',              90),
  ('Regalería',             'regaleria',             95),
  ('Varios',                'varios',                99)
on conflict (nombre) do nothing;

insert into public.proveedores (nombre) values ('Coronel'), ('Popeye'), ('DyG')
on conflict (nombre) do nothing;

insert into public.ubicaciones (nombre) values ('Local')
on conflict (nombre) do nothing;

insert into public.etiquetas (nombre, slug, visible) values
  ('Día del Niño', 'dia-del-nino', false),
  ('Navidad', 'navidad', false),
  ('Vuelta al cole', 'vuelta-al-cole', false)
on conflict (nombre) do nothing;
