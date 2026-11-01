import type { ReactNode } from "react";

export const shellPageContainerClass =
  "mx-auto w-full max-w-6xl px-5 py-8 sm:px-7 sm:py-10 md:px-9";

type ShellPageProps = {
  title: string;
  description?: string;
  /** Optional primary action(s) — sits opposite the title on the header strip. */
  actions?: ReactNode;
  children?: ReactNode;
  /**
   * `page` — standard titled module (Clients, Bookings).
   * `workspace` — full-height desk (Trip Builder); no page title chrome.
   */
  layout?: "page" | "workspace";
};

export function ShellPage({
  title,
  description,
  actions,
  children,
  layout = "page",
}: ShellPageProps) {
  if (layout === "workspace") {
    return (
      <div
        data-workspace
        className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      >
        {children}
      </div>
    );
  }

  return (
    <div className={shellPageContainerClass}>
      <header className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="studio-type-page text-ink">{title}</h1>
          <span
            className="mt-3 block h-px w-11 bg-accent opacity-80"
            aria-hidden
          />
          {description ? (
            <p className="studio-type-meta mt-3.5 max-w-xl text-pretty text-ink-muted sm:mt-4">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </header>
      {children}
    </div>
  );
}
