"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getRolePermissionsOverview,
  updateRolePermissions,
  type RolePermissionsOverviewData,
} from "@/lib/api/team";
import { showApiError, showOptionalSuccessToast } from "@/lib/feedback/toast";

import {
  defaultExpandedModules,
  listModuleKeys,
  setsEqual,
} from "./role-permissions-utils";

type UseRolePermissionsOptions = {
  enabled: boolean;
};

type RoleDraftState = {
  draftGrants: Set<string>;
  savedGrants: Set<string>;
  expandedModules: Set<string>;
};

function buildRoleDraftState(
  data: RolePermissionsOverviewData,
  roleSlug: string,
): RoleDraftState {
  const grants = new Set(data.grantsByRole[roleSlug] ?? []);

  return {
    draftGrants: grants,
    savedGrants: grants,
    expandedModules: defaultExpandedModules(listModuleKeys(data.permissions)),
  };
}

/** Client state for the role permissions tab. */
export function useRolePermissions({ enabled }: UseRolePermissionsOptions) {
  const [data, setData] = useState<RolePermissionsOverviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRoleSlug, setSelectedRoleSlug] = useState<string | null>(null);
  const [draftGrants, setDraftGrants] = useState<Set<string>>(new Set());
  const [savedGrants, setSavedGrants] = useState<Set<string>>(new Set());
  const [moduleSearch, setModuleSearch] = useState("");
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const applyRole = useCallback((roleSlug: string, overview: RolePermissionsOverviewData) => {
    const next = buildRoleDraftState(overview, roleSlug);
    setSelectedRoleSlug(roleSlug);
    setDraftGrants(next.draftGrants);
    setSavedGrants(next.savedGrants);
    setExpandedModules(next.expandedModules);
    setModuleSearch("");
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const response = await getRolePermissionsOverview();
      const overview = response.data;
      setData(overview);

      const nextRole =
        selectedRoleSlug &&
        overview.roles.some((role) => role.slug === selectedRoleSlug)
          ? selectedRoleSlug
          : (overview.roles[0]?.slug ?? null);

      if (nextRole) {
        applyRole(nextRole, overview);
      } else {
        setSelectedRoleSlug(null);
        setDraftGrants(new Set());
        setSavedGrants(new Set());
        setExpandedModules(new Set());
      }
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }, [applyRole, selectedRoleSlug]);

  useEffect(() => {
    if (!enabled || data) {
      return;
    }

    void refresh();
  }, [data, enabled, refresh]);

  const selectRole = useCallback(
    (roleSlug: string) => {
      if (!data || roleSlug === selectedRoleSlug) {
        return;
      }

      if (!setsEqual(draftGrants, savedGrants)) {
        const shouldDiscard = window.confirm(
          "Discard unsaved permission changes for this role?",
        );
        if (!shouldDiscard) {
          return;
        }
      }

      applyRole(roleSlug, data);
    },
    [applyRole, data, draftGrants, savedGrants, selectedRoleSlug],
  );

  const togglePermission = useCallback((slug: string, enabledValue: boolean) => {
    setDraftGrants((current) => {
      const next = new Set(current);
      if (enabledValue) {
        next.add(slug);
      } else {
        next.delete(slug);
      }
      return next;
    });
  }, []);

  const toggleModuleExpanded = useCallback((module: string) => {
    setExpandedModules((current) => {
      const next = new Set(current);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  }, []);

  const expandAllModules = useCallback((modules: string[]) => {
    setExpandedModules(new Set(modules));
  }, []);

  const collapseAllModules = useCallback(() => {
    setExpandedModules(new Set());
  }, []);

  const isDirty = useMemo(
    () => !setsEqual(draftGrants, savedGrants),
    [draftGrants, savedGrants],
  );

  const discardChanges = useCallback(() => {
    setDraftGrants(new Set(savedGrants));
  }, [savedGrants]);

  const saveRolePermissions = useCallback(async () => {
    if (!selectedRoleSlug || !data?.canManage) {
      return;
    }

    setSaving(true);

    try {
      const response = await updateRolePermissions(
        selectedRoleSlug,
        [...draftGrants],
      );
      const nextGrants = new Set(response.data.permissionSlugs);

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          grantsByRole: {
            ...current.grantsByRole,
            [selectedRoleSlug]: response.data.permissionSlugs,
          },
        };
      });
      setDraftGrants(nextGrants);
      setSavedGrants(nextGrants);
      showOptionalSuccessToast(response.message);
    } catch (error) {
      showApiError(error);
    } finally {
      setSaving(false);
    }
  }, [data?.canManage, draftGrants, selectedRoleSlug]);

  const selectedRole = useMemo(
    () => data?.roles.find((role) => role.slug === selectedRoleSlug) ?? null,
    [data?.roles, selectedRoleSlug],
  );

  return {
    data,
    loading,
    saving,
    selectedRole,
    selectedRoleSlug,
    draftGrants,
    isDirty,
    moduleSearch,
    expandedModules,
    totalPermissions: data?.permissions.length ?? 0,
    enabledCount: draftGrants.size,
    selectRole,
    togglePermission,
    toggleModuleExpanded,
    expandAllModules,
    collapseAllModules,
    setModuleSearch,
    discardChanges,
    saveRolePermissions,
  };
}
