import { AccountProfile } from "@/components/account/account-profile";
import { ShellPage } from "@/components/shell";
import { getMemberProfile } from "@/lib/account/member-profile";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";

export default async function AccountPage() {
  const session = await requireActiveStudioSession();
  const profile = await getMemberProfile(session.memberId);

  return (
    <ShellPage
      title="Account"
      description="View your profile, role, and team account details."
    >
      <AccountProfile {...profile} />
    </ShellPage>
  );
}
