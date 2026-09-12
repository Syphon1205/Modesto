import type { ConversationMode, OrchestrationLatestTurn, ThreadId } from "@modesto/contracts";

export type SpawnedThreadKind = "side" | "multiagent";

export type SpawnedThreadLike = {
  readonly id: ThreadId;
  readonly title: string;
  readonly parentThreadId?: ThreadId | null | undefined;
  readonly conversationMode?: ConversationMode;
  readonly archivedAt?: string | null;
  readonly deletedAt?: string | null;
  readonly latestTurn?: OrchestrationLatestTurn | null;
  readonly createdAt: string;
};

export function threadParentId(thread: Pick<SpawnedThreadLike, "parentThreadId">): ThreadId | null {
  return thread.parentThreadId ?? null;
}

export function spawnedThreadKind(
  thread: Pick<SpawnedThreadLike, "conversationMode">,
): SpawnedThreadKind {
  return thread.conversationMode === "chat" ? "side" : "multiagent";
}

export function spawnedThreadRoleLabel(kind: SpawnedThreadKind): string {
  return kind === "side" ? "Sidechat" : "Multi-Agent";
}

export function isAttachedSidechat(
  thread: Pick<SpawnedThreadLike, "parentThreadId" | "conversationMode">,
): boolean {
  return threadParentId(thread) !== null && spawnedThreadKind(thread) === "side";
}

export function selectSpawnedThreadsForParent<T extends SpawnedThreadLike>(
  threads: ReadonlyArray<T>,
  parentThreadId: ThreadId,
): T[] {
  return threads
    .filter((thread) => {
      if (threadParentId(thread) !== parentThreadId) return false;
      if (thread.deletedAt != null) return false;
      if (thread.archivedAt != null) return false;
      return true;
    })
    .slice()
    .toSorted(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    );
}

export function spawnedThreadIsLive(thread: Pick<SpawnedThreadLike, "latestTurn">): boolean {
  return thread.latestTurn?.state === "running";
}

export function spawnedThreadStatusLabel(thread: Pick<SpawnedThreadLike, "latestTurn">): string {
  switch (thread.latestTurn?.state) {
    case "running":
      return "Working";
    case "completed":
      return "Completed";
    case "error":
      return "Failed";
    case "interrupted":
      return "Stopped";
    default:
      return "Ready";
  }
}
