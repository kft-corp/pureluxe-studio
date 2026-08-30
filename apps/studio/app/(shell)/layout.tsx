import { redirect } from "next/navigation";

import { AppShell } from "@/components/shell";
import { loadStudioSessionWithPermissions } from "@/lib/auth/session-with-permissions";
import { pageRoutes } from "@/lib/routes";

export default async function ShellLayout({
  children,
}: LayoutProps<"/">) {
  const session = await loadStudioSessionWithPermissions();

  if (
    !session.isLoggedIn ||
    !session.email ||
    !session.name ||
    !session.role ||
    !session.memberId
  ) {
    redirect(pageRoutes.login);
  }

  return (
    <AppShell
      user={{
        name: session.name,
        email: session.email,
        permissions: session.permissions ?? [],
      }}
    >
      {children}
    </AppShell>
  );
}
