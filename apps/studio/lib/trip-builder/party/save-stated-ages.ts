import {
  listClientDocuments,
  updateClientDocument,
} from "@pureluxe/db";

/**
 * When the advisor states an age, write an approximate DOB onto an existing
 * passport so the "no date of birth" warning stops returning (Issue #22).
 * Does not create new passport rows (those need a file upload).
 */
export async function saveStatedAgesOnPassports(
  people: Array<{ clientId: string; age?: number }>,
  onDate: string,
): Promise<void> {
  const year = Number(onDate.slice(0, 4));
  if (!Number.isFinite(year) || year < 1900) return;

  await Promise.all(
    people.map(async (person) => {
      if (person.age == null || !Number.isFinite(person.age) || person.age < 0) return;
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
      // Approximate: birthday on 1 Jan of (onDate year − age).
      const birthYear = year - Math.floor(person.age);
      if (birthYear < 1900 || birthYear > year) return;
      await updateClientDocument(passport.id, {
        date_of_birth: `${birthYear}-01-01`,
      });
    }),
  );
}
