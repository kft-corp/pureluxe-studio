import { cn } from "@/lib/utils/cn";

type ContentSectionProps = {
  title: string;
  description?: string;
  count?: number;
  /** Shown after count, e.g. "clients" → "12 clients". */
  countLabel?: string;
  /** Optional header action (e.g. “View all”). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Raised content panel — use for tables, detail lists, and grouped page sections. */
export function ContentSection({
  title,
  description,
  count,
  countLabel,
  action,
  children,
  className,
}: ContentSectionProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border/70 bg-surface-raised shadow-[0_6px_24px_rgba(22,26,31,0.04)]",
        className,
      )}
    >
      <header className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-b border-border/60 px-5 py-3.5 sm:px-6 sm:py-4">
        <div className="min-w-0 flex-1 basis-[min(100%,14rem)]">
          <h2 className="studio-type-section wrap-break-word text-ink">
            {title}
          </h2>
          {description ? (
            <p className="studio-type-meta mt-1 max-w-xl text-pretty text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
        {action || count !== undefined ? (
          <div className="flex max-w-full flex-wrap items-center gap-2">
            {action}
            {count !== undefined ? (
              <span className="text-[13px] font-medium text-ink-muted tabular-nums">
                {countLabel ? `${count} ${countLabel}` : count}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>
      {children}
    </section>
  );
}


/** Quiet filter strip — not a second card above the table. */
export function PageToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border/60 pb-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Standard vertical spacing wrapper for shell page body content. */
export function PageStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-8", className)}>{children}</div>;
}
