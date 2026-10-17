"use client";

import { cn } from "@/lib/utils/cn";

import { studioFocusRing } from "./studio-control";

type ActionButtonProps = {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
};

export function ActionButton({
  children,
  onClick,
  disabled,
  variant = "default",
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-8 items-center rounded-lg px-2.5 text-xs font-medium transition-colors",
        studioFocusRing,
        "disabled:cursor-not-allowed disabled:opacity-40",
        variant === "default" &&
          "text-ink-muted hover:bg-surface-hover hover:text-ink",
        variant === "danger" &&
          "text-ink-muted hover:bg-danger-soft hover:text-danger-ink",
      )}
    >
      {children}
    </button>
  );
}
