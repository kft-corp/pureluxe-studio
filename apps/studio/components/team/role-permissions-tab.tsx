"use client";

import { useMemo } from "react";
import { LuShield } from "react-icons/lu";

import { PageLoader } from "@/components/feedback";
import { ContentSection, EmptyState, studioButtonClass } from "@/components/ui";
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
    ? "Choose a role, then turn permissions on or off. Save when you’re ready."
    : "View what this role can do. You don’t have permission to change it.";

  return (
    <ContentSection
      className={PANEL_CLASS}
      title={`${state.selectedRole.label} permissions`}
      description={sectionDescription}
      count={state.enabledCount}
      countLabel={`of ${state.totalPermissions} enabled`}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5">
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink uppercase">
            Role
          </p>
          <RolePermissionsRolePicker
            roles={state.data.roles}
            selectedRoleSlug={state.selectedRoleSlug}
            onSelectRole={state.selectRole}
          />
        </div>

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
            className={studioButtonClass(
              "secondary",
              "md",
              "w-full sm:w-auto",
            )}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => void state.saveRolePermissions()}
            disabled={!state.isDirty || state.saving}
            className={studioButtonClass("primary", "md", "w-full sm:w-auto")}
          >
            {state.saving ? "Saving…" : "Save changes"}
          </button>
        </footer>
      ) : null}
    </ContentSection>
  );
}
