import { FolderGit2Icon, FolderGitIcon, FolderIcon, HistoryIcon } from "lucide-react";
import { memo, useMemo, type ReactNode } from "react";

import {
  resolveCurrentWorkspaceLabel,
  resolveEnvModeLabel,
  resolveLockedWorkspaceLabel,
  type EnvMode,
} from "./BranchToolbar.logic";
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export const PREVIOUS_WORKTREE_SELECT_VALUE = "previous-worktree";

interface BranchToolbarEnvModeSelectorProps {
  envLocked: boolean;
  effectiveEnvMode: EnvMode;
  activeWorktreePath: string | null;
  onEnvModeChange: (mode: EnvMode) => void;
  previousWorktreeLabel?: string | null;
  onUsePreviousWorktree?: () => void;
  displayLabel?: string;
  displayIcon?: ReactNode;
  copilotAppearance?: boolean;
}

export const BranchToolbarEnvModeSelector = memo(function BranchToolbarEnvModeSelector({
  envLocked,
  effectiveEnvMode,
  activeWorktreePath,
  onEnvModeChange,
  previousWorktreeLabel,
  onUsePreviousWorktree,
  displayLabel,
  displayIcon,
  copilotAppearance = false,
}: BranchToolbarEnvModeSelectorProps) {
  const showPreviousWorktree = Boolean(previousWorktreeLabel && onUsePreviousWorktree);
  const envModeItems = useMemo(
    () => [
      { value: "worktree", label: resolveEnvModeLabel("worktree") },
      {
        value: "local",
        label:
          copilotAppearance && !activeWorktreePath
            ? "Local repository"
            : resolveCurrentWorkspaceLabel(activeWorktreePath),
      },
      ...(showPreviousWorktree && previousWorktreeLabel
        ? [{ value: PREVIOUS_WORKTREE_SELECT_VALUE, label: previousWorktreeLabel }]
        : []),
    ],
    [activeWorktreePath, copilotAppearance, previousWorktreeLabel, showPreviousWorktree],
  );

  if (envLocked) {
    return (
      <span
        className="inline-flex h-7 shrink-0 items-center gap-1 border border-transparent px-[calc(--spacing(3)-1px)] text-sm font-medium text-muted-foreground/70 sm:h-6 sm:text-xs"
        data-composer-context-control
      >
        {activeWorktreePath ? (
          <>
            <FolderGitIcon className="size-3" />
            {resolveLockedWorkspaceLabel(activeWorktreePath)}
          </>
        ) : (
          <>
            <FolderIcon className="size-3" />
            {resolveLockedWorkspaceLabel(activeWorktreePath)}
          </>
        )}
      </span>
    );
  }

  return (
    <Select
      modal={false}
      value={effectiveEnvMode}
      onValueChange={(value: string | null) => {
        if (value === PREVIOUS_WORKTREE_SELECT_VALUE) {
          onUsePreviousWorktree?.();
          return;
        }
        onEnvModeChange(value as EnvMode);
      }}
      items={envModeItems}
    >
      <SelectTrigger
        variant="ghost"
        size="xs"
        className="min-w-0 shrink font-medium"
        aria-label="Workspace"
        data-composer-context-control
      >
        {displayIcon ??
          (effectiveEnvMode === "worktree" ? (
            <FolderGit2Icon className="size-3" />
          ) : activeWorktreePath ? (
            <FolderGitIcon className="size-3" />
          ) : (
            <FolderIcon className="size-3" />
          ))}
        <span
          data-composer-label
          className="min-w-0 max-w-[240px] group-data-[compact]/composer-context:max-w-0"
        >
          <span
            data-composer-label-motion
            className="block w-full min-w-0 max-w-[240px] origin-left truncate transition-[opacity,transform] duration-180 ease-[cubic-bezier(0.32,0.72,0,1)] group-data-[compact]/composer-context:[transform:translateX(-0.25rem)_scaleX(0.95)] group-data-[compact]/composer-context:opacity-0 motion-reduce:transform-none motion-reduce:transition-opacity"
          >
            {displayLabel ?? <SelectValue />}
          </span>
        </span>
      </SelectTrigger>
      <SelectPopup>
        <SelectGroup>
          <SelectGroupLabel>
            {copilotAppearance ? "Where to run this session" : "Workspace"}
          </SelectGroupLabel>
          <SelectItem value="worktree">
            <span className="inline-flex items-start gap-2 py-0.5">
              <FolderGit2Icon className="mt-0.5 size-3" />
              <span className="flex min-w-0 flex-col">
                <span>{resolveEnvModeLabel("worktree")}</span>
                {copilotAppearance ? (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Creates a separate copy for this session
                  </span>
                ) : null}
              </span>
            </span>
          </SelectItem>
          <SelectItem value="local">
            <span className="inline-flex items-start gap-2 py-0.5">
              {activeWorktreePath ? (
                <FolderGitIcon className="mt-0.5 size-3" />
              ) : (
                <FolderIcon className="mt-0.5 size-3" />
              )}
              <span className="flex min-w-0 flex-col">
                <span>
                  {copilotAppearance && !activeWorktreePath
                    ? "Local repository"
                    : resolveCurrentWorkspaceLabel(activeWorktreePath)}
                </span>
                {copilotAppearance && !activeWorktreePath ? (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Works in the repository already on your machine
                  </span>
                ) : null}
              </span>
            </span>
          </SelectItem>
          {showPreviousWorktree && previousWorktreeLabel ? (
            <SelectItem value={PREVIOUS_WORKTREE_SELECT_VALUE}>
              <span className="inline-flex items-center gap-1.5">
                <HistoryIcon className="size-3" />
                {previousWorktreeLabel}
              </span>
            </SelectItem>
          ) : null}
        </SelectGroup>
      </SelectPopup>
    </Select>
  );
});
