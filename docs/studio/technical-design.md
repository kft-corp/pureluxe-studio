# PureLuxe Studio — Technical Design (Build From Scratch)

**Product brief:** [`build-brief.md`](./build-brief.md)  
**Audience:** Solo / founding engineer building PureLuxe Studio cleanly from day one  
**Status:** Greenfield technical blueprint

---

## What this file is

A single technical plan to build **PureLuxe Studio (+ Client App later)** from scratch:

| Section | What you get |
|---|---|
| §1 | Product rules & scope |
| §2 | Stack |
| §3 | Repo / folder structure |
| §4 | NPM packages |
| §5 | UI map (pages & components) |
| §6 | HTTP APIs |
| §7 | Database tables + schemas |
| §8 | Build order |
| §9 | Env, deploy, tests |

**In scope:** Login · RBAC · Settings · Clients · Bookings · Trip Builder · Rate Layer · Client App (read + chat)

**Out of scope:** Email extract, Inbox sync-as-creation, Queue-from-mail, Gmail as intake, commissions-from-mail

---

## 1. Product rules (never break in code)

1. **Trip Builder creates** trips, clients, and bookings (or an explicit Studio action that is the same idea).  
2. **Nothing reaches a guest** without advisor review / publish.  
3. **Rate Layer owns money** — Knowledge Base never stores sell prices.  
4. **Best rate first:** negotiated → specialist/offline → GDS → bedbank → manual. Safari/yacht/specialist never fall to generic.  
5. **Two websites, one database** — Studio and Client share trip truth; separate logins and cookies.  
6. **Chat is the interface; structured data is the state.** PDFs and Client UI are views of the same trip.

```
studio.yourdomain.com          app.yourdomain.com
   (team · Google)                (guests · Google)
              \                      /
               \                    /
            one GitHub monorepo
         apps/studio + apps/client
         packages/* (shared rules)
                     |
              one Postgres (Supabase)
```

---

## 2. Stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | One language end-to-end |
| Framework | Next.js App Router | Industry default for web apps on Vercel |
| UI | React 19 + Tailwind CSS 4 | Fast, consistent Studio UI |
| Validation | Zod | API bodies + AI tool JSON |
| Database | Supabase Postgres + SQL migrations | Managed Postgres, clear schema history |
| Studio auth | Google OAuth + iron-session + role gate | Invite-only team access |
| Guest auth | Separate guest cookie (Google) | Guests never share Studio session |
| AI | Anthropic Claude | Trip Builder + Client chat |
| Rates | Adapter interface (manual → Sabre → Hotelbeds) | Swap sources without UI rewrites |
| Documents | `docx` + Puppeteer/Chromium PDF | Itinerary + rate sheets |
| Hosting | Two Vercel projects, one repo | `APP_NAME=studio` \| `client` |
| Tests | Vitest | Domain rules (rates, RBAC, safe client payload) |
| Package manager | pnpm workspaces | Fast monorepo installs |

**Avoid day one:** microservices, two databases, GraphQL, heavy ORMs, Kubernetes, two repos that copy trip logic.

---

## 3. Folder structure (industry standard monorepo)

Use a **monorepo** from day one. Shared business rules live in `packages/`. Each website is a thin Next.js app.

