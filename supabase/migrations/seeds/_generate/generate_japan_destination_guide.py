"""Generate SQL appendices for 018_japan_destination_guide.sql from the guide text."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
DOCX = ROOT / "docs" / "founder docs" / "Japan-Destination-Guide.docx"
SEED_018 = (
    ROOT / "supabase" / "migrations" / "seeds" / "018_japan_destination_guide.sql"
)

MARKER = (
    "-- >>> BEGIN GENERATED JAPAN GUIDE ENTITIES "
    "(re-run seeds/_generate/generate_japan_destination_guide.py)"
)


def esc(s: str) -> str:
    return s.replace("'", "''")


def slug(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:90]


def luxury_band(tier: str) -> str:
    if "1" in tier:
        return "ultra_luxury"
    if "2" in tier:
        return "luxury"
    return "premium"


def contract_status(partner: str) -> tuple[str, bool, bool]:
    p = partner.lower()
    if "not yet contracted" in p or "placeholder only" in p:
        return "not_yet_contracted", True, "placeholder" in p
    if "quoted to clients" in p or "preferred partner" in p:
        return "unknown", True, False
    return "unknown", True, False


def club_from_partner(partner: str) -> list[tuple[str, str]]:
    mapping = [
        ("four seasons preferred partner", "fs_preferred", "Four Seasons Preferred Partner"),
        ("mandarin oriental fan club", "mo_fan_club", "Mandarin Oriental Fan Club"),
        ("leaders club", "palace_leaders_club", "Leaders Club"),
        ("peninsula", "peninsula", "Peninsula"),
        ("lhw vita", "lhw_vita", "LHW Vita"),
        ("serandipians", "serandipians", "Serandipians"),
        ("serandipains", "serandipians", "Serandipians"),
        ("marriott stars", "marriott_stars", "Marriott Stars"),
        ("hyatt prive", "hyatt_prive", "Hyatt Prive"),
        ("hilton for luxury", "hilton_for_luxury", "Hilton for Luxury"),
        ("ihg destined", "ihg_destined", "IHG Destined"),
        ("ihg", "ihg", "IHG"),
        ("shangri-la", "shangri_la", "Shangri-La"),
        ("accor", "accor", "Accor"),
        ("preferred hotels", "preferred_hotels", "Preferred Hotels"),
        ("slh within", "slh_within", "SLH Within"),
        ("relais and chateaux", "relais_chateaux", "Relais & Châteaux"),
        ("rosewood elite", "rosewood_elite", "Rosewood Elite"),
    ]
    low = partner.lower()
    out: list[tuple[str, str]] = []
    for needle, key, label in mapping:
        if needle in low:
            out.append((key, label))
    return out


def parse_hotels(lines: list[str]) -> list[dict]:
    start = lines.index("Hotels by location")
    end = lines.index("Hotel scoring matrix (internal)")
    hotel_lines = lines[start:end]
    city_headers = {
        "Tokyo": "Tokyo",
        "Kyoto": "Kyoto",
        "Osaka": "Osaka",
        "Hakone and Mt Fuji": "Hakone",
        "Hokkaido (Niseko)": "Niseko",
        "Nikko": "Nikko",
        "Okinawa and Miyako": None,
        "Okayama (Kurashiki)": "Okayama",
    }
    hotels: list[dict] = []
    i = 0
    current_city = None
    while i < len(hotel_lines):
        line = hotel_lines[i]
        if line in city_headers:
            current_city = city_headers[line]
            i += 1
            while i < len(hotel_lines) and hotel_lines[i] in (
                "Hotel",
                "Area",
                "Proposed tier",
                "Partner program / status",
                "Score (internal, out of 5)",
            ):
                i += 1
            continue
        if current_city is None and line not in city_headers:
            # still inside Okinawa block after header skip
            pass
        if i + 4 >= len(hotel_lines):
            break
        name, area, tier, partner, score = hotel_lines[i : i + 5]
        if not tier.startswith("Tier"):
            i += 1
            continue
        city = current_city
        if city is None:
            city = "Miyako Island" if ("Miyako" in name or "Miyako" in area) else "Okinawa"
        hotels.append(
            {
                "name": name,
                "city": city,
                "area": area,
                "tier": tier,
                "partner": partner,
                "score": score,
            }
        )
        i += 5
    return hotels


def parse_experiences(lines: list[str]) -> list[dict]:
    eb_start = lines.index("Tokyo: experiences and activities")
    eb_end = lines.index("Other places mentioned")
    eb = lines[eb_start:eb_end]
    section_city = {
        "Tokyo: experiences and activities": "Tokyo",
        "Tokyo: restaurants": "Tokyo",
        "Kyoto: experiences and activities": "Kyoto",
        "Kyoto: restaurants": "Kyoto",
        "Osaka and Nara": "Osaka",
        "Hakone and Mt Fuji": "Hakone",
        # Sentinel: city chosen per entry name (Nikko vs Niseko)
        "Hokkaido (Niseko) and Nikko": "__niseko_nikko__",
    }
    headers = {"Entry", "Type", "Who it suits", "Lead time", "Veg / Jain", "About", "Seen in"}
    experiences: list[dict] = []
    i = 0
    current = None
    while i < len(eb):
        line = eb[i]
        if line in section_city:
            current = section_city[line]
            i += 1
            while i < len(eb) and eb[i] in headers:
                i += 1
            continue
        if current is None or line in headers:
            i += 1
            continue
        if i + 5 >= len(eb):
            break
        name, typ, who, lead, veg, about = eb[i : i + 6]
        if not re.match(r"^(Activity|Experience|Restaurant|Bar)\b", typ, re.I):
            i += 1
            continue
        if about in section_city or about in headers:
            i += 1
            continue
        city = current
        if current == "__niseko_nikko__":
            city = "Nikko" if "Nikko" in name else "Niseko"
        if current == "Osaka" and (
            name.startswith("Nara") or name.startswith("Pizzeria Icaro, Nara")
        ):
            city = "Nara"
        experiences.append(
            {
                "name": name,
                "type": typ,
                "who": who,
                "lead": lead,
                "veg": veg,
                "about": about,
                "city": city,
            }
        )
        i += 6
    return experiences


# Existing 016 name variants → guide name match helpers (aliases to set on insert/update)
HOTEL_ALIASES: dict[str, list[str]] = {
    "Four Seasons Tokyo at Otemachi": ["Four Seasons — Tokyo at Otemachi", "Four Seasons Tokyo Otemachi"],
    "Four Seasons Tokyo at Marunouchi": ["Four Seasons — Tokyo at Marunouchi"],
    "Four Seasons Kyoto": ["Four Seasons — Kyoto"],
    "Four Seasons Osaka": ["Four Seasons — Osaka"],
    "Hotel Seiryu Kyoto Kiyomizu": ["The Hotel Seiryu Kyoto Kiyomizu", "The Hotel Seiryu Kyoto Kiyomizu"],
    "Imperial Hotel Tokyo": ["Imperial Hotel, Tokyo"],
    "Imperial Hotel Kyoto": ["Imperial Hotel, Kyoto"],
    "ROKU Kyoto, LXR Hotels": ["ROKU Kyoto, LXR Hotels & Resorts"],
    "Mandarin Oriental Tokyo": ["Mandarin Oriental, Tokyo", "Mandarin Oriental Tokyo"],
    "The Ritz-Carlton, Tokyo": ["The Ritz-Carlton Tokyo", "Ritz-Carlton Tokyo"],
    "The Ritz-Carlton Kyoto": ["The Ritz-Carlton, Kyoto", "Ritz-Carlton Kyoto"],
    "The Peninsula Tokyo": ["Peninsula Tokyo"],
    "Park Hyatt Tokyo": ["Park Hyatt Tokyo"],
    "Grand Hyatt Tokyo": ["Grand Hyatt Tokyo"],
    "ANA InterContinental Tokyo": ["ANA InterContinental Tokyo"],
    "Kimpton Shinjuku Tokyo": ["Kimpton Shinjuku Tokyo"],
    "Hotel Indigo Tokyo Shibuya": ["Hotel Indigo Tokyo Shibuya"],
    "Six Senses Kyoto": ["Six Senses Kyoto"],
    "ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu": ["ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu"],
    "Rosewood Miyakojima": ["Rosewood Miyakojima"],
    "Halekulani Okinawa": ["Halekulani Okinawa"],
    "Ryokan Kurashiki": ["Ryokan Kurashiki"],
    "Waldorf Astoria Osaka": ["Waldorf Astoria Osaka"],
    "Conrad Osaka": ["Conrad Osaka"],
    "Patina Osaka": ["Patina Osaka"],
    "Aman Tokyo": ["Aman Tokyo"],
    "Aman Kyoto": ["Aman Kyoto"],
    "Palace Hotel Tokyo": ["Palace Hotel Tokyo"],
    "Capitol Hotel Tokyu": ["Capitol Hotel Tokyu"],
    "Shangri-La Tokyo": ["Shangri-La Tokyo"],
    "The Okura Tokyo": ["The Okura Tokyo"],
    "Janu Tokyo": ["Janu Tokyo"],
    "Fairmont Tokyo": ["Fairmont Tokyo"],
    "1 Hotel Tokyo": ["1 Hotel Tokyo"],
    "The New Otani Executive House Zen": ["The New Otani Executive House Zen"],
    "BELLUSTAR TOKYO, A Pan Pacific Hotel": ["BELLUSTAR TOKYO, A Pan Pacific Hotel"],
    "Capella Kyoto": ["Capella Kyoto"],
    "Hotel The Mitsui Kyoto": ["Hotel The Mitsui Kyoto"],
    "Park Hyatt Kyoto": ["Park Hyatt Kyoto"],
    "Dusit Thani Kyoto": ["Dusit Thani Kyoto"],
    "FAUCHON L'Hotel Kyoto": ["FAUCHON L'Hotel Kyoto"],
}


def generate_sql(hotels: list[dict], experiences: list[dict]) -> str:
    parts: list[str] = []
    parts.append(
        """-- =============================================================================
