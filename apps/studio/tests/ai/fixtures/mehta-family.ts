import type { ScenarioSeed } from "../scenario-types";

/** Client ids are UUIDs like real ones: the agent's tools reject anything else. */
export const MEHTA_FAMILY_IDS = {
  ravi: "c1000000-0000-4000-8000-000000000001",
  anika: "c1000000-0000-4000-8000-000000000002",
  aarav: "c1000000-0000-4000-8000-000000000003",
  kiara: "c1000000-0000-4000-8000-000000000004",
} as const;

const { ravi, anika, aarav, kiara } = MEHTA_FAMILY_IDS;

const KANUHURA_TERMS =
  "Shoulder season (1 Oct – 21 Dec): cancel within 21 days of arrival and 100% is charged. Minimum stay 3 nights.";
const LUXURY_TERMS = "Free cancellation until 30 days before arrival; then 100% of the stay.";

/**
 * Seed for the Feedback v2 scenarios (Keshav's Oct 21 test run).
 *
 * - One household of four Mehtas: Ravi (primary, VIP), his spouse Anika, and two
 *   children, Aarav and Kiara. Every "Mehta" match belongs to it, so "Mehta
 *   family" must add all four without asking who leads.
 * - Anika prefers connecting rooms with the children (worth surfacing with rates).
 * - Six Senses Kanuhura has the rooms and team costs from the run (5 nights,
 *   15–20 Dec), so the advisor's prices are below its 25% minimum markup.
 * - Two more Maldives hotels in the same tier (luxury), one ultra-luxury and one
 *   premium hotel that "the same tier" must leave out.
 */
export const MEHTA_FAMILY_SEED: ScenarioSeed = {
  advisor: { memberId: "member-vijay", name: "Vijay" },
  clients: [
    {
      id: ravi,
      displayName: "Ravi Mehta",
      email: "ravi.mehta@example.com",
      tier: "VIP",
      dateOfBirth: "1979-05-02",
      householdPrimary: true,
      household: [
        { clientId: anika, relation: "spouse" },
        { clientId: aarav, relation: "child" },
        { clientId: kiara, relation: "child" },
      ],
    },
    {
      id: anika,
      displayName: "Anika Mehta",
      email: "anika.mehta@example.com",
      tier: "Standard",
      dateOfBirth: "1982-08-14",
      household: [
        { clientId: ravi, relation: "spouse" },
        { clientId: aarav, relation: "child" },
        { clientId: kiara, relation: "child" },
      ],
      preferences: [
        { label: "Connecting rooms when travelling with the children", sentiment: "prefer", category: "room" },
      ],
    },
    {
      id: aarav,
      displayName: "Aarav Mehta",
      email: "aarav.mehta@example.com",
      tier: "Standard",
      dateOfBirth: "2014-03-09",
      household: [
        { clientId: ravi, relation: "parent" },
        { clientId: anika, relation: "parent" },
        { clientId: kiara, relation: "sibling" },
      ],
    },
    {
      id: kiara,
      displayName: "Kiara Mehta",
      email: "kiara.mehta@example.com",
      tier: "Standard",
      dateOfBirth: "2017-06-25",
      household: [
        { clientId: ravi, relation: "parent" },
        { clientId: anika, relation: "parent" },
        { clientId: aarav, relation: "sibling" },
      ],
    },
  ],
  hotels: [
    {
      propertyId: "property-six-senses-kanuhura",
      name: "Six Senses Kanuhura",
      aliases: ["Kanuhura"],
      destination: "Maldives",
      styleTags: ["beach", "overwater", "family", "wellness"],
      tier: "luxury",
      minMarkupPercent: 25,
      cancellation: KANUHURA_TERMS,
      requiredCharges: [],
      rooms: [
        { name: "Beach Villa with Pool", nightlyCost: 1116, maxAdults: 3, maxChildren: 1, inclusions: ["Breakfast", "Dinner (half board)", "Shared return seaplane", "Green tax"] },
        { name: "Deluxe Beach Villa with Pool", nightlyCost: 1307, maxAdults: 3, maxChildren: 1, inclusions: ["Breakfast", "Dinner (half board)", "Shared return seaplane", "Green tax"] },
        { name: "Water Villa with Pool", nightlyCost: 1421, maxAdults: 3, maxChildren: 1, inclusions: ["Breakfast", "Dinner (half board)", "Shared return seaplane", "Green tax"] },
        { name: "Deluxe Beach Villa Suite with Pool", nightlyCost: 1528, maxAdults: 3, maxChildren: 1, inclusions: ["Breakfast", "Dinner (half board)", "Shared return seaplane", "Green tax"] },
        { name: "Family Water Villa with Pool", nightlyCost: 1636, maxAdults: 4, maxChildren: 2, inclusions: ["Breakfast", "Dinner (half board)", "Shared return seaplane", "Green tax"] },
        { name: "Beach Retreat with Pool", nightlyCost: 2331, maxAdults: 4, maxChildren: 2, inclusions: ["Breakfast", "Dinner (half board)", "Shared return seaplane", "Green tax"] },
      ],
      validFrom: "2026-10-01",
      validTo: "2027-04-30",
    },
    {
      propertyId: "property-anantara-kihavah",
      name: "Anantara Kihavah",
      aliases: ["Kihavah"],
      destination: "Maldives",
      styleTags: ["beach", "overwater", "family", "dining"],
      tier: "luxury",
      minMarkupPercent: 25,
      cancellation: LUXURY_TERMS,
      requiredCharges: [
        { name: "Green tax", amount: 6, unit: "per_person_per_night" },
        { name: "Seaplane transfer", amount: 1100, unit: "per_person" },
      ],
      rooms: [
        { name: "Beach Pool Villa", nightlyCost: 1350, maxAdults: 3, maxChildren: 1, inclusions: ["Breakfast"] },
        { name: "Over Water Pool Villa", nightlyCost: 1500, maxAdults: 3, maxChildren: 1, inclusions: ["Breakfast"] },
      ],
      validFrom: "2026-10-01",
      validTo: "2027-04-30",
    },
    {
      propertyId: "property-vakkaru-maldives",
      name: "Vakkaru Maldives",
      aliases: ["Vakkaru"],
      destination: "Maldives",
      styleTags: ["beach", "overwater", "family"],
      tier: "luxury",
      minMarkupPercent: 20,
      cancellation: LUXURY_TERMS,
      requiredCharges: [
        { name: "Green tax", amount: 6, unit: "per_person_per_night" },
        { name: "Seaplane transfer", amount: 900, unit: "per_person" },
      ],
      rooms: [
        { name: "Beach Villa with Pool", nightlyCost: 1050, maxAdults: 3, maxChildren: 1, inclusions: ["Breakfast"] },
        { name: "Over Water Villa with Pool", nightlyCost: 1300, maxAdults: 3, maxChildren: 1, inclusions: ["Breakfast"] },
      ],
      validFrom: "2026-10-01",
      validTo: "2027-04-30",
    },
    {
      propertyId: "property-soneva-fushi",
      name: "Soneva Fushi",
      destination: "Maldives",
      styleTags: ["beach", "family", "barefoot-luxury"],
      tier: "ultra_luxury",
      minMarkupPercent: 25,
      cancellation: LUXURY_TERMS,
      requiredCharges: [
        { name: "Green tax", amount: 6, unit: "per_person_per_night" },
        { name: "Seaplane transfer", amount: 1250, unit: "per_person" },
      ],
      rooms: [
        { name: "Crusoe Villa with Pool", nightlyCost: 2400, maxAdults: 3, maxChildren: 2, inclusions: ["Breakfast"] },
        { name: "Water Retreat with Slide", nightlyCost: 4800, maxAdults: 4, maxChildren: 2, inclusions: ["Breakfast"] },
      ],
      validFrom: "2026-10-01",
      validTo: "2027-04-30",
    },
    {
      propertyId: "property-coral-bay-resort",
      name: "Coral Bay Resort",
      destination: "Maldives",
      styleTags: ["beach", "budget"],
      tier: "premium",
      minMarkupPercent: 20,
      cancellation: "Free cancellation until 7 days before arrival.",
      requiredCharges: [
        { name: "Green tax", amount: 6, unit: "per_person_per_night" },
        { name: "Speedboat transfer", amount: 180, unit: "per_person" },
      ],
      rooms: [
        { name: "Garden Room", nightlyCost: 280, maxAdults: 2, inclusions: ["Breakfast"] },
        { name: "Beach Bungalow", nightlyCost: 420, maxAdults: 2, maxChildren: 1, inclusions: ["Breakfast"] },
      ],
      validFrom: "2026-10-01",
      validTo: "2027-04-30",
    },
  ],
  places: [
    {
      name: "Maldives",
      kind: "country",
      notes: [
        "Getting there: resort islands are reached by seaplane or boat from Malé (MLE).",
        "Money: contracted hotel rates are in USD. Green tax is charged separately from the villa rate unless the contract includes it.",
        "Seasons: shoulder 1 Oct – 21 Dec; peak from 22 Dec. Some rates have a minimum stay.",
        "Visa: free 30-day tourist visa on arrival for all nationalities, including Indian passport holders.",
      ].join("\n"),
    },
  ],
};

