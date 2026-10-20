import type { ScenarioSeed } from "../scenario-types";

/** Client ids are UUIDs like real ones: the agent's tools reject anything else. */
export const MEHTA_CLIENT_IDS = {
  aarav: "c0000000-0000-4000-8000-000000000001",
  anika: "c0000000-0000-4000-8000-000000000002",
  ravi: "c0000000-0000-4000-8000-000000000003",
  priya: "c0000000-0000-4000-8000-000000000004",
  kabir: "c0000000-0000-4000-8000-000000000005",
} as const;

/**
 * Seed for the Mehta / Maldives scenarios.
 *
 * - Four clients named Mehta, so the agent must ask which one.
 * - Aarav's household (Anika) fills the party without asking.
 * - Three Maldives hotels in a similar price band, and one far cheaper hotel
 *   that "similar price range" must leave out.
 * - Room names differ slightly by hotel ("Beach Pool Villa", "Water Villa with
 *   Pool"), so "Beach Villa" / "Water Villa" must be matched, not copied.
 * - Every hotel has the same cancellation and breakfast (shared terms shown
 *   once) but different required charges (all-in price differs).
 */
export const MEHTA_MALDIVES_SEED: ScenarioSeed = {
  advisor: { memberId: "member-vijay", name: "Vijay" },
  clients: [
    {
      id: MEHTA_CLIENT_IDS.aarav,
      displayName: "Aarav Mehta",
      email: "aarav.mehta@example.com",
      tier: "Gold",
      dateOfBirth: "1985-04-12",
      household: [{ clientId: MEHTA_CLIENT_IDS.anika, relation: "spouse" }],
    },
    {
      id: MEHTA_CLIENT_IDS.anika,
      displayName: "Anika Mehta",
      email: "anika.mehta@example.com",
      tier: "Gold",
      dateOfBirth: "1987-09-03",
      household: [{ clientId: MEHTA_CLIENT_IDS.aarav, relation: "spouse" }],
    },
    {
      id: MEHTA_CLIENT_IDS.ravi,
      displayName: "Ravi Mehta",
      email: "ravi.mehta@example.com",
      tier: "Silver",
      dateOfBirth: "1972-01-20",
    },
    {
      id: MEHTA_CLIENT_IDS.priya,
      displayName: "Priya Mehta",
      email: "priya.mehta@example.com",
      tier: "Platinum",
      dateOfBirth: "1990-06-15",
    },
    {
      id: MEHTA_CLIENT_IDS.kabir,
      displayName: "Kabir Mehta",
      email: "kabir.mehta@example.com",
      tier: "Silver",
      dateOfBirth: "1968-11-02",
    },
  ],
  hotels: [
    {
      propertyId: "property-six-senses-kanuhura",
      name: "Six Senses Kanuhura",
      aliases: ["Kanuhura"],
      destination: "Maldives",
      styleTags: ["beach", "overwater", "family", "wellness"],
      minMarkupPercent: 25,
      cancellation: "Free cancellation until 30 days before arrival; then 100% of the stay.",
      requiredCharges: [
        { name: "Green tax", amount: 6, unit: "per_person_per_night" },
        { name: "Seaplane transfer", amount: 950, unit: "per_person" },
      ],
      rooms: [
        { name: "Beach Villa", nightlyCost: 1450, maxAdults: 2, inclusions: ["Breakfast"] },
        { name: "Water Villa", nightlyCost: 1850, maxAdults: 2, inclusions: ["Breakfast"] },
      ],
      validFrom: "2026-11-01",
      validTo: "2027-04-30",
    },
    {
      propertyId: "property-anantara-kihavah",
      name: "Anantara Kihavah",
      aliases: ["Kihavah", "Anantara Kihavah Maldives Villas"],
      destination: "Maldives",
      styleTags: ["beach", "overwater", "family", "dining"],
      minMarkupPercent: 25,
      cancellation: "Free cancellation until 30 days before arrival; then 100% of the stay.",
      requiredCharges: [
        { name: "Green tax", amount: 6, unit: "per_person_per_night" },
        { name: "Seaplane transfer", amount: 1100, unit: "per_person" },
      ],
      rooms: [
        { name: "Beach Pool Villa", nightlyCost: 1600, maxAdults: 2, inclusions: ["Breakfast"] },
        { name: "Over Water Pool Villa", nightlyCost: 2050, maxAdults: 2, inclusions: ["Breakfast"] },
      ],
      validFrom: "2026-11-01",
      validTo: "2027-04-30",
    },
    {
      propertyId: "property-soneva-fushi",
      name: "Soneva Fushi",
      aliases: ["Soneva Fushi Resort"],
      destination: "Maldives",
      styleTags: ["beach", "overwater", "family", "barefoot-luxury"],
      minMarkupPercent: 25,
      cancellation: "Free cancellation until 30 days before arrival; then 100% of the stay.",
      requiredCharges: [
        { name: "Green tax", amount: 6, unit: "per_person_per_night" },
        { name: "Seaplane transfer", amount: 1250, unit: "per_person" },
      ],
      rooms: [
        { name: "Beach Villa with Pool", nightlyCost: 1700, maxAdults: 2, inclusions: ["Breakfast"] },
        { name: "Water Villa with Pool", nightlyCost: 2200, maxAdults: 2, inclusions: ["Breakfast"] },
      ],
      validFrom: "2026-11-01",
      validTo: "2027-04-30",
    },
    {
      propertyId: "property-coral-bay-resort",
      name: "Coral Bay Resort",
      destination: "Maldives",
      styleTags: ["beach", "budget"],
      minMarkupPercent: 20,
      cancellation: "Free cancellation until 7 days before arrival.",
      requiredCharges: [
        { name: "Green tax", amount: 6, unit: "per_person_per_night" },
        { name: "Speedboat transfer", amount: 180, unit: "per_person" },
      ],
      rooms: [
        { name: "Garden Room", nightlyCost: 280, maxAdults: 2, inclusions: ["Breakfast"] },
        { name: "Beach Bungalow", nightlyCost: 420, maxAdults: 2, inclusions: ["Breakfast"] },
      ],
      validFrom: "2026-11-01",
      validTo: "2027-04-30",
    },
  ],
  places: [
    {
      name: "Maldives",
      kind: "country",
      notes: [
        "Visa: free 30-day tourist visa on arrival for all nationalities, including Indian passport holders. Needs a passport valid for 6 months, a confirmed resort booking and an onward ticket.",
        "Best time: November to April is the dry season; May to October is the wet season with lower rates.",
        "Getting there: fly into Malé (MLE), then seaplane or speedboat to the resort. Seaplanes fly in daylight only.",
        "Currency: US dollars are accepted at every resort.",
      ].join("\n"),
    },
  ],
};
