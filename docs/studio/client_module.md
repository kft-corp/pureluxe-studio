# PureLuxe Studio — Client Module

**Who this is for:** Engineers building or extending Clients in Studio.  
**One sentence:** Know who the guest is, keep that truth clean, and make every trip personal.
**Status:** Studio CRM slice is shipped (directory → register → profile CRUD). Bookings, trips, guest invite, and merge actions are deferred.

> **Canonical for Studio Clients:** Prefer this file + migrations `003`–`009` over older wording in [`technical-design.md`](./technical-design.md). Schema work still waiting on Bookings/Trips: [`client_deferred_fks.md`](./client_deferred_fks.md).

---

## 1. Product framing

PureLuxe is a luxury travel operating system. Advisors work in **Studio**. Guests will use a separate **Client App** later (not in this codebase yet).

The **Client module** is the people layer: identity, preferences, household, documents, health, and audit. Trip Builder and Bookings will consume it; they are not wired yet.

**Non-negotiables (enforced in Studio today)**

1. **One client record per person** — no duplicate Studio models for guest vs team.
2. **Human-confirmed identity** — Studio create requires an advisor; new Studio clients start as **pending** until approved.
3. **Two note types** — *guest notes* may inform guest experience later; *internal notes* stay in Studio only.
4. **Family is explicit** — never auto-merge people because they share a surname.
5. **No spend on `clients`** — lifetime spend / stay counts are computed later from bookings, never denormalized onto the client row.

---

## 2. Users and permissions

Studio access is invite-only Google OAuth (see [`auth_team_module.md`](./auth_team_module.md)). Clients itself only checks two permission slugs:

| Permission | What it unlocks |
|---|---|
| `clients.read` | Nav, directory, search, filters, profile GET, document download URL, family search |
| `clients.write` | Create, edit, approve, deactivate, preferences, documents, health, household, relationships |

**Default seeded roles (migration `002`)**

| Role | Clients access |
|---|---|
| `advisor` | read + write |
| `ops` | read + write |
| `finance` | none (unless granted in Role permissions) |
| `admin` | all permissions |

There is no separate `clients.approve` / `clients.delete` / `clients.manage` — approve and soft-deactivate use `clients.write`.

---

## 3. Module boundaries

| Module | Relationship today |
|---|---|
| **Team / Auth** | Gates Clients via `clients.read` / `clients.write` |
| **Trip Builder** | Route reserved: `/trip-builder?primary_client_id=…` — UI **Start trip** is disabled |
| **Bookings / Trips** | Profile stats + Trips tab are placeholders; FKs deferred |
| **Client App** | Schema has `guest_users`; no Studio invite UI/API yet |
| **Trainer** | Spec only — not connected |

**Pending review** lives inside Clients (directory filter + profile Approve CTA). There is no separate Queue module.

---

## 4. Information architecture (Studio)

### 4.1 Pages

| Path | Purpose |
|---|---|
| `/clients` | Directory — search, chips, advanced filters, pagination |
| `/clients/new` | Register form (full page; requires `clients.write`) |
| `/clients/[id]` | Profile — hero + tabs |

```
/clients
  ├── search + quick chips + More filters
  ├── table / cards + pagination
  └── [ + New client ] → /clients/new

/clients/[id]
  ├── Hero: name, VIP badge, review badge, household line, completeness
  ├── Actions: Approve (if pending) · Edit contact · Start trip (disabled) · ⋯ Deactivate
  └── Tabs: Overview · Preferences · Documents · Health · Household · Activity · Trips
```

### 4.2 Profile tabs (implemented)

| Tab | Contents |
|---|---|
| **Overview** | Contact, identity, location, notes, important dates; jump cards into other tabs |
| **Preferences** | Add / edit / confirm / remove preferences by category |
| **Documents** | Upload (PDF/JPEG/PNG/WebP ≤10MB), verify / reject / remove, open signed URL |
| **Health** | Dietary, mobility, medication, emergency contact, share-with-hotels |
| **Household** | Create / join family, members + roles, related people (non-household links) |
| **Activity** | Recent audit log + read-only possible duplicates (no merge action) |
| **Trips** | Placeholder until Bookings / Trips ship |

