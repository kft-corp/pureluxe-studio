import { listClients, searchClients as dbSearchClients } from "@pureluxe/db";
import type { ListClientsQuery, SearchClientsQuery } from "@pureluxe/shared";

export { CLIENT_DIRECTORY_PAGE_SIZE } from "./client-limits";

type ListDirectoryOptions = ListClientsQuery & {
  actorMemberId?: string | null;
};

/** Directory list for the Clients page. */
export async function listClientDirectory(query: ListDirectoryOptions) {
  const result = await listClients(query);

  return {
    ...result,
    clients: result.clients.map((row) => {
      const { active, ...rest } = row;
      void active;
      return {
        ...rest,
        stats: {
          total_spend_usd: 0,
          booking_count: 0,
          last_booking_date: null as string | null,
        },
      };
    }),
  };
}

/** Autocomplete — max 10. */
export async function searchClients(query: SearchClientsQuery) {
  const clients = await dbSearchClients(query);
  return { clients };
}
