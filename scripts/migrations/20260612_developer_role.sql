INSERT INTO public.roles (value, name)
VALUES (3, 'Developer')
ON CONFLICT (name) DO NOTHING;