### 4.3 Visibility rules (Studio)

| Field / surface | Advisor / Ops with write | Read-only |
|---|---|---|
| Guest notes | Edit | View |
| Internal notes | Edit | View |
| Health | Edit | View |
| Documents | Upload / verify / reject | View + download if permitted |
| Approve / deactivate | Write only | Hidden |

---

## 5. User journeys (Studio — shipped)

### Journey A — Find and open a client

1. Open `/clients`.
2. Search by name, email, or phone (debounced).
3. Optionally use chips (`Has family`, `Missing contact`, `Mine`) or **More filters**.
4. Open a row → `/clients/[id]`.

### Journey B — Register a new client

1. **New client** → `/clients/new` (needs `clients.write`).
2. Enter preferred name + email and/or phone (required contact).
3. Optional: tier, nationality, notes, important dates.
4. Save → client created with `source: studio`, `review_status: pending`, default tier **Standard**.
5. Similar-name matches may be shown; land on profile.

### Journey C — Approve a pending client

1. Open a pending profile (or filter directory by review status).
2. Click **Approve client**.
3. `review_status` → `approved`; audit row written.

### Journey D — Capture preferences / documents / health

1. On profile, open the relevant tab.
2. Add or edit via dialogs; documents upload to private storage bucket `client-documents`.
3. Completeness score refreshes after writes that affect it.

### Journey E — Household and related people

1. **Household** tab → create or join a household, add members, set roles / primary.
2. Link non-household related people (assistant, travel companion, etc.).
3. Leave household or remove a member when needed.

### Journey F — Deactivate

1. Profile **⋯** → Deactivate → confirm.
2. Soft-delete (`active = false`); removed from active directory; history kept.

---

## 6. Data model

Migrations: `003_studio_clients.sql` … `009_client_household_perf_indexes.sql`.  
Types/queries: `packages/db` (`schema/clients.ts`, `queries/clients/`).

### 6.1 Entity relationship (Studio-owned)

```
client_tiers 1───* clients
clients 1───* client_preferences
clients 1───1 client_health_profiles
clients 1───* client_documents
clients *───* clients          (client_relationships)
clients *───* families         (family_members)
clients 1───* client_audit_log
clients *───* clients          (client_merge_candidates — read-only in UI)
clients 1───* guest_users      (schema only; no Studio product UI yet)
```

### 6.2 Core tables (summary)

| Table | Purpose |
|---|---|
| `client_tiers` | Standard / VIP / VVIP (slugs); `clients.tier_id` FK |
| `clients` | Identity, contact, address, notes, review, completeness, soft-delete |
| `client_preferences` | Categorized prefs with sentiment + confirmation |
| `client_health_profiles` | Dietary / mobility / emergency (1:1) |
| `client_documents` | Passport/visa/insurance/other + storage path + status |
| `client_relationships` | Non-household related people |
| `families` / `family_members` | Household membership + roles |
| `client_audit_log` | Field / action audit |
| `client_merge_candidates` | Suggested duplicates (list only) |
| `guest_users` | Future Client App linkage |
| `family_booking_members` | Schema for per-booking party; FK to `bookings` deferred |

### 6.3 Key `clients` fields

| Field | Notes |
|---|---|
| `display_name` | Preferred name (required) |
| `email` / `phone` | At least one required on create/update |
| `tier_id` | FK → `client_tiers` (not a free-text VIP string) |
| `source` | `studio` \| `trip_builder` \| `client_app` \| `import` |
| `review_status` | `pending` \| `approved` |
| `profile_completeness` | 0–100, recomputed on relevant writes |
| `guest_notes` / `internal_notes` | Guest-safe vs Studio-only |
| `active` | Soft-delete flag |

### 6.4 Profile completeness

Stored on `clients.profile_completeness`. Recomputed from core fields + signals (preference present, verified passport, family, health basics). Hints drive “Next: …” on the profile hero.

