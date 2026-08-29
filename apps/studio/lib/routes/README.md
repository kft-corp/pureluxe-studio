# Routes

All page and API paths live here. Do not hardcode URLs in components.

| File | Use for |
|---|---|
| `pages.ts` | `/login`, `/`, query helpers |
| `api.ts` | `/api/...` paths |

## Add a new API

1. Add path in `api.ts`
2. Add helper in `lib/api/<name>.ts` using `fetchApi`
3. Call the helper from components

```ts
// api.ts
team: { members: "/api/team/members" },

// lib/api/team.ts
export function inviteMember(input) {
  return fetchApi(apiRoutes.team.members, { method: "POST", body: ... });
}
```

OAuth sign-in uses `<a href={apiRoutes.auth.google}>` — not fetch.
