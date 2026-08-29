-- Studio login: roles, team accounts, and admin invites (invite-only Google sign-in).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where practical.

-- =============================================================================
-- 1. Shared helpers
--    Reusable trigger function for updated_at on any table.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. studio_roles
--    Configurable Studio roles — add rows here; team_members and invites reference slug.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.studio_roles (
  slug        text PRIMARY KEY,
  label       text NOT NULL,
  description text,
  active      boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT studio_roles_slug_format
    CHECK (slug ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT studio_roles_slug_not_blank
    CHECK (length(trim(slug)) > 0),
  CONSTRAINT studio_roles_label_not_blank
    CHECK (length(trim(label)) > 0)
);

COMMENT ON TABLE public.studio_roles IS 'Studio RBAC roles. Add rows to introduce new roles.';
COMMENT ON COLUMN public.studio_roles.slug IS 'Stable key stored on team_members.role and studio_invites.role.';
COMMENT ON COLUMN public.studio_roles.active IS 'false hides role from new invites; existing members keep their slug.';

DROP TRIGGER IF EXISTS studio_roles_set_updated_at ON public.studio_roles;
CREATE TRIGGER studio_roles_set_updated_at
  BEFORE UPDATE ON public.studio_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.studio_roles (slug, label, description, sort_order)
VALUES
  ('advisor', 'Advisor', 'Plans trips and works with clients.', 10),
  ('ops', 'Operations', 'Bookings, inventory, and supplier coordination.', 20),
  ('finance', 'Finance', 'Pricing, margins, and financial review.', 30),
  ('admin', 'Admin', 'Full access including team and settings.', 40)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 3. team_members
--    Who can log into Studio. Must exist, be active, and match Google email.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.team_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL,
  role          text NOT NULL REFERENCES public.studio_roles (slug),
  title         text,
  phone         text,
  active        boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT team_members_email_not_blank CHECK (length(trim(email)) > 0)
);

COMMENT ON TABLE public.team_members IS 'Studio team. Login only when active = true.';
COMMENT ON COLUMN public.team_members.email IS 'Lowercase. Matched at Google sign-in.';
COMMENT ON COLUMN public.team_members.role IS 'FK to studio_roles.slug — loaded into session after login.';
COMMENT ON COLUMN public.team_members.active IS 'false blocks login.';

CREATE UNIQUE INDEX IF NOT EXISTS team_members_email_lower_uidx
  ON public.team_members (lower(email));

DROP TRIGGER IF EXISTS team_members_set_updated_at ON public.team_members;
CREATE TRIGGER team_members_set_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 4. studio_invites
--    Admin invites email + role before first login. One pending invite per email.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.studio_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  role        text NOT NULL REFERENCES public.studio_roles (slug),
  invited_by  uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'revoked')),
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT studio_invites_email_not_blank CHECK (length(trim(email)) > 0)
);

COMMENT ON TABLE public.studio_invites IS 'Invite before first Studio login.';
COMMENT ON COLUMN public.studio_invites.role IS 'FK to studio_roles.slug — assigned on first sign-in.';
COMMENT ON COLUMN public.studio_invites.status IS 'pending | accepted | revoked';

CREATE UNIQUE INDEX IF NOT EXISTS studio_invites_pending_email_uidx
  ON public.studio_invites (lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS studio_invites_email_lower_idx
  ON public.studio_invites (lower(email));

-- =============================================================================
-- 5. Row Level Security
--    No public access. App server uses service_role key only.
-- =============================================================================

ALTER TABLE public.studio_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_invites ENABLE ROW LEVEL SECURITY;

-- No policies = deny all for anon/authenticated keys.

-- =============================================================================
-- 6. service_role privileges
--    Required when Supabase "Automatically expose new tables" is OFF.
--    service_role bypasses RLS but still needs table-level GRANTs.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_invites TO service_role;
