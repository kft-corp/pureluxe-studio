import { hasPermission } from "@pureluxe/shared";

import { TeamPageContent } from "@/components/team";
import { ShellModulePage } from "@/components/shell";
import { pageCopy } from "@/config/page-copy";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";
import { getTeamOverview } from "@/lib/team/team-overview";

export default async function TeamPage() {
  const session = await requireActiveStudioSession();
  const canManage = hasPermission(session.permissions, "team.manage");
  const overview = await getTeamOverview(canManage);

  return (
    <ShellModulePage module="team" {...pageCopy.team}>
      <TeamPageContent
        initialData={overview}
        currentMemberId={session.memberId}
        currentMemberEmail={session.email}
      />
    </ShellModulePage>
  );
}