### 6.5 Storage

- Bucket: `client-documents` (private)
- Max size: 10 MB
- MIME: PDF, JPEG, PNG, WebP
- Access via signed upload/download URLs from Studio APIs

---

## 7. Domain logic (Studio lib)

Business rules live in `apps/studio/lib/clients/` (same pattern as `lib/team`).

| Module | Responsibility |
|---|---|
| `create-client` | Studio create → pending + default tier + similar names + audit |
| `approve-client` / `deactivate-client` | Lifecycle |
| `update-client` | Whitelisted PATCH, conflict via `If-Unmodified-Since`, completeness |
| `client-directory` / `client-filters` | List + filter catalog (`CLIENT_DIRECTORY_PAGE_SIZE = 10`) |
| `client-profile` | Aggregate profile (prefs, health, docs, family, relationships, audit) |
| `client-preferences` / `upsert-client-health` / `client-documents` | Nested writes + completeness refresh |
| `client-family` / `client-relationships` | Household + related people |
| `client-tiers` | Resolve tier by id/slug/default |
| `profile-completeness` / `refresh-client-completeness` | Score + hints |
| `require-active-client` | Shared 404 guard for active clients |
| `client-format` | Display helpers |
| `confirm-dialog-config` | Deactivate / document confirm copy |

HTTP client helpers: `apps/studio/lib/api/clients.ts`.  
Routes constants: `apps/studio/lib/routes/pages.ts`, `api.ts`.  
Messages / Zod: `packages/shared/src/messages/clients.ts`, `validation/clients.ts`.

---

## 8. Features — Studio (status)

### 8.1 Directory — **shipped**

- Search (name / email / phone)
- Quick chips: has family, missing contact, mine
- Advanced filters: tier, review status, owner, sources, completeness, created date range, family/contact toggles
- Sort (server); pagination
- VIP / pending badges; open profile

Stats columns (last booking / spend) are **stubbed zeros** until Bookings.

### 8.2 Create client — **shipped**

- Full page `/clients/new` (not a modal)
- Requires email or phone
- Always `review_status: pending` when created in Studio
- Default tier = Standard (`client_tiers.is_default`)

### 8.3 Profile overview — **shipped**

- Section edit dialogs: identity, contact, location, notes, dates, health
- Completeness meter + next hint
- Approve CTA when pending
- Deactivate under more menu
- **Start trip** button present but disabled

### 8.4 Preferences — **shipped**

Add / edit / confirm / soft-remove; advisor-sourced; confirmation tracked.

### 8.5 Health — **shipped**

Upsert health profile; refreshes completeness.

### 8.6 Documents — **shipped**

Upload, verify, reject, remove, signed view URL; sorted by expiry urgency in UI.

### 8.7 Household & relationships — **shipped**

Create / join / rename household; add / edit / remove members; leave; link / unlink related people.

### 8.8 Activity — **partial**

- Recent audit: **shipped**
- Possible duplicates list: **read-only** (no merge / dismiss API)

### 8.9 Trips / bookings / guest access / merge — **deferred**

| Feature | Status |
|---|---|
| Trips tab content | Placeholder copy |
| Booking / spend stats | Always `0` / null |
| Start trip → Trip Builder | Route helper exists; UI disabled |
| Invite to Client App | `guest_users` table only |
| Merge duplicates | Candidates readable; no merge API/UI |
| Export directory | Not built |

See [`client_deferred_fks.md`](./client_deferred_fks.md) for FK work when Bookings/Trips land.

---

## 9. Features — Client App (guest)

**Not implemented in this repo.** Product intent (for later):

- Guest Google sign-in linked via `guest_users`
- Self-edit of a safe field set (phone, documents, dietary, etc.)
- Never see internal notes, cost, or margin
- Trips only when `client_visibility = shared`

Until then, treat §9 as product backlog, not Studio scope.

---

## 10. API design (Studio)

### 10.1 Conventions

