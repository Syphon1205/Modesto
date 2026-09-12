import type { AgentAvatarSpec, EnvironmentId, ThreadId } from "@modesto/contracts";
import {
  type AgentAwarenessPhase,
  type AgentAwarenessState,
  projectThreadAwareness,
} from "@modesto/shared/agentAwareness";

/**
 * Soft presence chip for the ambient overlay. Thread bubbles come from
 * `projectThreadAwareness`; optional live subagent summaries ride alongside
 * when a surface publishes them (Agents panel / ChatView).
 */
export interface AmbientBubble {
  readonly id: string;
  readonly kind: "thread" | "subagent";
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  /** Parent thread for subagent chips; equals `threadId` for thread chips. */
  readonly parentThreadId: ThreadId;
  readonly label: string;
  readonly title: string;
  readonly subtitle: string;
  readonly phase: AgentAwarenessPhase;
  readonly deepLink: string;
  readonly updatedAt: string;
  /**
   * The face of the agent bot that started this thread, when one did. Absent
   * for ordinary threads and for subagents — the orb then shows the colour
   * wash it has always shown.
   */
  readonly avatar?: AgentAvatarSpec | null;
}

export interface AmbientLiveSubagentSummary {
  readonly id: string;
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly title: string;
  readonly status:
    | "pending"
    | "running"
    | "waiting"
    | "idle"
    | "completed"
    | "failed"
    | "cancelled"
    | "interrupted";
  readonly progress?: string | null;
  readonly updatedAt: string;
}

export interface AmbientBubbleSourceThread {
  readonly environmentId: EnvironmentId;
  readonly projectTitle: string;
  readonly thread: Parameters<typeof projectThreadAwareness>[0]["thread"];
  /** Set by the presence layer when this thread belongs to an agent bot. */
  readonly avatar?: AgentAvatarSpec | null;
}

/** Map awareness / subagent phase → a stable CSS token for the bubble ring. */
export type AmbientBubbleTone = "neutral" | "active" | "waiting" | "success" | "danger" | "stale";

export function ambientBubbleToneForPhase(phase: AgentAwarenessPhase): AmbientBubbleTone {
  switch (phase) {
    case "starting":
    case "running":
      return "active";
    case "waiting_for_approval":
    case "waiting_for_input":
      return "waiting";
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "stale":
      return "stale";
  }
}

/** Hex colors for the desktop overlay (no app CSS variables available there). */
export function ambientBubbleHexForTone(tone: AmbientBubbleTone): string {
  switch (tone) {
    case "active":
      return "#3b82f6";
    case "waiting":
      return "#f59e0b";
    case "success":
      return "#22c55e";
    case "danger":
      return "#ef4444";
    case "stale":
      return "#94a3b8";
    case "neutral":
      return "#64748b";
  }
}

export function ambientBubbleInitial(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0) return "?";
  const grapheme = [...trimmed][0];
  return grapheme?.toLocaleUpperCase() ?? "?";
}

/**
 * Relay deep links use `/threads/:env/:thread`; the web router is
 * `/:environmentId/:threadId`. Prefer env+thread ids when navigating in-app.
 */
export function ambientBubbleRoutePath(
  bubble: Pick<AmbientBubble, "environmentId" | "threadId" | "deepLink">,
): string {
  return `/${encodeURIComponent(bubble.environmentId)}/${encodeURIComponent(bubble.threadId)}`;
}

export function awarenessStateToAmbientBubble(state: AgentAwarenessState): AmbientBubble {
  return {
    id: `thread:${state.environmentId}:${state.threadId}`,
    kind: "thread",
    environmentId: state.environmentId,
    threadId: state.threadId,
    parentThreadId: state.threadId,
    label: ambientBubbleInitial(state.threadTitle || state.projectTitle),
    title: state.threadTitle,
    subtitle: state.headline,
    phase: state.phase,
    deepLink: state.deepLink,
    updatedAt: state.updatedAt,
  };
}

export function liveSubagentStatusToPhase(
  status: AmbientLiveSubagentSummary["status"],
): AgentAwarenessPhase {
  switch (status) {
    case "pending":
      return "starting";
    case "running":
    case "idle":
      return "running";
    case "waiting":
      return "waiting_for_input";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
    case "interrupted":
      return "stale";
  }
}

export function liveSubagentToAmbientBubble(summary: AmbientLiveSubagentSummary): AmbientBubble {
  const phase = liveSubagentStatusToPhase(summary.status);
  const progress = summary.progress?.trim();
  return {
    id: `subagent:${summary.environmentId}:${summary.threadId}:${summary.id}`,
    kind: "subagent",
    environmentId: summary.environmentId,
    threadId: summary.threadId,
    parentThreadId: summary.threadId,
    label: ambientBubbleInitial(summary.title),
    title: summary.title,
    subtitle: progress && progress.length > 0 ? progress : headlineForLiveSubagent(summary.status),
    phase,
    deepLink: `/threads/${encodeURIComponent(summary.environmentId)}/${encodeURIComponent(summary.threadId)}`,
    updatedAt: summary.updatedAt,
  };
}

function headlineForLiveSubagent(status: AmbientLiveSubagentSummary["status"]): string {
  switch (status) {
    case "pending":
      return "Subagent starting";
    case "running":
      return "Subagent working";
    case "waiting":
      return "Subagent waiting";
    case "idle":
      return "Subagent idle";
    case "completed":
      return "Subagent finished";
    case "failed":
      return "Subagent failed";
    case "cancelled":
      return "Subagent cancelled";
    case "interrupted":
      return "Subagent interrupted";
  }
}

/**
 * Build the ambient bubble list from project thread shells (+ optional live
 * subagent summaries). Only live/terminal awareness phases are included —
 * idle threads with no session/turn stay out of the cluster.
 */
export function buildAmbientBubbles(input: {
  readonly threads: ReadonlyArray<AmbientBubbleSourceThread>;
  readonly liveSubagents?: ReadonlyArray<AmbientLiveSubagentSummary>;
}): ReadonlyArray<AmbientBubble> {
  const threadBubbles: AmbientBubble[] = [];
  for (const entry of input.threads) {
    const state = projectThreadAwareness({
      environmentId: entry.environmentId,
      project: { title: entry.projectTitle },
      thread: entry.thread,
    });
    if (state) {
      const bubble = awarenessStateToAmbientBubble(state);
      threadBubbles.push(entry.avatar ? { ...bubble, avatar: entry.avatar } : bubble);
    }
  }

  const live = input.liveSubagents ?? [];
  const liveBubbles = live
    .filter((summary) => summary.status !== "completed" && summary.status !== "cancelled")
    .map(liveSubagentToAmbientBubble);

  return [...threadBubbles, ...liveBubbles].toSorted((a, b) => {
    const phaseRank = ambientPhaseSortRank(a.phase) - ambientPhaseSortRank(b.phase);
    if (phaseRank !== 0) return phaseRank;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function ambientPhaseSortRank(phase: AgentAwarenessPhase): number {
  switch (phase) {
    case "waiting_for_approval":
      return 0;
    case "waiting_for_input":
      return 1;
    case "running":
      return 2;
    case "starting":
      return 3;
    case "failed":
      return 4;
    case "stale":
      return 5;
    case "completed":
      return 6;
  }
}
