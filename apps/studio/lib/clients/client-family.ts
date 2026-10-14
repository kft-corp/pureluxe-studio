import {
  clearFamilyPrimary,
  deleteFamily,
  deleteFamilyMember,
  findClientFamily,
  insertClientAuditLogs,
  insertFamily,
  insertFamilyMember,
  searchFamilies as dbSearchFamilies,
  updateFamilyMember,
  updateFamilyName,
  type FamilyMembership,
  type FamilySearchHit,
} from "@pureluxe/db";
import {
  AppError,
  clientMessages,
  type UpdateClientFamilyInput,
  type UpsertClientFamilyInput,
} from "@pureluxe/shared";

import { refreshClientCompleteness } from "./refresh-client-completeness";
import { requireActiveClient } from "./require-active-client";

/** Search households by name. */
export async function searchClientFamilies(
  query: string,
): Promise<FamilySearchHit[]> {
  return dbSearchFamilies(query);
}

export type UpsertClientFamilyResult = {
  family: FamilyMembership;
  messageKey:
    | "familyCreated"
    | "familyJoined"
    | "memberAdded";
};

/** Create, join, or add a member to a household. */
export async function upsertClientFamily(
  clientId: string,
  input: UpsertClientFamilyInput,
  actor: { memberId: string },
): Promise<UpsertClientFamilyResult> {
  await requireActiveClient(clientId);

  if (input.mode === "create") {
    const existing = await findClientFamily(clientId);
    if (existing) {
      throw new AppError({
        userMessage: clientMessages.error.alreadyInFamily,
        code: "clients.already_in_family",
        status: 409,
      });
    }

    const family = await insertFamily({
      name: input.name,
      created_by_id: actor.memberId,
    });

    await insertFamilyMember({
      family_id: family.id,
      client_id: clientId,
      role: input.role ?? "primary",
      is_primary: true,
    });

    await insertClientAuditLogs([
      {
        client_id: clientId,
        action: "updated",
        field_name: "family",
        new_value: family.name,
        team_member_id: actor.memberId,
        metadata: { source: "studio", mode: "create", family_id: family.id },
      },
    ]);

    const membership = await findClientFamily(clientId);
    if (!membership) {
      throw new AppError({
        userMessage: clientMessages.error.familyNotFound,
        code: "clients.family_not_found",
        status: 500,
      });
    }

    await refreshClientCompleteness(clientId, actor);

    return { family: membership, messageKey: "familyCreated" };
  }

  if (input.mode === "join") {
    const existing = await findClientFamily(clientId);
    if (existing) {
      throw new AppError({
        userMessage: clientMessages.error.alreadyInFamily,
        code: "clients.already_in_family",
        status: 409,
      });
    }

    await insertFamilyMember({
      family_id: input.family_id,
      client_id: clientId,
      role: input.role ?? "member",
      is_primary: false,
    });

    const membership = await findClientFamily(clientId);
    if (!membership) {
      throw new AppError({
        userMessage: clientMessages.error.familyNotFound,
        code: "clients.family_not_found",
        status: 404,
      });
    }

    await insertClientAuditLogs([
      {
        client_id: clientId,
        action: "updated",
        field_name: "family",
        new_value: membership.family_name,
        team_member_id: actor.memberId,
        metadata: {
          source: "studio",
          mode: "join",
          family_id: membership.family_id,
        },
      },
    ]);

    await refreshClientCompleteness(clientId, actor);

    return { family: membership, messageKey: "familyJoined" };
  }

  // add_member — current client must already be in a family
  if (input.client_id === clientId) {
    throw new AppError({
      userMessage: clientMessages.error.cannotLinkSelf,
      code: "clients.cannot_link_self",
      status: 400,
    });
  }

  const [family, , targetFamily] = await Promise.all([
    findClientFamily(clientId),
    requireActiveClient(input.client_id),
    findClientFamily(input.client_id),
  ]);

  if (!family) {
    throw new AppError({
      userMessage: clientMessages.error.notInFamily,
      code: "clients.not_in_family",
      status: 400,
    });
  }

  if (targetFamily) {
    const sameHousehold = targetFamily.family_id === family.family_id;
    throw new AppError({
      userMessage: sameHousehold
        ? clientMessages.error.targetAlreadyInThisFamily
        : clientMessages.error.targetAlreadyInFamily,
      code: sameHousehold
        ? "clients.target_already_in_this_family"
        : "clients.target_already_in_family",
      status: 409,
    });
  }

  const role = input.role ?? "member";
  await insertFamilyMember({
    family_id: family.family_id,
    client_id: input.client_id,
    role,
    is_primary: false,
  });

  await insertClientAuditLogs([
    {
      client_id: clientId,
      action: "updated",
      field_name: "family",
      new_value: input.client_id,
      team_member_id: actor.memberId,
      metadata: {
        source: "studio",
        mode: "add_member",
        family_id: family.family_id,
        member_client_id: input.client_id,
        role,
      },
    },
    {
      client_id: input.client_id,
      action: "updated",
      field_name: "family",
      new_value: family.family_name,
      team_member_id: actor.memberId,
      metadata: {
        source: "studio",
        mode: "added_to_family",
        family_id: family.family_id,
      },
    },
  ]);

  const updated = await findClientFamily(clientId);
  if (!updated) {
    throw new AppError({
      userMessage: clientMessages.error.familyNotFound,
      code: "clients.family_not_found",
      status: 500,
    });
  }

  // Only the newly added member gains hasFamily — existing members unchanged.
  await refreshClientCompleteness(input.client_id, actor);

  return { family: updated, messageKey: "memberAdded" };
}