-- 7. Guide hotels (Japan Destination Guide) + city repairs
-- =============================================================================
-- Inserts missing hotels; re-points Japan Unspecified rows to the guide city;
-- upgrades description / luxury_band / consortia from the guide.
-- Safe to re-run.

-- 7a. Re-point known Unspecified Japan hotels to the correct city
UPDATE public.kb_entities e
SET
  city_id = ci.id,
  country_id = co.id,
  region_id = co.region_id,
  updated_at = now()
FROM (VALUES
  ('six-senses-kyoto', 'Kyoto'),
  ('ana-intercontinental-tokyo', 'Tokyo'),
  ('kimpton-shinjuku-tokyo', 'Tokyo'),
  ('hotel-indigo-tokyo-shibuya', 'Tokyo'),
  ('hotel-indigo-hakone-gora', 'Hakone'),
  ('intercontinental-osaka', 'Osaka'),
  ('intercontinental-sapporo', 'Sapporo'),
  ('intercontinental-the-strings-tokyo', 'Tokyo'),
  ('vignette-collection-rihga-royal-hotel-osaka', 'Osaka')
) AS v(external_key, city)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_cities ci
  ON ci.country_id = co.id
 AND lower(ci.name) = lower(v.city)
WHERE e.external_key = v.external_key
  AND e.entity_type = 'hotel'
  AND e.active = true;
