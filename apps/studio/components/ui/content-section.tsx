import { cn } from "@/lib/utils/cn";

type ContentSectionProps = {
  title: string;
  description?: string;
  count?: number;
  children: React.ReactNode;
  className?: string;
};

/** Raised content panel — use for tables, detail lists, and grouped page sections. */
export function ContentSection({
  title,
  description,
  count,
  children,
  className,
}: ContentSectionProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-sm",
        "bg-[radial-gradient(ellipse_100%_80%_at_0%_0%,var(--surface-hover),var(--surface-raised)_50%)]",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border/80 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
        {count !== undefined ? (
          <span className="shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-ink-muted tabular-nums">
            {count}
          </span>
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
