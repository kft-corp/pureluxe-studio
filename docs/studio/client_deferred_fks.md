# Client module — future schema changes

Client tables already exist (`003`–`005`). This file is only the **database schema work still required** when later modules create `bookings`, `trips`, and related tables. Do not recreate Client tables. Do not add spend, stay count, or last-booking columns onto `clients`.

Canonical product spec: [`client_module.md`](./client_module.md) (§6 data model, §8 deferred features).

---

## 0. Studio UI — blocked on other modules

Studio Clients UI (Option A):

| Route | Purpose |
|---|---|
| `/clients` | Calm directory — search, filters, open profile |
| `/clients/new` | Register form (full page; requires `clients.write`) |
| `/clients/[id]` | Profile — contact, notes, household, prefs, docs, health; **booking / trip history after Bookings + Trips ship** |

Create uses a **full page** at `/clients/new`. Edit uses section dialogs on the profile page. Deactivate is under the profile **⋯** menu.


These features are **not in the UI yet** (or stay placeholder text) until their modules exist:

| Feature | Depends on | Why |
|---|---|---|
| **Start trip** | Trip Builder + `trips` / `trip_clients` | Pre-load client into a new trip |
| **Booking history + Trip history** (client detail tabs) | Bookings module + Trips module | After both modules are complete, add booking history and trip history on `/clients/[id]` (read-first summary + deep links). Stats/spend stay computed — not stored on `clients` |
| **Merge** | Merge API + ops UI | Spec exists; not wired in this UI slice |
| **Invite to Client App** | Guest invite API | Spec §8.9 / §9 |

Preferences and household (family + related people) now have write APIs and Studio UI on the profile tabs.

**When Bookings and Trips are complete:** add **booking history** and **trip history** to the client details page (`/clients/[id]`), via the profile Trips tab (or equivalent). Keep that surface read-first (recent stays / open trips + links into `/bookings` and Trip Builder). Do **not** denormalize spend onto `clients`.

---

## 0.1 Lifecycle cleanup — schedule the purge jobs

Migration `010_client_perf_lifecycle.sql` adds three SQL helpers that clean old Client data. They do **not** run by themselves.

| Function | What it removes | Default age |
|---|---|---|
| `purge_stale_client_document_uploads` | Document rows stuck in `pending_upload` (file never finished uploading) | 24 hours |
| `purge_old_client_audit_logs` | Old rows in `client_audit_log` | 365 days |
| `purge_inactive_client_preferences` | Soft-deleted preferences (`active = false`) | 90 days |

**Why schedule them:** Incomplete uploads, audit history, and removed preferences will keep growing. A nightly (or weekly) job keeps the database tidy and avoids leftover orphan documents.

**If you skip scheduling:** the Clients app still works, but storage and audit tables can grow over time with data you no longer need.

Wire these with `pg_cron`, a Supabase scheduled function, or any ops cron that can call Postgres — for example:

```sql
SELECT public.purge_stale_client_document_uploads();
SELECT public.purge_old_client_audit_logs();
SELECT public.purge_inactive_client_preferences();
```

---

## 0.2 Future notes — product & code leftovers

Scale / over-fetch P0 work is largely done (slim writes, nested list caps, filter catalog, estimated counts, completeness RPC, `pending_upload`, purge helpers). What follows is still open for later.

### Product (still very important)

| Item | Notes |
|---|---|
| **Merge** | Candidates are capped on the profile; still **no merge generator + merge UI**. Ops can’t clean duplicates until both exist. |
| **Guest invite / Client App access** | Spec’d; `guest_users` exists; no Studio invite flow yet. |
| **Start trip + booking / spend / last stay** | Wire when Trip Builder and Bookings exist. Keep stats computed — do not store spend on `clients`. |
| **Export / bulk approve** | Ops pain once the pending queue grows (export directory; approve many / assign owner in bulk). |

### Code leftovers (nice; not as urgent as former P0)

| Item | Notes |
|---|---|
| **True lazy-load by tab** | Nested lists are capped, but still loaded on the full profile GET. Prefer per-tab list APIs when profiles get heavy. |
| **Profile mutation sequencing** | Directory has a generation/race guard; profile `setProfile` can still lose a race under overlapping saves. |
| **Activity load-more** | Audit is last 5 only; no history browser yet. |
| **Reactivate client UX** | Soft-deactivate exists; restore flow may be missing or hard to find. |
| **P2 polish** | Align pending badges, shared Field components, confirm preference removal, expiry reminders, empty states, keyboard directory, clearer `If-Unmodified-Since` conflict CTA. |

### Auth / session (Studio-wide)

| Item | Notes |
|---|---|
| **Session expiry (logout policy)** | Today iron-session defaults to ~**14 days**. Change the Studio session cookie/`ttl` so the token **expires in 7 days**, then the user must sign in with Google again. Optional later: idle timeout + force-logout when a member is deactivated. |

---

## 1. Alter existing Client table

`family_booking_members` already has `booking_id uuid NOT NULL` with **no** foreign key.

**When `public.bookings` exists**, add:

```sql
ALTER TABLE public.family_booking_members
  ADD CONSTRAINT family_booking_members_booking_id_fkey
    FOREIGN KEY (booking_id)
    REFERENCES public.bookings (id)
    ON DELETE CASCADE;
```

`family_booking_members.client_id` already references `clients(id)`.

---

## 2. New tables — required columns and FKs to Client schema

Create these in their module migrations. Point **to** existing `clients` (and later `trips`). Do not add matching columns on `clients`.

### Bookings

```sql
-- On public.bookings:
client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL

CREATE INDEX bookings_client_id_idx ON public.bookings (client_id);
```

`ON DELETE SET NULL` — Client rows are deactivated, not deleted (`active = false`, `merged_into_client_id`).

### Trips

```sql
-- On public.trips:
primary_client_id  uuid REFERENCES public.clients (id) ON DELETE SET NULL
client_visibility  text NOT NULL DEFAULT 'draft'
                     CHECK (client_visibility IN ('draft', 'ready', 'shared'))
published_at       timestamptz
```

Guest APIs filter `client_visibility = 'shared'`.

### Trip companions

```sql
CREATE TABLE public.trip_clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  client_id  uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  -- additional columns as defined by the trips module
  UNIQUE (trip_id, client_id)
);
```

### Guest trip chat

```sql
-- On public.client_chat_messages:
trip_id uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE
```

No `client_id` on this table in the Client spec — scope is per trip.

### Trainer / AI chunks

```sql
-- On public.knowledge_chunks:
client_id uuid REFERENCES public.clients (id) ON DELETE CASCADE
```

---

## 3. Do not change on existing Client tables

| Table / column | Rule |
|---|---|
| `clients` | No `booking_id`, `trip_id`, spend, booking count, or last-booking columns. |
| `guest_users` | No `family_id`. Household is `family_members` via `guest_users.client_id`. |
| `client_relationships` | No spouse / child / parent types — those stay on `family_members.role`. |
| `client_health_profiles` | Dietary stays here, not on `client_preferences`. |

Optional later: `CREATE EXTENSION btree_gin` if composite GIN indexes are needed. `pg_trgm` is already enabled in `003`.

---

## 4. Naming

Future FKs to people must use `*_id` uuid columns referencing `public.clients(id)` or `public.team_members(id)` — not free-text email.
