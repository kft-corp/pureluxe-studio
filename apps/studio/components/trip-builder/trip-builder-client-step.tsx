"use client";

import { useEffect, useRef, useState } from "react";
import { LuUserRound } from "react-icons/lu";

import { studioButtonClass, studioControl } from "@/components/ui";
import { searchClients, type ClientSearchHit } from "@/lib/api/clients";
import { showApiError } from "@/lib/feedback";
import { cn } from "@/lib/utils/cn";

type TripBuilderClientStepProps = {
  canWrite: boolean;
  busy: boolean;
  initialQuery?: string;
  autoFocus?: boolean;
  onAssign: (clientId: string) => void;
};

/** Phase 1 client picker — domain path while agent is offline. */
export function TripBuilderClientStep({
  canWrite,
  busy,
  initialQuery = "",
  autoFocus = false,
  onAssign,
}: TripBuilderClientStepProps) {
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<ClientSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus || !canWrite) return;
    inputRef.current?.focus();
  }, [autoFocus, canWrite]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }

    const handle = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await searchClients({ q, limit: 8 });
        setHits(response.data.clients);
      } catch (error) {
        showApiError(error);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [query]);

  if (!canWrite) {
    return (
      <StepCard
        icon={<LuUserRound className="h-4 w-4" aria-hidden />}
        title="Choose a client"
        body="You can view this trip, but choosing a client needs write access."
      />
    );
  }

  return (
    <StepCard
      icon={<LuUserRound className="h-4 w-4" aria-hidden />}
      title="Choose a client"
      body="Search by name, email, or phone. This trip stays assigned to you."
    >
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
          Client
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search clients…"
          disabled={busy}
          className={cn(studioControl.field, "h-9 px-3")}
        />
      </label>

      <div className="mt-3 space-y-1">
        {searching ? (
          <p className="px-1 text-xs text-ink-muted">Searching…</p>
        ) : null}
        {!searching && query.trim().length >= 2 && hits.length === 0 ? (
          <p className="px-1 text-xs text-ink-muted">No clients match that search.</p>
        ) : null}
        {hits.map((hit) => (
          <button
            key={hit.id}
            type="button"
            disabled={busy}
            onClick={() => onAssign(hit.id)}
            className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-surface-raised px-3 py-2 text-left transition hover:bg-surface-hover"
          >
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-ink">
                {hit.display_name}
              </span>
              <span className="block truncate text-[11px] text-ink-muted">
                {[hit.email, hit.tier.label].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className={studioButtonClass("secondary", "sm", "shrink-0")}>
              Use
            </span>
          </button>
        ))}
      </div>
    </StepCard>
  );
}

function StepCard({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface-raised p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-muted">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{body}</p>
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