"""
    )

    # 7b insert hotels
    parts.append(
        """
-- 7b. Ensure every guide hotel exists (match by external_key OR lower(name) in city)
INSERT INTO public.kb_entities (
  entity_type, name, brand, description, kb_tier, provenance,
  source_name, region_id, country_id, city_id,
  contract_status, client_ready, placeholder, not_yet_open,
  external_key, aliases, external_ids, legacy_notes, active
)
SELECT
  'hotel',
  v.name,
  NULLIF(v.brand, ''),
  v.description,
  'kb_scraped',
  'kb',
  'Japan Destination Guide — PureLuxe Atlas KB (2026-11-03)',
  co.region_id,
  co.id,
  ci.id,
  v.contract_status,
  v.client_ready::boolean,
  v.placeholder::boolean,
  false,
  v.external_key,
  COALESCE(string_to_array(NULLIF(v.aliases, ''), '|'), '{}'::text[]),
  jsonb_build_object(
    'japan_guide', true,
    'guide_area', v.area,
    'guide_proposed_tier', v.tier,
    'guide_partner', v.partner,
    'guide_score', v.score
  ),
  v.legacy_notes,
  true
FROM (VALUES
"""
    )
    value_rows = []
    for h in hotels:
        status, client_ready, placeholder = contract_status(h["partner"])
        aliases = HOTEL_ALIASES.get(h["name"], [])
        alias_str = "|".join(aliases)
        brand = ""
        # light brand guess
        n = h["name"]
        for b in (
            "Four Seasons",
            "Mandarin Oriental",
            "Ritz-Carlton",
            "Park Hyatt",
            "Grand Hyatt",
            "Shangri-La",
            "Aman",
            "Peninsula",
            "Waldorf Astoria",
            "Conrad",
            "Rosewood",
            "Six Senses",
            "Capella",
            "Fairmont",
            "Kimpton",
            "Hotel Indigo",
            "ANA InterContinental",
            "St. Regis",
            "Janu",
            "Patina",
            "Dusit Thani",
            "Halekulani",
        ):
            if b.lower() in n.lower():
                brand = b
                break
        desc = (
            f"{h['area']}. Guide proposed {h['tier']}; partner: {h['partner']}. "
            f"Internal score {h['score']} (clients never see scores)."
        )
        legacy = f"Japan guide area={h['area']}; tier={h['tier']}; partner={h['partner']}; score={h['score']}"
        value_rows.append(
            "  ('{name}', '{city}', '{brand}', '{area}', '{tier}', '{partner}', '{score}', "
            "'{external_key}', '{aliases}', '{contract_status}', '{client_ready}', '{placeholder}', "
            "'{description}', '{legacy}')".format(
                name=esc(h["name"]),
                city=esc(h["city"]),
                brand=esc(brand),
                area=esc(h["area"]),
                tier=esc(h["tier"]),
                partner=esc(h["partner"]),
                score=esc(h["score"]),
                external_key=esc("jp-guide-" + slug(h["name"])),
                aliases=esc(alias_str),
                contract_status=status,
                client_ready="true" if client_ready else "false",
                placeholder="true" if placeholder else "false",
                description=esc(desc),
                legacy=esc(legacy),
            )
        )
    parts.append(",\n".join(value_rows))
    parts.append(
        """
) AS v(name, city, brand, area, tier, partner, score, external_key, aliases, contract_status, client_ready, placeholder, description, legacy_notes)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_cities ci ON ci.country_id = co.id AND lower(ci.name) = lower(v.city)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_entities e
  WHERE e.entity_type = 'hotel'
    AND e.active = true
    AND (
      e.external_key = v.external_key
      OR (e.city_id = ci.id AND lower(e.name) = lower(v.name))
      OR (e.country_id = co.id AND lower(e.name) = lower(v.name))
      OR (e.country_id = co.id AND v.aliases <> '' AND e.name = ANY (string_to_array(v.aliases, '|')))
      OR (e.country_id = co.id AND exists (
            SELECT 1 FROM unnest(coalesce(e.aliases, '{}'::text[])) a
            WHERE lower(a) = lower(v.name)
          ))
    )
);
"""
    )

    # 7c update descriptions / aliases / external_ids for matched hotels
    parts.append(
        """
