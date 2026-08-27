-- Studio login: team accounts + admin invites (invite-only Google sign-in).
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
-- 2. team_members
--    Who can log into Studio. Must exist, be active, and match Google email.
-- =============================================================================

-- 2.1 Create table

CREATE TABLE IF NOT EXISTS public.team_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL,
  role          text NOT NULL
                  CHECK (role IN ('advisor', 'ops', 'finance', 'admin')),
  title         text,
  phone         text,
  active        boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT team_members_email_not_blank CHECK (length(trim(email)) > 0)
);

-- 2.2 Comments

COMMENT ON TABLE public.team_members IS 'Studio team. Login only when active = true.';
COMMENT ON COLUMN public.team_members.email IS 'Lowercase. Matched at Google sign-in.';
COMMENT ON COLUMN public.team_members.role IS 'Loaded into session after login.';
COMMENT ON COLUMN public.team_members.active IS 'false blocks login.';

-- 2.3 Indexes

CREATE UNIQUE INDEX IF NOT EXISTS team_members_email_lower_uidx
  ON public.team_members (lower(email));

-- 2.4 Triggers

DROP TRIGGER IF EXISTS team_members_set_updated_at ON public.team_members;
CREATE TRIGGER team_members_set_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. studio_invites
--    Admin invites email + role before first login. One pending invite per email.
-- =============================================================================

-- 3.1 Create table

CREATE TABLE IF NOT EXISTS public.studio_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  role        text NOT NULL
                CHECK (role IN ('advisor', 'ops', 'finance', 'admin')),
  invited_by  uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'revoked')),
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT studio_invites_email_not_blank CHECK (length(trim(email)) > 0)
);

-- 3.2 Comments

COMMENT ON TABLE public.studio_invites IS 'Invite before first Studio login.';
COMMENT ON COLUMN public.studio_invites.status IS 'pending | accepted | revoked';

-- 3.3 Indexes

CREATE UNIQUE INDEX IF NOT EXISTS studio_invites_pending_email_uidx
  ON public.studio_invites (lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS studio_invites_email_lower_idx
  ON public.studio_invites (lower(email));

-- =============================================================================
-- 4. Row Level Security
--    No public access. App server uses service_role key only.
-- =============================================================================

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_invites ENABLE ROW LEVEL SECURITY;

-- No policies = deny all for anon/authenticated keys.
