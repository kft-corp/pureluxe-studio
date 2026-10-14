import type { RateSourcesSetting } from "@pureluxe/db";

export type OfflineAvailabilityInput = {
  property_id?: string | null;
  check_in: string;
  check_out: string;
  setting: RateSourcesSetting;
};

export type OfflineAvailabilityResult = {
  status: "available" | "unavailable" | "unknown" | "skipped" | "stub";
  message: string;
};

/**
 * GDS availability-only check after an offline paste.
 * Stub until a live GDS adapter is wired.
 */
export async function checkOfflineAvailability(
  input: OfflineAvailabilityInput,
): Promise<OfflineAvailabilityResult> {
  if (!input.setting.offline_availability_check) {
    return {
      status: "skipped",
      message: "Offline availability check is disabled in company settings.",
    };
  }

  if (!input.property_id) {
    return {
      status: "unknown",
      message: "No property id — cannot run availability check.",
    };
  }

  return {
    status: "stub",
    message:
      "Availability check stubbed. Wire a GDS adapter to verify rooms without pricing.",
  };
}
