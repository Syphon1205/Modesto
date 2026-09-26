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

export type SpawnedThreadTreeEntry<T extends SpawnedThreadLike> = {
  readonly thread: T;
  readonly depth: number;
};

/**
 * Flatten an attached-session tree in stable spawn order.
 *
 * A spawned thread can run `/multiagent` itself, so consumers must not stop
 * at the first generation. The visited set also makes old/corrupt parent
 * cycles harmless instead of recursing forever in the sidebar.
 */
export function selectSpawnedThreadTree<T extends SpawnedThreadLike>(
  threads: ReadonlyArray<T>,
  parentThreadId: ThreadId,
): Array<SpawnedThreadTreeEntry<T>> {
  const childrenByParent = new Map<ThreadId, T[]>();
  for (const thread of threads) {
    const parentId = threadParentId(thread);
    if (parentId === null || thread.deletedAt != null || thread.archivedAt != null) continue;
    const children = childrenByParent.get(parentId);
    if (children) children.push(thread);
    else childrenByParent.set(parentId, [thread]);
  }
  for (const children of childrenByParent.values()) {
    children.sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    );
  }

  const result: Array<SpawnedThreadTreeEntry<T>> = [];
  const visited = new Set<ThreadId>([parentThreadId]);
  const visit = (parentId: ThreadId, depth: number) => {
    for (const child of childrenByParent.get(parentId) ?? []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      result.push({ thread: child, depth });
      visit(child.id, depth + 1);
    }
  };
  visit(parentThreadId, 0);
  return result;
}

/** All currently running attached sessions, independent of chat/code mode. */
export function selectActiveSpawnedThreads<T extends SpawnedThreadLike>(
  threads: ReadonlyArray<T>,
): T[] {
  return threads
    .filter(
      (thread) =>
        threadParentId(thread) !== null &&
        thread.deletedAt == null &&
        thread.archivedAt == null &&
        spawnedThreadIsLive(thread),
    )
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
