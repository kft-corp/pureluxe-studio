import { Suspense } from "react";
import { hasPermission } from "@pureluxe/shared";

import { ClientsPageContent } from "@/components/clients";
import { ShellModulePage } from "@/components/shell";
import { pageCopy } from "@/config/page-copy";
import type { ClientDirectoryData } from "@/lib/api/clients";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";
import {
  CLIENT_DIRECTORY_PAGE_SIZE,
  EMPTY_CLIENT_DIRECTORY_FILTERS,
  getClientDirectoryFilters,
  listClientDirectory,
} from "@/lib/clients";
import {
  clientDirectoryUrlStateToListQuery,
  parseClientDirectoryUrlState,
} from "@/lib/clients/client-directory-query";
import { toURLSearchParams } from "@/lib/directory";

const EMPTY_DIRECTORY: ClientDirectoryData = {
  clients: [],
  total: 0,
  limit: CLIENT_DIRECTORY_PAGE_SIZE,
  offset: 0,
};

type ClientsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const session = await requireActiveStudioSession();
  const canWrite = hasPermission(session.permissions, "clients.write");
  const params = await searchParams;
  const directoryState = parseClientDirectoryUrlState(toURLSearchParams(params));
  const directoryQuery = clientDirectoryUrlStateToListQuery(directoryState);

  let initialDirectory = EMPTY_DIRECTORY;
  let filterOptions = EMPTY_CLIENT_DIRECTORY_FILTERS;

  try {
    const [directory, filters] = await Promise.all([
      listClientDirectory({
        ...directoryQuery,
        actorMemberId: session.memberId,
      }),
      getClientDirectoryFilters({
        memberId: session.memberId,
        name: session.name,
      }),
    ]);
    initialDirectory = directory;
    filterOptions = filters;
  } catch {
    initialDirectory = EMPTY_DIRECTORY;
  }

  return (
    <ShellModulePage module="clients" {...pageCopy.clients}>
      <Suspense fallback={null}>
        <ClientsPageContent
          initialDirectory={initialDirectory}
          canWrite={canWrite}
          filterOptions={filterOptions}
        />
      </Suspense>
    </ShellModulePage>
  );
}
