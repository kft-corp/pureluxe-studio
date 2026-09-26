"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  approveClient,
  deactivateClient,
  deleteClientDocument,
  deleteClientRelationship,
  getClientDocumentFileUrl,
  updateClientDocument,
  updateClientPreference,
} from "@/lib/api/clients";
import type { ClientProfile } from "@/lib/clients";
import {
  getClientConfirmConfig,
  type ClientConfirmState,
  type ClientDocumentConfirmAction,
} from "@/lib/clients";
import { showApiError, showOptionalSuccessToast } from "@/lib/feedback/toast";
import { pageRoutes } from "@/lib/routes";

import type { ClientEditSection } from "./client-edit-section-dialog";
import type { HouseholdDialogMode } from "./client-household-dialog";
import type { ClientProfileTab } from "./client-profile-tabs";

type UseClientProfileOptions = {
  initialProfile: ClientProfile;
};

/** Profile page state — tabs, dialogs, and mutations. */
export function useClientProfile({ initialProfile }: UseClientProfileOptions) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [activeTab, setActiveTab] = useState<ClientProfileTab>("overview");
  const [editSection, setEditSection] = useState<ClientEditSection | null>(
    null,
  );
  const [confirmState, setConfirmState] = useState<ClientConfirmState | null>(
    null,
  );
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [preferenceDialogOpen, setPreferenceDialogOpen] = useState(false);
  const [editingPreferenceId, setEditingPreferenceId] = useState<string | null>(
    null,
  );
  const [preferenceBusyId, setPreferenceBusyId] = useState<string | null>(null);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [documentBusyId, setDocumentBusyId] = useState<string | null>(null);
  const [documentConfirm, setDocumentConfirm] = useState<{
    action: ClientDocumentConfirmAction;
    documentId: string;
  } | null>(null);
  const [householdDialog, setHouseholdDialog] = useState<{
    mode: HouseholdDialogMode;
    memberClientId?: string | null;
  } | null>(null);
  const [relationshipBusyId, setRelationshipBusyId] = useState<string | null>(
    null,
  );

  const { client } = profile;

  function handleProfileSaved(next: ClientProfile) {
    setProfile(next);
  }

  const editingPreference =
    editingPreferenceId == null
      ? null
      : (client.preferences.find((pref) => pref.id === editingPreferenceId) ??
        null);

  const confirmingDocument =
    documentConfirm == null
      ? null
      : (client.documents.find((doc) => doc.id === documentConfirm.documentId) ??
        null);

  const activeConfirmState: ClientConfirmState | null = confirmState
    ? confirmState
    : documentConfirm
      ? {
          type: "document",
          action: documentConfirm.action,
          documentType: confirmingDocument?.document_type ?? null,
        }
      : null;

  const confirmConfig = getClientConfirmConfig(activeConfirmState);
  const confirmOpen = Boolean(activeConfirmState);
  const confirmBusy =
    confirmLoading ||
    Boolean(
      documentConfirm && documentBusyId === documentConfirm.documentId,
    );

  async function handleApprove() {
    setApproveLoading(true);
    try {
      const response = await approveClient(client.id);
      setProfile(response.data);
      showOptionalSuccessToast(response.message);
    } catch (error) {
      showApiError(error);
    } finally {
      setApproveLoading(false);
    }
  }

  async function handleConfirmPreference(preferenceId: string) {
    setPreferenceBusyId(preferenceId);
    try {
      const response = await updateClientPreference(client.id, preferenceId, {
        is_confirmed: true,
      });
      showOptionalSuccessToast(response.message);
      handleProfileSaved(response.data);
    } catch (error) {
      showApiError(error);
    } finally {
      setPreferenceBusyId(null);
    }
  }

  async function handleRemovePreference(preferenceId: string) {
    setPreferenceBusyId(preferenceId);
    try {
      const response = await updateClientPreference(client.id, preferenceId, {
        active: false,
      });
      showOptionalSuccessToast(response.message);
      handleProfileSaved(response.data);
    } catch (error) {
      showApiError(error);
    } finally {
      setPreferenceBusyId(null);
    }
  }

  async function handleRemoveRelationship(relationshipId: string) {
    setRelationshipBusyId(relationshipId);
    try {
      const response = await deleteClientRelationship(
        client.id,
        relationshipId,
      );
      showOptionalSuccessToast(response.message);
      handleProfileSaved(response.data);
    } catch (error) {
      showApiError(error);
    } finally {
      setRelationshipBusyId(null);
    }
  }

  async function handleViewDocument(documentId: string) {
    setDocumentBusyId(documentId);
    try {
      const response = await getClientDocumentFileUrl(client.id, documentId);
      window.open(response.data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      showApiError(error);
    } finally {
      setDocumentBusyId(null);
    }
  }

  function requestDocumentConfirm(
    action: ClientDocumentConfirmAction,
    documentId: string,
  ) {
    setDocumentConfirm({ action, documentId });
  }

  function requestDeactivate() {
    setConfirmState({
      type: "deactivate",
      clientName: client.display_name,
    });
  }

  function closeConfirm() {
    if (confirmBusy) return;
    setConfirmState(null);
    setDocumentConfirm(null);
  }

  async function handleConfirm() {
    if (confirmState?.type === "deactivate") {
      setConfirmLoading(true);
      try {
        const response = await deactivateClient(client.id);
        showOptionalSuccessToast(response.message);
        router.push(pageRoutes.clients);
        router.refresh();
      } catch (error) {
        showApiError(error);
      } finally {
        setConfirmLoading(false);
      }
      return;
    }

    if (!documentConfirm) return;

    const { action, documentId } = documentConfirm;
    setDocumentBusyId(documentId);

    try {
      if (action === "verify") {
        const response = await updateClientDocument(client.id, documentId, {
          status: "verified",
        });
        showOptionalSuccessToast(response.message);
        handleProfileSaved(response.data);
      } else if (action === "reject") {
        const response = await updateClientDocument(client.id, documentId, {
          status: "rejected",
        });
        showOptionalSuccessToast(response.message);
        handleProfileSaved(response.data);
      } else {
        const response = await deleteClientDocument(client.id, documentId);
        showOptionalSuccessToast(response.message);
        handleProfileSaved(response.data);
      }
      setDocumentConfirm(null);
    } catch (error) {
      showApiError(error);
    } finally {
      setDocumentBusyId(null);
    }
  }

  function openAddPreference() {
    setEditingPreferenceId(null);
    setPreferenceDialogOpen(true);
  }

  function openEditPreference(preferenceId: string) {
    setEditingPreferenceId(preferenceId);
    setPreferenceDialogOpen(true);
  }

  function closePreferenceDialog() {
    setPreferenceDialogOpen(false);
    setEditingPreferenceId(null);
  }

  return {
    profile,
    client,
    activeTab,
    setActiveTab,
    editSection,
    setEditSection,
    approveLoading,
    preferenceDialogOpen,
    editingPreference,
    preferenceBusyId,
    documentDialogOpen,
    setDocumentDialogOpen,
    documentBusyId,
    householdDialog,
    setHouseholdDialog,
    relationshipBusyId,
    confirmOpen,
    confirmConfig,
    confirmBusy,
    handleApprove,
    handleProfileSaved,
    handleConfirmPreference,
    handleRemovePreference,
    handleRemoveRelationship,
    handleViewDocument,
    requestDocumentConfirm,
    requestDeactivate,
    closeConfirm,
    handleConfirm,
    openAddPreference,
    openEditPreference,
    closePreferenceDialog,
  };
}
