"use client";

import { forwardRef, useEffect, useId } from "react";
import { LuX } from "react-icons/lu";

import { cn } from "@/lib/utils/cn";

import { studioControl, studioTone } from "./studio-control";

function useEscapeKey(onClose: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
}

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Wider dialog for multi-field forms. */
  size?: "md" | "lg";
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEscapeKey(onClose);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-brand-dark/50 backdrop-blur-[1px]"
        aria-label="Close dialog"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-xl",
          size === "lg" ? "max-w-lg" : "max-w-md",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="mt-1 wrap-break-word text-sm leading-relaxed text-ink-muted"
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-hover hover:text-ink"
            aria-label="Close"
          >
            <LuX className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {children}

        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type ModalButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  form?: string;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
};

export const ModalButton = forwardRef<HTMLButtonElement, ModalButtonProps>(
  function ModalButton(
    {
      children,
      onClick,
      type = "button",
      form,
      disabled,
      variant = "secondary",
      className,
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        form={form}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          studioControl.button,
          variant === "secondary" && studioTone.secondary,
          variant === "primary" && studioTone.primary,
          variant === "danger" && "bg-red-700 text-on-dark hover:bg-red-800",
          className,
        )}
      >
        {children}
      </button>
    );
  },
);

export const modalFieldClassName =
  "mt-1.5 w-full rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-brand-dark/40 focus:ring-2 focus:ring-brand-dark/10";
