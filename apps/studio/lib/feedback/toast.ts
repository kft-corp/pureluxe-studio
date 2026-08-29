"use client";

import { messages } from "@pureluxe/shared";
import { toast } from "sonner";

import { ApiRequestError } from "@/lib/api/client";

import { feedbackVariantFromCode } from "./map-error";
import type { FeedbackVariant, ToastOptions } from "./types";

function showToast(
  variant: FeedbackVariant,
  message: string,
  options?: ToastOptions,
) {
  const toastOptions = options?.description
    ? { description: options.description, duration: options.duration }
    : { duration: options?.duration };

  switch (variant) {
    case "success":
      toast.success(message, toastOptions);
      break;
    case "warning":
      toast.warning(message, toastOptions);
      break;
    case "info":
      toast.info(message, toastOptions);
      break;
    case "error":
      toast.error(message, toastOptions);
      break;
  }
}

export function showSuccessToast(message: string, options?: ToastOptions) {
  showToast("success", message, options);
}

export function showErrorToast(message: string, options?: ToastOptions) {
  showToast("error", message, options);
}

export function showWarningToast(message: string, options?: ToastOptions) {
  showToast("warning", message, options);
}

export function showApiError(error: unknown, options?: ToastOptions) {
  if (error instanceof ApiRequestError) {
    showToast(
      feedbackVariantFromCode(error.code),
      error.message,
      options,
    );
    return;
  }

  if (error instanceof Error && error.message) {
    showErrorToast(error.message, options);
    return;
  }

  showErrorToast(messages.error.somethingWentWrong, options);
}
