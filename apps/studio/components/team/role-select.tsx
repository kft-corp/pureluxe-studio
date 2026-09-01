import type { TeamOverviewData } from "@/lib/api/team";

import { modalFieldClassName } from "@/components/ui/modal";

type RoleSelectProps = {
  roles: TeamOverviewData["roles"];
  value: string;
  onChange: (value: string) => void;
  id?: string;
};

export function RoleSelect({ roles, value, onChange, id }: RoleSelectProps) {
  return (
    <select
      id={id}
      required
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={modalFieldClassName}
    >
      {roles.map((role) => (
        <option key={role.slug} value={role.slug}>
          {role.label}
        </option>
      ))}
    </select>
  );
}
