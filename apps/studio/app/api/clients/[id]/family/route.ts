import {
  clientIdSchema,
  clientMessages,
  removeClientFamilyMemberSchema,
  updateClientFamilySchema,
  upsertClientFamilySchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import {
  getClientProfile,
  leaveClientFamily,
  updateClientFamily,
  upsertClientFamily,
} from "@/lib/clients";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Create, join, or add a member to a household. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("clients.write");
    const { id } = await context.params;
    const clientId = clientIdSchema.parse(id);
    const body = upsertClientFamilySchema.parse(await request.json());

    const result = await upsertClientFamily(clientId, body, {
      memberId: session.memberId,
    });
    const profile = await getClientProfile(clientId);

    return apiSuccess(profile, {
      message: clientMessages.success[result.messageKey],
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}

/** Update household name, role, or primary. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("clients.write");
    const { id } = await context.params;
    const clientId = clientIdSchema.parse(id);
    const body = updateClientFamilySchema.parse(await request.json());

    await updateClientFamily(clientId, body, { memberId: session.memberId });
    const profile = await getClientProfile(clientId);

    return apiSuccess(profile, {
      message: clientMessages.success.familyUpdated,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}

/**
 * Leave the household, or remove another member.
 * Body optional: `{ member_client_id }` removes that member; omit to leave yourself.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("clients.write");
    const { id } = await context.params;
    const clientId = clientIdSchema.parse(id);

    let memberClientId: string | undefined;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const raw: unknown = await request.json().catch(() => null);
      if (raw && typeof raw === "object") {
        const body = removeClientFamilyMemberSchema.parse(raw);
        memberClientId = body.member_client_id;
      }
    }

    await leaveClientFamily(
      clientId,
      { memberId: session.memberId },
      { memberClientId },
    );
    const profile = await getClientProfile(clientId);

    const removingOther =
      memberClientId != null && memberClientId !== clientId;

    return apiSuccess(profile, {
      message: removingOther
        ? clientMessages.success.memberRemoved
        : clientMessages.success.familyLeft,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