-- 7c. Enrich existing hotels that match the guide (by name / alias / external_key)
UPDATE public.kb_entities e
SET
  description = COALESCE(NULLIF(trim(e.description), ''), v.description),
  aliases = (
    SELECT ARRAY(
      SELECT DISTINCT x
      FROM unnest(
        coalesce(e.aliases, '{}'::text[])
        || CASE WHEN v.aliases = '' THEN '{}'::text[] ELSE string_to_array(v.aliases, '|') END
        || ARRAY[v.name]
      ) AS x
      WHERE length(trim(x)) > 0
    )
  ),
  external_ids = coalesce(e.external_ids, '{}'::jsonb) || jsonb_build_object(
    'japan_guide', true,
    'guide_area', v.area,
    'guide_proposed_tier', v.tier,
    'guide_partner', v.partner,
    'guide_score', v.score
  ),
  legacy_notes = COALESCE(NULLIF(trim(e.legacy_notes), ''), v.legacy_notes),
  city_id = COALESCE(e.city_id, ci.id),
  country_id = COALESCE(e.country_id, co.id),
  region_id = COALESCE(e.region_id, co.region_id),
  placeholder = CASE WHEN v.placeholder = 'true' THEN true ELSE e.placeholder END,
  contract_status = CASE
    WHEN v.contract_status = 'not_yet_contracted' AND e.contract_status = 'unknown'
      THEN 'not_yet_contracted'
    ELSE e.contract_status
  END,
  updated_at = now()
