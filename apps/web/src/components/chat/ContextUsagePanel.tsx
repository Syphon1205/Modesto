// FILE: ContextUsagePanel.tsx
// Purpose: The context viewer - a live report of what is filling the active
//          thread's context window, and what the thread has cost so far.
// Layer: Chat UI (right-panel surface)
//
// Ported from Modesto's older `ContextUsagePanel`, rebuilt on this tree's atom
// state (`useThreadActivities`) instead of the old `useStore` selector. The
// numbers come from the same `lib/contextWindow` derivations the compact meter
// uses, so the ring here and the ring in the header can never disagree.
//
// Every field shown is one a provider actually reports; anything a provider
// leaves out renders as an em dash rather than a zero, because "0 reasoning
// tokens" and "this provider does not report reasoning tokens" are different
// claims and conflating them makes the report untrustworthy.

import type { ScopedThreadRef } from "@modesto/contracts";
import { ChartColumnIcon } from "lucide-react";
import { useMemo } from "react";

import type { ContextWindowSnapshot } from "../../lib/contextWindow";
import {
  deriveContextWindowMeterDisplay,
  deriveCumulativeCostUsd,
  formatContextWindowTokens,
  formatCostUsd,
  resolveVisibleContextWindowSnapshot,
} from "../../lib/contextWindow";
import { cn } from "../../lib/utils";
import { DraftId, useComposerDraftModelState } from "../../composerDraftStore";
import { useThreadActivities, useThreadShell } from "../../state/entities";

function UsageRing({ usage }: { readonly usage: ContextWindowSnapshot }) {
  const display = deriveContextWindowMeterDisplay(usage);
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
          className="text-muted-foreground/45"
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
            display.normalizedPercentage >= 85 ? "text-warning" : "text-foreground/80",
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
          {display.compactLabel}
        </span>
        <span className="mt-0.5 text-xs text-muted-foreground">
          {display.normalizedPercentage >= 99.5 ? "Full" : "used"}
        </span>
      </div>
    </div>
  );
}

function ReportFact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

/** An em dash, not "0" - see the file header on why the distinction matters. */
function optionalTokens(value: number | null | undefined): string {
  return value == null ? "—" : formatContextWindowTokens(value);
}

function ExplorerRow({
  label,
  detail,
  value,
  accentClassName,
}: {
  readonly label: string;
  readonly detail: string;
  readonly value: number | null | undefined;
  readonly accentClassName: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
      <span className={cn("size-2 shrink-0 rounded-sm", accentClassName)} />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-foreground">{label}</div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</div>
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {optionalTokens(value)}
      </span>
    </div>
  );
}

export function ContextUsagePanel({ threadRef }: { readonly threadRef: ScopedThreadRef | null }) {
  const shell = useThreadShell(threadRef);
  const activities = useThreadActivities(threadRef);
  const draft = useComposerDraftModelState(threadRef ?? DraftId.make(""));
  const selectedModelSelection = useMemo(() => {
    if (draft.activeProvider) {
      return draft.modelSelectionByProvider[draft.activeProvider] ?? shell?.modelSelection ?? null;
    }
    return shell?.modelSelection ?? null;
  }, [draft.activeProvider, draft.modelSelectionByProvider, shell?.modelSelection]);
  const usage = useMemo(
    () =>
      resolveVisibleContextWindowSnapshot({
        activities,
        selectedModelSelection,
        persistedModelSelection: shell?.modelSelection,
        hasStartedSession: shell?.session !== null && shell?.session !== undefined,
      }),
    [activities, selectedModelSelection, shell?.modelSelection, shell?.session],
  );
  const cost = useMemo(() => deriveCumulativeCostUsd(activities), [activities]);
  const threadTitle = shell?.title || "Current thread";

  const display = deriveContextWindowMeterDisplay(usage);
  const isNearLimit = display.normalizedPercentage >= 80;
  const totalProcessed = usage.totalProcessedTokens ?? usage.inputTokens ?? usage.usedTokens;

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto" aria-live="polite">
      <div className="mx-auto w-full max-w-2xl p-6 sm:p-8">
        <header className="border-b border-border/60 pb-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ChartColumnIcon className="size-3.5" />
            Context Usage Report
          </div>
          <h1 className="mt-2 truncate text-xl font-semibold tracking-tight text-foreground">
            {threadTitle}
          </h1>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <ReportFact label="Context size" value={optionalTokens(usage.maxTokens)} />
            <ReportFact label="Tokens used" value={formatContextWindowTokens(usage.usedTokens)} />
            <ReportFact label="Remaining" value={optionalTokens(usage.remainingTokens)} />
            <ReportFact label="Processed" value={optionalTokens(totalProcessed)} />
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

        <section className="mt-8 border-t border-border/60 pt-6">
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
              value={usage.inputTokens}
              accentClassName="bg-info"
            />
            <ExplorerRow
              label="Cached input"
              detail="Previously processed context reused by the model"
              value={usage.cachedInputTokens}
              accentClassName="bg-success"
            />
            <ExplorerRow
              label="Output"
              detail="Assistant response tokens"
              value={usage.outputTokens}
              accentClassName="bg-primary"
            />
            <ExplorerRow
              label="Reasoning"
              detail="Model reasoning tokens, when the provider reports them"
              value={usage.reasoningOutputTokens}
              accentClassName="bg-warning"
            />
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border/60 pt-6 sm:grid-cols-4">
          <ReportFact label="Last input" value={optionalTokens(usage.lastInputTokens)} />
          <ReportFact label="Last output" value={optionalTokens(usage.lastOutputTokens)} />
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
