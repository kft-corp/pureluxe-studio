"use client";

import { LuBotMessageSquare } from "react-icons/lu";

import type { NormalizedRateOption } from "@pureluxe/rates";
import type { SetTripStayBody } from "@pureluxe/shared";

import { studioButtonClass, studioChipClass } from "@/components/ui";
import type { TripDetail } from "@/lib/trip-builder";

import type { TripBuilderDraft } from "./trip-builder-draft";
import { TripBuilderClientStep } from "./trip-builder-client-step";
import { TripBuilderRatesStep } from "./trip-builder-rates-step";
import { TripBuilderStayStep } from "./trip-builder-stay-step";
import { resolveTripStage } from "./trip-stages";

type TripBuilderChatPaneProps = {
  detail: TripDetail | null;
  canWrite: boolean;
  busy: boolean;
  notices: string[];
  draft: TripBuilderDraft | null;
  rateOptions: NormalizedRateOption[];
  rateSearchMessage: string | null;
  onNewTrip: () => void;
  onAssignClient: (clientId: string) => void;
  onSaveStay: (input: SetTripStayBody) => void;
  onSearchRates: () => void;
  onSelectRateOption: (option: NormalizedRateOption) => void;
  onSelectRateCandidate: (lineItemId: string) => void;
  onPasteQuote: (text: string) => void;
  onStarter: (intent: "client" | "hotel") => void;
};

const HOME_STARTERS = [
  { id: "hotel" as const, label: "Quote a named hotel" },
  { id: "client" as const, label: "Start a client trip" },
];

/** Chat hero — home lead or open-trip steps (agent later). */
export function TripBuilderChatPane({
  detail,
  canWrite,
  busy,
  notices,
  draft,
  rateOptions,
  rateSearchMessage,
  onNewTrip,
  onAssignClient,
  onSaveStay,
  onSearchRates,
  onSelectRateOption,
  onSelectRateCandidate,
  onPasteQuote,
  onStarter,
}: TripBuilderChatPaneProps) {
  if (!detail) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-8 sm:px-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-raised shadow-sm">
            <LuBotMessageSquare className="h-5 w-5 text-ink-muted" aria-hidden />
          </div>
          <h2 className="mt-5 font-serif text-3xl font-normal tracking-tight text-ink sm:text-4xl">
            What do you need?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
            Build a hotel quote step by step — start a trip, choose the client,
            then set the stay.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          {canWrite ? (
            <button
              type="button"
              disabled={busy}
              onClick={onNewTrip}
              className={studioButtonClass("primary", "md", "min-w-[10rem]")}
            >
              New trip
            </button>
          ) : (
            <p className="max-w-sm text-center text-xs text-ink-muted">
              You can open assigned trips above. Creating trips needs write
              access.
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            <span className="w-full text-center text-[11px] font-medium tracking-wide text-ink-subtle uppercase">
              Or try
            </span>
            {HOME_STARTERS.map((starter) => (
              <button
                key={starter.id}
                type="button"
                disabled={busy || !canWrite}
                onClick={() => onStarter(starter.id)}
                className={studioChipClass(false)}
              >
                {starter.label}
              </button>
            ))}
          </div>
        </div>

        <NoticeList notices={notices} />
      </div>
    );
  }

  const stage = resolveTripStage(detail);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
      <AssistantBubble>
        {stage === "client"
          ? "Who is this trip for? Search and confirm the client."
          : stage === "stay"
            ? `Got it${detail.client ? ` — ${detail.client.display_name}` : ""}. Set the hotel, city, and dates for this quote.`
            : stage === "rates"
              ? `Stay looks set for ${detail.stay?.property_name}. Search rates or paste a hotel quote to continue.`
              : `Rate selected${detail.rates.selected ? ` — ${detail.rates.selected.title}` : ""}. Package is ready; quote editing lands next.`}
      </AssistantBubble>

      {stage === "client" ? (
        <TripBuilderClientStep
          key={`client-${draft?.clientQuery ?? ""}`}
          canWrite={canWrite}
          busy={busy}
          initialQuery={draft?.clientQuery ?? ""}
          autoFocus={canWrite}
          onAssign={onAssignClient}
        />
      ) : null}

      {stage === "stay" ? (
        <TripBuilderStayStep
          key={`${detail.trip.id}-stay-${detail.stay?.leg_id ?? "new"}-${draft?.hotelName ?? ""}`}
          stay={detail.stay}
          canWrite={canWrite}
          busy={busy}
          pricingLocked={detail.pricing_locked}
          initialHotel={draft?.hotelName ?? ""}
          autoFocusHotel={draft?.focus === "hotel" || Boolean(draft?.hotelName)}
          onSave={onSaveStay}
        />
      ) : null}

      {stage === "rates" && detail.stay ? (
        <TripBuilderRatesStep
          stay={detail.stay}
          selected={detail.rates.selected}
          candidates={detail.rates.candidates}
          searchOptions={rateOptions}
          searchMessage={rateSearchMessage}
          canWrite={canWrite}
          busy={busy}
          onSearch={onSearchRates}
          onSelectOption={onSelectRateOption}
          onSelectCandidate={onSelectRateCandidate}
          onPaste={onPasteQuote}
        />
      ) : null}

      {stage === "package" || stage === "quote" ? (
        <section className="rounded-xl border border-dashed border-border bg-surface-raised/70 px-4 py-5">
          <p className="text-sm font-medium text-ink">
            {stage === "quote" ? "Quote ready" : "Package ready"}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
            {stage === "quote"
              ? "Quote PDF is generated. Use the quote URL API to download it."
              : "Client, stay, and selected rate are on the trip. Edit the quote draft, then generate the PDF via the quote APIs."}
          </p>
          {detail.rates.selected ? (
            <p className="mt-3 text-xs text-ink">
              Selected: {detail.rates.selected.title}
              {detail.rates.selected.cost_internal != null
                ? ` · ${detail.rates.selected.currency ?? ""} ${detail.rates.selected.cost_internal}`
                : ""}
            </p>
          ) : null}
          {detail.quote.document ? (
            <p className="mt-1 text-xs text-ink-muted">
              Quote doc: {detail.quote.document.status}
              {detail.quote.document.has_file ? " · file ready" : ""}
            </p>
          ) : null}
        </section>
      ) : null}

      <NoticeList notices={notices} />
    </div>
  );
}

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl rounded-tl-md border border-border bg-surface-raised px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold tracking-wide text-ink-subtle uppercase">
        PureLuxe
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink">{children}</p>
    </div>
  );
}

function NoticeList({ notices }: { notices: string[] }) {
  if (notices.length === 0) return null;
  return (
    <div className="space-y-2">
      {notices.map((notice, index) => (
        <div
          key={`${index}-${notice.slice(0, 24)}`}
          className="rounded-2xl rounded-tr-md border border-border/80 bg-surface px-4 py-3"
        >
          <p className="text-[11px] font-semibold tracking-wide text-ink-subtle uppercase">
            Note
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">{notice}</p>
        </div>
      ))}
    </div>
  );
}
