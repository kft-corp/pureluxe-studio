"use client";

import { authMessages } from "@pureluxe/shared";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LuEllipsis, LuLogOut, LuUser } from "react-icons/lu";

import { logout } from "@/lib/api";
import { pageRoutes } from "@/lib/routes";
import { showApiError, showSuccessToast } from "@/lib/feedback";

type SidebarUser = {
  name: string;
  email: string;
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
  const { name, email } = user;

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
        className={[
          "flex w-full min-h-11 items-center gap-2 rounded-md p-1 text-left transition md:min-h-0",
          "hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light/30",
          unfoldable ? "justify-center" : "gap-2",
        ].join(" ")}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-border-dark text-xs font-semibold text-on-dark"
          aria-hidden
        >
          {initials}
        </span>
        {!unfoldable ? (
          <>
            <span className="min-w-0 flex-1 text-start">
              <span className="block truncate text-sm font-semibold text-on-dark">
                {name}
              </span>
              <span className="block truncate text-xs text-on-dark-subtle">
                {email}
              </span>
            </span>
            <LuEllipsis
              className="h-4 w-4 shrink-0 text-on-dark-subtle"
              aria-hidden
            />
          </>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-2 w-full rounded-lg border border-border-dark bg-brand-sidebar p-1 shadow-lg"
        >
          <div className="flex items-center gap-2 px-2 py-2">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-border-dark text-xs font-semibold text-on-dark"
              aria-hidden
            >
              {initials}
            </span>
            <div className="min-w-0 text-start text-sm">
              <div className="truncate font-semibold text-on-dark">{name}</div>
              <div className="truncate text-xs text-on-dark-subtle">{email}</div>
            </div>
          </div>

          <div className="my-1 h-px bg-border-dark" />

          <button
            type="button"
            role="menuitem"
            className="flex w-full min-h-11 items-center gap-2 rounded-md px-2 py-2.5 text-sm text-on-dark hover:bg-white/5 md:min-h-0 md:py-2"
            onClick={handleAccountClick}
          >
            <LuUser className="h-4 w-4 shrink-0" aria-hidden />
            Account
          </button>

          <div className="my-1 h-px bg-border-dark" />

          <button
            type="button"
            role="menuitem"
            className="flex w-full min-h-11 items-center gap-2 rounded-md px-2 py-2.5 text-sm text-on-dark hover:bg-white/5 md:min-h-0 md:py-2"
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
