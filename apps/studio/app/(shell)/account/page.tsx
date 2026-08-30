import { ShellPage } from "@/components/shell";
import { AccountProfile } from "@/components/account/account-profile";
import { loadStudioSession } from "@/lib/auth/session";

export default async function AccountPage() {
  const session = await loadStudioSession();

  return (
    <ShellPage
      title="Account"
      description="Your Studio profile and sign-in details."
    >
      <AccountProfile
        name={session.name ?? ""}
        email={session.email ?? ""}
        role={session.role ?? ""}
        memberId={session.memberId ?? ""}
      />
    </ShellPage>
  );
}