/** Update household name, member role, or primary contact. */
export async function updateClientFamily(
  clientId: string,
  input: UpdateClientFamilyInput,
  actor: { memberId: string },
): Promise<FamilyMembership> {
  await requireActiveClient(clientId);

  const family = await findClientFamily(clientId);
  if (!family) {
    throw new AppError({
      userMessage: clientMessages.error.notInFamily,
      code: "clients.not_in_family",
      status: 400,
    });
  }

  if (input.family_name) {
    await updateFamilyName(family.family_id, input.family_name);
  }

  const targetMemberId = input.member_client_id ?? clientId;
  const target = family.members.find(
    (member) => member.client_id === targetMemberId,
  );
  if (!target) {
    throw new AppError({
      userMessage: clientMessages.error.notFound,
      code: "clients.member_not_found",
      status: 404,
    });
  }

  if (input.is_primary === true) {
    await clearFamilyPrimary(family.family_id);
    await updateFamilyMember(family.family_id, targetMemberId, {
      role: input.role ?? target.role,
      is_primary: true,
    });
  } else if (input.role !== undefined || input.is_primary === false) {
    await updateFamilyMember(family.family_id, targetMemberId, {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.is_primary === false ? { is_primary: false } : {}),
    });
  }

  await insertClientAuditLogs([
    {
      client_id: clientId,
      action: "updated",
      field_name: "family",
      team_member_id: actor.memberId,
      metadata: {
        source: "studio",
        family_id: family.family_id,
        member_client_id: targetMemberId,
        ...(input.family_name ? { family_name: input.family_name } : {}),
        ...(input.role ? { role: input.role } : {}),
        ...(input.is_primary !== undefined
          ? { is_primary: input.is_primary }
          : {}),
      },
    },
  ]);

  const updated = await findClientFamily(clientId);
  if (!updated) {
    throw new AppError({
      userMessage: clientMessages.error.familyNotFound,
      code: "clients.family_not_found",
      status: 500,
    });
  }

  return updated;
}

/** Leave the current household, or remove another member from it. */
export async function leaveClientFamily(
  clientId: string,
  actor: { memberId: string },
  options?: { memberClientId?: string },
): Promise<void> {
  await requireActiveClient(clientId);

  const family = await findClientFamily(clientId);
  if (!family) {
    throw new AppError({
      userMessage: clientMessages.error.notInFamily,
      code: "clients.not_in_family",
      status: 400,
    });
  }

  const targetClientId = options?.memberClientId ?? clientId;

  const target = family.members.find(
    (member) => member.client_id === targetClientId,
  );
  if (!target) {
    throw new AppError({
      userMessage: clientMessages.error.notFound,
      code: "clients.member_not_found",
      status: 404,
    });
  }

  const wasPrimary = target.is_primary;
  const others = family.members.filter(
    (member) => member.client_id !== targetClientId,
  );

  await deleteFamilyMember(family.family_id, targetClientId);

  if (others.length === 0) {
    await deleteFamily(family.family_id);
  } else if (wasPrimary) {
    const next = others[0]!;
    await clearFamilyPrimary(family.family_id);
    await updateFamilyMember(family.family_id, next.client_id, {
      is_primary: true,
    });
  }

  const removingOther = targetClientId !== clientId;

  await insertClientAuditLogs([
    {
      client_id: targetClientId,
      action: "updated",
      field_name: "family",
      old_value: family.family_name,
      team_member_id: actor.memberId,
      metadata: {
        source: "studio",
        mode: removingOther ? "removed_from_family" : "leave",
        family_id: family.family_id,
        ...(removingOther ? { removed_by_client_id: clientId } : {}),
      },
    },
    ...(removingOther
      ? [
          {
            client_id: clientId,
            action: "updated" as const,
            field_name: "family",
            old_value: target.display_name,
            team_member_id: actor.memberId,
            metadata: {
              source: "studio",
              mode: "remove_member",
              family_id: family.family_id,
              member_client_id: targetClientId,
            },
          },
        ]
      : []),
  ]);

  // Only the removed client loses hasFamily. Remaining members' scores unchanged.
  await refreshClientCompleteness(targetClientId, actor);
}
