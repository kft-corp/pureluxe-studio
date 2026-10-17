"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { IconType } from "react-icons";
import { LuArrowRight, LuPlus, LuSearch, LuUser } from "react-icons/lu";

import { Spinner } from "@/components/feedback";
import type { ShellNavItem } from "@/config/navigation";
import { searchClients, type ClientSearchHit } from "@/lib/api/clients";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

const CLIENT_QUERY_MIN = 2;

type QuickFindItem = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: IconType;
};

type QuickFindProps = {
  open: boolean;
  onClose: () => void;
  /** Live pages this person can open. */
  pages: ShellNavItem[];
  canCreateTrip: boolean;
  canSearchClients: boolean;
};

/** Ctrl/⌘+K finder — jump to a page, start a trip, or open a client. */
export function QuickFind(props: QuickFindProps) {
  if (!props.open) return null;
  return <QuickFindDialog {...props} />;
}

function QuickFindDialog({
  onClose,
  pages,
  canCreateTrip,
  canSearchClients,
}: QuickFindProps) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [clients, setClients] = useState<ClientSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();
  const clientQueryReady = canSearchClients && trimmed.length >= CLIENT_QUERY_MIN;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!clientQueryReady) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchClients({ q: trimmed, limit: 6 })
        .then((response) => {
          if (!cancelled) setClients(response.data.clients);
        })
        .catch(() => {
          if (!cancelled) setClients([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [clientQueryReady, trimmed]);

  const actions: QuickFindItem[] =
    canCreateTrip && (!needle || "new trip".includes(needle) || "create trip".includes(needle))
      ? [
          {
            id: "new-trip",
            label: "New trip",
            hint: "Start planning in Trip Builder",
            href: pageRoutes.tripBuilder,
            icon: LuPlus,
          },
        ]
      : [];

  const clientItems: QuickFindItem[] = (clientQueryReady ? clients : []).map((client) => ({
    id: `client-${client.id}`,
    label: client.display_name,
    hint: [client.email, client.phone].filter(Boolean).join(" · ") || client.tier.label,
    href: pageRoutes.client(client.id),
    icon: LuUser,
  }));

  const pageItems: QuickFindItem[] = pages
    .filter((page) => !needle || page.label.toLowerCase().includes(needle))
    .map((page) => ({
      id: `page-${page.href}`,
      label: page.label,
      hint: "Go to page",
      href: page.href,
      icon: page.icon,
    }));

  const groups = [
    { title: "Actions", items: actions },
    { title: "Clients", items: clientItems },
    { title: "Pages", items: pageItems },
  ].filter((group) => group.items.length > 0);
  const flat = groups.flatMap((group) => group.items);
  const active = Math.min(highlight, Math.max(flat.length - 1, 0));
  const activeItem = flat[active];
  const showSearching = clientQueryReady && searching;

  function open(item: QuickFindItem) {
    onClose();
    router.push(item.href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight(flat.length === 0 ? 0 : (active + 1) % flat.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight(flat.length === 0 ? 0 : (active - 1 + flat.length) % flat.length);
    } else if (event.key === "Enter" && activeItem) {
      event.preventDefault();
      open(activeItem);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[12vh]">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close search"
        className="absolute inset-0 bg-brand-dark/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Studio"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-xl"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <LuSearch className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeItem ? `${listId}-${activeItem.id}` : undefined}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlight(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={
              canSearchClients ? "Search clients or jump to a page…" : "Jump to a page…"
            }
            className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          />
          <kbd className="hidden shrink-0 rounded border border-border bg-surface-subtle px-1.5 py-0.5 font-sans text-[10px] font-medium text-ink-muted sm:inline">
            Esc
          </kbd>
        </div>

        <div
          id={listId}
          role="listbox"
          aria-label="Results"
          className="max-h-[min(60vh,24rem)] overflow-y-auto p-2"
        >
          {groups.map((group) => (
            <div key={group.title} role="group" aria-label={group.title} className="mb-1 last:mb-0">
              <p className="px-2 pt-2 pb-1 text-[11px] font-medium text-ink-muted" aria-hidden>
                {group.title}
              </p>
              {group.items.map((item) => {
                const index = flat.indexOf(item);
                const on = index === active;
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    id={`${listId}-${item.id}`}
                    role="option"
                    aria-selected={on}
                    onMouseEnter={() => setHighlight(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => open(item)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-ink transition-colors",
                      on && "bg-accent-soft",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                        on
                          ? "border-accent-line bg-surface-raised text-accent-strong"
                          : "border-border bg-surface-subtle text-ink-muted",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.label}</span>
                      {item.hint ? (
                        <span className="block truncate text-xs text-ink-muted">{item.hint}</span>
                      ) : null}
                    </span>
                    {on ? (
                      <LuArrowRight className="h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}

          {flat.length === 0 && !showSearching ? (
            <p className="px-3 py-8 text-center text-sm text-ink-muted">
              No matches for “{trimmed}”.
            </p>
          ) : null}

          {showSearching ? (
            <p className="flex items-center gap-2 px-3 py-2 text-xs text-ink-muted" role="status">
              <Spinner size="xs" tone="current" />
              Searching clients…
            </p>
          ) : null}
        </div>

        <div className="hidden items-center gap-4 border-t border-border bg-surface-subtle px-4 py-2 text-[11px] text-ink-muted sm:flex">
          <span>↑ ↓ to move</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