FROM (VALUES
"""
    )
    parts.append(",\n".join(value_rows))
    parts.append(
        """
) AS v(name, city, brand, area, tier, partner, score, external_key, aliases, contract_status, client_ready, placeholder, description, legacy_notes)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_cities ci ON ci.country_id = co.id AND lower(ci.name) = lower(v.city)
WHERE e.entity_type = 'hotel'
  AND e.active = true
  AND e.country_id = co.id
  AND (
    e.external_key = v.external_key
    OR lower(e.name) = lower(v.name)
    OR (v.aliases <> '' AND e.name = ANY (string_to_array(v.aliases, '|')))
    OR exists (
      SELECT 1 FROM unnest(coalesce(e.aliases, '{}'::text[])) a
      WHERE lower(a) = lower(v.name)
    )
  );
"""
    )

    # 7d hotel details luxury_band
    parts.append(
        """
-- 7d. Hotel details — luxury_band from proposed tier
INSERT INTO public.kb_hotel_details (entity_id, amenities, style_tags, luxury_band, best_for)
SELECT
  e.id,
  '{}'::text[],
  ARRAY[lower(replace(v.tier, ' ', '_'))],
  v.luxury_band,
  '{}'::text[]
FROM (VALUES
"""
    )
    detail_rows = []
    for h in hotels:
        detail_rows.append(
            "  ('{name}', '{city}', '{tier}', '{band}', '{external_key}', '{aliases}')".format(
                name=esc(h["name"]),
                city=esc(h["city"]),
                tier=esc(h["tier"]),
                band=luxury_band(h["tier"]),
                external_key=esc("jp-guide-" + slug(h["name"])),
                aliases=esc("|".join(HOTEL_ALIASES.get(h["name"], []))),
            )
        )
    parts.append(",\n".join(detail_rows))
    parts.append(
        """
) AS v(name, city, tier, luxury_band, external_key, aliases)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_cities ci ON ci.country_id = co.id AND lower(ci.name) = lower(v.city)
JOIN public.kb_entities e ON e.entity_type = 'hotel' AND e.active = true AND e.country_id = co.id
  AND (
    e.external_key = v.external_key
    OR lower(e.name) = lower(v.name)
    OR (v.aliases <> '' AND e.name = ANY (string_to_array(v.aliases, '|')))
    OR exists (
      SELECT 1 FROM unnest(coalesce(e.aliases, '{}'::text[])) a
      WHERE lower(a) = lower(v.name)
    )
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_hotel_details d WHERE d.entity_id = e.id
);

