import { AppError } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { answerAtlasStay } from "@/lib/trip-builder";

/** Stay-stage questions answered only from Atlas. */
export const POST = apiRoute("trip_builder.read", async ({ request }) => {
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
});
