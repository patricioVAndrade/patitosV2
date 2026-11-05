-- "Marroquinería" pasa a llamarse "Mochilas y bolsos": es lo que hay adentro (3 de cada 4
-- artículos son mochilas) y la gente lo entiende sin pensar. La URL vieja /c/marroquineria
-- redirige a la nueva desde next.config.ts.
update public.categorias
   set nombre = 'Mochilas y bolsos', slug = 'mochilas-y-bolsos'
 where slug = 'marroquineria';

-- Pilotos, paraguas y el puf no son mochilas ni bolsos: van a Varios.
update public.productos
   set categoria_id = (select id from public.categorias where slug = 'varios')
 where categoria_id = (select id from public.categorias where slug = 'mochilas-y-bolsos')
   and public.normalizar(nombre) ~ '^(piloto|paraguas?|puf)\M';
