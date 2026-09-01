"use client";

import { useMemo } from "react";
import { LuShield } from "react-icons/lu";

import { PageLoader } from "@/components/feedback";
import { ContentSection, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

import { RolePermissionsModuleList } from "./role-permissions-module-list";
import { RolePermissionsRolePicker } from "./role-permissions-role-picker";
import { groupPermissionsByModule } from "./role-permissions-utils";
import { useRolePermissions } from "./use-role-permissions";

type RolePermissionsTabProps = {
  active: boolean;
};

const PANEL_CLASS = "flex min-h-[min(70vh,calc(100dvh-14rem))] flex-col";
const FOOTER_CLASS = cn(
  "sticky bottom-0 z-10 flex shrink-0 flex-col-reverse gap-2 border-t border-border/80 bg-surface-raised/95 px-4 py-3 backdrop-blur-sm sm:flex-row sm:justify-end sm:px-6 sm:py-4",
  "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
);

export function RolePermissionsTab({ active }: RolePermissionsTabProps) {
  const state = useRolePermissions({ enabled: active });

  const moduleGroups = useMemo(
    () => groupPermissionsByModule(state.data?.permissions ?? []),
    [state.data?.permissions],
  );

  const moduleKeys = useMemo(
    () => moduleGroups.map((group) => group.module),
    [moduleGroups],
  );

  if (!active) {
    return null;
  }

  if (state.loading && !state.data) {
    return <PageLoader className="min-h-[min(50vh,24rem)]" />;
  }

  if (!state.data) {
    return (
      <EmptyState
        icon={LuShield}
        message="Unable to load permissions. Refresh the page or try again in a moment."
      />
    );
  }

  if (!state.selectedRole || !state.selectedRoleSlug) {
    return (
      <EmptyState
        icon={LuShield}
        message="No active roles are available to manage."
      />
    );
  }

  const sectionDescription = state.data.canManage
    ? `${state.enabledCount} of ${state.totalPermissions} permissions enabled.`
    : `View only — ${state.enabledCount} of ${state.totalPermissions} permissions enabled.`;

  return (
    <ContentSection
      className={PANEL_CLASS}
      title={`${state.selectedRole.label} permissions`}
      description={sectionDescription}
      count={state.enabledCount}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5">
        <RolePermissionsRolePicker
          roles={state.data.roles}
          selectedRoleSlug={state.selectedRoleSlug}
          onSelectRole={state.selectRole}
        />

        <RolePermissionsModuleList
          groups={moduleGroups}
          draftGrants={state.draftGrants}
          canManage={state.data.canManage}
          moduleSearch={state.moduleSearch}
          expandedModules={state.expandedModules}
          onModuleSearchChange={state.setModuleSearch}
          onToggleModuleExpanded={state.toggleModuleExpanded}
          onExpandAll={() => state.expandAllModules(moduleKeys)}
          onCollapseAll={state.collapseAllModules}
          onTogglePermission={state.togglePermission}
        />
      </div>

      {state.data.canManage ? (
        <footer className={FOOTER_CLASS}>
          <button
            type="button"
            onClick={state.discardChanges}
            disabled={!state.isDirty || state.saving}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-border bg-surface-raised px-4 text-sm font-medium text-ink transition hover:bg-surface-hover disabled:opacity-50 sm:w-auto"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => void state.saveRolePermissions()}
            disabled={!state.isDirty || state.saving}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-brand-dark px-4 text-sm font-medium text-on-dark transition hover:bg-brand-dark/90 disabled:opacity-50 sm:w-auto"
          >
            {state.saving ? "Saving…" : "Save changes"}
          </button>
        </footer>
      ) : null}
    </ContentSection>
  );
}
