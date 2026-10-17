import { notFound } from "next/navigation";
import { hasPermission } from "@pureluxe/shared";

import { ClientProfileContent } from "@/components/clients";
import { ShellModulePage } from "@/components/shell";
import { pageCopy } from "@/config/page-copy";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";
import { getClientProfile, listRelationshipOwnerOptions } from "@/lib/clients";

type ClientProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientProfilePage({
  params,
}: ClientProfilePageProps) {
  const session = await requireActiveStudioSession();
  const canWrite = hasPermission(session.permissions, "clients.write");
  const { id } = await params;

  let profile;
  try {
    profile = await getClientProfile(id);
  } catch {
    notFound();
  }

  const ownerOptions = canWrite
    ? await listRelationshipOwnerOptions().catch(() => [])
    : [];

  return (
    <ShellModulePage module="clients" {...pageCopy.client}>
      <ClientProfileContent
        initialProfile={profile}
        canWrite={canWrite}
        ownerOptions={ownerOptions}
      />
    </ShellModulePage>
  );
}
