"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LuCheck, LuX } from "react-icons/lu";
import {
  CLIENT_FAMILY_MEMBER_ROLES,
  CLIENT_RELATIONSHIP_TYPES,
  clientMessages,
  type CreateClientRelationshipBody,
  type UpsertClientFamilyBody,
} from "@pureluxe/shared";

import { Modal, ModalButton, modalFieldClassName } from "@/components/ui/modal";
import {
  createClientRelationship,
  leaveClientFamily,
  removeClientFamilyMember,
  searchClients,
  searchFamilies,
  updateClientFamily,
  upsertClientFamily,
  type ClientSearchHit,
  type FamilySearchHit,
} from "@/lib/api/clients";
import {
  formatFamilyRole,
  formatRelationshipType,
  type ClientProfile,
} from "@/lib/clients";
import {
  showApiError,
  showOptionalSuccessToast,
  showWarningToast,
} from "@/lib/feedback/toast";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

type ProfileClient = ClientProfile["client"];

export type HouseholdDialogMode =
  | "create"
  | "join"
  | "add_member"
  | "edit_member"
  | "rename"
  | "leave"
  | "remove_member"
  | "add_relationship";

type ClientHouseholdDialogProps = {
  open: boolean;
  mode: HouseholdDialogMode;
  profile: ClientProfile;
  memberClientId?: string | null;
  onClose: () => void;
  onSuccess: (profile: ClientProfile) => void;
};

function SelectionCheck({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
        checked
          ? "border-brand bg-brand text-white"
          : "border-border bg-surface text-transparent",
      )}
      aria-hidden
    >
      <LuCheck className="h-3.5 w-3.5" />
    </span>
  );
}

