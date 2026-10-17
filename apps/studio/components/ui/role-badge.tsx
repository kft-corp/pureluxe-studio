import { cn } from "@/lib/utils/cn";

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: "bg-accent-soft text-accent-ink ring-accent-line",
  advisor: "bg-neutral-soft text-neutral-ink ring-neutral-line",
  ops: "bg-success-soft text-success-ink ring-success-line",
  finance: "bg-info-soft text-info-ink ring-info-line",
};

export function roleBadgeClassName(role: string): string {
  return (
    ROLE_BADGE_STYLES[role] ?? "bg-neutral-soft text-neutral-ink ring-neutral-line"
  );
}

type RoleBadgeProps = {
  label: string;
  role: string;
  className?: string;
};

export function RoleBadge({ label, role, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        roleBadgeClassName(role),
        className,
      )}
    >
      {label}
    </span>
  );
}
