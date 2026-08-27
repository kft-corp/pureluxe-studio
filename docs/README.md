# Documentation

Product and engineering docs for the PureLuxe monorepo.

Docs are split by product so Studio and Client stay easy to find. Shared monorepo setup lives in the [root README](../README.md).

## Layout

```
docs/
├── README.md          # This index
├── studio/            # Studio (internal team) — building now
└── client/            # Client (guest app) — planned later
```

| Path | Product | Status |
|---|---|---|
| [`studio/`](./studio/) | Advisors, ops, finance, admin | **Active** |
| [`client/`](./client/) | Guests / travellers | Placeholder until Client phase |

---

## Studio

| Doc | Description |
|---|---|
| [build-brief.md](./studio/build-brief.md) | Product scope: Login, RBAC, Settings, Trip Builder, Rate Layer, Clients, Bookings |
| [technical-design.md](./studio/technical-design.md) | Stack, folders, APIs, DB schemas, build order (covers monorepo + Client later) |
| [structure.md](./studio/structure.md) | `apps/studio` folder scaffold, naming, ownership rules |
| [internal-team-product.pdf](./studio/internal-team-product.pdf) | Source product / end-to-end flow deck |

App-local notes: [`apps/studio/README.md`](../apps/studio/README.md)

Database: [`supabase/README.md`](../supabase/README.md) — `team_members` + `studio_invites` for Studio login


---

## Client

| Doc | Description |
|---|---|
| [README.md](./client/README.md) | Placeholder — Client product & technical docs will live here |

App path (future): `apps/client`
