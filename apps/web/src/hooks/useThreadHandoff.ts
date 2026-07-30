// FILE: useThreadHandoff.ts
// Purpose: Creates provider-to-provider handoff threads from the active web state.
// Layer: Web hook
// Exports: useThreadHandoff

import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { type ProviderKind } from "@modesto/contracts";
import { formatSharedContextNarrative } from "@modesto/shared/sharedContext";
import { resolveThreadWorkspaceCwd } from "@modesto/shared/threadEnvironment";
import { useComposerDraftStore } from "../composerDraftStore";
import { useProviderStatusesForLocalConfig } from "./useProviderStatusesForLocalConfig";
import { useRefreshProviderStatusesNow } from "./useProviderStatusRefresh";
import {
  buildDefaultHandoffObjective,
  buildDefaultHandoffSummary,
  buildContextAwareHandoffSummary,
  buildHandoffUnfinishedSteps,
  buildThreadHandoffImportedActivities,
  buildThreadHandoffImportedMessages,
  buildThreadHandoffRepoSnapshotFromGit,
  canCreateThreadHandoff,
  resolveAvailableHandoffTargetProviders,
  resolveHandoffDiffAckStatus,
  resolveThreadHandoffModelSelection,
  resolveThreadHandoffTitle,
  type ThreadHandoffDraft,
  type ThreadHandoffReturnDraft,
} from "../lib/threadHandoff";
import { resolveProviderSendAvailabilityWithRefresh } from "../lib/providerAvailability";
import { newCommandId, newThreadId } from "../lib/utils";
import { readNativeApi } from "../nativeApi";
import { useStore } from "../store";
import { type Project, type Thread } from "../types";

async function captureHandoffRepoSnapshot(input: {
  readonly cwd: string;
  readonly worktreePath: string | null;
  readonly branch: string | null;
}) {
  const api = readNativeApi();
  if (!api) {
    return null;
  }

  const status = await api.git.status({ cwd: input.cwd });
  let diffSummaryMarkdown: string | null = null;
  if (status.hasWorkingTreeChanges) {
    try {
      const diff = await api.git.readWorkingTreeDiff({
        cwd: input.cwd,
        scope: "workingTree",
      });
      if (diff.patch.trim().length > 0) {
        const summary = await api.git.summarizeDiff({
          cwd: input.cwd,
          patch: diff.patch,
        });
        diffSummaryMarkdown = summary.summary;
      }
    } catch {
      diffSummaryMarkdown = null;
    }
  }

  return buildThreadHandoffRepoSnapshotFromGit({
    status,
    diffSummaryMarkdown,
    worktreePath: input.worktreePath,
    capturedAt: new Date().toISOString(),
  });
}

export function prepareThreadHandoffDraft(
  thread: Thread,
  targetProvider: ProviderKind,
): Omit<ThreadHandoffDraft, "repoSnapshot" | "diffAckStatus" | "repoSnapshotLoading"> {
  const latestDeclaredCheckpoint = thread.activities
    .toReversed()
    .find((activity) => activity.kind === "agent.checkpoint.declared");
  const checkpointPayload =
    latestDeclaredCheckpoint?.payload &&
    typeof latestDeclaredCheckpoint.payload === "object" &&
    !Array.isArray(latestDeclaredCheckpoint.payload)
      ? (latestDeclaredCheckpoint.payload as Record<string, unknown>)
      : null;
  const checkpointIncomplete = Array.isArray(checkpointPayload?.incomplete)
    ? checkpointPayload.incomplete.filter((value): value is string => typeof value === "string")
    : [];
  const checkpointNotRun = Array.isArray(checkpointPayload?.notRun)
    ? checkpointPayload.notRun.filter((value): value is string => typeof value === "string")
    : [];
  const checkpointNextStep =
    typeof checkpointPayload?.nextStep === "string" ? checkpointPayload.nextStep.trim() : "";
  const checkpointSteps = [
    ...checkpointIncomplete.map((text, index) => ({
      id: `checkpoint:incomplete:${index}`,
      text,
      status: "todo" as const,
    })),
    ...checkpointNotRun.map((text, index) => ({
      id: `checkpoint:not-run:${index}`,
      text: `Not run: ${text}`,
      status: "blocked" as const,
    })),
  ];
  return {
    sourceThread: thread,
    targetProvider,
    summary: latestDeclaredCheckpoint?.summary ?? buildDefaultHandoffSummary(thread),
    objective: checkpointNextStep || buildDefaultHandoffObjective(thread),
    unfinishedSteps:
      checkpointSteps.length > 0 ? checkpointSteps : buildHandoffUnfinishedSteps(thread),
  };
}

