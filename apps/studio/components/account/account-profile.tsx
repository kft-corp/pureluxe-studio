import { formatRoleLabel } from "@/lib/auth/format-role-label";

type AccountProfileProps = {
  name: string;
  email: string;
  role: string;
  memberId: string;
};

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border px-4 py-4 last:border-b-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
      <dt className="text-sm font-medium text-ink-muted">{label}</dt>
      <dd className="mt-1 wrap-break-word text-sm text-ink sm:col-span-2 sm:mt-0">
        {value}
      </dd>
    </div>
  );
}

export function AccountProfile({
  name,
  email,
  role,
  memberId,
}: AccountProfileProps) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-surface-raised shadow-sm"
      aria-label="Account details"
    >
      <dl>
        <ProfileField label="Name" value={name} />
        <ProfileField label="Email" value={email} />
        <ProfileField label="Role" value={formatRoleLabel(role)} />
        <ProfileField label="Member ID" value={memberId} />
      </dl>
    </section>
  );
}
