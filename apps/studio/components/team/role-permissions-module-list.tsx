"use client";

import { LuChevronDown, LuSearch, LuX } from "react-icons/lu";

import { studioButtonClass, studioControl } from "@/components/ui";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils/cn";

import {
  countEnabledInModule,
  filterModuleGroups,
  moduleGrantStatusClass,
  permissionHint,
  type PermissionModuleGroup,
} from "./role-permissions-utils";

type RolePermissionsModuleListProps = {
  groups: PermissionModuleGroup[];
  draftGrants: Set<string>;
  canManage: boolean;
  moduleSearch: string;
  expandedModules: Set<string>;
  onModuleSearchChange: (value: string) => void;
  onToggleModuleExpanded: (module: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onTogglePermission: (slug: string, enabled: boolean) => void;
};

export function RolePermissionsModuleList({
  groups,
  draftGrants,
  canManage,
  moduleSearch,
  expandedModules,
  onModuleSearchChange,
  onToggleModuleExpanded,
  onExpandAll,
  onCollapseAll,
  onTogglePermission,
}: RolePermissionsModuleListProps) {
  const filteredGroups = filterModuleGroups(groups, moduleSearch);
  const hasExpanded = expandedModules.size > 0;

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-ink-muted">
        No permissions are defined in the catalog yet.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <LuSearch
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <input
            type="search"
            value={moduleSearch}
            onChange={(event) => onModuleSearchChange(event.target.value)}
            placeholder="Search modules or actions…"
            aria-label="Search modules or actions"
            className={cn(
              studioControl.field,
              "pr-9 pl-9",
              "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
            )}
          />
          {moduleSearch ? (
            <button
              type="button"
              onClick={() => onModuleSearchChange("")}
              className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface-hover hover:text-ink"
              aria-label="Clear search"
            >
              <LuX className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="flex gap-1.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={onExpandAll}
            className={studioButtonClass("secondary", "sm")}
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={onCollapseAll}
            disabled={!hasExpanded}
            className={studioButtonClass("secondary", "sm")}
          >
            Collapse all
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-surface">
        {filteredGroups.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-ink-muted">
            No modules or actions match your search.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredGroups.map((group) => {
              const isExpanded = expandedModules.has(group.module);
              const { enabled, total } = countEnabledInModule(
                group.permissions,
                draftGrants,
              );
              const panelId = `permissions-module-${group.module}`;

              return (
                <section key={group.module}>
                  <button
                    type="button"
                    id={`${panelId}-trigger`}
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    onClick={() => onToggleModuleExpanded(group.module)}
                    className="flex w-full items-center gap-2.5 px-3 py-3.5 text-left transition hover:bg-surface-hover/60 sm:gap-3 sm:px-4"
                  >
                    <LuChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-ink-muted transition-transform",
                        isExpanded && "rotate-180",
                      )}
                      aria-hidden
                    />

                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {group.label}
                    </span>

                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums sm:text-xs",
                        moduleGrantStatusClass(enabled, total),
                      )}
                    >
                      {enabled}/{total}
                    </span>
                  </button>

                  {isExpanded ? (
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={`${panelId}-trigger`}
                      className="border-t border-border/70 bg-surface-raised/40"
                    >
                      <ul className="divide-y divide-border/60">
                        {group.permissions.map((permission) => {
                          const checked = draftGrants.has(permission.slug);
                          const hint = permissionHint(permission, checked);

                          return (
                            <li
                              key={permission.slug}
                              className="flex items-start justify-between gap-3 px-3 py-3 sm:items-center sm:gap-4 sm:px-4"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-ink">
                                  {permission.label}
                                </p>
                                {hint ? (
                                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                                    {hint}
                                  </p>
                                ) : null}
                              </div>

                              <Switch
                                checked={checked}
                                disabled={!canManage}
                                label={permission.label}
                                className="mt-0.5 sm:mt-0"
                                onCheckedChange={(enabledValue) =>
                                  onTogglePermission(permission.slug, enabledValue)
                                }
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
