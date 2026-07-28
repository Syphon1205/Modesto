import type { CSSProperties } from "react";
import { PROVIDER_DISPLAY_NAMES } from "@modesto/contracts";

import { ProviderIcon } from "~/components/ProviderIcon";
import { ThreadRunningSpinner } from "~/components/ThreadRunningSpinner";
import {
  BrainIcon,
  HammerIcon,
  InfoIcon,
  TelescopeIcon,
  TriangleAlertIcon,
  UsersIcon,
  type LucideIcon,
} from "~/lib/icons";
import { formatRelativeTime } from "~/lib/relativeTime";
import { cn } from "~/lib/utils";
import { deriveThreadActivitySummary, isThreadRunningTurn } from "~/session-logic";
import type { Thread } from "~/types";

export const WORK_LOG_TONE_ICON: Record<string, LucideIcon> = {
  thinking: BrainIcon,
  tool: HammerIcon,
  info: InfoIcon,
  error: TriangleAlertIcon,
};

/** Shared live task card for the Teams and Research landings — surfaces a thread's
 * provider, its most recent real work-log activity (what it's doing right now),
 * and a completion percent when the provider has reported a task/todo list for the
 * current turn. Both figures come straight from `~/session-logic`; when a thread's
 * turn has no task list, the percent is omitted rather than guessed. */
export function WorkspaceTaskCard({
  thread,
  projectName,
  onOpen,
  style,
  kind,
}: {
  readonly thread: Thread;
  readonly projectName: string;
  readonly onOpen: () => void;
  readonly style?: CSSProperties;
  readonly kind: "research" | "teams";
}) {
  const running = isThreadRunningTurn(thread);
  const latestTurnId = thread.latestTurn?.turnId ?? undefined;
  const {
    activityLabel,
    activityTone,
    taskProgressPercent: percent,
  } = deriveThreadActivitySummary(thread.activities, latestTurnId);
  const ToneIcon = activityTone ? (WORK_LOG_TONE_ICON[activityTone] ?? null) : null;
  const KindIcon = kind === "research" ? TelescopeIcon : UsersIcon;
  const kindLabel = kind === "research" ? "Research" : "Teams";

  return (
    <button
      type="button"
      style={style}
      onClick={onOpen}
      className="chat-message-send-enter group flex flex-col gap-2 rounded-xl border border-border/55 p-3.5 text-left transition-colors hover:bg-foreground/[0.025]"
    >
      <div className="flex items-center gap-2">
        <span
          aria-label={`${kindLabel} task`}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md border",
            kind === "research"
              ? "border-violet-400/20 bg-violet-400/10 text-violet-400"
              : "border-blue-400/20 bg-blue-400/10 text-blue-400",
          )}
        >
          <KindIcon className="size-3" />
        </span>
        <ProviderIcon provider={thread.modelSelection.provider} className="size-4" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground">
          {PROVIDER_DISPLAY_NAMES[thread.modelSelection.provider]}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
          {running ? (
            <ThreadRunningSpinner className="size-3" />
          ) : (
            <span className="size-1.5 rounded-full bg-muted-foreground/35" />
          )}
          {running ? "Working" : formatRelativeTime(thread.updatedAt ?? thread.createdAt)}
        </span>
      </div>

      <div className="min-w-0">
        <div className="truncate text-xs font-medium">{thread.title}</div>
        <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{projectName}</div>
      </div>

      {activityLabel ? (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {ToneIcon ? <ToneIcon className="size-3 shrink-0" /> : null}
          <span className="truncate">{activityLabel}</span>
        </div>
      ) : null}

      {percent !== null ? (
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                percent >= 100 ? "bg-emerald-400/80" : "bg-blue-400/80",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {percent}%
          </span>
        </div>
      ) : null}
    </button>
  );
}
