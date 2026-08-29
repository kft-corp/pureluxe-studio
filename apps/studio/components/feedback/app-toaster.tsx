"use client";

import { Toaster } from "sonner";

/** App-wide Sonner toaster — mount once in the root layout. */
export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-lg border shadow-md",
          title: "text-sm font-medium",
          description: "text-sm",
        },
      }}
    />
  );
}
