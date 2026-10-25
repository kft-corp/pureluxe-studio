import type { Property, PropertySearchHit } from "@pureluxe/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  searchPropertiesRanked: vi.fn(),
  findActivePropertyById: vi.fn(),
  searchActivePropertiesByName: vi.fn(),
}));

vi.mock("@pureluxe/db", () => db);

import {
  matchPropertyByName,
  namesLooselyMatch,
} from "@/lib/rates/match-property";

function hit(partial: Partial<PropertySearchHit> & Pick<PropertySearchHit, "id" | "name" | "score">): PropertySearchHit {
  return {
    destination: "Maldives",
    city: null,
    country: "Maldives",
    aliases: [],
    price_tier: "ultra_luxury",
    style_tags: [],
    ...partial,
  };
}

function property(id: string, name: string): Property {
  return {
    id,
    name,
    destination: "Maldives",
    brand: null,
    chain: null,
    city: null,
    country: "Maldives",
    region: null,
    property_type: null,
    destination_profile_id: null,
    curated_hotel_id: null,
    aliases: [],
    kb_country_id: null,
    kb_city_id: null,
    default_currency: "USD",
    min_markup_percent: 25,
    contracting_entity_name: null,
    default_commission: null,
    commission_channel: null,
    commissionable: null,
    relationship_strength: null,
    booking_notes: null,
    vip_contact_notes: null,
    reservations_email: null,
    general_phone: null,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.searchActivePropertiesByName.mockResolvedValue([]);
});

describe("namesLooselyMatch (Stage 3a)", () => {
  it.each([
    ["Six Senses Kanuhura", "Kanuhura", true],
    ["Kanuhura", "Six Senses Kanuhura", true],
    ["Six Senses Kanuhura", "Soneva Fushi", false],
  ])("%j vs %j → %s", (left, right, expected) => {
    expect(namesLooselyMatch(left, right)).toBe(expected);
  });
});

describe("matchPropertyByName (Stage 3a / R5)", () => {
  it("links a clear high-confidence hit", async () => {
    db.searchPropertiesRanked.mockResolvedValue([
      hit({ id: "p1", name: "Six Senses Kanuhura", score: 1 }),
    ]);
    db.findActivePropertyById.mockResolvedValue(property("p1", "Six Senses Kanuhura"));

    const result = await matchPropertyByName("Kanuhura");

    expect(result.status).toBe("linked");
    expect(result.property?.name).toBe("Six Senses Kanuhura");
    expect(result.names).toEqual(["Six Senses Kanuhura"]);
  });

  it("returns several when scores are close (Did you mean…?)", async () => {
    db.searchPropertiesRanked.mockResolvedValue([
      hit({ id: "p1", name: "Six Senses Kanuhura", score: 0.72 }),
      hit({ id: "p2", name: "Six Senses Laamu", score: 0.7 }),
    ]);

    const result = await matchPropertyByName("Six Senses");

    expect(result.status).toBe("several");
    expect(result.property).toBeNull();
    expect(result.names).toEqual(["Six Senses Kanuhura", "Six Senses Laamu"]);
  });

  it("returns none for a short query", async () => {
    expect(await matchPropertyByName("S")).toEqual({
      status: "none",
      names: [],
      property: null,
    });
    expect(db.searchPropertiesRanked).not.toHaveBeenCalled();
  });
});