```
pureluxe/
│
├── apps/
│   ├── studio/                         # Internal team site → studio.yourdomain.com
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   └── login/page.tsx
│   │   │   ├── (shell)/                # Sidebar layout for signed-in team
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx            # Home
│   │   │   │   ├── trip-builder/
│   │   │   │   ├── bookings/
│   │   │   │   ├── clients/
│   │   │   │   ├── trips/
│   │   │   │   ├── team/               # Team & Roles
│   │   │   │   └── settings/           # Branding · Rate sources
│   │   │   └── api/                    # Thin HTTP handlers only
│   │   │       ├── auth/
│   │   │       ├── clients/
│   │   │       ├── bookings/
│   │   │       ├── trips/
│   │   │       ├── trip-builder/
│   │   │       ├── team/
│   │   │       └── settings/
│   │   ├── components/                 # Studio-only UI
│   │   │   ├── shell/                  # Nav, top bar, user strip
│   │   │   ├── trip-builder/
│   │   │   ├── clients/
│   │   │   ├── bookings/
│   │   │   ├── team/
│   │   │   └── settings/
│   │   ├── middleware.ts               # Require Studio session; block /client
│   │   ├── next.config.ts
│   │   └── package.json
│   │
│   └── client/                         # Guest site → app.yourdomain.com
│       ├── app/
│       │   ├── (auth)/login/
│       │   ├── (shell)/                # Trips list · chat · itinerary/rates
│       │   └── api/
│       │       ├── auth/
│       │       ├── trips/
│       │       └── profile/
│       ├── components/
│       ├── middleware.ts               # Require guest session; block /studio
│       └── package.json
│
├── packages/
│   ├── domain/                         # Business rules — NO React
│   │   ├── package.json
│   │   └── src/
│   │       ├── trips/                  # publish, getTripForStudio/Client
│   │       ├── clients/
│   │       ├── bookings/
│   │       ├── rates/                  # Rate Layer (router + types)
│   │       ├── knowledge/              # Trust tiers only (no prices)
│   │       ├── documents/              # Doc assembly rules
│   │       └── permissions/            # assertPermission(role, module, action)
│   │
│   ├── db/                             # Supabase client + typed queries
│   │   └── src/
│   │       ├── client.ts
│   │       ├── clients.ts
│   │       ├── bookings.ts
│   │       ├── trips.ts
│   │       └── rates.ts
│   │
│   ├── ai/                             # Agents & tools
│   │   └── src/
│   │       ├── trip-builder/           # Studio chat agent + tools
│   │       └── client-chat/            # Curator / Assistant policies
│   │
│   ├── integrations/                   # External suppliers
│   │   └── src/
│   │       ├── sabre/
│   │       └── hotelbeds/
│   │
│   ├── auth/                           # Studio vs guest sessions
│   │   └── src/
│   │       ├── studio-session.ts
│   │       ├── guest-session.ts
│   │       └── google-oauth.ts
│   │
│   └── ui/                             # Optional shared primitives (Button, Input…)
│
├── supabase/
│   ├── migrations/                     # 001_….sql numbered migrations
│   └── seed/                           # Optional demo data
│
├── docs/
│   ├── studio/                         # Studio product + technical docs
│   └── client/                         # Client docs (future)
├── scripts/                            # One-off tsx jobs
├── package.json                        # pnpm workspaces root
├── pnpm-workspace.yaml
├── turbo.json                          # Optional: parallel lint/build
├── .env.example
└── README.md
```

### How to think about folders

| Layer | Owns | Does not own |
|---|---|---|
| `apps/*/app` | Routes, layouts, thin API handlers | Business rules |
| `apps/*/components` | Screens & widgets | DB queries, rate order |
| `packages/domain` | “Can this role publish?” “Which rate wins?” | React, HTTP |
| `packages/db` | SQL / Supabase access | UI |
| `packages/ai` | Prompts, tools, agent loops | Nav chrome |
| `packages/integrations` | Sabre / Hotelbeds HTTP | Product UI |
| `packages/auth` | Cookies, OAuth, session shape | Page layout |

**Rule of thumb:** if both Studio and Client need it, it belongs in `packages/`, not inside one app.

---

## 4. NPM packages

### 4.1 Root / workspace tooling

| Package | Purpose |
|---|---|
| `typescript` | Types across monorepo |
| `turbo` | Optional parallel `build` / `lint` / `test` |
| `prettier` | Format |
| `eslint` + `eslint-config-next` | Lint |
| `vitest` | Unit tests for `packages/domain` |
| `tsx` | Run scripts |
| `dotenv` | Local env for scripts |
| `zod` | Shared validation (also used in apps) |

### 4.2 Each Next app (`apps/studio`, `apps/client`)

| Package | Purpose |
|---|---|
| `next` | App Router framework |
| `react` / `react-dom` | UI |
| `tailwindcss` / `@tailwindcss/postcss` | Styling |
| `zod` | Validate request bodies |
| `date-fns` | Travel nights / date math |
| `clsx` or `class-variance-authority` | Class composition (optional, keep light) |

### 4.3 Shared runtime (`packages/*` consumers)

