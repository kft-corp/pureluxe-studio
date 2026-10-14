import { updateMemberProfile } from "@pureluxe/db";
import { accountMessages, updateMemberProfileSchema } from "@pureluxe/shared";

import { getMemberProfile } from "@/lib/account/member-profile";
import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiStudioSession } from "@/lib/auth/require-api-session";
import { loadStudioSession } from "@/lib/auth/session";

const NO_STORE = "no-store, no-cache, must-revalidate";

function profileResponse(profile: Awaited<ReturnType<typeof getMemberProfile>>, message?: string) {
  const response = apiSuccess(profile, message ? { message } : undefined);
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}

/** Signed-in member profile — always loaded from team_members. */
export async function GET() {
  try {
    const session = await requireApiStudioSession();
    const profile = await getMemberProfile(session.memberId);
    return profileResponse(profile);
  } catch (cause) {
    return apiFromError(cause);
  }
}

/** Update the signed-in member's name, designation, and phone. */
export async function PATCH(request: Request) {
  try {
    const session = await requireApiStudioSession();
    const input = updateMemberProfileSchema.parse(await request.json());

    await updateMemberProfile({
      memberId: session.memberId,
      ...input,
    });

    const ironSession = await loadStudioSession();
    ironSession.name = input.name;
    await ironSession.save();

    const profile = await getMemberProfile(session.memberId);
    return profileResponse(profile, accountMessages.success.profileUpdated);
  } catch (cause) {
    return apiFromError(cause);
  }
}
