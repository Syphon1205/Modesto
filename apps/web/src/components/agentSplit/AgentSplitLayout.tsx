import type { EnvironmentId, ThreadId } from "@modesto/contracts";
import { Columns2Icon, XIcon } from "lucide-react";

import ChatView from "../ChatView";
import { agentSplitGridClassName, type AgentSplitPaneRef } from "../../agentSplit";
import { useAgentSplitStore } from "../../agentSplitStore";
import { Button } from "../ui/button";
import { cn } from "~/lib/utils";

export function AgentSplitLayout({
  parentEnvironmentId,
  parentThreadId,
  panes,
}: {
  readonly parentEnvironmentId: EnvironmentId;
  readonly parentThreadId: ThreadId;
  readonly panes: ReadonlyArray<AgentSplitPaneRef>;
}) {
  const closeSplit = useAgentSplitStore((state) => state.closeSplit);
  const count = panes.length;
  if (count === 0) return null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-3">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <Columns2Icon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate font-medium text-foreground">Multi-Agent split</span>
          <span className="tabular-nums">
            {count} pane{count === 1 ? "" : "s"}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2"
          onClick={() => closeSplit(parentEnvironmentId, parentThreadId)}
        >
          <XIcon className="size-3.5" aria-hidden />
          Close split
        </Button>
      </div>
      <div
        className={cn("grid min-h-0 flex-1 gap-px bg-border/60", agentSplitGridClassName(count))}
      >
        {panes.map((pane) => (
          <section
            key={`${pane.environmentId}:${pane.threadId}`}
            className="flex min-h-0 min-w-0 flex-col bg-background"
            aria-label={pane.title}
          >
            <div className="flex h-8 shrink-0 items-center border-b border-border/50 px-2.5">
              <span className="truncate text-xs font-medium text-foreground">{pane.title}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <ChatView
                environmentId={pane.environmentId}
                threadId={pane.threadId}
                routeKind="server"
                embedded
                reserveTitleBarControlInset={false}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
