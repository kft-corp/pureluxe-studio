import {
  createTripDocumentDownloadUrl,
  findClientById,
  findTripById,
  findTripDocument,
  type Trip,
} from "@pureluxe/db";
import { AppError, tripMessages } from "@pureluxe/shared";

/** Signed URL for the client's options quote PDF. The whole team can open it, not only the owner. */
export async function getJourneyQuoteUrl(
  tripId: string,
  download: boolean,
): Promise<{ url: string }> {
  const trip = await findTripById(tripId);
  if (!trip || trip.is_demo || trip.archived_at) {
    throw new AppError({
      userMessage: tripMessages.error.notFound,
      code: "trips.not_found",
      status: 404,
    });
  }

  const document = await findTripDocument(tripId, "options");
  if (!document?.file_path || document.status === "generating") {
    throw new AppError({
      userMessage: tripMessages.error.quoteFileMissing,
      code: "trips.quote_file_missing",
      status: 404,
    });
  }

  const client = trip.primary_client_id ? await findClientById(trip.primary_client_id) : null;
  const url = await createTripDocumentDownloadUrl(
    document.file_path,
    120,
    download ? quoteFileName(trip, client?.display_name ?? null) : undefined,
  );
  return { url };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sandeep Sharma - Maldives Quote - Nov 2026.pdf". The client name is not repeated from the title. */
function quoteFileName(trip: Trip, clientName: string | null): string {
  const client = cleanPart(clientName);
  const places = (trip.title ?? "")
    .split(/\s*[·|,–—]\s*|\s+-\s+/)
    .map(cleanPart)
    .filter((part): part is string => Boolean(part) && part?.toLowerCase() !== client?.toLowerCase())
    .join(" ");

  const parts: string[] = [];
  if (client) parts.push(client);
  parts.push(places ? `${places} Quote` : "Quote");
  const month = trip.starts_on ? monthLabel(trip.starts_on) : null;
  if (month) parts.push(month);
  return `${parts.join(" - ").slice(0, 100).trim()}.pdf`;
}

function monthLabel(isoDate: string): string | null {
  const [year, month] = isoDate.split("-");
  const name = MONTHS[Number(month) - 1];
  return year && name ? `${name} ${year}` : null;
}

/** File-safe ASCII so the name downloads as written. */
function cleanPart(value: string | null | undefined): string | null {
  const cleaned = value
    ?.normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
    .trim();
  return cleaned || null;
}
