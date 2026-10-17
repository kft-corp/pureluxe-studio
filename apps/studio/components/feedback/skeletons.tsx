import {
  MobileCard,
  PageToolbar,
  ResponsiveTable,
  TableCell,
} from "@/components/ui";
import { cn } from "@/lib/utils/cn";

import { Skeleton } from "./skeleton";

const LINE_WIDTHS = ["w-24", "w-16", "w-20", "w-28", "w-14"] as const;
const PILL_COLUMNS = new Set(["Status", "Stage", "Role"]);

function lineWidth(index: number) {
  return LINE_WIDTHS[index % LINE_WIDTHS.length];
}

/** Page title + description placeholder — matches the ShellPage header. */
export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 sm:mb-8">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2.5 h-3.5 w-72 max-w-full" />
    </div>
  );
}

/** Search + primary action, optionally a quick-filter row — matches directory toolbars. */
export function ToolbarSkeleton({ filters = true }: { filters?: boolean }) {
  return (
    <PageToolbar className="gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 sm:max-w-xl sm:flex-1">
          <Skeleton className="mb-2 h-3 w-24" />
          <Skeleton className="h-8 w-full" />
        </div>
        <Skeleton className="h-8 w-full sm:w-28" />
      </div>
      {filters ? (
        <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Skeleton className="mb-2 h-3 w-24" />
            <div className="flex flex-wrap gap-1.5">
              {["w-16", "w-20", "w-14", "w-24", "w-20"].map((width, index) => (
                <Skeleton key={index} className={cn("h-7 rounded-full", width)} />
              ))}
            </div>
          </div>
          <Skeleton className="h-8 w-full sm:w-32" />
        </div>
      ) : null}
    </PageToolbar>
  );
}

type TableSkeletonProps = {
  /** Same columns as the real table — headings render as real text. */
  columns: string[];
  rows?: number;
  /** First cell shows an avatar circle (people) or a two-line title (bookings, trips). */
  lead?: "avatar" | "text";
  breakpoint?: "md" | "lg";
  minWidthClassName?: string;
};

/** Directory table placeholder built on ResponsiveTable, so widths and paddings match. */
export function TableSkeleton({
  columns,
  rows = 6,
  lead = "avatar",
  breakpoint,
  minWidthClassName,
}: TableSkeletonProps) {
  const rowKeys = Array.from({ length: rows }, (_, index) => index);

  const mobile = rowKeys.map((row) => (
    <MobileCard key={row}>
      <div className="flex items-start gap-3">
        {lead === "avatar" ? <Skeleton className="h-10 w-10 shrink-0 rounded-full" /> : null}
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-40 max-w-full" />
          <Skeleton className="mt-2 h-3 w-56 max-w-full" />
          <Skeleton className="mt-2 h-3 w-24" />
          <Skeleton className="mt-3 h-6 w-20 rounded-full" />
        </div>
      </div>
    </MobileCard>
  ));

  return (
    <ResponsiveTable
      columns={columns}
      breakpoint={breakpoint}
      minWidthClassName={minWidthClassName}
      mobile={mobile}
    >
      {rowKeys.map((row) => (
        <tr key={row}>
          {columns.map((column, index) => (
            <TableCell key={column || `col-${index}`}>
              {index === 0 ? (
                <div className="flex items-center gap-3">
                  {lead === "avatar" ? (
                    <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  ) : null}
                  <div className="min-w-0">
                    <Skeleton className={cn("h-3.5", row % 2 ? "w-28" : "w-36")} />
                    <Skeleton className="mt-2 h-3 w-20" />
                  </div>
                </div>
              ) : column === "" ? (
                <Skeleton className="ml-auto h-4 w-4" />
              ) : PILL_COLUMNS.has(column) ? (
                <Skeleton className="h-6 w-20 rounded-full" />
              ) : (
                <Skeleton className={cn("h-3.5", lineWidth(row + index))} />
              )}
            </TableCell>
          ))}
        </tr>
      ))}
    </ResponsiveTable>
  );
}

/** Label / value / hint card — matches SnapshotCard and the completeness meter. */
export function MetricCardSkeleton() {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface-subtle px-4 py-3">
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="mt-2.5 h-4 w-28 max-w-full" />
      <Skeleton className="mt-2 h-3 w-16" />
    </div>
  );
}

type DetailHeroSkeletonProps = {
  /** `avatar` for people, `tile` for bookings and trips (rounded icon square). */
  media?: "avatar" | "tile";
  actions?: number;
  cards?: number;
};

/** Detail page hero — media, title with pill, meta lines, actions, metric cards. */
export function DetailHeroSkeleton({
  media = "avatar",
  actions = 2,
  cards = 4,
}: DetailHeroSkeletonProps) {
  return (
    <PageToolbar>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          {media === "avatar" ? (
            <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
          ) : (
            <Skeleton className="h-12 w-12 shrink-0 rounded-2xl sm:h-16 sm:w-16" />
          )}
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-7 w-48 max-w-full sm:w-64" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-3.5 w-56 max-w-full" />
            <Skeleton className="mt-2 h-3 w-40 max-w-full" />
          </div>
        </div>
        {actions > 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {Array.from({ length: actions }, (_, index) => (
              <Skeleton key={index} className="h-7 w-24" />
            ))}
          </div>
        ) : null}
      </div>
      {cards > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cards }, (_, index) => (
            <MetricCardSkeleton key={index} />
          ))}
        </div>
      ) : null}
    </PageToolbar>
  );
}

/** Pill tab strip placeholder — matches PillTabs. */
export function TabsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-1 overflow-hidden rounded-xl border border-border bg-surface p-1">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-9 w-24 shrink-0 rounded-lg" />
      ))}
    </div>
  );
}

/** Icon + label + value rows — matches DetailField lists. */
export function DetailListSkeleton({
  rows = 4,
  columns = 1,
}: {
  rows?: number;
  columns?: 1 | 2;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-divider",
        columns === 2 && "sm:grid sm:grid-cols-2 sm:divide-y-0",
      )}
    >
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-start gap-3 px-5 py-4 sm:px-6">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className={cn("mt-2 h-3.5 max-w-full", index % 2 ? "w-32" : "w-44")} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Section card with an unknown title — matches ContentSection. */
export function CardSkeleton({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-sm",
        className,
      )}
    >
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-2 h-3 w-64 max-w-full" />
      </div>
      <DetailListSkeleton rows={rows} />
    </section>
  );
}
