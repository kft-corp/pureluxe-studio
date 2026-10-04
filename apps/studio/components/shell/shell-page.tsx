type ShellPageProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
  /**
   * `page` — standard titled module (Clients, Bookings).
   * `workspace` — full-height desk (Trip Builder); no page title chrome.
   */
  layout?: "page" | "workspace";
};

export function ShellPage({
  title,
  description,
  children,
  layout = "page",
}: ShellPageProps) {
  if (layout === "workspace") {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 md:px-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-pretty text-sm leading-relaxed text-ink-muted sm:mt-2">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </div>
  );
}