- Permission: `requireApiPermission("clients.read" | "clients.write")`
- Success: `{ data, message? }` via shared API helpers
- Errors: `AppError` + `clientMessages`
- Optimistic concurrency on PATCH client: optional `If-Unmodified-Since` → 409 conflict

### 10.2 Endpoints

| Method | Path | Perm | Purpose |
|---|---|---|---|
| GET | `/api/clients` | read | Directory list |
| POST | `/api/clients` | write | Create |
| GET | `/api/clients/search` | read | Autocomplete (max 10) |
| GET | `/api/clients/filters` | read | Filter catalog |
| GET | `/api/clients/[id]` | read | Profile aggregate |
| PATCH | `/api/clients/[id]` | write | Update core fields |
| DELETE | `/api/clients/[id]` | write | Soft-deactivate |
| POST | `/api/clients/[id]/approve` | write | Approve |
| PUT | `/api/clients/[id]/health` | write | Upsert health |
| POST | `/api/clients/[id]/preferences` | write | Add preference |
| PATCH | `/api/clients/[id]/preferences/[prefId]` | write | Update / confirm / remove |
| POST | `/api/clients/[id]/documents` | write | Create + signed upload |
| PATCH | `/api/clients/[id]/documents/[docId]` | write | Update / verify / reject |
| DELETE | `/api/clients/[id]/documents/[docId]` | write | Remove |
| GET | `/api/clients/[id]/documents/[docId]/url` | read | Signed download |
| POST / PATCH / DELETE | `/api/clients/[id]/family` | write | Household ops |
| POST | `/api/clients/[id]/relationships` | write | Link related person |
| DELETE | `/api/clients/[id]/relationships/[relId]` | write | Unlink |
| GET | `/api/families/search` | read | Household name search |

### 10.3 Profile aggregate (conceptual)

```
ClientProfile {
  client: Client & {
    tier, relationship_owner, stats (stub),
    family?, preferences[], health_profile?,
    documents[], relationships[],
    merge_candidates[], recent_audit[]
  }
  bookings: []   // until Bookings
  trips: []      // until Trips
}
```

---

## 11. Code map (Studio)

| Area | Path |
|---|---|
| Pages | `apps/studio/app/(shell)/clients/` |
| API routes | `apps/studio/app/api/clients/`, `app/api/families/` |
| UI | `apps/studio/components/clients/` |
| Domain | `apps/studio/lib/clients/` |
| API client | `apps/studio/lib/api/clients.ts` |
| DB | `packages/db/src/schema/clients.ts`, `queries/clients/` |
| Validation / messages | `packages/shared/src/validation/clients.ts`, `messages/clients.ts` |
| Migrations | `supabase/migrations/003`–`010` |

UI patterns worth reusing: `use-clients-directory`, `use-client-profile`, shared `ConfirmDialog`, `StudioSearchField`, `ActionButton`, section edit forms.

### Performance notes (keep in mind)

- Profile nested lists are **capped** (`PROFILE_LIST_LIMITS` in `client-limits.ts`).
- Directory filter catalog does **not** scan all clients (static enums + team owners).
- Directory counts use PostgREST **estimated** count; default page size is **10**.
- Completeness refresh uses SQL RPC `refresh_client_profile_completeness`.
- Document create is `pending_upload` until file confirm; purge helpers exist for stale uploads / old audit / inactive prefs (`010_client_perf_lifecycle.sql`).
- Profile mutations update client state without a redundant `router.refresh()`.

---

## 12. Do not change without product review

- Do not store spend / booking counts on `clients`
- Do not hard-delete clients (soft-deactivate only)
- Do not auto-approve Studio-created clients
- Do not expose `internal_notes` to any future guest API
- Do not invent people from AI without human confirmation

---

## 13. Related docs

| Doc | Use |
|---|---|
| [`auth_team_module.md`](./auth_team_module.md) | Login, RBAC, Team & Roles, Account |
| [`client_deferred_fks.md`](./client_deferred_fks.md) | FKs / UI blocked on Bookings & Trips |
| [`technical-design.md`](./technical-design.md) | Broader system design (may lag; prefer this file for Clients) |
