# Studio folder structure

Scaffold only — **no feature code yet**. Folders hold `.gitkeep` so Git tracks empty dirs.

Naming follows Next.js App Router + feature-first UI (aligned with [`technical-design.md`](./technical-design.md)).

---

## Map

```
apps/studio/
├── app/                          # Routes & HTTP only (thin)
│   ├── (auth)/                   # Route group — no URL segment
│   │   └── login/                # → /login
│   ├── (shell)/                  # Route group — signed-in chrome later
│   │   ├── trip-builder/         # → /trip-builder
│   │   ├── bookings/             # → /bookings
│   │   ├── clients/              # → /clients
│   │   ├── trips/                # → /trips
│   │   ├── team/                 # → /team
│   │   └── settings/             # → /settings
│   ├── api/                      # Route handlers (no business rules)
│   │   ├── auth/
│   │   ├── clients/
│   │   ├── bookings/
│   │   ├── trips/
│   │   ├── trip-builder/
│   │   ├── team/
│   │   └── settings/
│   ├── layout.tsx                # Root layout (exists)
│   ├── page.tsx                  # Home shell (exists; move under (shell) when auth lands)
│   └── globals.css
│
├── components/                   # Studio-only React UI (by feature)
│   ├── shell/                    # Sidebar, top bar, user menu
│   ├── trip-builder/
│   ├── clients/
│   ├── bookings/
│   ├── trips/
│   ├── team/
│   ├── settings/
│   └── ui/                       # Small local primitives (Button, Input…) if not in packages/ui yet
│
├── lib/                          # Studio-only helpers (not domain rules)
│   ├── auth/                     # Thin session/cookie helpers until packages/auth
│   ├── api/                      # Fetch wrappers, response helpers
│   └── utils/                    # Generic formatters, className helpers
│
├── hooks/                        # React hooks used only by Studio
├── types/                        # App-local TypeScript types
├── config/                       # App config (nav items, feature flags)
├── constants/                    # Magic strings / enums used in UI only
│
├── public/
│   ├── images/
│   └── branding/                 # Logos / brand assets (Settings → Branding)
│
├── middleware.ts                 # Add when auth starts (protect (shell), allow (auth))
└── …
```

Parentheses in `(auth)` / `(shell)` are **Next.js route groups**: they organize layouts without changing the URL.

---

## What belongs where

| Folder | Put here | Do not put here |
|---|---|---|
| `app/**/page.tsx` | Route screens | SQL, rate logic, RBAC rules |
| `app/api/**` | Thin HTTP adapters | Business rules (call `packages/*` later) |
| `components/<feature>/` | Feature UI widgets | Shared rules used by Client app |
| `lib/` | Studio-only utilities | Cross-app domain (`packages/domain`) |
| `hooks/` | Client/server React hooks | API route handlers |
| `types/` | UI / DTO types for this app | DB schema (lives with `packages/db`) |
| `config/` | Nav, flags, Studio-only settings shapes | Secrets (use env) |
| `packages/*` (monorepo root) | Auth, DB, rates, permissions shared with Client | Studio-only chrome |

**Rule:** if Client will need it later → `packages/`. If only Studio UI needs it → here.

---

## Naming conventions

| Kind | Convention | Example |
|---|---|---|
| Route folders | `kebab-case` | `trip-builder`, `rate-sources` |
| Route groups | `(name)` | `(auth)`, `(shell)` |
| Components | `PascalCase.tsx` | `ClientProfile.tsx` |
| Hooks | `use` + camelCase | `useTripPicker.ts` |
| Lib modules | `kebab-case.ts` | `session-cookie.ts` |
| Types | `kebab-case.ts` or `*.types.ts` | `booking.types.ts` |
| API routes | `route.ts` inside folder | `app/api/clients/route.ts` |
| Layouts | `layout.tsx` | `(shell)/layout.tsx` |

---

## Planned pages (when you add `page.tsx`)

| Path | Folder | Purpose |
|---|---|---|
| `/login` | `app/(auth)/login` | Google sign-in · internal only |
| `/` | `app/(shell)` or root `page.tsx` | Home / “do first” |
| `/trip-builder` | `app/(shell)/trip-builder` | Primary workspace |
| `/bookings` | `app/(shell)/bookings` | Booking list & detail |
| `/clients` | `app/(shell)/clients` | Client list & profile |
| `/trips` | `app/(shell)/trips` | Trip list → open builder |
| `/team` | `app/(shell)/team` | Members & roles |
| `/settings` | `app/(shell)/settings` | Branding · rate sources |

---

## Next steps (implementation order)

1. Keep this scaffold; add `page.tsx` / `layout.tsx` only when building that feature.
2. Auth → `(auth)/login` + `middleware.ts` + move home under `(shell)`.
3. Shell UI → `components/shell` + `(shell)/layout.tsx`.
4. Features one module at a time; keep APIs thin and push rules into `packages/` as they appear.
