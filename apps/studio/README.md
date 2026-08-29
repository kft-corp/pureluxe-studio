# PureLuxe Studio

Package: **`@pureluxe/studio`**

Internal Next.js app for PureLuxe advisors, ops, finance, and admin. Use it to plan trips, price and book travel, and manage clients and bookings.

This app is part of the **PureLuxe monorepo**. The same repo will later include a **Client** app for guests (`apps/client`). Right now only Studio is being built.

| App | Audience | Status |
|---|---|---|
| **Studio** (this package) | Internal team | **Building now** |
| **Client** | Guests | Planned later |

Studio and Client will stay separate products (separate logins and UIs) but share trip data and business logic via packages under `packages/`.

For monorepo overview, setup, and docs, see the [root README](../../README.md).

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 · Tailwind CSS 4 |
| Language | TypeScript |
| Port | `3002` |

---

## Run locally

Prefer commands from the **repository root** (recommended):

```bash
pnpm install
pnpm dev
```

Or from this folder:

```bash
pnpm install   # from repo root first if deps are missing
pnpm dev
```

Open **[http://localhost:3002](http://localhost:3002)**.

Auth, database, and AI keys are not required for the current shell. When those features land, copy the root [`.env.example`](../../.env.example) to `.env.local` and fill in values (do not commit secrets).

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Development server on port 3002 |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |

From the monorepo root you can also use `pnpm dev`, `pnpm build`, `pnpm start`, and `pnpm lint` — they target this Studio package.

---

## App layout

See **[Studio structure](../../docs/studio/structure.md)** for the full scaffold map, naming rules, and what belongs where.

```
apps/studio/
├── app/
│   ├── (auth)/login/        # → /login (scaffold)
│   ├── (shell)/             # signed-in routes (scaffold)
│   │   ├── trip-builder/
│   │   ├── bookings/
│   │   ├── clients/
│   │   ├── trips/
│   │   ├── team/
│   │   └── settings/
│   ├── api/                 # thin HTTP handlers (scaffold)
│   ├── layout.tsx
│   ├── page.tsx             # home shell (live)
│   └── globals.css
├── components/<feature>/    # Studio-only UI by feature
├── lib/ · hooks/ · types/ · config/ · constants/
└── public/images · public/branding
```

Folders are empty placeholders (`.gitkeep`) until feature work starts. No business logic lives in this scaffold.

---

## What’s next (Studio)

1. Sign-in and session (Google OAuth)
2. RBAC and settings
3. Core modules: Clients, Bookings, Trip Builder, Rate Layer
4. Shared packages under `packages/` as those features need them

Product and technical plans:

- [Studio build brief](../../docs/studio/build-brief.md)
- [Studio technical design](../../docs/studio/technical-design.md)
- [Docs index](../../docs/README.md) (Studio + Client)

---

## Current status

Studio is bootstrapped and runnable. Sign-in and core modules are not built yet. The Client app is out of scope for this package until a later monorepo phase — see [`docs/client`](../../docs/client/README.md).
