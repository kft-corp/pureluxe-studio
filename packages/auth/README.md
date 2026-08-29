# @pureluxe/auth

Studio and guest auth — Google OAuth, sessions, sign-in gates. Server only.

## Layout

```
src/
├── validation/      # Zod env checks (Google + session secret)
├── errors/          # Auth errors with user-safe messages
├── oauth/           # Google sign-in URL + profile from code
├── session/         # iron-session cookie (Studio)
├── authorize/       # “Is this person allowed in Studio?”
└── index.ts         # public exports
```

## Usage

```ts
import {
  authorizeStudioSignIn,
  buildGoogleAuthUrl,
  getStudioSession,
} from "@pureluxe/auth";
import { messages } from "@pureluxe/shared";
```

User-facing copy lives in `@pureluxe/shared` (`messages`, `AppError`).
