import type { ReactNode } from "react";

import { hasModulePermission, type StudioModule } from "@pureluxe/shared";

import { AccessDenied } from "./access-denied";
import { ComingSoon } from "./coming-soon";
import { ShellPage } from "./shell-page";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";

type ShellModulePageProps = {
  module: StudioModule;
  title: string;
  description?: string;
  children?: ReactNode;
};

/**
 * Module page shell with RBAC.
 * - No read permission → access denied UI
 * - Read permission, no children → coming soon placeholder
 * - Read permission + children → feature content
 */
export async function ShellModulePage({
  module,
  title,
  description,
  children,
}: ShellModulePageProps) {
  const session = await requireActiveStudioSession();
  const { permissions } = session;
  const canRead = hasModulePermission(permissions, module, "read");
  const canWrite = hasModulePermission(permissions, module, "write");

  if (!canRead) {
    return (
      <ShellPage title={title} description={description}>
        <AccessDenied feature={title} />
      </ShellPage>
    );
  }

  return (
    <ShellPage title={title} description={description}>
      {children ?? <ComingSoon feature={title} canWrite={canWrite} />}
    </ShellPage>
  );
}
