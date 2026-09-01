import { cn } from "@/lib/utils/cn";

const ROLE_BADGE_STYLES: Record<string, string> = {
  advisor: "bg-amber-50/90 text-amber-900 ring-amber-600/10",
  ops: "bg-emerald-50/90 text-emerald-900 ring-emerald-600/10",
  finance: "bg-sky-50/90 text-sky-900 ring-sky-600/10",
  admin: "bg-stone-100 text-stone-700 ring-stone-500/10",
};

export function roleBadgeClassName(role: string): string {
  return ROLE_BADGE_STYLES[role] ?? "bg-surface text-ink-muted ring-border/60";
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
