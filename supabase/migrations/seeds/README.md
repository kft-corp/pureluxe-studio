# Optional SQL seeds (not applied by `db push`)

Files in this folder are **manual inserts** for data that may differ between
local / staging / live. Supabase only auto-applies `*.sql` files directly under
`migrations/` — not subfolders.

## Rule

| In numbered migrations | In `migrations/seeds/` |
|---|---|
| Tables, indexes, RLS, grants | Business rows from founder Excel / PDFs |
| Required system catalogs (roles, permissions, client tiers) | Destination examples, consortia slug labels |
| Sure company setting *structure* defaults (`rate_sources`) | Branding colors, ski peak date examples |
| Storage bucket definitions | Anything ops will replace with live truth |

**Never** put invented Sabre access codes in migrations. Prefer seeds (or Settings UI).

## Seed files

| File | After migration | What it loads |
|---|---|---|
| [`011_rate_layer.sql`](./011_rate_layer.sql) | `011_rate_layer.sql` | Maldives/Dubai/Bali/Doha profiles, Layer 2 overrides, Pure Escapes binding (inactive), ski peak windows, negotiated code **placeholder slugs** (`active = false`) |
| [`011_rate_layer_contracted.sql`](./011_rate_layer_contracted.sql) | `011` (+ `021` tax cols) + run `011_rate_layer.sql` first | Real contracted money: Waldorf Ithaafushi, SUJÁN×3, COMO Cocoa + Maalifushi, JOALI Maldives + BEING — from Excel + PDFs |
| [`011_rate_layer_kanuhura.sql`](./011_rate_layer_kanuhura.sql) | same | Six Senses Kanuhura wholesale 2026–27 + India package `SSK26IN` |
| [`016_atlas_kb.sql`](./016_atlas_kb.sql) | `016_atlas_kb.sql` (+ `021` style_tags/price_tier) | Full Atlas hotel master from Excel (~2.2k hotels) + rooms/details where present; links contracted `properties` ↔ `kb_entities` |
| [`015_trip_builder_flow.sql`](./015_trip_builder_flow.sql) | `015_trip_builder_flow.sql` | Starter `pdf_branding` company setting |

## Trip Builder recommended local order

1. `011_rate_layer.sql` (destination profiles + Layer 2)
2. `011_rate_layer_contracted.sql` (money)
3. `011_rate_layer_kanuhura.sql` (Kanuhura money)
4. `016_atlas_kb.sql` (Atlas KB + curated hotel links)
5. `015_trip_builder_flow.sql` (optional branding)

Sources:

- `docs/excel sheets/Contracted Rates Master (Pilot).xlsx`
- `docs/excel sheets/PureLuxe Atlas KB — Hotels (…).xlsx`
- `docs/contracted rate pdf/`

## How to run

1. Apply numbered migrations (`db push` or paste each migration in order).
2. Open Supabase **SQL Editor**.
3. Paste each seed file in the order above and run.
4. Seeds are written to be re-runnable (`WHERE NOT EXISTS` / `ON CONFLICT`).

Do **not** run seeds on production unless ops has reviewed and confirmed the rows.

## Intentionally left in migrations (not seeds)

These inserts are required for the app to work the same in every environment:

- `001` — `studio_roles` (advisor / ops / finance / admin)
- `002` — permissions + role grants
- `007` — `client_tiers` (standard / vip / vvip) — `clients.tier_id` is NOT NULL
- `011` — `rate_sources` / `knowledge_base` setting keys, Layer 3 `destination_type_defaults`, rate/knowledge permissions
- `016` — merge/extend `knowledge_base` flags
- Storage bucket inserts (`008`, `012`, `013`, `015`) — infrastructure, not business content
