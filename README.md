# PureLuxe

This repository is a **pnpm monorepo** for PureLuxe. It is designed to hold **both** products in one place:

| App | Who it’s for | Status |
|---|---|---|
| **Studio** (`apps/studio`) | Advisors, ops, finance, admin — plan trips, price, book, manage clients | **In progress now** |
| **Client** (`apps/client`) | Guests — chat-first trip review and planning | **Planned for later** |

**Right now we are building Studio only.** The Client app will be added in a future phase under `apps/client`. Shared code (auth, database, domain rules) will live in `packages/` so both apps can reuse it.

Studio and Client stay separate products (separate logins and UIs) but share the same trip data and business logic through this monorepo.

---

## Tech stack

| Layer | Choice |
|---|---|
| App framework | Next.js (App Router) |
| UI | React 19 · Tailwind CSS 4 |
| Language | TypeScript |
| Workspace | pnpm (`apps/*`, `packages/*`) |
| Active package | `@pureluxe/studio` → `apps/studio` |

---

## Prerequisites

- [Node.js](https://nodejs.org/) **20 or newer**
- [pnpm](https://pnpm.io/) **10** (this repo pins `pnpm@10.24.0`)

Install pnpm if needed:

```bash
npm install -g pnpm@10
```

---

## Getting started

From the repository root:

```bash
pnpm install
pnpm dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

That’s enough to run the current Studio shell. Auth, database, and AI keys are not required until those features are wired up.

---

## Common commands

Run these from the **repo root**:

| Command | Description |
|---|---|
| `pnpm dev` | Start Studio in development mode |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Lint the Studio app |

`pnpm dev:studio` and `pnpm build:studio` are aliases for the same Studio targets.

---

## Repository layout

```
pureluxe-studio/
├── apps/
│   ├── studio/          # Studio app (building now)
│   └── client/          # Client app (future — not created yet)
├── packages/            # Shared code for Studio + Client (added as features land)
├── docs/                # docs/studio · docs/client
├── .env.example         # Env var template (no secrets)
├── package.json         # Root scripts & workspace entry
└── pnpm-workspace.yaml  # Declares apps/* and packages/*
```

---

## Environment variables

1. Copy the template when you start auth or database work:

   ```bash
   cp .env.example .env.local
   ```

2. Fill in values in `.env.local` only (never commit real secrets).

`.env.example` lists expected keys (Supabase, Google OAuth, session secret, Anthropic). Leave them empty until the related feature is in progress.

---

## Documentation

| Doc | What it’s for |
|---|---|
| [docs/README.md](./docs/README.md) | Docs index (Studio + Client) |
| [Studio build brief](./docs/studio/build-brief.md) | What to build for Studio core modules |
| [Studio technical design](./docs/studio/technical-design.md) | Stack, APIs, schemas, build order |
| [Studio structure](./docs/studio/structure.md) | `apps/studio` folder scaffold |
| [Client docs](./docs/client/README.md) | Placeholder until Client phase |

---

## Current status

| Area | Status |
|---|---|
| Monorepo (pnpm workspaces) | Ready |
| Studio app (`apps/studio`) | Bootstrapped and runnable locally |
| Client app (`apps/client`) | Not started — planned for a later phase |
| Shared packages (`packages/`) | Placeholder — added as Studio features need them |

Next for Studio: sign-in, core modules, and shared packages. See the docs above for the full plan.