UPDATE public.kb_hotel_details d
SET
  luxury_band = COALESCE(d.luxury_band, v.luxury_band),
  style_tags = CASE
    WHEN d.style_tags = '{}'::text[] THEN ARRAY[lower(replace(v.tier, ' ', '_'))]
    ELSE d.style_tags
  END,
  updated_at = now()
FROM (VALUES
"""
    )
    parts.append(",\n".join(detail_rows))
    parts.append(
        """
) AS v(name, city, tier, luxury_band, external_key, aliases)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_entities e ON e.entity_type = 'hotel' AND e.active = true AND e.country_id = co.id
  AND (
    e.external_key = v.external_key
    OR lower(e.name) = lower(v.name)
    OR (v.aliases <> '' AND e.name = ANY (string_to_array(v.aliases, '|')))
    OR exists (
      SELECT 1 FROM unnest(coalesce(e.aliases, '{}'::text[])) a
      WHERE lower(a) = lower(v.name)
    )
  )
WHERE d.entity_id = e.id;
"""
    )

    # 7e consortia
    consortia_rows = []
    for h in hotels:
        for key, label in club_from_partner(h["partner"]):
            consortia_rows.append(
                "  ('{name}', '{city}', '{external_key}', '{aliases}', '{key}', '{label}')".format(
                    name=esc(h["name"]),
                    city=esc(h["city"]),
                    external_key=esc("jp-guide-" + slug(h["name"])),
                    aliases=esc("|".join(HOTEL_ALIASES.get(h["name"], []))),
                    key=esc(key),
                    label=esc(label),
                )
            )
    if consortia_rows:
        parts.append(
            """
-- 7e. Consortia / partner clubs from guide partner column
INSERT INTO public.kb_hotel_consortia (entity_id, club_key, club_name)
SELECT e.id, v.club_key, v.club_name
FROM (VALUES
"""
        )
        parts.append(",\n".join(consortia_rows))
        parts.append(
            """
) AS v(name, city, external_key, aliases, club_key, club_name)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_entities e ON e.entity_type = 'hotel' AND e.active = true AND e.country_id = co.id
  AND (
    e.external_key = v.external_key
    OR lower(e.name) = lower(v.name)
    OR (v.aliases <> '' AND e.name = ANY (string_to_array(v.aliases, '|')))
    OR exists (
      SELECT 1 FROM unnest(coalesce(e.aliases, '{}'::text[])) a
      WHERE lower(a) = lower(v.name)
    )
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_hotel_consortia c
  WHERE c.entity_id = e.id AND c.club_key = v.club_key
);
"""
        )

    # 8 experiences
    parts.append(
        """
-- =============================================================================
-- 8. Experience bank (activities + restaurants) — unverified per guide
-- =============================================================================
-- Guide: nothing verified yet; advisor_take blank. client_ready = false.
-- Experience → activity entity_type. Restaurant/Bar → restaurant.

INSERT INTO public.kb_entities (
  entity_type, name, description, kb_tier, provenance, source_name,
  region_id, country_id, city_id,
  contract_status, client_ready, placeholder, not_yet_open,
  external_key, external_ids, legacy_notes, active
)
SELECT
  v.entity_type,
  v.name,
  v.description,
  'kb_scraped',
  'kb',
  'Japan Destination Guide — PureLuxe Atlas KB (2026-11-03)',
  co.region_id,
  co.id,
  ci.id,
  'unknown',
  false,
  false,
  false,
  v.external_key,
  jsonb_build_object(
    'japan_guide', true,
    'guide_type', v.guide_type,
    'who_it_suits', v.who_it_suits,
    'lead_time', v.lead_time,
    'veg_jain', v.veg_jain
  ),
  v.legacy_notes,
  true
