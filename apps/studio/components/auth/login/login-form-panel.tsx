import { GoogleSignInButton } from "./google-sign-in-button";

export function LoginFormPanel() {
  const signInDescribedBy = "login-subtitle";

  return (
    <section
      aria-labelledby="login-heading"
      className="relative flex min-h-screen w-full flex-1 flex-col bg-surface lg:w-2/5"
    >
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] sm:px-8 sm:py-12">
        <div
          className="flex w-full max-w-sm flex-col items-center text-center"
          role="region"
          aria-label="Sign in"
        >
          <h1
            id="login-heading"
            className="font-serif text-3xl font-normal tracking-tight text-ink sm:text-4xl"
          >
            PureLuxe Studio
          </h1>

          <p
            id="login-subtitle"
            className="mt-3 max-w-xs text-sm leading-relaxed text-ink-muted sm:max-w-sm"
          >
            Invite-only · Sign in with your KFT Google account
          </p>

          <div className="mt-8 flex w-full flex-col items-center gap-4 sm:mt-10">
            <GoogleSignInButton aria-describedby={signInDescribedBy} />
          </div>
        </div>
      </div>

      <p className="pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-xs text-ink-subtle sm:pb-8">
        No public registration
      </p>
    </section>
  );
}
