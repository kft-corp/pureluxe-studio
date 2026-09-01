import { getMemberProfile } from "@/lib/account/member-profile";
import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiStudioSession } from "@/lib/auth/require-api-session";

/** Signed-in member profile — always loaded from team_members. */
export async function GET() {
  try {
    const session = await requireApiStudioSession();
    const profile = await getMemberProfile(session.memberId);

    const response = apiSuccess(profile);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}