/**
 * A small client base for questions about all clients: the four Mehtas (added 2025),
 * Omar Haddad (VIP, Sept 2026) and Sarah Chen (VVIP, newest, pending review).
 * 6 clients, 2 VIPs, 1 VVIP, 1 pending review.
 */
export const CLIENT_BASE_SEED: ScenarioSeed = {
  ...MEHTA_FAMILY_SEED,
  clients: [
    ...MEHTA_FAMILY_SEED.clients.map((client) => ({ ...client, addedOn: "2025-03-10" })),
    {
      id: "c2000000-0000-4000-8000-000000000001",
      displayName: "Omar Haddad",
      email: "omar.haddad@example.com",
      tier: "VIP",
      dateOfBirth: "1975-11-20",
      addedOn: "2026-09-28",
    },
    {
      id: "c2000000-0000-4000-8000-000000000002",
      displayName: "Sarah Chen",
      email: "sarah.chen@example.com",
      tier: "VVIP",
      dateOfBirth: "1988-02-14",
      addedOn: "2026-10-18",
      reviewStatus: "pending",
    },
  ],
};

/**
 * The same household with two upcoming trips and none travelled yet: a confirmed
 * Maldives trip that overlaps 15–20 Dec, and a Dubai trip still being built.
 */
export const MEHTA_FAMILY_WITH_TRIPS_SEED: ScenarioSeed = {
  ...MEHTA_FAMILY_SEED,
  trips: [
    {
      id: "a1000000-0000-4000-8000-000000000001",
      leadClientId: ravi,
      destination: "Maldives",
      startsOn: "2026-12-14",
      endsOn: "2026-12-18",
      status: "confirmed",
    },
    {
      id: "a1000000-0000-4000-8000-000000000002",
      leadClientId: ravi,
      destination: "Dubai",
      startsOn: "2026-11-05",
      endsOn: "2026-11-10",
      status: "building",
    },
  ],
};
