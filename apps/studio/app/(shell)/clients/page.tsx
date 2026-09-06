import { hasPermission } from "@pureluxe/shared";

import { ClientsPageContent } from "@/components/clients";
import { ShellModulePage } from "@/components/shell";
import type { ClientDirectoryData } from "@/lib/api/clients";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";
import {
  CLIENT_DIRECTORY_PAGE_SIZE,
  EMPTY_CLIENT_DIRECTORY_FILTERS,
  getClientDirectoryFilters,
  listClientDirectory,
} from "@/lib/clients";

const EMPTY_DIRECTORY: ClientDirectoryData = {
  clients: [],
  total: 0,
  limit: CLIENT_DIRECTORY_PAGE_SIZE,
  offset: 0,
};

export default async function ClientsPage() {
  const session = await requireActiveStudioSession();
  const canWrite = hasPermission(session.permissions, "clients.write");

  let initialDirectory = EMPTY_DIRECTORY;
  let filterOptions = EMPTY_CLIENT_DIRECTORY_FILTERS;

  try {
    const [directory, filters] = await Promise.all([
      listClientDirectory({
        q: "",
        filters: [],
        tier: "any",
        review_status: "any",
        has_family: false,
        missing_contact: false,
        owner: "any",
        sources: [],
        completeness: "any",
        created_from: "",
        created_to: "",
        sort: "name_asc",
        limit: CLIENT_DIRECTORY_PAGE_SIZE,
        offset: 0,
        actorMemberId: session.memberId,
      }),
      getClientDirectoryFilters(),
    ]);
    initialDirectory = directory;
    filterOptions = filters;
  } catch {
    initialDirectory = EMPTY_DIRECTORY;
  }

  return (
    <ShellModulePage
      module="clients"
      title="Clients"
      description="Find people fast, filter the book, and open a profile."
    >
      <ClientsPageContent
        initialDirectory={initialDirectory}
        canWrite={canWrite}
        filterOptions={filterOptions}
      />
    </ShellModulePage>
  );
}
