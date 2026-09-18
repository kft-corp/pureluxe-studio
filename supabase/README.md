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

Migration: `migrations/003_studio_clients.sql`

Creates:

| Object | Purpose |
|---|---|
| `pg_trgm` extension | Directory search + dedup similarity |
| `clients` | Core client identity (CRM anchor) |

Migration: `migrations/004_studio_client_profiles.sql`

Creates:

| Object | Purpose |
|---|---|
| `client_preferences` | Structured taste with guest-confirm workflow |
| `client_health_profiles` | One-to-one health record per client |
| `client_documents` | Passports and travel docs with verification |
| `client_relationships` | Non-household links between clients |
| `client_merge_candidates` | Persisted dedup suggestions |
| `client_audit_log` | Append-only change history |
| `find_similar_clients()` | pg_trgm RPC for dedup on profile and create |

Migration: `migrations/005_studio_families_guest.sql`

Creates:

| Table | Purpose |
|---|---|
| `families` | Household grouping |
| `family_members` | Client ↔ family membership (one family per client) |
| `family_booking_members` | Travellers on a booking (`booking_id` has no FK yet) |
| `guest_users` | Guest Client App login (invite-before-login) |

Deferred FKs (add when `bookings` / `trips` exist): [`docs/studio/client_deferred_fks.md`](../docs/studio/client_deferred_fks.md).

Migration: `migrations/008_client_documents_storage.sql`

Creates private Storage bucket `client-documents` for passport / visa / insurance uploads (signed URLs only).

Migration: `migrations/009_client_household_perf_indexes.sql`

Household / relationship search indexes.

Migration: `migrations/010_client_perf_lifecycle.sql`

Directory/search indexes, `pending_upload` document status, `refresh_client_profile_completeness()` RPC, and purge helpers for stale uploads / old audit / inactive preferences.

Adds indexes for household name search (`families.name` trigram) and related-people lookups (`client_relationships` from/to).

Migration: `migrations/011_rate_layer.sql`

Creates Rate Layer **Layers 1–4** config + **Knowledge Base** (end-to-end):

| Object | Purpose |
|---|---|
| `company_settings` | Seeds `rate_sources` (incl. channel enable flags) + `knowledge_base` |
| `destination_type_defaults` | Layer 3 type → pattern |
| `destination_profiles` | Canonical destinations + aliases |
| `destination_routing_overrides` | Layer 2 (Maldives / Dubai / Bali / Doha seeded) |
| `destination_wholesalers` | Dest ↔ wholesaler adapter bindings |
| `rate_peak_windows` | Ski peak dates |
| `negotiated_rate_codes` | Consortia/chain code registry |
| `properties` | Thin hotel master (links to KB via `curated_hotel_id`) |
| `property_supplier_codes` | Generic Sabre/Hotelbeds/wholesale codes |
| `property_contracted_rates` | Layer 1 contracted rates |
| `kb_sources` / `kb_entities` / `kb_facts` | KB content (facts = full notes) |
| `kb_fact_chunks` | Semantic RAG chunks + embeddings |
| `rate_search_events` | Optional resolveRates audit |
| Permissions | `rates.search`, `settings.rate_sources`, `knowledge.*`, `settings.knowledge_base` |

Drops obsolete Path tables (`offline_trip_types`, `wholesaler_destinations`, `high_value_routing`).  
Spec: [`docs/studio/rate-layer.md`](../docs/studio/rate-layer.md). Recreate notes: [`docs/studio/rate-layer-deferred.md`](../docs/studio/rate-layer-deferred.md).

Migration: `migrations/012_trips_kernel.sql`

Creates the **seven-table trip kernel** (Trip Builder + Trips portfolio + Client App):

| Table | Purpose |
|---|---|
| `trips` | Canonical journey record |
| `trip_clients` | Primary + companions |
| `trip_legs` | Ordered stops |
| `trip_itinerary_days` | Day narrative + provenance |
| `trip_line_items` | Rates/options incl. `pending_review` (no drafts table) |
| `trip_documents` | Proposal PDFs + STALE |
| `trip_chat_messages` | Advisor + guest chat (`channel`) |

Also: `clients.is_demo`, storage bucket `trip-documents`, ops/finance Trip Builder grants.

Migration: `migrations/013_bookings.sql`

Creates:

| Object | Purpose |
|---|---|
| `bookings` | Confirmed inventory ledger |
| `booking_travellers` | Named people on a reservation |
| `booking_audit_log` | Status / money / ref history |
| `family_booking_members` FK | Deferred Client FK → `bookings` |
| Storage | `booking-confirmations` bucket |
| Permissions | Advisor `bookings.read` / `bookings.write` |

Run **001 → … → 013** in order (Dashboard paste or `npx supabase db push` from repo root).

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
