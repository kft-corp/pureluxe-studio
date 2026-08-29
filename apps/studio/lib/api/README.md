# API client

```
components → lib/api → fetchApi → app/api
```

| Need | Import |
|---|---|
| Call API | `@/lib/api` — `logout()`, etc. |
| Page link | `@/lib/routes` — `pageRoutes.login` |
| OAuth link | `@/lib/routes` — `apiRoutes.auth.google` |

## Add an endpoint

1. `app/api/<name>/route.ts`
2. Path in `lib/routes/api.ts`
3. Helper in `lib/api/<name>.ts`
4. Export from `lib/api/index.ts`

Handlers return `{ success, data }` or `{ success: false, error }`. `fetchApi` throws on error.
