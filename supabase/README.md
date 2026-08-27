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
| `team_members` | Who can log into Studio + their role |
| `studio_invites` | Admin invites before first Google sign-in |

Also adds reusable `set_updated_at()` trigger helper and enables RLS (server `service_role` only).

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

Or add the row in **Table Editor** → `team_members`.

## App env

In repo root `.env.local` (never commit):

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Use the **service role** key only on the server. Never expose it in the browser.

App code will use `@pureluxe/db` when login is wired.
