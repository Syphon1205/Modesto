import type { ScopedThreadRef } from "@modesto/contracts";
import {
  FileDiffIcon,
  FileStackIcon,
  GitBranchIcon,
  GitCommitIcon,
  ListFilterIcon,
  MonitorIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import type { DraftId } from "~/composerDraftStore";
import { cn } from "~/lib/utils";
import type { EnvironmentDiffStats } from "../RightPanelEnvironments.logic";
import GitActionsControl from "../GitActionsControl";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { Toggle } from "../ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

interface PinnedSummaryPanelProps {
  readonly activeThreadRef: ScopedThreadRef;
  readonly draftId?: DraftId;
  readonly environmentLabel: string | null;
  readonly environmentMode: "local" | "worktree";
  readonly branch: string | null;
  readonly diffStats: EnvironmentDiffStats | null;
  readonly gitCwd: string | null;
  readonly onOpenChanges: () => void;
  readonly onOpenArtifacts: () => void;
  readonly onOpenPullRequest?: ((number: number) => void) | undefined;
}

function SummaryRow({
  icon: Icon,
  label,
  detail,
  onClick,
}: {
  readonly icon: typeof FileDiffIcon;
  readonly label: string;
  readonly detail?: ReactNode;
  readonly onClick?: () => void;
}) {
  const content = (
    <>
      <Icon className="size-[17px] shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {detail ? <span className="shrink-0 text-muted-foreground">{detail}</span> : null}
    </>
  );

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-accent/70"
    >
      {content}
    </button>
  ) : (
    <div className="flex w-full items-center gap-3 px-2.5 py-2 text-[13px] text-foreground">
      {content}
    </div>
  );
}

export function PinnedSummaryPanel(props: PinnedSummaryPanelProps) {
  const [open, setOpen] = useState(false);
  const environmentName = props.environmentMode === "worktree" ? "Worktree" : "Local";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Toggle
                  pressed={open}
                  aria-label="Toggle pinned summary"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 [-webkit-app-region:no-drag]"
                >
                  <ListFilterIcon className="size-4" />
                </Toggle>
              }
            />
          }
        />
        <TooltipPopup side="bottom">Toggle pinned summary</TooltipPopup>
      </Tooltip>
      <PopoverPopup
        align="end"
        side="bottom"
        sideOffset={10}
        className="w-[340px] overflow-hidden rounded-2xl border border-border/80 bg-popover p-0 shadow-2xl"
        viewportClassName="p-0 [--viewport-inline-padding:0px]"
      >
        <div className="px-4 pt-4 pb-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Environment</h2>
              <p className="mt-0.5 max-w-[250px] truncate text-[11px] text-muted-foreground">
                {props.environmentLabel ?? "Current workspace"}
              </p>
            </div>
          </div>
          <div className="space-y-0.5">
            <SummaryRow
              icon={FileDiffIcon}
              label="Changes"
              onClick={props.onOpenChanges}
              detail={
                props.diffStats ? (
                  <span className="font-mono text-xs tabular-nums">
                    <span className="text-emerald-500">+{props.diffStats.insertions}</span>{" "}
                    <span className="text-red-500">−{props.diffStats.deletions}</span>
                  </span>
                ) : (
                  <span className="text-xs">Clean</span>
                )
              }
            />
            <SummaryRow icon={MonitorIcon} label={environmentName} />
            <SummaryRow
              icon={GitBranchIcon}
              label={props.branch ?? "No branch"}
              detail={<span className="text-xs">Branch</span>}
            />
            <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
              <GitCommitIcon className="size-[17px] shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 text-[13px] text-foreground">Commit or push</span>
              <div className={cn("shrink-0", !props.gitCwd && "opacity-50")}>
                <GitActionsControl
                  gitCwd={props.gitCwd}
                  activeThreadRef={props.activeThreadRef}
                  onOpenPullRequest={props.onOpenPullRequest}
                  {...(props.draftId ? { draftId: props.draftId } : {})}
                />
              </div>
            </div>
            <SummaryRow
              icon={GitBranchIcon}
              label="Compare branch"
              detail={<span aria-hidden>↗</span>}
              onClick={props.onOpenChanges}
            />
          </div>
        </div>
        <div className="mx-4 border-t border-border/70" />
        <div className="px-4 pt-3 pb-4">
          <div className="mb-1 px-1">
            <h2 className="text-sm font-semibold text-foreground">Sources</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Files and references collected for this task.
            </p>
          </div>
          <SummaryRow
            icon={FileStackIcon}
            label="Thread artifacts"
            detail={<span aria-hidden>↗</span>}
            onClick={props.onOpenArtifacts}
          />
        </div>
      </PopoverPopup>
    </Popover>
  );
}
