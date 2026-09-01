import { cn } from "@/lib/utils/cn";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "?";
}

const SIZE_CLASSES = {
  sm: "h-10 w-10 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
} as const;

type UserAvatarProps = {
  name?: string;
  email?: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  variant?: "member" | "invite";
};

export function UserAvatar({
  name,
  email,
  size = "sm",
  className,
  variant = "member",
}: UserAvatarProps) {
  const initials = name?.trim()
    ? initialsFromName(name)
    : initialsFromEmail(email ?? "");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight ring-2 ring-surface-raised",
        SIZE_CLASSES[size],
        variant === "member" && "bg-brand-dark text-on-dark shadow-sm",
        variant === "invite" &&
          "border border-dashed border-border bg-surface text-ink-muted",
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
