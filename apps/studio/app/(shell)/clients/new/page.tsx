import { hasPermission } from "@pureluxe/shared";
import { redirect } from "next/navigation";

import { ClientRegisterForm } from "@/components/clients";
import { ShellModulePage } from "@/components/shell";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";
import {
  getActiveClientTiers,
  listRelationshipOwnerOptions,
  pickDefaultClientTierId,
} from "@/lib/clients";
import { pageRoutes } from "@/lib/routes";

export default async function NewClientPage() {
  const session = await requireActiveStudioSession();
  const canWrite = hasPermission(session.permissions, "clients.write");

  if (!canWrite) {
    redirect(pageRoutes.clients);
  }

  const [tiers, ownerOptions] = await Promise.all([
    getActiveClientTiers(),
    listRelationshipOwnerOptions().catch(() => []),
  ]);
  const defaultTierId = pickDefaultClientTierId(tiers);

  return (
    <ShellModulePage
      module="clients"
      title="New client"
      description="Who they are and how to reach them. New clients stay pending until approved."
    >
      <ClientRegisterForm
        tiers={tiers}
        defaultTierId={defaultTierId}
        ownerOptions={ownerOptions}
        defaultOwnerId={session.memberId}
      />
    </ShellModulePage>
  );
}
