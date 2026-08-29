"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { showSignedInToast } from "@/lib/feedback/auth-toast";
import { pageAuthParams, pageRoutes } from "@/lib/routes";

export function SignedInToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    if (searchParams.get("auth") !== pageAuthParams.signedIn) return;

    shown.current = true;
    showSignedInToast();
    router.replace(pageRoutes.home, { scroll: false });
  }, [searchParams, router]);

  return null;
}
