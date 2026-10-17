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
      className="inline-flex min-h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-[#dadce0] bg-surface-raised px-4 py-2.5 text-sm font-medium text-[#3c4043] shadow-sm transition hover:border-[#c6c9cc] hover:bg-[#f8f9fa] hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <FcGoogle aria-hidden className="h-[18px] w-[18px] shrink-0" />
      Sign in with Google
    </a>
  );
}
