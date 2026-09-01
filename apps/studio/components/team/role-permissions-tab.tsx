import { ComingSoon } from "@/components/shell/coming-soon";

type RolePermissionsTabProps = {
  canManage: boolean;
};

export function RolePermissionsTab({ canManage }: RolePermissionsTabProps) {
  return <ComingSoon feature="Role permissions" canWrite={canManage} />;
}
