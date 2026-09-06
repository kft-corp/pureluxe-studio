# PureLuxe Studio — Auth, Team & Roles Module

**Who this is for:** Engineers building or extending Studio access control, Team management, or Account.  
**One sentence:** Invite-only Google sign-in, role-based permissions, and a Team UI to manage who can do what.  
**Status:** Auth session, Team members/invites, Role permissions matrix, and Account self-edit are shipped. Invite **email delivery** is not implemented (DB-only invites).

> **Canonical for Auth / Team / RBAC:** Prefer this file + migrations `001`–`002` and `@pureluxe/shared` RBAC helpers over older wording in [`technical-design.md`](./technical-design.md) §7.4.

Cross-module consumer example: [`client_module.md`](./client_module.md) (`clients.read` / `clients.write`).

---

## 1. Product framing

Studio is an **internal** tool. People do not self-register.

1. An admin (or anyone with `team.manage`) **invites** an email + role.
2. That person signs in with **Google** using the same email.
3. First successful login **accepts** the invite and creates / activates the `team_members` row.
4. Every page and API checks **session + permission slugs** for that member’s role.

**Non-negotiables**

1. **Invite-only** — unknown Google accounts are denied.
2. **Inactive members cannot sign in** — deactivate removes access immediately on next auth attempt.
3. **Permissions are data-driven** — grants live in `studio_role_permissions`, not hardcoded role CHECKs in app code.
4. **Self-protection** — you cannot change your own role or deactivate yourself (API + UI).
5. **Account ≠ Team** — any signed-in member can edit their own profile fields; only `team.manage` can change others.

---

## 2. Users and what they need

### 2.1 Admin (typical `admin` role)

| Need | Why |
|---|---|
| Invite advisors / ops / finance | Grow the Studio team safely |
| Change roles | Move people between job functions |
| Edit role permissions | Grant/revoke module access without code deploys |
| Deactivate leavers | Cut access without deleting history |

### 2.2 Advisor / Ops / Finance

| Need | Why |
|---|---|
| Sign in with Google | Low friction |
| See only permitted modules | Least privilege |
| Edit own Account profile | Name, designation, phone |

### 2.3 Default seed access (migration `002`)

| Role | Notable modules |
|---|---|
| `advisor` | home, trip_builder r/w, clients r/w, trips r/w, trainer r, tasks r/w |
| `ops` | home, bookings r/w, clients r/w, trips r/w, trainer r, tasks r/w |
| `finance` | home, commissions r/w, payments r/w, trips read, bookings read — **no clients, no team** |
| `admin` | all seeded permissions |

Admins can change these grants in **Team → Role permissions** without a migration.

---

## 3. Module boundaries

| Concern | Owns | Does not own |
|---|---|---|
| **Auth** | Google OAuth, session cookie, login gate | Module business data |
| **Team** | Members, invites, role permission matrix | Client CRM, bookings, etc. |
| **Account** | Own profile fields | Other members’ roles |
| **Each feature module** | Its own `*.read` / `*.write` / `*.manage` checks | User provisioning |

Shell navigation filters by `module.read` (see `config/navigation.ts`). Modules without a built page still show **Coming Soon** after Access Denied checks pass.

---

## 4. Information architecture

### 4.1 Pages

| Path | Purpose | Access |
|---|---|---|
| `/login` | Brand + Google sign-in | Public |
| `/` (and shell) | Home / modules | Signed-in session |
| `/team` | Members + Role permissions | `team.read` (manage actions need `team.manage`) |
| `/account` | Own profile view/edit | Any signed-in member |

```
/login  →  Google  →  /?auth=signed_in

/team
  ├── Tab: Members
  │     ├── Search + status filters (all / active / inactive / pending)
  │     ├── Active / inactive tables
  │     ├── Pending invites
  │     └── Invite · Change role · Deactivate / Reactivate · Resend · Revoke
  └── Tab: Role permissions
        ├── Pick role
        ├── Toggle permission grants by module
        └── Save (full replace of grants for that role)

/account
  └── Name, email (read-only), designation, phone, role badge · Edit dialog
```

### 4.2 Auth surfaces

| Surface | Behavior |
|---|---|
| Login errors | Query `?error=` → toast (`access_denied`, `inactive`, `sign_in_failed`, …) |
| Sign out | Sidebar user menu → `POST /api/auth/logout` |
| Access Denied | Shell module page when missing `*.read` |
| Coming Soon | Module has `*.read` but no children content yet |

---

## 5. User journeys

### Journey A — First login (invited)

1. Admin invites `ada@agency.com` as `advisor` on `/team`.
2. Ada opens Studio `/login` and continues with Google (same email).
3. Callback finds pending invite → creates `team_members` → marks invite accepted.
4. Session cookie stores `memberId`, email, name, role, permission slugs.
5. Redirect home with signed-in toast.