| Package | Where | Purpose |
|---|---|---|
| `@supabase/supabase-js` | `packages/db` | Postgres access (service role on server only) |
| `@anthropic-ai/sdk` | `packages/ai` | Claude for Trip Builder + Client chat |
| `google-auth-library` | `packages/auth` | Google OAuth |
| `iron-session` | `packages/auth` | Encrypted cookies (Studio ≠ guest secret) |
| `docx` | docs service | Word itinerary / rate sheet |
| `puppeteer-core` | docs service | PDF render |
| `@sparticuz/chromium` | studio (Vercel) | Chromium binary for serverless PDF |

### 4.4 Dev types

`@types/node` · `@types/react` · `@types/react-dom`

### 4.5 Do **not** add for this product scope

| Skip | Why |
|---|---|
| `googleapis` / `mailparser` / `mammoth` | Email extract / Inbox — out of scope |
| Prisma / Drizzle (day one) | SQL migrations + thin query layer is enough; add later if needed |
| GraphQL / tRPC | REST + RSC is enough for solo |
| Multiple UI kits (MUI + shadcn + …) | One Tailwind system only |
| Redux / heavy state libs | Server state + React is enough |
| Stripe / payment SDK | Only when guest pay phase starts |

### 4.6 Suggested `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 4.7 Env template (`.env.example`)

```bash
# Deploy
APP_NAME=studio                    # or client

# Database
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=         # server only — never in browser

# Auth (different secrets per product)
STUDIO_SESSION_SECRET=
GUEST_SESSION_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# AI
ANTHROPIC_API_KEY=

# Rate Layer (optional until live)
SABRE_CLIENT_ID=
SABRE_CLIENT_SECRET=
SABRE_USERNAME=
SABRE_PASSWORD=
HOTELBEDS_API_KEY=
HOTELBEDS_SECRET=
```

---

## 5. UI map

### 5.1 Studio navigation (signed-in)

```
Home
Trip Builder          ← primary daily workspace
Bookings
Clients
Trips                 ← list → open Trip Builder
────────────
Team & Roles          ← Admin
Settings              ← Admin (Branding · Rate sources)
```

No Inbox · Queue · Extract in this build.

### 5.2 Pages & what to build

| Route | Page | Main UI pieces |
|---|---|---|
| `/login` | Studio login | Brand · “Internal team only” · Sign in with Google · access-denied state |
| `/` | Home | Role-based “do first” cards (trips waiting, check-ins, deadlines) — keep small |
| `/trip-builder` | Trip Builder | Trip picker · **chat** · right sidebar: Overview · Rates & pricing · Proposal |
| `/bookings` | Bookings | Search · status filters · row → detail panel (edit / amend / cancel) |
| `/clients` | Clients | List + profile · Edit · Merge · Family · **Start trip** |
| `/trips` | Trips | Active / Upcoming / Past · open Trip Builder |
| `/team` | Team & Roles | Tabs: Members · Role permissions |
| `/settings` | Settings | Inner nav: Branding · Rate sources |

### 5.3 Trip Builder layout (core screen)

```
┌──────────┬────────────────────────────┬──────────────────────────┐
│ Studio   │ Chat                       │ Overview | Rates | Proposal
│ nav      │                            │                          │
│          │ Advisor ↔ assistant        │ Living trip truth        │
│          │ Hotel option cards         │                          │
│          │ [ message… ]               │                          │
└──────────┴────────────────────────────┴──────────────────────────┘
```

| Tab | Shows |
|---|---|
| **Overview** | Status, next action, travellers, legs, selected stay, client sell; team-only cost/margin |
| **Rates & pricing** | Options · Paste offline quote · Search suppliers · sell / margin / payment plan · **Lock for proposal** |
| **Proposal** | Itinerary PDF · Rate PDF · preview / download / regenerate · STALE if trip changed |

### 5.4 Client App layout

```
┌──────────────┬────────────────────────┬──────────────────────┐
│ My trips     │ Chat                   │ Itinerary | Rates    │
│ [New trip]   │ (Curator → Assistant)  │ Sell prices only     │
└──────────────┴────────────────────────┴──────────────────────┘
```

Guests never see: cost, margin, internal notes, Team, Settings, Bookings list.

### 5.5 Component ownership (keep manageable)

