-- Studio RBAC: permissions catalog and role grants.
-- Depends on 001_studio_team_auth.sql (studio_roles).

-- =============================================================================
-- 1. studio_permissions
--    Atomic permissions — slug = module.action (e.g. bookings.read)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.studio_permissions (
  slug        text PRIMARY KEY,
  module      text NOT NULL,
  action      text NOT NULL,
  label       text NOT NULL,
  description text,
  active      boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT studio_permissions_slug_format
    CHECK (slug ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  CONSTRAINT studio_permissions_module_format
    CHECK (module ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT studio_permissions_action_format
    CHECK (action ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT studio_permissions_module_action_unique
    UNIQUE (module, action),
  CONSTRAINT studio_permissions_label_not_blank
    CHECK (length(trim(label)) > 0)
);

COMMENT ON TABLE public.studio_permissions IS 'RBAC permission catalog. slug = module.action.';
COMMENT ON COLUMN public.studio_permissions.module IS 'Studio module key — maps to nav routes and feature areas.';
COMMENT ON COLUMN public.studio_permissions.action IS 'read | write | delete | manage';

DROP TRIGGER IF EXISTS studio_permissions_set_updated_at ON public.studio_permissions;
CREATE TRIGGER studio_permissions_set_updated_at
  BEFORE UPDATE ON public.studio_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 2. studio_role_permissions
--    Grants permissions to roles (many-to-many)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.studio_role_permissions (
  role_slug       text NOT NULL
                  REFERENCES public.studio_roles (slug)
                  ON UPDATE CASCADE
                  ON DELETE CASCADE,
  permission_slug text NOT NULL
                  REFERENCES public.studio_permissions (slug)
                  ON UPDATE CASCADE
                  ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (role_slug, permission_slug)
);

COMMENT ON TABLE public.studio_role_permissions IS 'Role → permission grants for Studio RBAC.';

CREATE INDEX IF NOT EXISTS studio_role_permissions_permission_idx
  ON public.studio_role_permissions (permission_slug);

-- =============================================================================
-- 3. Seed permissions (module × action)
-- =============================================================================

INSERT INTO public.studio_permissions (slug, module, action, label, sort_order)
VALUES
  ('home.read', 'home', 'read', 'View home', 10),

  ('trip_builder.read', 'trip_builder', 'read', 'View trip builder', 20),
  ('trip_builder.write', 'trip_builder', 'write', 'Edit trips and proposals', 21),

  ('bookings.read', 'bookings', 'read', 'View bookings', 30),
  ('bookings.write', 'bookings', 'write', 'Manage bookings', 31),

  ('clients.read', 'clients', 'read', 'View clients', 40),
  ('clients.write', 'clients', 'write', 'Manage clients', 41),

  ('trips.read', 'trips', 'read', 'View trips', 50),
  ('trips.write', 'trips', 'write', 'Manage trips', 51),

  ('trainer.read', 'trainer', 'read', 'View trainer', 60),

  ('tasks.read', 'tasks', 'read', 'View tasks', 70),
  ('tasks.write', 'tasks', 'write', 'Manage tasks', 71),

  ('commissions.read', 'commissions', 'read', 'View commissions', 80),
  ('commissions.write', 'commissions', 'write', 'Manage commissions', 81),

  ('payments.read', 'payments', 'read', 'View payments', 90),
  ('payments.write', 'payments', 'write', 'Manage payments', 91),

  ('team.read', 'team', 'read', 'View team', 100),
  ('team.manage', 'team', 'manage', 'Manage team and invites', 101),

  ('settings.read', 'settings', 'read', 'View settings', 110),
  ('settings.manage', 'settings', 'manage', 'Manage studio settings', 111)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 4. Seed role grants
-- =============================================================================

-- Advisor: trip planning and client work
INSERT INTO public.studio_role_permissions (role_slug, permission_slug)
SELECT 'advisor', slug
FROM public.studio_permissions
WHERE slug IN (
  'home.read',
  'trip_builder.read', 'trip_builder.write',
  'clients.read', 'clients.write',
  'trips.read', 'trips.write',
  'trainer.read',
  'tasks.read', 'tasks.write'
)
ON CONFLICT DO NOTHING;

-- Ops: bookings, clients, trips, tasks
INSERT INTO public.studio_role_permissions (role_slug, permission_slug)
SELECT 'ops', slug
FROM public.studio_permissions
WHERE slug IN (
  'home.read',
  'bookings.read', 'bookings.write',
  'clients.read', 'clients.write',
  'trips.read', 'trips.write',
  'trainer.read',
  'tasks.read', 'tasks.write'
)
ON CONFLICT DO NOTHING;

-- Finance: commercial modules + read-only ops visibility
INSERT INTO public.studio_role_permissions (role_slug, permission_slug)
SELECT 'finance', slug
FROM public.studio_permissions
WHERE slug IN (
  'home.read',
  'commissions.read', 'commissions.write',
  'payments.read', 'payments.write',
  'trips.read',
  'bookings.read'
)
ON CONFLICT DO NOTHING;

-- Admin: all active permissions
INSERT INTO public.studio_role_permissions (role_slug, permission_slug)
SELECT 'admin', slug
FROM public.studio_permissions
WHERE active = true
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 5. Row Level Security + service_role grants
-- =============================================================================

ALTER TABLE public.studio_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_role_permissions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_role_permissions TO service_role;
