import { hasPermission } from "@pureluxe/shared";

import { TeamPageContent } from "@/components/team";
import { ShellModulePage } from "@/components/shell";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";
import { getTeamOverview } from "@/lib/team/team-overview";

export default async function TeamPage() {
  const session = await requireActiveStudioSession();
  const canManage = hasPermission(session.permissions, "team.manage");
  const overview = await getTeamOverview(canManage);

  return (
    <ShellModulePage
      module="team"
      title="Team & Roles"
      description="Invite KFT team · set role · Google sign-in only · no public registration."
    >
      <TeamPageContent
        initialData={overview}
        currentMemberId={session.memberId}
        currentMemberEmail={session.email}
      />
    </ShellModulePage>
  );
}
