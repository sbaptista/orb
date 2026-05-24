CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Enable RLS Policies
-- SELECT: readable by everyone (authenticated and anonymous) to check maintenance status.
-- ALL: restricted to admins/super admins (role_id 1 or 3) for updates.
CREATE POLICY "system_settings: select all" ON public.system_settings
  FOR SELECT USING (true);

CREATE POLICY "system_settings: admin write" ON public.system_settings
  FOR ALL USING (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.role_id IN (1, 3)
    )
  );

-- Insert default value for maintenance mode
INSERT INTO public.system_settings (key, value)
VALUES ('maintenance_mode', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