| Folder | Examples |
|---|---|
| `apps/studio/components/shell` | `Sidebar`, `TopBar`, `UserMenu` |
| `…/trip-builder` | `TripBuilderChat`, `TripSidebar`, `RateOptionCard`, `ProposalPanel` |
| `…/clients` | `ClientList`, `ClientProfile`, `MergeDialog` |
| `…/bookings` | `BookingTable`, `BookingDetailPanel` |
| `…/team` | `MembersTable`, `InviteForm`, `RolePermissionsEditor` |
| `…/settings` | `BrandingForm`, `RateSourcesForm` |
| `apps/client/components` | `TripList`, `GuestChat`, `ItineraryPanel`, `RateCards` |

Prefer **feature folders** over a flat `components/` dump of 200 files.

---

## 6. HTTP APIs

**Conventions**
- Studio APIs under `apps/studio/app/api/**` — require Studio session + `assertPermission`
- Client APIs under `apps/client/app/api/**` — require guest session; return **safe** fields only
- Handlers stay thin: validate (Zod) → call `packages/domain` + `packages/db` → JSON response
- Never put Rate Layer order or publish rules only inside a route file

### 6.1 Auth

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/google` | Start Studio Google OAuth |
| GET | `/api/auth/callback` | OAuth callback · create Studio session |
| POST | `/api/auth/logout` | Clear Studio session |
| GET | `/api/client/auth/google` | Start guest Google OAuth |
| GET | `/api/client/auth/callback` | Guest callback · bind `guest_users` |
| POST | `/api/client/auth/logout` | Clear guest session |

### 6.2 Team & Roles (Admin)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/team/members` | List members + invites |
| POST | `/api/team/members` | Invite member (email + role) |
| PATCH | `/api/team/members/[id]` | Change role · activate / deactivate |
| DELETE | `/api/team/invites/[id]` | Revoke pending invite |
| GET | `/api/team/roles` | Role → module → actions |
| PUT | `/api/team/roles/[role]` | Save permissions for one role |

### 6.3 Settings (Admin)

| Method | Path | Purpose |
|---|---|---|
| GET/PATCH | `/api/settings/branding` | Logo, colours, footer |
| GET/PATCH | `/api/settings/rate-sources` | Company rate preference + toggles |
| GET/POST/PATCH/DELETE | `/api/settings/rate-routing/offline-types` | Offline trip types CRUD |
| GET/POST/PATCH/DELETE | `/api/settings/rate-routing/wholesalers` | Wholesaler destinations CRUD |
| GET/POST/PATCH/DELETE | `/api/settings/rate-routing/high-value` | High-value routing CRUD |

### 6.4 Clients

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/clients` | List / search / VIP filter |
| POST | `/api/clients` | Create (human-confirmed) |
| GET/PATCH | `/api/clients/[id]` | Profile |
| POST | `/api/clients/merge` | Merge duplicates |
| GET/POST | `/api/clients/[id]/family` | Family links |
| POST | `/api/clients/[id]/start-trip` | Create trip + open Trip Builder |

### 6.5 Bookings

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/bookings` | Search / filter trusted stays |
| POST | `/api/bookings` | Manual create (ops) or from Trip Builder book action |
| GET/PATCH | `/api/bookings/[id]` | Detail · edit |
| POST | `/api/bookings/[id]/amend` | Amendment flow |
| POST | `/api/bookings/[id]/cancel` | Cancel |
| POST | `/api/bookings/[id]/supersede` | Replace with new version |

### 6.6 Trips (list)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/trips` | By stage (active / upcoming / past) |
| GET | `/api/trips/[id]` | Ops summary → deep-link Trip Builder |

