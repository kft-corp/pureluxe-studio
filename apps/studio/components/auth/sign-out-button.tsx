"use client";

import { authMessages } from "@pureluxe/shared";
import { useRouter } from "next/navigation";

import { logout } from "@/lib/api";
import { pageRoutes } from "@/lib/routes";
import { showApiError, showSuccessToast } from "@/lib/feedback";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    try {
      const response = await logout();
      showSuccessToast(
        response.message ?? authMessages.success.signedOut,
      );
      router.push(pageRoutes.login);
      router.refresh();
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded-full border border-[#3d3a34] px-5 py-2 text-sm text-[#f4f1ea] transition hover:border-[#a39e93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4f1ea] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0c]"
    >
      Sign out
    </button>
  );
}
