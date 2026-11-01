import {
  findClientById,
  listClientDocuments,
  updateClient,
  updateClientDocument,
  updateTripClientStatedAges,
} from "@pureluxe/db";

/** Approximate DOB as 1 Jan of (onDate year − age). */
function approximateDob(age: number, onDate: string): string | null {
  const year = Number(onDate.slice(0, 4));
  if (!Number.isFinite(year) || year < 1900) return null;
  if (!Number.isFinite(age) || age < 0) return null;
  const birthYear = year - Math.floor(age);
  if (birthYear < 1900 || birthYear > year) return null;
  return `${birthYear}-01-01`;
}

/**
 * Persist stated ages without requiring a passport:
 * 1) trip_clients.stated_age (trip-scoped)
 * 2) clients.date_of_birth when empty (approximate)
 * 3) passport date_of_birth when a passport exists and DOB is empty
 */
export async function saveStatedAges(input: {
  tripId: string;
  people: Array<{ clientId: string; age?: number }>;
  onDate: string;
  actorId: string;
}): Promise<void> {
  const withAges = input.people.filter(
    (person) => person.age != null && Number.isFinite(person.age) && person.age! >= 0,
  );
  if (withAges.length === 0) return;

  await updateTripClientStatedAges(
    input.tripId,
    withAges.map((person) => ({
      clientId: person.clientId,
      statedAge: Math.floor(person.age!),
    })),
  );

  await Promise.all(
    withAges.map(async (person) => {
      const age = Math.floor(person.age!);
      const dob = approximateDob(age, input.onDate);
      if (!dob) return;

      const client = await findClientById(person.clientId);
      if (client && !client.date_of_birth) {
        await updateClient({
          id: person.clientId,
          date_of_birth: dob,
          updated_by_id: input.actorId,
        });
      }

      const docs = await listClientDocuments(person.clientId);
      const passport = docs
        .filter((row) => row.document_type === "passport" && row.status !== "rejected")
        .sort((a, b) => {
          if ((a.status === "verified") !== (b.status === "verified")) {
            return a.status === "verified" ? -1 : 1;
          }
          return (b.expiry_date ?? "").localeCompare(a.expiry_date ?? "");
        })[0];
      if (!passport || passport.date_of_birth) return;
      await updateClientDocument(passport.id, { date_of_birth: dob });
    }),
  );
}