### 6.7 Trip Builder

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/trip-builder/trips` | List / start trip |
| GET/PATCH | `/api/trip-builder/trips/[id]` | Trip shell |
| POST | `/api/trip-builder/trips/[id]/chat` | Advisor chat (streaming OK) |
| GET/PATCH | `/api/trip-builder/trips/[id]/line-items/[itemId]` | Update / select line item |
| POST | `/api/trip-builder/trips/[id]/rate-drafts` | Paste offline quote → draft |
| PATCH | `/api/trip-builder/rate-drafts/[id]` | Approve / reject draft |
| POST | `/api/trip-builder/trips/[id]/rates/search` | Rate Layer live search |
| POST | `/api/trip-builder/trips/[id]/lock-pricing` | Lock sell + payment plan |
| POST | `/api/trip-builder/trips/[id]/documents` | Generate itinerary / rate sheet |
| GET | `/api/trip-builder/documents/[id]/preview` | Preview |
| GET | `/api/trip-builder/documents/[id]/download` | Download |
| POST | `/api/trip-builder/trips/[id]/publish` | Mark ready / shared for Client |

### 6.8 Client App

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/trips` | Guest’s trips (safe) |
| POST | `/api/trips` | Start “building” trip for self |
| GET | `/api/trips/[id]` | Safe trip detail |
| POST | `/api/trips/[id]/chat` | Curator / Assistant chat |
| POST | `/api/trips/[id]/line-items/[itemId]/lean` | Lean toward option |
| GET | `/api/trips/[id]/documents` | Confirmation docs only |
| GET/PATCH | `/api/profile` | Guest self profile |

### 6.9 Shared domain functions (not HTTP)

Put these in `packages/domain` and call from APIs:

| Function | Job |
|---|---|
| `assertPermission(member, module, action)` | RBAC gate |
| `resolveRateRouting(ctx)` | Which path (offline / wholesale / GDS+bedbank) |
| `resolveRates(ctx)` | Call adapters in order · return normalized options |
| `lockTripPricing(tripId, sell, plan)` | Freeze sell for proposal |
| `publishTripForClient(tripId)` | `draft` → `ready` / `shared` |
| `getTripForStudio(tripId)` | Full commercial payload |
| `getTripForClient(tripId)` | Strip cost, margin, internal notes |

---

## 7. Database

**Engine:** PostgreSQL (Supabase)  
**Access:** Server uses **service role**. Browser never gets the service key. Auth enforced in APIs.

### 7.1 Entity map

```
team_members ← studio_invites
role_permissions
guest_users → clients / families

clients ←→ families ←→ family_members
   │
   ├── trips ←→ trip_clients
   │      ├── trip_legs → trip_itinerary_days
   │      ├── trip_line_items / trip_line_item_drafts
   │      ├── trip_chat_messages          (Studio)
   │      ├── client_chat_messages        (Client)
   │      └── trip_documents
   │
   └── bookings (trip_id → trips)

document_branding · company_settings
offline_trip_types · wholesaler_destinations · high_value_routing
properties
destination_facts · property_facts     (KB — no prices)
```

### 7.2 Naming

Use table name **`trips`** (clear planning truth). All FKs point at `trips`.

### 7.3 Conventions

- PK: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- Timestamps: `created_at` / `updated_at timestamptz NOT NULL DEFAULT now()`
- Money: `numeric` + `currency text`
- Statuses: lowercase text + CHECK
- Soft flags: `active boolean`, `is_demo boolean` where useful

---

### 7.4 Identity & RBAC