FROM (VALUES
"""
    )
    exp_rows = []
    for e in experiences:
        guide_type = e["type"]
        if re.match(r"^(Restaurant|Bar)\b", guide_type, re.I):
            entity_type = "restaurant"
        else:
            entity_type = "activity"
        desc = (
            f"{e['about']} Suits: {e['who']}. Booking lead time: {e['lead']}. "
            f"Vegetarian/Jain: {e['veg']}."
        )
        legacy = f"type={guide_type}; who={e['who']}; lead={e['lead']}; veg/jain={e['veg']}"
        exp_rows.append(
            "  ('{entity_type}', '{name}', '{city}', '{guide_type}', '{who}', '{lead}', '{veg}', "
            "'{external_key}', '{description}', '{legacy}')".format(
                entity_type=entity_type,
                name=esc(e["name"]),
                city=esc(e["city"]),
                guide_type=esc(guide_type),
                who=esc(e["who"]),
                lead=esc(e["lead"]),
                veg=esc(e["veg"]),
                external_key=esc("jp-guide-" + slug(e["name"])),
                description=esc(desc),
                legacy=esc(legacy),
            )
        )
    parts.append(",\n".join(exp_rows))
    parts.append(
        """
) AS v(entity_type, name, city, guide_type, who_it_suits, lead_time, veg_jain, external_key, description, legacy_notes)
JOIN public.kb_countries co ON co.country_code = 'JP'
JOIN public.kb_cities ci ON ci.country_id = co.id AND lower(ci.name) = lower(v.city)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_entities e
  WHERE e.active = true
    AND e.entity_type = v.entity_type
    AND (
      e.external_key = v.external_key
      OR (e.city_id = ci.id AND lower(e.name) = lower(v.name))
    )
);
"""
    )

    # restaurant / activity details
    parts.append(
        """
INSERT INTO public.kb_restaurant_details (entity_id, cuisine, price_tier, awards)
SELECT e.id, NULL, NULL, '[]'::jsonb
FROM public.kb_entities e
WHERE e.entity_type = 'restaurant'
  AND e.active = true
  AND e.external_key LIKE 'jp-guide-%'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_restaurant_details d WHERE d.entity_id = e.id
  );

INSERT INTO public.kb_activity_details (entity_id, category, duration_text, price_tier)
SELECT
  e.id,
  coalesce(e.external_ids->>'guide_type', 'activity'),
  e.external_ids->>'lead_time',
  NULL
FROM public.kb_entities e
WHERE e.entity_type = 'activity'
  AND e.active = true
  AND e.external_key LIKE 'jp-guide-%'
  AND NOT EXISTS (
    SELECT 1 FROM public.kb_activity_details d WHERE d.entity_id = e.id
  );
"""
    )

    # 9 link first day-per-city to one preferred flagship hotel
    parts.append(
        """
-- =============================================================================
-- 9. Attach one flagship hotel onto the first day note per city
-- =============================================================================

