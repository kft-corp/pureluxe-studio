import { isStudioSessionActive } from "@pureluxe/auth";
import Link from "next/link";
import { Suspense } from "react";

import { SignedInToast } from "@/components/auth/signed-in-toast";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { loadStudioSession } from "@/lib/auth/session";
import { pageRoutes } from "@/lib/routes";

export default async function Home() {
  const session = await loadStudioSession();
  const loggedIn = isStudioSessionActive(session);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[#0b0b0c] px-6 text-[#f4f1ea]">
      <Suspense fallback={null}>
        <SignedInToast />
      </Suspense>
      <main className="flex w-full max-w-lg flex-col items-center gap-6 text-center">
        <p className="text-xs tracking-[0.28em] text-[#a39e93] uppercase">
          PureLuxe
        </p>
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
          Studio
        </h1>
        {loggedIn ? (
          <>
            <p className="max-w-sm text-sm leading-6 text-[#a39e93]">
              Signed in as {session.name} ({session.role})
            </p>
            <SignOutButton />
          </>
        ) : (
          <>
            <p className="max-w-sm text-sm leading-6 text-[#a39e93]">
              Internal team only. Sign in to continue.
            </p>
            <Link
              href={pageRoutes.login}
              className="rounded-full border border-[#3d3a34] bg-[#f4f1ea] px-5 py-2 text-sm font-medium text-[#0b0b0c] transition hover:bg-white"
            >
              Go to sign in
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
