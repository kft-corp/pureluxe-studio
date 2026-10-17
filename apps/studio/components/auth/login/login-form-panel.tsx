import { GoogleSignInButton } from "./google-sign-in-button";

export function LoginFormPanel() {
  const signInDescribedBy = "login-subtitle";

  return (
    <section
      aria-labelledby="login-heading"
      className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-surface lg:w-2/5"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 lg:py-8">
        <div
          className="flex w-full max-w-[22rem] flex-col items-center text-center"
          role="region"
          aria-label="Sign in"
        >
          <h1
            id="login-heading"
            className="font-serif text-[1.625rem] leading-tight font-normal tracking-[-0.01em] text-ink sm:text-[1.75rem]"
          >
            PureLuxe Studio
          </h1>

          <p
            id="login-subtitle"
            className="mt-2 text-sm leading-relaxed text-ink-muted"
          >
            Invite-only · Sign in with your KFT Google account
          </p>

          <div className="mt-7 flex w-full flex-col items-center gap-4">
            <GoogleSignInButton aria-describedby={signInDescribedBy} />
          </div>
        </div>
      </div>

      <p className="shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-ink-subtle sm:pb-6">
        No public registration
      </p>
    </section>
  );
}