WITH preferred AS (
  SELECT * FROM (VALUES
    ('Tokyo', 1, ARRAY[
      'Palace Hotel Tokyo',
      'Mandarin Oriental Tokyo',
      'Four Seasons Tokyo at Otemachi',
      'Four Seasons — Tokyo at Otemachi'
    ]::text[]),
    ('Kyoto', 1, ARRAY[
      'Park Hyatt Kyoto',
      'The Ritz-Carlton Kyoto',
      'Four Seasons Kyoto',
      'Four Seasons — Kyoto'
    ]::text[]),
    ('Osaka', 1, ARRAY[
      'Waldorf Astoria Osaka',
      'Four Seasons Osaka',
      'Four Seasons — Osaka',
      'The St. Regis Osaka'
    ]::text[]),
    ('Hakone', 1, ARRAY[
      'ESPACIO The Hakone Geihinkan Rin Poh Ki Ryu',
      'Gora Kadan'
    ]::text[]),
    ('Niseko', 1, ARRAY[
      'Park Hyatt Niseko Hanazono',
      'Higashiyama Niseko Village, a Ritz-Carlton Reserve'
    ]::text[])
  ) AS t(city, pick_rank, hotel_names)
),
first_days AS (
  SELECT DISTINCT ON (i.id, p.city)
    ii.id AS item_id,
    p.city,
    p.hotel_names
  FROM public.kb_itineraries i
  JOIN public.kb_countries c ON c.id = i.country_id AND c.country_code = 'JP'
  JOIN public.kb_itinerary_items ii ON ii.itinerary_id = i.id
  JOIN preferred p ON ii.note ILIKE p.city || '%'
  WHERE ii.entity_id IS NULL
  ORDER BY i.id, p.city, ii.day_number, ii.sort_order
),
picked_hotel AS (
  SELECT DISTINCT ON (fd.item_id)
    fd.item_id,
    e.id AS entity_id
  FROM first_days fd
  JOIN public.kb_countries co ON co.country_code = 'JP'
  JOIN public.kb_cities ci ON ci.country_id = co.id AND lower(ci.name) = lower(fd.city)
  JOIN public.kb_entities e
    ON e.entity_type = 'hotel'
   AND e.active = true
   AND e.country_id = co.id
   AND e.city_id = ci.id
   AND e.name = ANY (fd.hotel_names)
  ORDER BY fd.item_id, array_position(fd.hotel_names, e.name) NULLS LAST
)
UPDATE public.kb_itinerary_items ii
SET entity_id = ph.entity_id, updated_at = now()
FROM picked_hotel ph
WHERE ii.id = ph.item_id
  AND ii.entity_id IS NULL;
"""
    )
    return "\n".join(parts)


def extract_docx_lines(path: Path) -> list[str]:
    from xml.etree import ElementTree as ET
    from zipfile import ZipFile

    with ZipFile(path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    paras: list[str] = []
    for p in root.iter(
        "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"
    ):
        texts = [
            t.text or ""
            for t in p.iter(
                "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t"
            )
        ]
        line = "".join(texts).strip()
        if line:
            paras.append(line)
    return paras


def main() -> None:
    lines = extract_docx_lines(DOCX)
    hotels = parse_hotels(lines)
    experiences = parse_experiences(lines)
    sql = generate_sql(hotels, experiences)

    seed = SEED_018.read_text(encoding="utf-8")
    if MARKER in seed:
        seed = seed.split(MARKER)[0].rstrip() + "\n\n"
    elif "-- >>> BEGIN GENERATED JAPAN GUIDE ENTITIES" in seed:
        seed = seed.split("-- >>> BEGIN GENERATED JAPAN GUIDE ENTITIES")[0].rstrip() + "\n\n"
    elif "-- =============================================================================\n-- 7. Guide hotels + experience bank (generated)" in seed:
        seed = seed.split(
            "-- =============================================================================\n-- 7. Guide hotels + experience bank (generated)"
        )[0].rstrip() + "\n\n"
    if "guide hotels + experience bank" not in seed:
        seed = seed.replace(
            "-- Seeds place facts only (country / visa / cities / destination / itineraries).\n"
            "-- Hotels are already covered by seeds/016_atlas_kb.sql — do not re-insert here.\n"
            "-- Experience-bank restaurants/activities are NOT seeded yet (unverified per guide;\n"
            "--   advisor_take still blank for Keshav).\n",
            "-- Seeds place facts + guide hotels + experience bank for Trip Builder Japan tests.\n"
            "-- Hotels: insert missing / repair Unspecified city / luxury_band / consortia.\n"
            "-- Experiences: activities + restaurants (kb_scraped, client_ready=false; no advisor_take).\n",
        )
    SEED_018.write_text(seed + "\n" + MARKER + "\n" + sql, encoding="utf-8")
    print(f"hotels={len(hotels)} experiences={len(experiences)}")
    print(f"updated {SEED_018} ({SEED_018.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
