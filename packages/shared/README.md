# @pureluxe/shared

Shared code for Studio and Client apps.

## Layout

```
src/
├── messages/      # User-facing copy (auth, db, common)
├── errors/        # AppError + toAppError
└── validation/    # Zod schemas for API forms and shared input
```

## Usage

```ts
import {
  messages,
  AppError,
  inviteMemberSchema,
} from "@pureluxe/shared";

const input = inviteMemberSchema.parse(body);
return Response.json({ error: messages.error.accessDenied }, { status: 403 });
```

Use the same strings and schemas in API routes and UI.
