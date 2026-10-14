-- Optional Rate Layer rows for migration 011_rate_layer.sql. NOT a migration.
--
-- supabase db push only applies *.sql files directly in migrations/.
-- Files in this seeds/ folder are ignored on deploy, including production.
--
-- Run by hand in the SQL Editor (or psql) only when you want these rows
-- in that database — typically local or staging. Safe to re-run: each
-- insert skips rows that already exist.
--
-- Depends on migrations/011_rate_layer.sql (tables must already exist).
--
-- What is here (may differ from live):
--   destination_profiles          Maldives / Dubai / Bali / Doha
--   destination_routing_overrides Layer 2 patterns for those places
--   destination_wholesalers       Pure Escapes ↔ Maldives (inactive)
--   rate_peak_windows             ski peak dates (season-specific)
--   negotiated_rate_codes         consortia labels as placeholder slugs
--
-- Live Sabre access codes, real wholesaler bindings, and confirmed peak
-- dates should be entered by ops after they are confirmed. Do not treat
-- the slugs below as live GDS codes.

-- =============================================================================
-- destination_profiles
-- =============================================================================

INSERT INTO public.destination_profiles (canonical_name, aliases, destination_type, notes)
SELECT v.canonical_name, v.aliases::jsonb, v.destination_type, v.notes
FROM (
  VALUES
    ('Maldives', '["MLE","Malé","Male","maldives"]', 'resort_beach', 'Layer 2 wholesale_first'),
    ('Dubai', '["DXB","dubai"]', 'city_countryside', 'Layer 2 parallel_lowest'),
    ('Bali', '["DPS","bali"]', 'resort_beach', 'Layer 2 parallel_lowest'),
    ('Doha', '["DOH","doha"]', 'city_countryside', 'Layer 2 parallel_lowest')
) AS v(canonical_name, aliases, destination_type, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.destination_profiles p
  WHERE lower(p.canonical_name) = lower(v.canonical_name)
);

-- =============================================================================
-- destination_routing_overrides (Layer 2)
-- =============================================================================

INSERT INTO public.destination_routing_overrides (destination_profile_id, pattern, notes)
SELECT p.id, v.pattern, v.notes
FROM (
  VALUES
    ('Maldives', 'wholesale_first', 'Placeholder — confirm before treating as live'),
    ('Dubai', 'parallel_lowest', 'Placeholder — confirm before treating as live'),
    ('Bali', 'parallel_lowest', 'Placeholder — confirm before treating as live'),
    ('Doha', 'parallel_lowest', 'Placeholder — confirm before treating as live')
) AS v(canonical_name, pattern, notes)
JOIN public.destination_profiles p ON lower(p.canonical_name) = lower(v.canonical_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.destination_routing_overrides o
  WHERE o.destination_profile_id = p.id AND o.active = true
);

-- =============================================================================
-- destination_wholesalers
-- =============================================================================

INSERT INTO public.destination_wholesalers (
  destination_profile_id, wholesaler_name, supplier_key, priority, notes, active
)
SELECT p.id, 'Pure Escapes', 'wholesale_pure_escapes', 10,
       'Placeholder partner — leave inactive until wholesale API credentials are live', false
FROM public.destination_profiles p
WHERE lower(p.canonical_name) = 'maldives'
  AND NOT EXISTS (
    SELECT 1 FROM public.destination_wholesalers w
    WHERE w.destination_profile_id = p.id
      AND w.supplier_key = 'wholesale_pure_escapes'
  );

-- =============================================================================
-- rate_peak_windows (ski)
-- =============================================================================

INSERT INTO public.rate_peak_windows (
  destination_type, name, start_date, end_date, behaviour, notes
)
SELECT 'ski', v.name, v.start_date::date, v.end_date::date, 'offline_if_zero_gds', v.notes
FROM (
  VALUES
    ('Christmas / New Year week', '2026-12-20', '2027-01-03', 'Placeholder: ~20 Dec–3 Jan — replace with the live season'),
    ('February half-term', '2027-02-13', '2027-02-21', 'Placeholder: 13–21 Feb — replace with the live season')
) AS v(name, start_date, end_date, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.rate_peak_windows w
  WHERE w.name = v.name AND w.start_date = v.start_date::date
);

-- =============================================================================
-- negotiated_rate_codes
-- Codes are stable slugs from program names, not confirmed Sabre access codes.
-- Rows are inserted inactive so a mistaken run does not turn them on.
-- =============================================================================

INSERT INTO public.negotiated_rate_codes (code, label, supplier_key, notes, active)
SELECT v.code, v.label, 'sabre',
       'Placeholder slug — replace code with the live GDS access code, then set active',
       false
FROM (
  VALUES
    ('serandipians', 'Serandipians'),
    ('four_seasons', 'Four Seasons'),
    ('mandarin_oriental', 'Mandarin Oriental'),
    ('peninsula', 'Peninsula'),
    ('dorchester_collection', 'Dorchester Collection'),
    ('hilton_for_luxury', 'Hilton For Luxury'),
    ('marriott_stars', 'Marriott Stars'),
    ('accor', 'Accor'),
    ('rocco_forte', 'Rocco Forte'),
    ('lhw_vita', 'LHW Vita'),
    ('hyatt_prive', 'Hyatt Privé'),
    ('shangri_la', 'Shangri-La'),
    ('ihg', 'IHG'),
    ('rosewood_elite', 'Rosewood Elite'),
    ('jumeirah', 'Jumeirah'),
    ('slh', 'SLH'),
    ('preferred', 'Preferred'),
    ('como_metropolitan_london', 'Como Metropolitan London')
) AS v(code, label)
WHERE NOT EXISTS (
  SELECT 1 FROM public.negotiated_rate_codes n
  WHERE n.supplier_key = 'sabre' AND lower(n.code) = lower(v.code)
);