function SelectedSummary({
  label,
  detail,
  onClear,
}: {
  label: string;
  detail?: string | null;
  onClear: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand/40 bg-brand-light/60 px-3 py-2.5">
      <SelectionCheck checked />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Selected
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-ink">{label}</p>
        {detail ? (
          <p className="truncate text-xs text-ink-muted">{detail}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-hover hover:text-ink"
        aria-label="Clear selection"
      >
        <LuX className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export function ClientHouseholdDialog({
  open,
  mode,
  profile,
  memberClientId,
  onClose,
  onSuccess,
}: ClientHouseholdDialogProps) {
  const client = profile.client;
  const member = client.family?.members.find(
    (row) => row.client_id === memberClientId,
  );

  const [familyName, setFamilyName] = useState(
    mode === "rename" ? (client.family?.name ?? "") : "",
  );
  const [role, setRole] = useState(
    member?.role ?? (mode === "create" ? "primary" : "member"),
  );
  const [isPrimary, setIsPrimary] = useState(member?.is_primary ?? false);
  const [relationshipType, setRelationshipType] =
    useState<(typeof CLIENT_RELATIONSHIP_TYPES)[number]>("assistant");
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [clientHits, setClientHits] = useState<ClientSearchHit[]>([]);
  const [familyHits, setFamilyHits] = useState<FamilySearchHit[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientSearchHit | null>(
    null,
  );
  const [selectedFamily, setSelectedFamily] = useState<FamilySearchHit | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const needsClientPick =
    mode === "add_member" || mode === "add_relationship";
  const needsFamilyPick = mode === "join";
  const selectionReady = needsClientPick
    ? Boolean(selectedClient)
    : needsFamilyPick
      ? Boolean(selectedFamily)
      : true;
  const householdMemberIds = (client.family?.members ?? [])
    .map((member) => member.client_id)
    .join(",");

  useEffect(() => {
    if (!open) return;
    if (mode !== "join" && mode !== "add_member" && mode !== "add_relationship") {
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        if (mode === "join") {
          const response = await searchFamilies({ q: trimmed });
          if (!cancelled) setFamilyHits(response.data.families);
        } else {
          const response = await searchClients({ q: trimmed, limit: 10 });
          if (!cancelled) {
            const memberIdSet = new Set(
              householdMemberIds ? householdMemberIds.split(",") : [],
            );
            setClientHits(
              response.data.clients.filter((hit) => {
                if (hit.id === client.id) return false;
                // Add member: only people not already in any household.
                if (mode === "add_member") {
                  if (memberIdSet.has(hit.id)) return false;
                  if (hit.family_id) return false;
                }
                return true;
              }),
            );
          }
        }
      } catch (error) {
        if (!cancelled) showApiError(error);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, mode, query, client.id, householdMemberIds]);

  const copy = dialogCopy(mode, client);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);

    try {
      let response;

      if (mode === "create") {
        const body: UpsertClientFamilyBody = {
          mode: "create",
          name: familyName.trim(),
          role: "primary",
        };
        response = await upsertClientFamily(client.id, body);
      } else if (mode === "join") {
        if (!selectedFamily) {
          showWarningToast(clientMessages.error.pickHousehold);
          setSaving(false);
          return;
        }
        response = await upsertClientFamily(client.id, {
          mode: "join",
          family_id: selectedFamily.family_id,
          role: role as (typeof CLIENT_FAMILY_MEMBER_ROLES)[number],
        });
      } else if (mode === "add_member") {
        if (!selectedClient) {
          showWarningToast(clientMessages.error.pickClientToAdd);
          setSaving(false);
          return;
        }
        response = await upsertClientFamily(client.id, {
          mode: "add_member",
          client_id: selectedClient.id,
          role: role as (typeof CLIENT_FAMILY_MEMBER_ROLES)[number],
        });
      } else if (mode === "rename") {
        response = await updateClientFamily(client.id, {
          family_name: familyName.trim(),
        });
      } else if (mode === "edit_member") {
        if (!memberClientId) {
          setSaving(false);
          return;
        }
        response = await updateClientFamily(client.id, {
          member_client_id: memberClientId,
          role: role as (typeof CLIENT_FAMILY_MEMBER_ROLES)[number],
          is_primary: isPrimary,
        });
      } else if (mode === "leave") {
        response = await leaveClientFamily(client.id);
      } else if (mode === "remove_member") {
        if (!memberClientId) {
          setSaving(false);
          return;
        }
        response = await removeClientFamilyMember(client.id, memberClientId);
      } else {
        if (!selectedClient) {
          showWarningToast(clientMessages.error.pickRelatedPerson);
          setSaving(false);
          return;
        }
        const body: CreateClientRelationshipBody = {
          to_client_id: selectedClient.id,
          relationship_type: relationshipType,
          notes: notes.trim() || null,
        };
        response = await createClientRelationship(client.id, body);
      }

      showOptionalSuccessToast(response.message);
      onSuccess(response.data);
      onClose();
    } catch (error) {
      showApiError(error);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={copy.title}
      description={copy.description}
      size={
        mode === "join" || mode === "add_member" || mode === "add_relationship"
          ? "lg"
          : "md"
      }
      footer={
        <>
          <ModalButton onClick={onClose} disabled={saving}>
            Cancel
          </ModalButton>
          <ModalButton
            type="submit"
            form="client-household-form"
            variant={
              mode === "leave" || mode === "remove_member" ? "danger" : "primary"
            }
            disabled={saving || !selectionReady}
          >
            {saving ? "Saving…" : copy.submit}
          </ModalButton>
        </>
      }
    >
      <form
        id="client-household-form"
        onSubmit={handleSubmit}
        className="min-w-0 space-y-4 px-5 py-4"
      >
        {mode === "create" || mode === "rename" ? (
          <label className="block">
            <span className="text-sm font-medium text-ink">Household name</span>
            <input
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
              placeholder="Chen Family"
              maxLength={120}
              required
              className={cn(modalFieldClassName, "mt-1.5")}
            />
          </label>
        ) : null}

        {mode === "join" || mode === "add_member" || mode === "add_relationship" ? (
          <div className="space-y-3">
            {mode === "join" && selectedFamily ? (
              <SelectedSummary
                label={selectedFamily.family_name}
                detail={`${selectedFamily.member_count} ${
                  selectedFamily.member_count === 1 ? "member" : "members"
                }`}
                onClear={() => setSelectedFamily(null)}
              />
            ) : null}

            {needsClientPick && selectedClient ? (
              <SelectedSummary
                label={selectedClient.display_name}
                detail={
                  selectedClient.email ||
                  selectedClient.phone ||
                  "No contact on file"
                }
                onClear={() => setSelectedClient(null)}
              />
            ) : null}

            <label className="block">
              <span className="text-sm font-medium text-ink">
                {mode === "join" ? "Search households" : "Search clients"}
              </span>
              <input
                value={query}
                onChange={(event) => {
                  const next = event.target.value;
                  setQuery(next);
                  if (next.trim().length < 2) {
                    setClientHits([]);
                    setFamilyHits([]);
                  }
                }}
                placeholder={
                  mode === "join"
                    ? "Search by household name"
                    : "Search by name, email, or phone"
                }
                className={cn(modalFieldClassName, "mt-1.5")}
              />
              <p className="mt-1.5 text-xs text-ink-muted">
                {mode === "add_member"
                  ? "Only clients who are not already in a household appear here. Tick one to select."
                  : "Type at least 2 characters, then tick a row to select."}
              </p>
            </label>

            {searching ? (
              <p className="text-xs text-ink-muted">Searching…</p>
            ) : null}

            {mode === "join" ? (
              <ul
                className="max-h-48 divide-y divide-border overflow-y-auto rounded-xl border border-border"
                role="listbox"
                aria-label="Households"
              >
                {familyHits.map((hit) => {
                  const checked =
                    selectedFamily?.family_id === hit.family_id;
                  return (
                    <li key={hit.family_id} role="option" aria-selected={checked}>
                      <button
                        type="button"
                        onClick={() => setSelectedFamily(hit)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-brand-light/50",
                          checked && "bg-brand-light",
                        )}
                      >
                        <SelectionCheck checked={checked} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-ink">
                            {hit.family_name}
                          </span>
                          <span className="block truncate text-xs text-ink-muted">
                            {hit.member_count}{" "}
                            {hit.member_count === 1 ? "member" : "members"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {query.trim().length >= 2 &&
                familyHits.length === 0 &&
                !searching ? (
                  <li className="px-3 py-2.5 text-sm text-ink-muted">
                    No households found.
                  </li>
                ) : null}
                {query.trim().length < 2 ? (
                  <li className="px-3 py-2.5 text-sm text-ink-muted">
                    Start typing to find a household.
                  </li>
                ) : null}
              </ul>
            ) : (
              <ul
                className="max-h-48 divide-y divide-border overflow-y-auto rounded-xl border border-border"
                role="listbox"
                aria-label="Clients"
              >
                {clientHits.map((hit) => {
                  const checked = selectedClient?.id === hit.id;
                  return (
                    <li key={hit.id} role="option" aria-selected={checked}>
                      <button
                        type="button"
                        onClick={() => setSelectedClient(hit)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-brand-light/50",
                          checked && "bg-brand-light",
                        )}
                      >
                        <SelectionCheck checked={checked} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-ink">
                            {hit.display_name}
                          </span>
                          <span className="block truncate text-xs text-ink-muted">
                            {hit.email || hit.phone || "No contact"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {query.trim().length >= 2 &&
                clientHits.length === 0 &&
                !searching ? (
                  <li className="px-3 py-2.5 text-sm text-ink-muted">
                    {mode === "add_member"
                      ? "No available clients. They must exist in Clients and not already be in a household."
                      : "No clients found."}
                  </li>
                ) : null}
                {query.trim().length < 2 ? (
                  <li className="px-3 py-2.5 text-sm text-ink-muted">
                    Start typing to find a client.
                  </li>
                ) : null}
              </ul>
            )}

            {mode === "add_member" ? (
              <p className="text-xs text-ink-muted">
                Not a client yet?{" "}
                <Link
                  href={pageRoutes.clientNew}
                  onClick={onClose}
                  className="font-semibold text-brand-dark hover:underline"
                >
                  Create a new client
                </Link>{" "}
                first, then add them here.
              </p>
            ) : null}
          </div>
        ) : null}

        {mode === "join" || mode === "add_member" || mode === "edit_member" ? (
          <label className="block">
            <span className="text-sm font-medium text-ink">Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className={cn(modalFieldClassName, "mt-1.5")}
            >
              {CLIENT_FAMILY_MEMBER_ROLES.map((value) => (
                <option key={value} value={value}>
                  {formatFamilyRole(value)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {mode === "edit_member" ? (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(event) => setIsPrimary(event.target.checked)}
              className="rounded border-border"
            />
            Primary contact for this household
          </label>
        ) : null}

        {mode === "add_relationship" ? (
          <>
            <label className="block">
              <span className="text-sm font-medium text-ink">Relationship</span>
              <select
                value={relationshipType}
                onChange={(event) =>
                  setRelationshipType(
                    event.target.value as (typeof CLIENT_RELATIONSHIP_TYPES)[number],
                  )
                }
                className={cn(modalFieldClassName, "mt-1.5")}
              >
                {CLIENT_RELATIONSHIP_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {formatRelationshipType(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                maxLength={2000}
                className={cn(modalFieldClassName, "mt-1.5 resize-y")}
              />
            </label>
          </>
        ) : null}

        {mode === "leave" ? (
          <p className="text-sm text-ink-muted">
            {client.display_name} will leave{" "}
            <span className="font-medium text-ink">
              {client.family?.name ?? "this household"}
            </span>
            . History stays on their profile.
          </p>
        ) : null}

        {mode === "remove_member" ? (
          <p className="text-sm text-ink-muted">
            <span className="font-medium text-ink">
              {member?.display_name ?? "This member"}
            </span>{" "}
            will be removed from{" "}
            <span className="font-medium text-ink">
              {client.family?.name ?? "this household"}
            </span>
            . They can be added again later.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

function dialogCopy(
  mode: HouseholdDialogMode,
  client: ProfileClient,
): { title: string; description: string; submit: string } {
  switch (mode) {
    case "create":
      return {
        title: "Create household",
        description: "Group people who often travel and bill together.",
        submit: "Create",
      };
    case "join":
      return {
        title: "Join household",
        description: "Link this client to an existing family group.",
        submit: "Join",
      };
    case "add_member":
      return {
        title: "Add household member",
        description: `Search and select a client to add to ${
          client.family?.name ?? "this household"
        }.`,
        submit: "Add member",
      };
    case "edit_member":
      return {
        title: "Edit member",
        description: "Update their household role or primary contact.",
        submit: "Save",
      };
    case "rename":
      return {
        title: "Rename household",
        description: "Shown on profiles for everyone in this group.",
        submit: "Save",
      };
    case "leave":
      return {
        title: "Leave household",
        description: "Remove this client from the household.",
        submit: "Leave",
      };
    case "remove_member":
      return {
        title: "Remove member?",
        description: "They will leave this household. Profiles stay intact.",
        submit: "Remove",
      };
    case "add_relationship":
      return {
        title: "Add related person",
        description:
          "Assistants, companions, and referrers — not spouse or family.",
        submit: "Add link",
      };
  }
}
