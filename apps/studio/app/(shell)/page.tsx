import { Suspense } from "react";

import { SignedInToast } from "@/components/auth/signed-in-toast";
import { ShellModulePage } from "@/components/shell";
import { pageCopy } from "@/config/page-copy";

export default function HomePage() {
  return (
    <>
      <Suspense fallback={null}>
        <SignedInToast />
      </Suspense>
      <ShellModulePage module="home" {...pageCopy.home} />
    </>
  );
}
