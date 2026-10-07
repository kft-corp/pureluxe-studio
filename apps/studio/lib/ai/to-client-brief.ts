import type { ClientBrief } from "@pureluxe/ai";

import type { ClientProfile } from "@/lib/clients";

type Prefs = ClientProfile["client"]["preferences"];
type Docs = ClientProfile["client"]["documents"];

function countSentiment(prefs: Prefs, sentiment: Prefs[number]["sentiment"]) {
  return prefs.filter((row) => row.sentiment === sentiment).length;
}

function countDocType(docs: Docs, documentType: Docs[number]["document_type"]) {
  return docs.filter((row) => row.document_type === documentType).length;
}

/** Studio client profile → lean shape for the get_client tool. */
export function toClientBrief(profile: ClientProfile): ClientBrief {
  const { client } = profile;
  const preferences = client.preferences;
  const documents = client.documents;
  const familyMembers = client.family?.members ?? [];

  return {
    id: client.id,
    display_name: client.display_name,
    email: client.email,
    phone: client.phone,
    whatsapp: client.whatsapp,
    preferred_contact_method: client.preferred_contact_method,
    preferred_language: client.preferred_language,
    nationality: client.nationality,
    city_of_residence: client.city_of_residence,
    company: client.company,
    review_status: client.review_status,
    client_since: client.client_since,
    tier: {
      slug: client.tier.slug,
      label: client.tier.label,
    },
    relationship_owner: client.relationship_owner,
    counts: {
      preferences: preferences.length,
      preferences_prefer: countSentiment(preferences, "prefer"),
      preferences_avoid: countSentiment(preferences, "avoid"),
      preferences_require: countSentiment(preferences, "require"),
      documents: documents.length,
      documents_passport: countDocType(documents, "passport"),
      documents_visa: countDocType(documents, "visa"),
      documents_insurance: countDocType(documents, "insurance"),
      documents_other: countDocType(documents, "other"),
      family_members: familyMembers.length,
      relationships: client.relationships.length,
      bookings: client.stats.booking_count,
      open_trips: client.stats.open_trip_count,
    },
    family: client.family
      ? {
          name: client.family.name,
          role: client.family.role,
          is_primary: client.family.is_primary,
          members: familyMembers.map((m) => ({
            display_name: m.display_name,
            role: m.role,
            is_primary: m.is_primary,
          })),
        }
      : null,
    preferences: preferences.map((p) => ({
      category: p.category,
      label: p.label,
      sentiment: p.sentiment,
      is_confirmed: p.is_confirmed,
    })),
    health: client.health_profile
      ? {
          dietary_restrictions: client.health_profile.dietary_restrictions,
          mobility_notes: client.health_profile.mobility_notes,
          has_emergency_contact: Boolean(
            client.health_profile.emergency_contact_name ||
              client.health_profile.emergency_contact_phone,
          ),
        }
      : null,
    documents: documents.map((d) => ({
      document_type: d.document_type,
      status: d.status,
      expiry_date: d.expiry_date,
      issuing_country: d.issuing_country,
    })),
    guest_notes: client.guest_notes,
    note:
      profile.bookings.length === 0 && profile.trips.length === 0
        ? "Booking and trip history lists are not loaded yet; counts.bookings / counts.open_trips come from client stats."
        : null,
  };
}
