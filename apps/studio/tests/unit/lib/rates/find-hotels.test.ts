import type { PropertySearchHit } from "@pureluxe/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  searchPropertiesRanked: vi.fn(),
  listActiveHotelsInDestination: vi.fn(),
  listPropertyPriceBands: vi.fn(),
  typicalNightlyForProperty: vi.fn(),
}));

vi.mock("@pureluxe/db", () => db);

import { findHotels } from "@/lib/rates/find-hotels";

function hit(
  partial: Partial<PropertySearchHit> &
    Pick<PropertySearchHit, "id" | "name" | "score">,
): PropertySearchHit {
  return {
    destination: "Maldives",
    city: null,
    country: "Maldives",
    aliases: [],
    price_tier: "ultra_luxury",
    style_tags: ["overwater"],
    ...partial,
  };
}

const KANUHURA = hit({
  id: "p-kanuhura",
  name: "Six Senses Kanuhura",
  score: 1,
  aliases: ["Kanuhura"],
});
const KIHAVAH = hit({
  id: "p-kihavah",
  name: "Anantara Kihavah",
  score: 0.5,
  style_tags: ["overwater", "family"],
});
const VAKKARU = hit({
  id: "p-vakkaru",
  name: "Vakkaru Maldives",
  score: 0.4,
  style_tags: ["family"],
});
const PREMIUM = hit({
  id: "p-premium",
  name: "Coral Bay Resort",
  score: 0.3,
  price_tier: "premium",
  style_tags: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  db.listPropertyPriceBands.mockResolvedValue([]);
  db.typicalNightlyForProperty.mockReturnValue(null);
});

describe("findHotels (Stage 3a)", () => {
  it("returns one hotel for a clear name match", async () => {
    db.searchPropertiesRanked.mockResolvedValue([KANUHURA]);

    const result = await findHotels({ name: "Kanuhura" });

    expect(result.hotels).toHaveLength(1);
    expect(result.hotels[0]?.name).toBe("Six Senses Kanuhura");
    expect(result.hotels[0]?.contracted).toBe(true);
    expect(result.did_you_mean).toEqual([]);
    expect(result.note).toBeNull();
  });

  it("asks Did you mean…? when the name is unsure", async () => {
    db.searchPropertiesRanked.mockResolvedValue([
      hit({ id: "p1", name: "Six Senses Kanuhura", score: 0.5 }),
      hit({ id: "p2", name: "Six Senses Laamu", score: 0.45 }),
    ]);

    const result = await findHotels({ name: "Six Sensis" });

    expect(result.hotels).toEqual([]);
    expect(result.did_you_mean).toEqual([
      "Six Senses Kanuhura",
      "Six Senses Laamu",
    ]);
    expect(result.note).toBe("Did you mean one of these?");
  });

  it("suggests same-tier hotels including the named one (done-when 3a)", async () => {
    db.searchPropertiesRanked.mockResolvedValue([KANUHURA]);
    // Destination listing is already filtered by tier in the DB query.
    db.listActiveHotelsInDestination.mockResolvedValue([KIHAVAH, VAKKARU]);

    const result = await findHotels({
      similarTo: "Six Senses Kanuhura",
      limit: 3,
    });

    expect(db.listActiveHotelsInDestination).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: "Maldives",
        tier: "ultra_luxury",
        excludePropertyIds: ["p-kanuhura"],
      }),
    );
    expect(result.hotels.map((h) => h.name)).toEqual([
      "Six Senses Kanuhura",
      "Anantara Kihavah",
      "Vakkaru Maldives",
    ]);
    expect(result.hotels.every((h) => h.tier === "ultra_luxury")).toBe(true);
    expect(result.hotels.every((h) => h.contracted)).toBe(true);
  });

  it("filters destination suggestions by tier only", async () => {
    db.listActiveHotelsInDestination.mockResolvedValue([PREMIUM]);

    const result = await findHotels({
      destination: "Maldives",
      tier: "premium",
      limit: 5,
    });

    expect(db.listActiveHotelsInDestination).toHaveBeenCalledWith(
      expect.objectContaining({ destination: "Maldives", tier: "premium" }),
    );
    expect(result.hotels.map((h) => h.name)).toEqual(["Coral Bay Resort"]);
  });

  it("asks for a filter when nothing is passed", async () => {
    const result = await findHotels({});
    expect(result.hotels).toEqual([]);
    expect(result.note).toMatch(/Pass a hotel name/);
  });
});