### Journey B — Returning login

1. Google OAuth succeeds.
2. Active `team_members` row found by email → `last_login_at` updated → session loaded.
3. Inactive member → denied (`inactive`).

### Journey C — Change someone’s role

1. Team → Members → **Change role**.
2. `PATCH /api/team/members/[id]` with `{ role }` (not self).
3. Their next permission resolution uses the new role’s grants (see §7 on session freshness).

### Journey D — Edit role permissions

1. Team → **Role permissions**.
2. Select role, toggle slugs, Save.
3. `PUT /api/team/roles/[role]` replaces all grants for that role.

### Journey E — Deactivate / reactivate

1. Confirm dialog → `PATCH` `{ active: false | true }`.
2. Deactivated members cannot complete Google sign-in.

### Journey F — Update own Account

1. `/account` → Edit profile.
2. `PATCH /api/account/me` with name / title / phone.
3. Session display name updates; email and role stay read-only here.

---

## 6. Auth & session

### 6.1 Stack

| Piece | Location |
|---|---|
| Google OAuth + iron-session | `@pureluxe/auth` |
| Edge gate | `apps/studio/proxy.ts` |
| Public paths | `apps/studio/lib/auth/public-paths.ts` (`/login`, `/api/auth/*`) |
| Session load | `lib/auth/session.ts`, `session-with-permissions.ts` (React `cache`) |
| API guards | `requireApiStudioSession`, `requireApiPermission` |

### 6.2 Session payload (conceptual)

```
{
  memberId: string
  email: string
  name: string
  role: string          // studio_roles.slug
  permissions: string[] // e.g. ["clients.read", "clients.write", ...]
}
```

### 6.3 Sign-in authorization (`authorizeStudioSignIn`)

1. Look up `team_members` by email.
2. If found and `active = false` → deny (`auth.account_inactive`).
3. If found and active → allow; refresh `last_login_at`.
4. If not found → look for **pending** `studio_invites` for email → accept invite + create member; else deny (`auth.access_denied`).
5. Load permission slugs for the member’s role into the session.

**No password or email-OTP login** — Google only.

### 6.4 Request guards

| Layer | Check |
|---|---|
| Proxy | Cookie present for protected page routes; logged-in users redirected away from `/login` |
| Shell layout | Complete session or redirect to login |
| `ShellModulePage` | `hasPermission(session, moduleReadPermission(module))` |
| API routes | `requireApiPermission("team.read" \| "team.manage" \| …)` |

---

## 7. Permissions model

Package: `packages/shared/src/rbac`.

### 7.1 Shape

- **Modules:** `home`, `trip_builder`, `bookings`, `clients`, `trips`, `trainer`, `tasks`, `commissions`, `payments`, `team`, `settings`
- **Actions:** `read` \| `write` \| `delete` \| `manage`
- **Slug:** `` `${module}.${action}` `` (example: `clients.write`, `team.manage`)

Helpers: `hasPermission`, `hasModulePermission`, `moduleReadPermission`, `buildPermissionSlug`, …

### 7.2 Seeded permission catalog (active)

```
home.read
trip_builder.read | trip_builder.write
bookings.read | bookings.write
clients.read | clients.write
trips.read | trips.write
trainer.read
tasks.read | tasks.write
commissions.read | commissions.write
payments.read | payments.write
team.read | team.manage
settings.read | settings.manage
```

`delete` exists as an action type in shared code but is **not** seeded as rows today.

### 7.3 How feature modules use this

Example — Clients:

| Surface | Required slug |
|---|---|
| Nav + directory + profile GET | `clients.read` |
| Create / edit / approve / nested writes | `clients.write` |

Team UI passes `canManage` from `team.manage` to hide invite / role / deactivate actions for read-only viewers.

### 7.4 Session freshness note

Permissions are stored in the session at login. Studio also **backfills from DB** when the cookie lacks permissions (`session-with-permissions`). After an admin changes another user’s role or grants, that user may need a fresh navigation/load (or re-login) before every surface reflects the new matrix — do not assume instantaneous cookie rewrite for all tabs.

---

## 8. Data model

Migrations: `001_studio_identity.sql`, `002_studio_rbac.sql` (names may vary slightly; identity + RBAC pair).  
Queries: `packages/db/src/queries/auth/`, `queries/rbac/`.

| Table | Purpose |
|---|---|
| `studio_roles` | Configurable roles (`slug` PK): advisor, ops, finance, admin |
| `team_members` | Studio people; `role` → `studio_roles.slug`; `active` gates login |
| `studio_invites` | `pending` \| `accepted` \| `revoked`; unique pending email |
| `studio_permissions` | Catalog of `module.action` slugs |
| `studio_role_permissions` | `(role_slug, permission_slug)` grants |

