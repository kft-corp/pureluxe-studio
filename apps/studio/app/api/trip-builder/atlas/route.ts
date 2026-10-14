import { AppError } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { answerAtlasStay } from "@/lib/trip-builder";

/** Stay-stage questions answered only from Atlas. */
export async function POST(request: Request) {
  try {
    await requireApiPermission("trip_builder.read");
    const body = (await request.json()) as { question?: unknown; city?: unknown };
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : null;
    if (question.length < 2 || question.length > 2000) {
      throw new AppError({
        userMessage: "Ask about a country, city, or hotel.",
        code: "atlas.question_invalid",
        status: 400,
      });
    }
    const data = await answerAtlasStay({ question, cityHint: city });
    return apiSuccess(data);
  } catch (cause) {
    return apiFromError(cause);
  }
}
