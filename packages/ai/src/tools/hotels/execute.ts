import { z } from "zod";

import type { HotelToolHandlers } from "./types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

const getHotelInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    check_in: isoDate.optional(),
    check_out: isoDate.optional(),
  })
  .refine((value) => !value.check_out || (value.check_in && value.check_in < value.check_out), {
    message: "check_out needs a check_in before it.",
  });

/**
 * Run get_hotel.
 * Throws ZodError / AppError-shaped errors for the root executor to wrap.
 */
export async function executeHotelTool(
  input: unknown,
  handlers: HotelToolHandlers,
): Promise<unknown> {
  const parsed = getHotelInputSchema.parse(input ?? {});
  return handlers.getHotel({
    name: parsed.name,
    checkIn: parsed.check_out ? parsed.check_in : undefined,
    checkOut: parsed.check_out,
  });
}
