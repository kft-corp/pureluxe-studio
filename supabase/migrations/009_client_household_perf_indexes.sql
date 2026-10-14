-- Performance indexes for Client household + related-people lookups.

-- Household name autocomplete (ilike %q%) — pg_trgm already enabled in 003.
CREATE INDEX IF NOT EXISTS families_name_trgm_idx
  ON public.families
  USING gin (name gin_trgm_ops);

-- Related-people OR filter: from_client_id = X OR to_client_id = X
CREATE INDEX IF NOT EXISTS client_relationships_from_client_idx
  ON public.client_relationships (from_client_id);

CREATE INDEX IF NOT EXISTS client_relationships_to_client_idx
  ON public.client_relationships (to_client_id);
