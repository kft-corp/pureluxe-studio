"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LuBanknote, LuWallet } from "react-icons/lu";

import {
  ContentSection,
  DetailField,
  studioButtonClass,
} from "@/components/ui";
import { updateJourneyPayment } from "@/lib/api/trips";
import { showApiError, showSuccessToast } from "@/lib/feedback";
import {
  formatJourneySell,
  type JourneyPageModel,
} from "@/lib/trips";
import { cn } from "@/lib/utils/cn";

type JourneyPaymentPanelProps = {
  journey: JourneyPageModel;
  canWrite: boolean;
};

/** Offline client payment tracking on the trip (record-only). */
export function JourneyPaymentPanel({
  journey,
  canWrite,
}: JourneyPaymentPanelProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(
    journey.amountReceived == null ? "" : String(journey.amountReceived),
  );
  const [status, setStatus] = useState(journey.paymentStatus);
  const [loading, setLoading] = useState(false);

  const receivedLabel =
    formatJourneySell(journey.amountReceived, journey.sellCurrency) ?? "—";
  const pendingLabel =
    formatJourneySell(journey.amountPending, journey.sellCurrency) ?? "—";

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    const parsed = amount.trim() === "" ? null : Number(amount);
    if (parsed != null && Number.isNaN(parsed)) return;
    setLoading(true);
    try {
      const response = await updateJourneyPayment(journey.id, {
        amount_received: parsed,
        payment_status: status as
          | "not_started"
          | "partial"
          | "paid"
          | "overdue",
      });
      if (response.message) showSuccessToast(response.message);
      setEditing(false);
      router.refresh();
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="client-payment" className="scroll-mt-24">
    <ContentSection
      title="Client payment"
      description="Record money taken offline. Studio does not collect payment."
      className="min-w-0"
      action={
        canWrite && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(studioButtonClass("secondary", "sm"))}
          >
            Edit
          </button>
        ) : null
      }
    >
      {editing ? (
        <form onSubmit={handleSave} className="space-y-3 px-5 py-4 sm:px-6">
          <label className="block text-sm font-medium text-ink">
            Amount received
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              placeholder={journey.sellCurrency ?? "Amount"}
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="not_started">Not started</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setAmount(
                  journey.amountReceived == null
                    ? ""
                    : String(journey.amountReceived),
                );
                setStatus(journey.paymentStatus);
                setEditing(false);
              }}
              className={cn(studioButtonClass("secondary", "sm"))}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(studioButtonClass("primary", "sm"))}
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <div className="divide-y divide-border/70">
          <DetailField
            icon={LuWallet}
            label="Status"
            value={journey.paymentStatusLabel}
          />
          <DetailField
            icon={LuBanknote}
            label="Received"
            value={receivedLabel}
          />
          <DetailField
            icon={LuBanknote}
            label="Pending"
            value={pendingLabel}
          />
        </div>
      )}
    </ContentSection>
    </div>
  );
}
