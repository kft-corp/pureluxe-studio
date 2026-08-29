# @pureluxe/db

Server-side Supabase access. Database only — no UI copy (use `@pureluxe/shared`).

## Layout

```
src/
├── client/          # Supabase connection (singleton, server-only)
├── validation/      # Zod schemas (env, etc.)
├── schema/          # Table types (one file per table)
├── queries/         # Read/write functions (one file per table)
├── errors/          # dbQueryError, dbConfigError
└── index.ts         # public exports
```

## Rules

- **Server only** — API routes and server actions.
- **Zod** — env and DB-specific validation live in `validation/`.
- **Messages** — import from `@pureluxe/shared`, not here.
- **SQL** — lives in `/supabase/migrations`.

## Example

```ts
import { findTeamMemberByEmail } from "@pureluxe/db";
import { AppError, messages, toAppError } from "@pureluxe/shared";

const member = await findTeamMemberByEmail(email);
if (!member?.active) {
  return Response.json({ error: messages.error.accessDenied }, { status: 403 });
}
```
