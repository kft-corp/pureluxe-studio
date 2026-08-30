# Supabase

Database for PureLuxe (Studio + Client later). One project, SQL migrations in this folder.

## Layout

```
supabase/
├── migrations/     # Numbered SQL — apply in order
└── README.md
```

## Apply the Studio auth tables

Migration: `migrations/001_studio_team_auth.sql`

Creates:

| Table | Purpose |
|---|---|
| `studio_roles` | Configurable Studio roles (seeded with advisor, ops, finance, admin) |
| `team_members` | Who can log into Studio + their role |
| `studio_invites` | Admin invites before first Google sign-in |

Migration: `migrations/002_studio_rbac.sql`

Creates:

| Table | Purpose |
|---|---|
| `studio_permissions` | Permission catalog (`module.action`, e.g. `bookings.read`) |
| `studio_role_permissions` | Role → permission grants for RBAC |

Seeds default permissions and grants for `advisor`, `ops`, `finance`, and `admin`.

`team_members.role` and `studio_invites.role` reference `studio_roles.slug` — add new roles by inserting into `studio_roles`, no migration required.

Also adds reusable `set_updated_at()` trigger helper, enables RLS (server `service_role` only), and grants `service_role` table access (needed when auto-expose is off).

Run **001** before **002**. Apply both in order (Dashboard paste or `npx supabase db push` from repo root).

### Option A — Supabase Dashboard (simplest)

1. Open your company Supabase project → **SQL Editor**
2. Paste the full contents of `migrations/001_studio_team_auth.sql`
3. Run
4. Confirm tables under **Table Editor**

### Option B — Supabase CLI

```bash
# from repo root (once)
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF

npx supabase db push
```

### Already ran an older version of 001?

If `team_members` / `studio_invites` exist with a hardcoded role `CHECK`, drop those tables in the SQL Editor (dev only), then re-run the full migration. Or create a new numbered migration to add `studio_roles` and swap the constraints.

## First admin

Run once in **SQL Editor** (replace email with a real Google account, lowercase):

```sql
INSERT INTO public.team_members (name, email, role, active)
SELECT 'Founder Admin', 'you@yourcompany.com', 'admin', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_members
  WHERE lower(email) = lower('you@yourcompany.com')
);
```

`admin` must exist in `studio_roles` (seeded by migration 001).

Or add the row in **Table Editor** → `team_members`.

## Add a new role later

No migration needed — insert in **SQL Editor** or admin UI (when built):

```sql
INSERT INTO public.studio_roles (slug, label, description, sort_order)
VALUES ('regional_lead', 'Regional Lead', 'Leads advisors in a region.', 25)
ON CONFLICT (slug) DO NOTHING;
```

Slug rules: lowercase, starts with a letter, then letters/numbers/underscores (`^[a-z][a-z0-9_]*$`).

## App env

In repo root `.env.local` (never commit):

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Use the **service role** key only on the server. Never expose it in the browser.

App code uses `@pureluxe/db` — `listActiveStudioRoles()` for invite/RBAC UIs.
