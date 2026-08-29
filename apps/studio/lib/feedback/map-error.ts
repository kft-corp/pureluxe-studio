import type { FeedbackVariant } from "./types";

export function feedbackVariantFromCode(code: string): FeedbackVariant {
  if (code === "auth.account_inactive") {
    return "warning";
  }

  return "error";
}
