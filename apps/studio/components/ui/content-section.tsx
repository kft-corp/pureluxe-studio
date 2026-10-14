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
        "overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-sm",
        "bg-[radial-gradient(ellipse_100%_80%_at_0%_0%,var(--surface-hover),var(--surface-raised)_55%)]",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-border/80 px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1 basis-[min(100%,14rem)]">
          <h2 className="wrap-break-word text-base font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-pretty text-sm leading-relaxed text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
        {action || count !== undefined ? (
          <div className="flex max-w-full flex-wrap items-center gap-2">
            {action}
            {count !== undefined ? (
              <span className="rounded-full bg-brand-light/80 px-2.5 py-1 text-xs font-semibold text-ink tabular-nums ring-1 ring-border/80">
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


/** Toolbar strip — tabs, filters, and primary actions above page content. */
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
        "flex flex-col gap-4 rounded-2xl border border-border bg-surface-raised p-4 shadow-sm sm:p-5",
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
  return <div className={cn("space-y-5", className)}>{children}</div>;
}
