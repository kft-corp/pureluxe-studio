"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { pageRoutes } from "@/lib/routes";
import { showLoginFeedbackToast } from "@/lib/feedback/auth-toast";

export function LoginFeedbackToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;

    const error = searchParams.get("error");
    if (!error) return;

    shown.current = true;
    showLoginFeedbackToast(error);
    router.replace(pageRoutes.login, { scroll: false });
  }, [searchParams, router]);

  return null;
}
