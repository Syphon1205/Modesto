// FILE: ContextUsagePanel.tsx
// Purpose: Cursor-style, live context usage report for a docked chat workspace.

import type { ThreadId } from "@modesto/contracts";
import { useMemo } from "react";

import {
  deriveContextWindowMeterDisplay,
  deriveCumulativeCostUsd,
  deriveLatestContextWindowSnapshot,
  formatContextWindowTokens,
  formatCostUsd,
  type ContextWindowSnapshot,
} from "~/lib/contextWindow";
import { ChartBarIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { useStore } from "~/store";
import { createThreadSelector } from "~/storeSelectors";

function UsageRing(props: { usage: ContextWindowSnapshot }) {
  const display = deriveContextWindowMeterDisplay(props.usage);
  const radius = 58;
  const circumference = Math.PI * 2 * radius;
  const offset = circumference - (display.normalizedPercentage / 100) * circumference;

  return (
    <div className="relative size-44 shrink-0" aria-label={display.ariaLabel}>
      <svg viewBox="0 0 136 136" className="size-full -rotate-90" aria-hidden="true">
        <circle
          cx="68"
          cy="68"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-muted/80"
        />
        <circle
          cx="68"
          cy="68"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none",
            display.normalizedPercentage >= 85 ? "text-warning" : "text-primary",
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
          {display.compactLabel}
        </span>
        <span className="mt-0.5 text-xs text-muted-foreground">Full</span>
      </div>
    </div>
  );
}

function ReportFact(props: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{props.label}</div>
      <div className="mt-0.5 truncate text-sm font-medium tabular-nums text-foreground">
        {props.value}
      </div>
    </div>
  );
}

function ExplorerRow(props: {
  label: string;
  detail: string;
  value: number | null;
  accentClassName: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[color:var(--color-border-light)] bg-muted/10 px-3 py-2.5">
      <span className={cn("size-2 shrink-0 rounded-sm", props.accentClassName)} />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-foreground">{props.label}</div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{props.detail}</div>
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {props.value === null ? "—" : formatContextWindowTokens(props.value)}
      </span>
    </div>
  );
}

function EmptyReport(props: { threadTitle: string }) {
  return (
    <div className="h-full min-h-0 w-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl p-6 sm:p-8">
        <div className="border-b border-[color:var(--color-border-light)] pb-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ChartBarIcon className="size-3.5" />
            Context Usage Report
          </div>
          <h1 className="mt-2 truncate text-xl font-semibold tracking-tight text-foreground">
            {props.threadTitle}
          </h1>
        </div>
        <div className="mt-12 flex max-w-md flex-col items-start">
          <div className="flex size-10 items-center justify-center rounded-xl border border-[color:var(--color-border-light)] bg-muted/30">
            <ChartBarIcon className="size-5 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-base font-medium text-foreground">
            Waiting for live context data
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This report fills in as soon as the selected model returns token usage. It will show the
            live context window as well as input, cached input, output, and reasoning tokens.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ContextUsagePanel(props: { threadId: ThreadId }) {
  const thread = useStore(useMemo(() => createThreadSelector(props.threadId), [props.threadId]));
  const usage = useMemo(
    () => deriveLatestContextWindowSnapshot(thread?.activities ?? []),
    [thread?.activities],
  );
  const cost = useMemo(
    () => deriveCumulativeCostUsd(thread?.activities ?? []),
    [thread?.activities],
  );
  const threadTitle = thread?.title || "Current thread";

  if (!usage) {
    return <EmptyReport threadTitle={threadTitle} />;
  }

  const display = deriveContextWindowMeterDisplay(usage);
  const isNearLimit = display.normalizedPercentage >= 80;
  const totalProcessed = usage.totalProcessedTokens ?? usage.inputTokens ?? usage.usedTokens;

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto" aria-live="polite">
      <div className="mx-auto w-full max-w-2xl p-6 sm:p-8">
        <header className="border-b border-[color:var(--color-border-light)] pb-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ChartBarIcon className="size-3.5" />
            Context Usage Report
          </div>
          <h1 className="mt-2 truncate text-xl font-semibold tracking-tight text-foreground">
            {threadTitle}
          </h1>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <ReportFact
              label="Context size"
              value={formatContextWindowTokens(usage.maxTokens ?? 0)}
            />
            <ReportFact label="Tokens used" value={formatContextWindowTokens(usage.usedTokens)} />
            <ReportFact
              label="Remaining"
              value={formatContextWindowTokens(usage.remainingTokens)}
            />
            <ReportFact label="Processed" value={formatContextWindowTokens(totalProcessed)} />
          </div>
        </header>

        <p className="mt-6 max-w-xl text-sm leading-6 text-muted-foreground">
          The context window contains the information the agent can use during its next response.
          Usage updates live as the model reads, reasons, and produces output.
        </p>

        <section className="mt-8 flex flex-col items-center justify-center py-2 text-center">
          <UsageRing usage={usage} />
          {isNearLimit ? (
            <div className="mt-5 max-w-md rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-left text-xs leading-5 text-warning-foreground">
              Context space is getting tight.{" "}
              {usage.compactsAutomatically
                ? "This model can compact automatically when needed."
                : "Start a fresh thread if the conversation needs more room."}
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Live updates are shown while the agent is working.
            </p>
          )}
        </section>

        <section className="mt-8 border-t border-[color:var(--color-border-light)] pt-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-base font-semibold text-foreground">Context Explorer</h2>
            {cost !== null ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatCostUsd(cost)} session
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            The categories reported by the active provider for this conversation.
          </p>
          <div className="mt-4 space-y-2">
            <ExplorerRow
              label="Input"
              detail="New prompt and conversation tokens"
              value={usage.inputTokens ?? null}
              accentClassName="bg-info"
            />
            <ExplorerRow
              label="Cached input"
              detail="Previously processed context reused by the model"
              value={usage.cachedInputTokens ?? null}
              accentClassName="bg-success"
            />
            <ExplorerRow
              label="Output"
              detail="Assistant response tokens"
              value={usage.outputTokens ?? null}
              accentClassName="bg-primary"
            />
            <ExplorerRow
              label="Reasoning"
              detail="Model reasoning tokens, when the provider reports them"
              value={usage.reasoningOutputTokens ?? null}
              accentClassName="bg-warning"
            />
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[color:var(--color-border-light)] pt-6 sm:grid-cols-4">
          <ReportFact
            label="Last input"
            value={
              usage.lastInputTokens == null ? "—" : formatContextWindowTokens(usage.lastInputTokens)
            }
          />
          <ReportFact
            label="Last output"
            value={
              usage.lastOutputTokens == null
                ? "—"
                : formatContextWindowTokens(usage.lastOutputTokens)
            }
          />
          <ReportFact
            label="Tool uses"
            value={usage.toolUses == null ? "—" : String(usage.toolUses)}
          />
          <ReportFact
            label="Last turn"
            value={usage.durationMs == null ? "—" : `${Math.round(usage.durationMs / 1000)}s`}
          />
        </section>
      </div>
    </div>
  );
}
