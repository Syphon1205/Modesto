import type { ScopedProjectRef } from "@modesto/contracts";
import { scopedProjectKey, scopeProjectRef } from "@modesto/client-runtime/environment";
import { FolderPlusIcon } from "lucide-react";
import { useCallback, useMemo, type ReactElement, type ReactNode } from "react";

import { openCommandPalette } from "~/commandPaletteBus";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { useClientSettings } from "~/hooks/useSettings";
import { selectProjectGroupingSettings } from "~/logicalProject";
import {
  buildSidebarProjectPickerEntries,
  buildSidebarProjectSnapshots,
  type SidebarProjectPickerEntry,
} from "~/sidebarProjectGrouping";
import { useProjects, useThreadShells } from "~/state/entities";
import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import { sortLogicalProjectsForSidebar } from "../Sidebar.logic";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export interface DraftProjectPickerState {
  readonly entries: readonly SidebarProjectPickerEntry[];
  readonly activeProjectKey: string;
  /** Logical project name for the draft, or null when no project is chosen. */
  readonly activeDisplayName: string | null;
  readonly canChoose: boolean;
  readonly select: (projectKey: string) => void;
  readonly openAddProject: () => void;
}

/**
 * Project choice for an empty draft. Picking a project re-targets the draft
 * and carries whatever the user already typed, since they started writing in
 * the wrong project rather than starting a new task.
 */
export function useDraftProjectPicker(
  activeProjectRef: ScopedProjectRef | null,
  activeProjectTitle: string | null,
): DraftProjectPickerState {
  const projects = useProjects();
  const threads = useThreadShells();
  const { environments } = useEnvironments();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const projectGroupingSettings = useClientSettings(selectProjectGroupingSettings);
  const projectSortOrder = useClientSettings((settings) => settings.sidebarProjectSortOrder);
  const handleNewThread = useNewThreadHandler();
  const openAddProject = useCallback(() => openCommandPalette({ open: "add-project" }), []);

  const environmentLabelById = useMemo(
    () =>
      new Map(
        environments.map((environment) => [environment.environmentId, environment.label] as const),
      ),
    [environments],
  );
  const projectGroups = useMemo(
    () =>
      sortLogicalProjectsForSidebar(
        buildSidebarProjectSnapshots({
          projects,
          settings: projectGroupingSettings,
          primaryEnvironmentId,
          resolveEnvironmentLabel: (environmentId) =>
            environmentLabelById.get(environmentId) ?? null,
        }),
        threads,
        projectSortOrder,
      ),
    [
      environmentLabelById,
      primaryEnvironmentId,
      projectGroupingSettings,
      projectSortOrder,
      projects,
      threads,
    ],
  );
  const entries = useMemo(
    () =>
      buildSidebarProjectPickerEntries({
        groups: projectGroups,
        preferredProjectRef: activeProjectRef,
      }),
    [activeProjectRef, projectGroups],
  );
  const entryByKey = useMemo(
    () => new Map(entries.map((entry) => [entry.group.projectKey, entry] as const)),
    [entries],
  );
  const activeProjectGroup =
    activeProjectRef === null
      ? null
      : (projectGroups.find((group) =>
          group.memberProjectRefs.some(
            (projectRef) => scopedProjectKey(projectRef) === scopedProjectKey(activeProjectRef),
          ),
        ) ?? null);
  const activeProjectKey = activeProjectGroup?.projectKey ?? "";

  const select = useCallback(
    (projectKey: string) => {
      const entry = entryByKey.get(projectKey);
      if (!entry || projectKey === activeProjectKey) return;
      const project = entry.targetProject;
      void handleNewThread(scopeProjectRef(project.environmentId, project.id), {
        replace: true,
        carryComposerContent: true,
      });
    },
    [activeProjectKey, entryByKey, handleNewThread],
  );

  return {
    entries,
    activeProjectKey,
    activeDisplayName: activeProjectGroup?.displayName ?? activeProjectTitle,
    canChoose: entries.length > 0,
    select,
    openAddProject,
  };
}

/**
 * The project menu itself. `trigger` is the element the caller styles; the
 * menu content is identical everywhere a draft picks its project.
 */
export function DraftProjectMenu({
  picker,
  trigger,
  children,
  align = "center",
  tooltip,
}: {
  picker: DraftProjectPickerState;
  trigger: ReactElement;
  children: ReactNode;
  align?: "start" | "center" | "end";
  tooltip?: string | null;
}) {
  const menuTrigger = <MenuTrigger render={trigger}>{children}</MenuTrigger>;
  return (
    <Menu>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger render={menuTrigger} />
          <TooltipPopup side="top" className="max-w-80">
            {tooltip}
          </TooltipPopup>
        </Tooltip>
      ) : (
        menuTrigger
      )}
      <MenuPopup align={align} className="max-h-80 min-w-40! w-max max-w-64 overflow-y-auto">
        <MenuRadioGroup
          value={picker.activeProjectKey}
          onValueChange={(value) => picker.select(value as string)}
        >
          {picker.entries.map(({ group }) => (
            <MenuRadioItem key={group.projectKey} value={group.projectKey} closeOnClick>
              <span className="block min-w-0 truncate" title={group.displayName}>
                {group.displayName}
              </span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem onClick={picker.openAddProject}>
          <FolderPlusIcon />
          New project
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
