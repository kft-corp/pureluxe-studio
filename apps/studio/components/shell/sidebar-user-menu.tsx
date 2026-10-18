"use client";

import { authMessages } from "@pureluxe/shared";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LuEllipsis, LuLogOut, LuUser } from "react-icons/lu";

import { studioFocusRing } from "@/components/ui";
import { logout } from "@/lib/api";
import { pageRoutes } from "@/lib/routes";
import { showApiError, showSuccessToast } from "@/lib/feedback";
import { cn } from "@/lib/utils/cn";

type SidebarUser = {
  name: string;
  email: string;
  roleLabel: string;
};

type SidebarUserMenuProps = {
  user: SidebarUser;
  unfoldable: boolean;
  onNavigate?: () => void;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function SidebarUserMenu({
  user,
  unfoldable,
  onNavigate,
}: SidebarUserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { name, email, roleLabel } = user;

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function handleSignOut() {
    try {
      const response = await logout();
      showSuccessToast(response.message ?? authMessages.success.signedOut);
      router.push(pageRoutes.login);
      router.refresh();
    } catch (error) {
      showApiError(error);
    }
  }

  function handleAccountClick() {
    setOpen(false);
    onNavigate?.();
    router.push(pageRoutes.account);
  }

  const initials = initialsFromName(name);

  return (
    <div ref={menuRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full min-h-11 items-center rounded-lg text-left transition-colors duration-150",
          studioFocusRing,
          unfoldable
            ? "justify-center p-1 hover:bg-nav-hover"
            : "gap-2.5 bg-nav-active/70 px-2 py-1.5 ring-1 ring-nav-line ring-inset hover:bg-nav-active",
          open && (unfoldable ? "bg-nav-hover" : "bg-nav-active"),
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={unfoldable ? `${name} · account menu` : undefined}
        title={unfoldable ? name : undefined}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-avatar-hero font-serif text-[13px] font-medium text-avatar-hero-ink"
          aria-hidden
        >
          {initials}
        </span>
        {!unfoldable ? (
          <>
            <span className="studio-nav-reveal min-w-0 flex-1 text-start">
              <span className="block truncate text-[13px] leading-tight font-medium text-nav-ink-strong">
                {name}
              </span>
              <span className="mt-0.5 block truncate text-xs leading-tight text-nav-label">
                {roleLabel}
              </span>
            </span>
            <LuEllipsis className="h-4 w-4 shrink-0 text-nav-icon" strokeWidth={1.5} aria-hidden />
          </>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute bottom-full z-50 mb-2 rounded-xl border border-border bg-surface-raised p-1 shadow-lg",
            unfoldable ? "left-0 w-60" : "left-0 w-full",
          )}
        >
          <div className="px-2.5 py-2">
            <div className="truncate text-sm font-medium text-ink">{name}</div>
            <div className="truncate text-xs text-ink-muted">{email}</div>
          </div>

          <div className="my-1 h-px bg-divider" />

          <button
            type="button"
            role="menuitem"
            className="flex w-full min-h-11 items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm text-ink hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none md:min-h-0 md:py-2"
            onClick={handleAccountClick}
          >
            <LuUser className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
            Account
          </button>

          <button
            type="button"
            role="menuitem"
            className="flex w-full min-h-11 items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm text-ink hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none md:min-h-0 md:py-2"
            onClick={handleSignOut}
          >
            <LuLogOut className="h-4 w-4 shrink-0" aria-hidden />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