export function useThreadHandoff() {
  const navigate = useNavigate();
  const projects = useStore((store) => store.projects);
  const syncServerShellSnapshot = useStore((store) => store.syncServerShellSnapshot);
  const providerStatuses = useProviderStatusesForLocalConfig();
  const refreshProviderStatuses = useRefreshProviderStatusesNow();
  const [handoffDialogOpen, setHandoffDialogOpen] = useState(false);
  const [handoffDraft, setHandoffDraft] = useState<ThreadHandoffDraft | null>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnDraft, setReturnDraft] = useState<ThreadHandoffReturnDraft | null>(null);
  const [handoffBusy, setHandoffBusy] = useState(false);

  const resolveProjectForThread = useCallback(
    (thread: Thread): Project | undefined =>
      projects.find((entry) => entry.id === thread.projectId),
    [projects],
  );

  const resolveThreadGitCwd = useCallback(
    (thread: Thread, project: Project | undefined): string | null => {
      if (!project) {
        return null;
      }
      return resolveThreadWorkspaceCwd({
        projectCwd: project.cwd,
        envMode: thread.envMode ?? (thread.worktreePath ? "worktree" : "local"),
        worktreePath: thread.worktreePath ?? null,
      });
    },
    [],
  );

  const loadRepoSnapshotIntoDraft = useCallback(
    async (input: {
      readonly cwd: string | null;
      readonly worktreePath: string | null;
      readonly branch: string | null;
      readonly apply: (repoSnapshot: ThreadHandoffDraft["repoSnapshot"]) => void;
    }) => {
      if (!input.cwd) {
        input.apply(null);
        return;
      }
      try {
        const repoSnapshot = await captureHandoffRepoSnapshot({
          cwd: input.cwd,
          worktreePath: input.worktreePath,
          branch: input.branch,
        });
        input.apply(repoSnapshot);
      } catch {
        input.apply(null);
      }
    },
    [],
  );

  const openHandoffDialog = useCallback(
    async (
      thread: Thread,
      targetProvider: ProviderKind,
      options: { readonly summary?: string } = {},
    ) => {
      const project = resolveProjectForThread(thread);
      if (!project) {
        throw new Error("Project not found for handoff thread.");
      }
      if (!canCreateThreadHandoff({ thread })) {
        throw new Error("This thread cannot be handed off yet.");
      }
      if (
        !resolveAvailableHandoffTargetProviders(thread.modelSelection.provider).includes(
          targetProvider,
        )
      ) {
        throw new Error("This handoff target is not available for the current thread.");
      }
      const targetAvailability = await resolveProviderSendAvailabilityWithRefresh({
        provider: targetProvider,
        statuses: providerStatuses,
        refreshStatuses: () => refreshProviderStatuses({ silent: true }),
      });
      if (!targetAvailability.usable) {
        throw new Error(targetAvailability.unavailableReason);
      }

      const baseDraft = prepareThreadHandoffDraft(thread, targetProvider);
      const initialDraft: ThreadHandoffDraft = {
        ...baseDraft,
        ...(options.summary?.trim() ? { summary: options.summary.trim() } : {}),
        repoSnapshot: null,
        diffAckStatus: "not_required",
        repoSnapshotLoading: true,
      };
      setHandoffDraft(initialDraft);
      setHandoffDialogOpen(true);

      const cwd = resolveThreadGitCwd(thread, project);
      void loadRepoSnapshotIntoDraft({
        cwd,
        worktreePath: thread.worktreePath ?? null,
        branch: thread.branch ?? null,
        apply: (repoSnapshot) => {
          setHandoffDraft((current) => {
            if (!current || current.sourceThread.id !== thread.id) {
              return current;
            }
            return {
              ...current,
              repoSnapshot,
              diffAckStatus: resolveHandoffDiffAckStatus({ repoSnapshot }),
              repoSnapshotLoading: false,
            };
          });
        },
      });
    },
    [
      loadRepoSnapshotIntoDraft,
      providerStatuses,
      refreshProviderStatuses,
      resolveProjectForThread,
      resolveThreadGitCwd,
    ],
  );

  const confirmThreadHandoff = useCallback(
    async (draft: ThreadHandoffDraft): Promise<Thread["id"]> => {
      const api = readNativeApi();
      if (!api) {
        throw new Error("Native API not found");
      }

      const thread = draft.sourceThread;
      const project = resolveProjectForThread(thread);
      if (!project) {
        throw new Error("Project not found for handoff thread.");
      }

      setHandoffBusy(true);
      try {
        const nextThreadId = newThreadId();
        const createdAt = new Date().toISOString();
        const importedMessages = buildThreadHandoffImportedMessages(thread);
        const importedActivities = buildThreadHandoffImportedActivities(thread);
        const contextBundle = await api.orchestration
          .getSharedContextBundle({ threadId: thread.id })
          .catch(() => null);
        const contextNarrative = contextBundle ? formatSharedContextNarrative(contextBundle) : null;
        const { copyTransferableComposerState, stickyModelSelectionByProvider } =
          useComposerDraftStore.getState();
        const normalizedSteps = draft.unfinishedSteps
          .map((step) => ({
            ...step,
            text: step.text.trim(),
          }))
          .filter((step) => step.text.length > 0);

        const cwd = resolveThreadGitCwd(thread, project);
        const checkpointCapture = cwd
          ? await api.orchestration
              .captureHandoffCheckpoint({
                cwd,
                sourceThreadId: thread.id,
                destThreadId: nextThreadId,
              })
              .catch(() => ({
                checkpointRef: null,
                baseCheckpointRef: null,
                baseHeadSha: null,
                checkpointStatus: "missing" as const,
                unchanged: false,
              }))
          : {
              checkpointRef: null,
              baseCheckpointRef: null,
              baseHeadSha: null,
              checkpointStatus: "not_applicable" as const,
              unchanged: false,
            };

        await api.orchestration.dispatchCommand({
          type: "thread.handoff.create",
          commandId: newCommandId(),
          threadId: nextThreadId,
          sourceThreadId: thread.id,
          projectId: thread.projectId,
          title: resolveThreadHandoffTitle(thread),
          modelSelection: resolveThreadHandoffModelSelection({
            sourceThread: thread,
            targetProvider: draft.targetProvider,
            projectDefaultModelSelection: project.defaultModelSelection,
            stickyModelSelectionByProvider,
          }),
          runtimeMode: thread.runtimeMode,
          interactionMode: thread.interactionMode,
          envMode: thread.envMode ?? (thread.worktreePath ? "worktree" : "local"),
          branch: thread.branch,
          worktreePath: thread.worktreePath,
          associatedWorktreePath: thread.associatedWorktreePath ?? thread.worktreePath ?? null,
          associatedWorktreeBranch: thread.associatedWorktreeBranch ?? thread.branch ?? null,
          associatedWorktreeRef:
            thread.associatedWorktreeRef ??
            thread.associatedWorktreeBranch ??
            thread.branch ??
            null,
          createBranchFlowCompleted: thread.createBranchFlowCompleted ?? false,
          importedMessages: [...importedMessages],
          summary: buildContextAwareHandoffSummary(draft.summary, contextNarrative),
          objective: draft.objective.trim(),
          unfinishedSteps: normalizedSteps,
          contextNarrative,
          contextArtifactIds: contextBundle?.artifacts.map((artifact) => artifact.id) ?? [],
          repoSnapshot: draft.repoSnapshot,
          diffAckStatus: draft.diffAckStatus,
          checkpointRef: checkpointCapture.checkpointRef,
          baseCheckpointRef: checkpointCapture.baseCheckpointRef,
          baseHeadSha: checkpointCapture.baseHeadSha ?? draft.repoSnapshot?.headSha ?? null,
          checkpointStatus: checkpointCapture.checkpointStatus,
          createdAt,
        });

        for (const activity of importedActivities) {
          await api.orchestration.dispatchCommand({
            type: "thread.activity.append",
            commandId: newCommandId(),
            threadId: nextThreadId,
            activity,
            createdAt,
          });
        }

        copyTransferableComposerState(thread.id, nextThreadId);

        const snapshot = await api.orchestration.getShellSnapshot();
        syncServerShellSnapshot(snapshot);
        setHandoffDialogOpen(false);
        setHandoffDraft(null);
        await navigate({
          to: "/$threadId",
          params: { threadId: nextThreadId },
        });

        return nextThreadId;
      } finally {
        setHandoffBusy(false);
      }
    },
    [navigate, resolveProjectForThread, resolveThreadGitCwd, syncServerShellSnapshot],
  );

  const openReturnDialog = useCallback(
    async (thread: Thread) => {
      if (!thread.handoff) {
        throw new Error("This thread is not a handoff target.");
      }
      const project = resolveProjectForThread(thread);
      const initialDraft: ThreadHandoffReturnDraft = {
        fromThread: thread,
        sourceThreadId: thread.handoff.sourceThreadId,
        summary: buildDefaultHandoffSummary(thread),
        repoSnapshot: null,
        completedStepIds: [],
        repoSnapshotLoading: true,
      };
      setReturnDraft(initialDraft);
      setReturnDialogOpen(true);

      const cwd = resolveThreadGitCwd(thread, project);
      void loadRepoSnapshotIntoDraft({
        cwd,
        worktreePath: thread.worktreePath ?? null,
        branch: thread.branch ?? null,
        apply: (repoSnapshot) => {
          setReturnDraft((current) => {
            if (!current || current.fromThread.id !== thread.id) {
              return current;
            }
            return {
              ...current,
              repoSnapshot,
              repoSnapshotLoading: false,
            };
          });
        },
      });
    },
    [loadRepoSnapshotIntoDraft, resolveProjectForThread, resolveThreadGitCwd],
  );

  const confirmThreadHandoffReturn = useCallback(
    async (draft: ThreadHandoffReturnDraft): Promise<Thread["id"]> => {
      const api = readNativeApi();
      if (!api) {
        throw new Error("Native API not found");
      }

      setHandoffBusy(true);
      try {
        const createdAt = new Date().toISOString();
        await api.orchestration.dispatchCommand({
          type: "thread.handoff.return",
          commandId: newCommandId(),
          sourceThreadId: draft.sourceThreadId,
          fromThreadId: draft.fromThread.id,
          summary: draft.summary.trim(),
          repoSnapshot: draft.repoSnapshot,
          completedStepIds: [...draft.completedStepIds],
          createdAt,
        });

        const snapshot = await api.orchestration.getShellSnapshot();
        syncServerShellSnapshot(snapshot);
        setReturnDialogOpen(false);
        setReturnDraft(null);
        await navigate({
          to: "/$threadId",
          params: { threadId: draft.sourceThreadId },
        });
        return draft.sourceThreadId;
      } finally {
        setHandoffBusy(false);
      }
    },
    [navigate, syncServerShellSnapshot],
  );

  return {
    handoffBusy,
    handoffDialogOpen,
    setHandoffDialogOpen,
    handoffDraft,
    setHandoffDraft,
    openHandoffDialog,
    confirmThreadHandoff,
    returnDialogOpen,
    setReturnDialogOpen,
    returnDraft,
    setReturnDraft,
    openReturnDialog,
    confirmThreadHandoffReturn,
  };
}
