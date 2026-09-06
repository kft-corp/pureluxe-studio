"use client";

import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

import { studioButtonClass } from "@/components/ui";

type ClientsPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

/** Server-side page controls — filters still apply to the full result set. */
export function ClientsPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: ClientsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex flex-col gap-3 border-t border-border/80 bg-surface/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="text-sm text-ink-muted">
        Showing{" "}
        <span className="font-semibold text-ink">
          {from}–{to}
        </span>{" "}
        of <span className="font-semibold text-ink">{total}</span>
        <span className="hidden sm:inline"> clients</span>
      </p>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          className={studioButtonClass("secondary", "sm", "justify-self-start")}
        >
          <LuChevronLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Previous</span>
        </button>
        <span className="px-1 text-center text-sm font-medium text-ink tabular-nums">
          {page}
          <span className="text-ink-muted"> / </span>
          {totalPages}
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          className={studioButtonClass("secondary", "sm", "justify-self-end")}
        >
          <span className="hidden sm:inline">Next</span>
          <LuChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
