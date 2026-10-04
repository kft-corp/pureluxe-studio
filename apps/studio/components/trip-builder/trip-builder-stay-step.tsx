"use client";

import { useEffect, useRef, useState } from "react";
import { LuHotel } from "react-icons/lu";

import { studioButtonClass, studioControl } from "@/components/ui";
import type { TripStaySnapshot } from "@/lib/trip-builder";
import type { SetTripStayBody } from "@pureluxe/shared";
import { cn } from "@/lib/utils/cn";

type TripBuilderStayStepProps = {
  stay: TripStaySnapshot | null;
  canWrite: boolean;
  busy: boolean;
  pricingLocked: boolean;
  initialHotel?: string;
  autoFocusHotel?: boolean;
  onSave: (input: SetTripStayBody) => void;
};

/** Phase 1 fixed stay — hotel + city + dates. */
export function TripBuilderStayStep({
  stay,
  canWrite,
  busy,
  pricingLocked,
  initialHotel = "",
  autoFocusHotel = false,
  onSave,
}: TripBuilderStayStepProps) {
  const [city, setCity] = useState(stay?.city ?? "");
  const [hotel, setHotel] = useState(stay?.property_name || initialHotel);
  const [checkIn, setCheckIn] = useState(stay?.check_in ?? "");
  const [checkOut, setCheckOut] = useState(stay?.check_out ?? "");
  const hotelRef = useRef<HTMLInputElement>(null);

  const disabled = !canWrite || busy || pricingLocked;

  useEffect(() => {
    if (!autoFocusHotel || disabled) return;
    hotelRef.current?.focus();
  }, [autoFocusHotel, disabled]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (disabled) return;
    onSave({
      city: city.trim(),
      property_name: hotel.trim(),
      property_id: stay?.property_id ?? null,
      check_in: checkIn,
      check_out: checkOut,
    });
  }

  return (
    <section className="rounded-xl border border-border bg-surface-raised p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-muted">
          <LuHotel className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">Set the stay</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Hotel, city, and dates before rates. One hotel for this quote.
          </p>

          {pricingLocked ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Pricing is locked. Unlock before changing the stay.
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Hotel" className="sm:col-span-2">
              <input
                ref={hotelRef}
                required
                value={hotel}
                onChange={(event) => setHotel(event.target.value)}
                disabled={disabled}
                placeholder="Palace Hotel Tokyo"
                className={cn(studioControl.field, "h-9 px-3")}
              />
            </Field>
            <Field label="City" className="sm:col-span-2">
              <input
                required
                value={city}
                onChange={(event) => setCity(event.target.value)}
                disabled={disabled}
                placeholder="Tokyo"
                className={cn(studioControl.field, "h-9 px-3")}
              />
            </Field>
            <Field label="Check-in">
              <input
                required
                type="date"
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
                disabled={disabled}
                className={cn(studioControl.field, "h-9 px-3")}
              />
            </Field>
            <Field label="Check-out">
              <input
                required
                type="date"
                value={checkOut}
                onChange={(event) => setCheckOut(event.target.value)}
                disabled={disabled}
                className={cn(studioControl.field, "h-9 px-3")}
              />
            </Field>

            {canWrite ? (
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={disabled}
                  className={studioButtonClass("primary", "md")}
                >
                  Save stay
                </button>
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1.5 block text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
