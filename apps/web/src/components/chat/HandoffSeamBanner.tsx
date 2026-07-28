// FILE: HandoffSeamBanner.tsx
// Purpose: Destination-thread handoff seam card — provider pair, structured note, review actions.
// Layer: Chat status presentation

import { memo } from "react";
import { PROVIDER_DISPLAY_NAMES, type ProviderKind } from "@modesto/contracts";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import {
  EXPANDED_NOTIFICATION_SURFACE_CLASS_NAME,
  NOTIFICATION_ICON_CLASS_NAME,
} from "../ui/notificationSurface";
import { ChangesIcon, Undo2Icon } from "~/lib/icons";
import {
  buildHandoffSeamPresentation,
  hasNativeThreadHandoffMessages,
} from "~/lib/threadHandoff";
import { cn } from "~/lib/utils";
import { ProviderIcon } from "../ProviderIcon";
import { ChatColumnBannerFrame } from "./ChatColumnBannerFrame";
import type { Thread } from "../../types";

function SeamNoteLines({
  label,
  lines,
}: {
  readonly label: string;
  readonly lines: ReadonlyArray<string>;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="grid gap-1">
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--notification-fg)]/55">
        {label}
      </div>
      <ul className="grid gap-1 text-[var(--notification-fg)]/80">
        {lines.map((line) => (
          <li key={`${label}:${line}`} className="leading-snug">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const HandoffSeamBanner = memo(function HandoffSeamBanner({
  thread,
  activeProvider,
  busy = false,
  onAcknowledgeDiff,
  onInsertAckPrompt,
  onOpenReturnDialog,
  onInspectCheckpoint,
  onRollbackCheckpoint,
}: {
  thread: Thread | null | undefined;
  activeProvider: ProviderKind;
  busy?: boolean;
  onAcknowledgeDiff: () => void;
  onInsertAckPrompt: () => void;
  onOpenReturnDialog: () => void;
  onInspectCheckpoint?: () => void;
  onRollbackCheckpoint?: () => void;
}) {
  const handoff = thread?.handoff;
  if (!thread || !handoff) {
    return null;
  }

  const presentation = buildHandoffSeamPresentation({
    handoff,
    targetProvider: activeProvider,
  });
  const needsDiffAck = handoff.diffAckStatus === "pending";
  const canReturn =
    hasNativeThreadHandoffMessages(thread) && handoff.bootstrapStatus === "completed";
  const sourceLabel = presentation.fromLabel;
  const targetLabel = presentation.toLabel ?? PROVIDER_DISPLAY_NAMES[activeProvider];
  const canInspect = presentation.canInspectCheckpoint && Boolean(onInspectCheckpoint);
  const canRollback = presentation.canRollbackCheckpoint && Boolean(onRollbackCheckpoint);
  const showActions = needsDiffAck || canReturn || canInspect || canRollback;

  return (
    <ChatColumnBannerFrame>
      <Alert
        className={cn(EXPANDED_NOTIFICATION_SURFACE_CLASS_NAME)}
        variant={needsDiffAck ? "warning" : "info"}
      >
        <ChangesIcon className={NOTIFICATION_ICON_CLASS_NAME} />
        <AlertTitle className="font-normal text-[var(--notification-fg)]">
          <span className="inline-flex items-center gap-1.5">
            <ProviderIcon provider={handoff.sourceProvider} className="size-3.5" />
            <span className="text-[var(--notification-fg)]/55">→</span>
            <ProviderIcon provider={activeProvider} className="size-3.5" />
            <span>
              {sourceLabel} → {targetLabel}
            </span>
          </span>
        </AlertTitle>
        <AlertDescription className="grid gap-3 text-[var(--notification-fg)]/72">
          <p className="text-[11px] leading-relaxed text-[var(--notification-fg)]/60">
            Declared handoff seam. Prefer this note and the live repo over older imported chat.
          </p>
          <SeamNoteLines label="Done" lines={presentation.doneLines} />
          <SeamNoteLines label="Incomplete" lines={presentation.incompleteLines} />
          <SeamNoteLines label="Next" lines={presentation.nextLines} />
          {presentation.repoLine ? (
            <p className="font-mono text-[11px] text-[var(--notification-fg)]/65">
              {presentation.repoLine}
            </p>
          ) : null}
          {presentation.checkpointLine ? (
            <p className="text-[11px] text-[var(--notification-fg)]/65">
              {presentation.checkpointLine}
            </p>
          ) : null}
          {needsDiffAck ? (
            <p>
              Uncommitted changes came with this handoff. Review the diff before continuing
              implementation.
            </p>
          ) : null}
        </AlertDescription>
        {showActions ? (
          <AlertAction className="mt-2 flex flex-wrap gap-2">
            {canInspect ? (
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={busy}
                onClick={onInspectCheckpoint}
              >
                Inspect seam
              </Button>
            ) : null}
            {needsDiffAck ? (
              <>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={busy}
                  onClick={onInsertAckPrompt}
                >
                  Ask agent to review diff
                </Button>
                <Button type="button" size="xs" disabled={busy} onClick={onAcknowledgeDiff}>
                  Continue
                </Button>
              </>
            ) : null}
            {canRollback ? (
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={busy}
                onClick={onRollbackCheckpoint}
              >
                Rollback to seam
              </Button>
            ) : null}
            {canReturn ? (
              <Button
                type="button"
                size="xs"
                variant={needsDiffAck || canInspect || canRollback ? "outline" : "default"}
                disabled={busy}
                onClick={onOpenReturnDialog}
              >
                <Undo2Icon className="size-3.5" />
                Return to {sourceLabel}
              </Button>
            ) : null}
          </AlertAction>
        ) : null}
      </Alert>
    </ChatColumnBannerFrame>
  );
});
