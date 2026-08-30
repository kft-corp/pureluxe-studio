import { FcGoogle } from "react-icons/fc";

import { apiRoutes } from "@/lib/routes";

type GoogleSignInButtonProps = {
  "aria-describedby"?: string;
};

export function GoogleSignInButton({
  "aria-describedby": ariaDescribedBy,
}: GoogleSignInButtonProps) {
  return (
    <a
      href={apiRoutes.auth.google}
      aria-describedby={ariaDescribedBy}
      className="inline-flex w-full max-w-sm items-center justify-center gap-3 rounded-lg border border-[#dadce0] bg-surface-raised px-4 py-3.5 text-sm font-medium text-[#3c4043] shadow-sm transition hover:border-[#c6c9cc] hover:bg-[#f8f9fa] hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:py-3"
    >
      <FcGoogle aria-hidden className="h-5 w-5 shrink-0" />
      Sign in with Google
    </a>
  );
}
