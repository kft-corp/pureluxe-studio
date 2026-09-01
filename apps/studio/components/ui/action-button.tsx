"use client";

import { cn } from "@/lib/utils/cn";

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
        "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/15",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variant === "default" &&
          "text-ink-muted hover:bg-surface-hover hover:text-ink",
        variant === "danger" &&
          "text-ink-muted hover:bg-red-50 hover:text-red-700",
      )}
    >
      {children}
    </button>
  );
}
