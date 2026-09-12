import {
  buildCoreContext,
  CORE_CONTEXT_DEFAULT_TITLE,
  formatCoreContextBlock,
  hasReplayableCoreContextMessages,
  shouldCarryCoreContext,
  type CoreContext,
  type CoreContextCheckpoint,
  type CoreContextReason,
} from "@modesto/shared/coreContext";

export function coreContextFromThread(
  thread: {
    readonly title: string;
    readonly messages: ReadonlyArray<{ readonly role: string; readonly text: string }>;
    readonly proposedPlans?: ReadonlyArray<{
      readonly planMarkdown: string;
      readonly implementedAt: string | null;
    }>;
    readonly checkpoints?: ReadonlyArray<{
      readonly checkpointTurnCount: number;
      readonly checkpointRef: string;
      readonly files: ReadonlyArray<{
        readonly path: string;
        readonly additions: number;
        readonly deletions: number;
      }>;
    }>;
  },
  reason: CoreContextReason,
  latestCheckpoint?: CoreContextCheckpoint | null,
): CoreContext {
  const checkpoint = latestCheckpoint ?? thread.checkpoints?.at(-1) ?? null;
  return buildCoreContext({
    title: thread.title,
    defaultTitle: CORE_CONTEXT_DEFAULT_TITLE,
    messages: thread.messages,
    proposedPlans: thread.proposedPlans ?? [],
    latestCheckpoint: checkpoint
      ? {
          checkpointTurnCount: checkpoint.checkpointTurnCount,
          checkpointRef: checkpoint.checkpointRef,
          files: checkpoint.files.map((file) => ({
            path: file.path,
            additions: file.additions,
            deletions: file.deletions,
          })),
        }
      : null,
    reason,
  });
}

export function formatThreadCoreContext(
  thread: Parameters<typeof coreContextFromThread>[0],
  reason: CoreContextReason,
  options?: {
    readonly latestCheckpoint?: CoreContextCheckpoint | null;
    readonly excludeTrailingText?: string;
  },
): string {
  const coreContext = coreContextFromThread(thread, reason, options?.latestCheckpoint);
  return shouldCarryCoreContext(
    coreContext,
    hasReplayableCoreContextMessages(thread.messages, options?.excludeTrailingText),
  )
    ? formatCoreContextBlock(coreContext)
    : "";
}