```sql
CREATE TABLE team_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL UNIQUE,
  role       text NOT NULL CHECK (role IN ('advisor','ops','finance','admin')),
  title      text,
  phone      text,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE studio_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  role         text NOT NULL CHECK (role IN ('advisor','ops','finance','admin')),
  invited_by   uuid REFERENCES team_members(id),
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','accepted','revoked')),
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX studio_invites_pending_email_idx
  ON studio_invites (lower(email))
  WHERE status = 'pending';

CREATE TABLE role_permissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role       text NOT NULL CHECK (role IN ('advisor','ops','finance','admin')),
  module     text NOT NULL,  -- trip_builder | bookings | clients | trips | team | settings
  action     text NOT NULL,  -- view | create | edit | merge | lock_pricing | publish | invite
  allowed    boolean NOT NULL DEFAULT true,
  UNIQUE (role, module, action)
);

CREATE TABLE guest_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  client_id     uuid,          -- FK added after clients exists
  family_id     uuid,          -- FK added after families exists
  status        text NOT NULL DEFAULT 'pending_access'
                  CHECK (status IN ('active','pending_access','disabled')),
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

---

### 7.5 Settings

```sql
CREATE TABLE document_branding (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name  text NOT NULL DEFAULT 'PureLuxe',
  logo_path     text,
  primary_color text,
  footer_html   text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE company_settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text UNIQUE NOT NULL,   -- e.g. 'rate_sources'
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Example company_settings.value for key = 'rate_sources':
-- {
--   "allow_offline_paste": true,
--   "preference_order": ["special","offline","gds","bedbank","manual"]
-- }
```

---

### 7.6 Clients & families

```sql
CREATE TABLE clients (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name            text NOT NULL,
  title                text,
  first_name           text,
  last_name            text,
  email                text,
  phone                text,
  whatsapp             text,
  nationality          text,
  city_of_residence    text,
  relationship_owner   uuid REFERENCES team_members(id),
  vip_level            text NOT NULL DEFAULT 'standard',
  client_since         date,
  company              text,
  loyalty_programs     jsonb NOT NULL DEFAULT '[]'::jsonb,
  birthday             date,
  anniversary          date,
  general_notes        text,   -- may inform guest agent
  internal_notes       text,   -- NEVER returned by Client APIs
  active               boolean NOT NULL DEFAULT true,
  normalized_name      text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE client_preferences (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  key        text NOT NULL,
  value      text,
  UNIQUE (client_id, key)
);

CREATE TABLE families (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_name text NOT NULL,
  notes       text,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE family_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  client_id  uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member',  -- primary | spouse | child | assistant
  is_primary boolean NOT NULL DEFAULT false,
  UNIQUE (family_id, client_id)
);

-- After clients/families exist:
ALTER TABLE guest_users
  ADD CONSTRAINT guest_users_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES clients(id),
  ADD CONSTRAINT guest_users_family_id_fkey
    FOREIGN KEY (family_id) REFERENCES families(id);
```

---

### 7.7 Trips (Trip Builder truth)

```sql
CREATE TABLE trips (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_client_id  uuid REFERENCES clients(id),
  status             text NOT NULL DEFAULT 'building'
                       CHECK (status IN ('building','quoted','confirmed','itinerary_sent')),
  title              text,
  created_by         text NOT NULL,              -- advisor email
  client_visibility  text NOT NULL DEFAULT 'draft'
                       CHECK (client_visibility IN ('draft','ready','shared')),
  published_at       timestamptz,
  sell_total         numeric,
  sell_currency      text,
  margin_internal    numeric,                    -- Studio only
  payment_plan       jsonb,                      -- { "deposit_pct": 40, "balance_pct": 60 }
  pricing_locked_at  timestamptz,
  is_demo            boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trip_clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  client_id  uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'companion'
               CHECK (role IN ('primary','companion')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, client_id)
);

CREATE TABLE trip_legs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id           uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sequence_order    integer NOT NULL,
  destination       text NOT NULL,
  check_in          date,
  check_out         date,
  itinerary_status  text NOT NULL DEFAULT 'not_started'
                      CHECK (itinerary_status IN ('not_started','drafted','confirmed')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trip_itinerary_days (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  leg_id     uuid NOT NULL REFERENCES trip_legs(id) ON DELETE CASCADE,
  day_num    integer NOT NULL,
  date       date,
  title      text,
  items      jsonb NOT NULL DEFAULT '[]'::jsonb,
  source     text NOT NULL
               CHECK (source IN ('kb','llm_general','advisor_manual')),
  verified   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trip_line_items (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                   uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  leg_id                    uuid REFERENCES trip_legs(id) ON DELETE CASCADE,
  category                  text NOT NULL
                              CHECK (category IN ('accommodation','activity','transfer','flight')),
  title                     text NOT NULL,
  subtitle                  text,
  details                   text,
  unit                      text CHECK (unit IN ('night','person','flat')),
  quantity                  numeric,
  rate_per_unit             numeric,              -- sell-facing
  currency                  text,
  tax_percentage            numeric,
  cost_internal             numeric,              -- Studio only
  rate_source_code          text,                 -- special|offline|sabre|hotelbeds|wholesaler|manual
  inclusions                jsonb NOT NULL DEFAULT '[]'::jsonb,
  cancellation_policy       text,
  payment_policy            text,
  breakdown                 jsonb,
  property_name             text,
  room_size                 text,
  room_features             jsonb,
  loyalty_hotel_eligible    boolean,
  loyalty_pureluxe_eligible boolean,
  segments                  jsonb,                -- flights
  status                    text NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','confirmed')),
  selected                  boolean NOT NULL DEFAULT false,
  source                    text NOT NULL DEFAULT 'manual'
                              CHECK (source IN ('manual','offline_kb','api')),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trip_line_item_drafts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  leg_id         uuid REFERENCES trip_legs(id) ON DELETE CASCADE,
  raw_input      text NOT NULL,
  extracted_json jsonb,
  status         text NOT NULL DEFAULT 'pending_review'
                   CHECK (status IN ('pending_review','approved','rejected')),
  created_by     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trip_documents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id            uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  type               text NOT NULL CHECK (type IN ('itinerary','rate_sheet')),
  file_path          text NOT NULL,
  generated_at       timestamptz NOT NULL DEFAULT now(),
  source_updated_at  timestamptz NOT NULL
);

CREATE TABLE trip_chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  role       text NOT NULL,
  content    text NOT NULL,
  tool_calls jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE client_chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user','assistant')),
  content    text NOT NULL,
  tool_calls jsonb,
  mode       text CHECK (mode IN ('discover','execute')),  -- Curator vs Assistant
  is_demo    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

### 7.8 Bookings

```sql
CREATE TABLE bookings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid REFERENCES clients(id),
  trip_id               uuid REFERENCES trips(id),
  client_name           text,
  property_id           uuid,
  hotel_name            text,
  city                  text,
  country               text,
  chain                 text,
  num_rooms             integer,
  num_adults            integer,
  num_children          integer,
  booked_by             uuid REFERENCES team_members(id),
  booking_source        text,                         -- trip_builder | manual_ops
  booking_channel       text,
  hotel_ref             text,
  gds_ref               text,
  check_in              date NOT NULL,
  check_out             date NOT NULL,
  nights                integer,
  total_cost            numeric,
  currency              text,
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN (
                            'pending','confirmed','cancelled','checked_out','superseded'
                          )),
  cancellation_deadline date,
  cancellation_policy   text,
  vip_flag              boolean NOT NULL DEFAULT false,
  vvip_flag             boolean NOT NULL DEFAULT false,
  special_occasion      text,
  notes                 text,
  internal_notes        text,                         -- never Client API
  is_demo               boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bookings_client_id_idx ON bookings(client_id);
CREATE INDEX bookings_trip_id_idx ON bookings(trip_id);
CREATE INDEX bookings_status_check_in_idx ON bookings(status, check_in);
```

---

### 7.9 Rate Layer config + properties

```sql
CREATE TABLE properties (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  destination           text,
  sabre_hotel_code      text,
  hotelbeds_hotel_code  text,
  active                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE offline_trip_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_type  text NOT NULL UNIQUE,   -- safari, yacht, …
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wholesaler_destinations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination     text NOT NULL,
  wholesaler_name text NOT NULL,
  api_source      text NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE high_value_routing (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination      text,
  property_id      uuid REFERENCES properties(id),
  wholesale_source text NOT NULL,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT high_value_one_scope CHECK (
    (destination IS NOT NULL AND property_id IS NULL) OR
    (destination IS NULL AND property_id IS NOT NULL)
  )
);
```

**Rate Layer order in code (`packages/domain/rates`):**

1. Negotiated / PureLuxe special  
2. Specialist / offline (`offline_trip_types` / high-value) — never skip to generic  
3. GDS (Sabre)  
4. Bedbank (Hotelbeds)  
5. Manual / consultant required  

---

### 7.10 Knowledge (no prices)

```sql
CREATE TABLE destination_facts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination text NOT NULL,
  content     jsonb NOT NULL DEFAULT '{}'::jsonb,
  trust_tier  text NOT NULL DEFAULT 'verified'
                CHECK (trust_tier IN ('verified','general','advisor_added')),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE property_facts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id),
  destination text,
  content     jsonb NOT NULL DEFAULT '{}'::jsonb,
  trust_tier  text NOT NULL DEFAULT 'verified'
                CHECK (trust_tier IN ('verified','general','advisor_added')),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

---

### 7.11 Suggested migration order

| File | Contents |
|---|---|
| `001_team_and_rbac.sql` | `team_members`, `studio_invites`, `role_permissions` |
| `002_clients_families.sql` | clients, preferences, families, members |
| `003_guest_users.sql` | `guest_users` + FKs |
| `004_settings.sql` | branding, company_settings |
| `005_properties_and_rates_config.sql` | properties + rate routing tables |
| `006_trips.sql` | trips + legs + itinerary + line items + drafts + docs + chats |
| `007_bookings.sql` | bookings |
| `008_knowledge.sql` | destination_facts, property_facts |
| `009_seed_role_permissions.sql` | Default Advisor / Ops / Finance / Admin actions |

---

### 7.12 Status cheat sheet

| Area | Values |
|---|---|
| Invite | `pending` · `accepted` · `revoked` |
| Guest | `pending_access` · `active` · `disabled` |
| Trip | `building` · `quoted` · `confirmed` · `itinerary_sent` |
| Client visibility | `draft` · `ready` · `shared` |
| Leg itinerary | `not_started` · `drafted` · `confirmed` |
| Line item | `pending` · `confirmed` |
| Rate draft | `pending_review` · `approved` · `rejected` |
| Booking | `pending` · `confirmed` · `cancelled` · `checked_out` · `superseded` |
| Document | `itinerary` · `rate_sheet` |
| Chat mode | `discover` · `execute` |
| Rate source | `special` · `offline` · `sabre` · `hotelbeds` · `wholesaler` · `manual` |

---

## 8. Build order (from scratch)

Build in dependency order so each step is usable alone.

| Phase | Deliverable | Done when |
|---|---|---|
| **0** | Monorepo scaffold · Supabase · env · two Vercel projects | `apps/studio` boots; DB migrations apply |
| **1** | Studio login + Team & Roles | Invite → Google sign-in → role-gated Home |
| **2** | Clients + Bookings CRUD UI/API | Search, edit, merge; manual booking entry |
| **3** | Trip Builder V1 | Chat creates trip/legs/itinerary; Overview sidebar works |
| **4** | Rate Layer V1 | Paste → draft → approve → set sell → lock → docs |
| **5** | Settings | Branding on PDFs; rate-source rules drive routing |
| **6** | Publish gate | `getTripForClient` strips secrets; publish endpoint |
| **7** | Client App | Guest login · trip workspace · Curator chat (read approved) |
| **8** | Live rates | Sabre + Hotelbeds adapters behind same Rate Layer API |

**Do not start with:** email extract, Inbox, Queue-from-mail.

---

## 9. Deploy, security, tests

### 9.1 Deploy

| Vercel project | Domain | Env |
|---|---|---|
| `pureluxe-studio` | `studio.…` | `APP_NAME=studio` |
| `pureluxe-client` | `app.…` | `APP_NAME=client` |

Both point at the same GitHub repo and same Supabase project.

Local:

```bash
pnpm --filter @pureluxe/studio dev
pnpm --filter @pureluxe/client dev
```

### 9.2 Security checklist

- [ ] Studio cookie ≠ guest cookie (different secrets / cookie names)  
- [ ] Service role key server-only  
- [ ] Client APIs use `getTripForClient` only  
- [ ] Guests cannot hit Studio routes (middleware)  
- [ ] Inactive / uninvited Google accounts denied  
- [ ] No raw card data in DB  
- [ ] `.env.example` placeholders only — no secrets in git  

### 9.3 Tests worth writing first

| Test | Why |
|---|---|
| Rate Layer order + offline never → generic | Commercial advantage |
| `getTripForClient` omits cost / margin / internal notes | Guest safety |
| Publish blocks Client until `ready`/`shared` | Review gate |
| Uninvited / inactive member cannot enter Studio | Access control |
| Default Finance role cannot create trips | RBAC |

---

## 10. One-page remember

| Topic | Decision |
|---|---|
| Repo | One monorepo · `apps/studio` + `apps/client` + `packages/*` |
| Rules | Always in `packages/domain` — not only in React |
| Packages | Next · Tailwind · Supabase · Claude · iron-session · Zod · docx/PDF · Sabre/Hotelbeds later |
| UI | Studio shell + Trip Builder three tabs; Client three columns |
| APIs | Thin handlers · Zod · domain functions |
| DB | `trips` is planning truth · Rate config tables · invites/roles/guests |
| Skip | Email extract / Inbox / Queue-from-mail |

> Product brief = *what the product does*.  
> This file = *how to build it cleanly from scratch* — folders, packages, screens, APIs, and schemas that stay easy to understand and manage.
