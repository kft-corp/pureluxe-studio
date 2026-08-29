import Link from "next/link";

import { pageRoutes } from "@/lib/routes";

export function NotFoundContent() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-[#f9f8f6] px-4 py-12"
    >
      <div className="flex flex-col items-center justify-center text-sm max-md:px-4">
        <h1 className="text-8xl font-bold text-indigo-500 md:text-9xl">404</h1>
        <div className="my-5 h-1 w-16 rounded bg-indigo-500 md:my-7" />
        <p className="text-2xl font-bold text-gray-800 md:text-3xl">
          Page Not Found
        </p>
        <p className="mt-4 max-w-md text-center text-sm text-gray-500 md:text-base">
          The page you are looking for might have been removed, had its name
          changed, or is temporarily unavailable.
        </p>
        <div className="mt-6 flex items-center gap-4">
          <Link
            href={pageRoutes.home}
            className="rounded-md bg-gray-800 px-7 py-2.5 text-white transition-all hover:bg-black active:scale-95"
          >
            Return Home
          </Link>
          <a
            href="mailto:vijay@kft.com"
            className="rounded-md border border-gray-300 px-7 py-2.5 text-gray-800 transition-all active:scale-95"
          >
            Contact support
          </a>
        </div>
      </div>
    </main>
  );
}
