import { Suspense } from "react";

import { SignedInToast } from "@/components/auth/signed-in-toast";
import { ShellModulePage } from "@/components/shell";

export default function HomePage() {
  return (
    <>
      <Suspense fallback={null}>
        <SignedInToast />
      </Suspense>
      <ShellModulePage
        module="home"
        title="Home"
        description="Your starting point for trips, check-ins, and deadlines."
      />
    </>
  );
}
