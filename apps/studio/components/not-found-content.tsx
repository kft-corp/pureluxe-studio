import Link from "next/link";

import { pageRoutes } from "@/lib/routes";

export function NotFoundContent() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12"
    >
      <div className="flex w-full max-w-md flex-col items-center justify-center text-center text-sm">
        <h1 className="font-serif text-7xl font-normal text-brand-dark sm:text-8xl md:text-9xl">
          404
        </h1>
        <div className="my-5 h-1 w-16 rounded bg-border-dark md:my-7" />
        <p className="text-xl font-semibold text-ink sm:text-2xl md:text-3xl">
          Page Not Found
        </p>
        <p className="mt-4 text-pretty text-sm leading-relaxed text-ink-muted md:text-base">
          The page you are looking for might have been removed, had its name
          changed, or is temporarily unavailable.
        </p>
        <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center sm:gap-4">
          <Link
            href={pageRoutes.home}
            className="rounded-md bg-brand-dark px-7 py-3 text-center text-on-dark transition-all hover:bg-ink active:scale-95"
          >
            Return Home
          </Link>
          <a
            href="mailto:vijay@kft.com"
            className="rounded-md border border-border px-7 py-3 text-center text-ink transition-all hover:bg-surface-hover active:scale-95"
          >
            Contact support
          </a>
        </div>
      </div>
    </main>
  );
}
