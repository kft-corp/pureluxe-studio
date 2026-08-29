import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginFeedbackToast } from "@/components/auth/login-feedback-toast";
import { LoginFormPanel } from "@/components/auth/login/login-form-panel";
import { LoginHeroPanel } from "@/components/auth/login/login-hero-panel";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to PureLuxe Studio with your invited KFT Google account.",
};

export default function LoginPage() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col lg:flex-row"
    >
      <Suspense fallback={null}>
        <LoginFeedbackToast />
      </Suspense>
      <LoginHeroPanel />
      <LoginFormPanel />
    </main>
  );
}