RLS is enabled; the app uses the Supabase **service role** for server queries.

---

## 9. Features — status

### 9.1 Auth — **shipped**

- Google OAuth start + callback
- Invite accept on first login
- Inactive / access denied / cancel error toasts
- Logout
- Proxy + shell + API session enforcement

### 9.2 Team — Members — **shipped**

- List members + pending invites
- Search / status filters
- Invite (email + role)
- Change role
- Deactivate / reactivate
- Resend invite (**DB timestamp only** — no email send)
- Revoke invite

### 9.3 Team — Role permissions — **shipped**

- View catalog grouped by module
- Edit grants per role (full replace on save)
- UI may label some toggles “Admin only” as guidance; enforcement is still the slug check

### 9.4 Account — **shipped**

- View: name, email, designation (`title`), phone, role, active, member id
- Edit: name, designation, phone
- Cannot edit email or role on Account

### 9.5 Deferred / gaps

| Item | Reality |
|---|---|
| Invite / resend **email** delivery | Not implemented — success copy still says invite sent |
| Custom role CRUD UI | DB supports roles; UI only edits grants on seeded roles |
| Permission catalog admin UI | Seed / SQL only |
| Force-logout on deactivate | Next sign-in blocked; existing cookie may linger until expiry/proxy rules |
| Most non-clients module backends | Permissions exist; features mostly Coming Soon |

---

## 10. API design

### 10.1 Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/auth/google` | Public | Start OAuth (sets state) |
| GET | `/api/auth/callback` | Public | Finish OAuth → session |
| POST | `/api/auth/logout` | Session | Clear session |

### 10.2 Account

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/account/me` | Session | Own profile |
| PATCH | `/api/account/me` | Session | `{ name, title?, phone? }` |

### 10.3 Team

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/team/members` | `team.read` | Members + invites + roles; includes `canManage` |
| PATCH | `/api/team/members/[memberId]` | `team.manage` | `{ role }` or `{ active }` |
| POST | `/api/team/invites` | `team.manage` | `{ email, role }` |
| DELETE | `/api/team/invites/[inviteId]` | `team.manage` | Revoke |
| POST | `/api/team/invites/[inviteId]/resend` | `team.manage` | Refresh invite row |
| GET | `/api/team/roles` | `team.read` | Roles + catalog + grants |
| PUT | `/api/team/roles/[role]` | `team.manage` | `{ permissionSlugs: string[] }` replace |

Client helpers: `apps/studio/lib/api/auth.ts`, `account.ts`, `team.ts`.  
Messages: `packages/shared/src/messages/auth.ts`, `team.ts`, `account.ts`.  
Validation: `packages/shared/src/validation/` (team / account schemas).

---

## 11. Code map (Studio)

| Area | Path |
|---|---|
| Login page | `apps/studio/app/(auth)/login/` |
| Team page | `apps/studio/app/(shell)/team/` |
| Account page | `apps/studio/app/(shell)/account/` |
| Auth APIs | `apps/studio/app/api/auth/` |
| Team APIs | `apps/studio/app/api/team/` |
| Account API | `apps/studio/app/api/account/me/` |
| Auth lib | `apps/studio/lib/auth/` |
| Team lib | `apps/studio/lib/team/` |
| Account lib | `apps/studio/lib/account/` |
| Team UI | `apps/studio/components/team/` |
| Account UI | `apps/studio/components/account/` |
| Proxy / public paths | `apps/studio/proxy.ts`, `lib/auth/public-paths.ts` |
| Navigation RBAC | `apps/studio/config/navigation.ts` |
| Shared RBAC | `packages/shared/src/rbac/` |
| Auth package | `packages/auth/` |
| DB queries | `packages/db/src/queries/auth/`, `queries/rbac/` |

UI patterns: `use-team-page`, shared `ConfirmDialog`, `MemberSearch` → `StudioSearchField`, invite / change-role dialogs.

---

## 12. Do not change without product review

- Do not allow self-role-change or self-deactivate
- Do not add open registration (invite-only)
- Do not hardcode module access by role name in feature code — check permission slugs
- Do not put secrets (Google client secret, session password) in the client bundle
- Do not treat “Resend invite” as email delivery until a mailer exists

---

## 13. Related docs

| Doc | Use |
|---|---|
| [`client_module.md`](./client_module.md) | Clients CRM — example of `clients.*` permission usage |
| [`technical-design.md`](./technical-design.md) | Broader system design (RBAC section may lag; prefer this file) |
| [`structure.md`](./structure.md) | Repo / app layout |
