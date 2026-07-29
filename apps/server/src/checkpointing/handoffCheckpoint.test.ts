import { CheckpointRef, ThreadId } from "@modesto/contracts";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  captureAgentHandoffCheckpoint,
  declareAgentCheckpoint,
  diffAgentHandoffCheckpoint,
  restoreAgentHandoffCheckpoint,
} from "./handoffCheckpoint.ts";
import type { CheckpointStoreShape } from "./Services/CheckpointStore.ts";
import {
  AGENT_CHECKPOINT_REFS_PREFIX,
  checkpointRefForAgentHandoffBase,
  checkpointRefForAgentHandoffTree,
  checkpointRefForDeclaredAgentBase,
  checkpointRefForDeclaredAgentTree,
} from "./Utils.ts";

function unusedStore(): CheckpointStoreShape {
  return {
    isGitRepository: () => Effect.die("unused"),
    copyCheckpointRef: () => Effect.die("unused"),
    captureCheckpoint: () => Effect.die("unused"),
    hasCheckpointRef: () => Effect.die("unused"),
    resolveCheckpointTreeOid: () => Effect.die("unused"),
    resolveHeadCommitOid: () => Effect.die("unused"),
    resolveWorkingTreeOid: () => Effect.die("unused"),
    restoreCheckpoint: () => Effect.die("unused"),
    diffCheckpoints: () => Effect.die("unused"),
    reverseCheckpointDiff: () => Effect.die("unused"),
    deleteCheckpointRefs: () => Effect.void,
  };
}

describe("agent handoff checkpoint refs", () => {
  const sourceThreadId = ThreadId.makeUnsafe("thread-source");
  const destThreadId = ThreadId.makeUnsafe("thread-dest");

  it("builds hidden agent-checkpoint refs under the dedicated prefix", () => {
    const tree = checkpointRefForAgentHandoffTree(sourceThreadId, destThreadId);
    const base = checkpointRefForAgentHandoffBase(sourceThreadId, destThreadId);
    expect(tree).toMatch(new RegExp(`^${AGENT_CHECKPOINT_REFS_PREFIX}/`));
    expect(tree.endsWith("/tree")).toBe(true);
    expect(base.endsWith("/base")).toBe(true);
    expect(base.replace(/\/base$/, "/tree")).toBe(tree);
  });
});

describe("handoffCheckpoint helpers", () => {
  const sourceThreadId = ThreadId.makeUnsafe("thread-source");
  const destThreadId = ThreadId.makeUnsafe("thread-dest");
  const treeRef = checkpointRefForAgentHandoffTree(sourceThreadId, destThreadId);
  const baseRef = checkpointRefForAgentHandoffBase(sourceThreadId, destThreadId);

  it("reuses a declared checkpoint without recapturing an unchanged tree", async () => {
    const calls: string[] = [];
    const declaredTreeRef = checkpointRefForDeclaredAgentTree(sourceThreadId);
    const declaredBaseRef = checkpointRefForDeclaredAgentBase(sourceThreadId);
    const store = {
      ...unusedStore(),
      isGitRepository: () => Effect.succeed(true),
      resolveCheckpointTreeOid: () => Effect.succeed("same-tree"),
      resolveWorkingTreeOid: () => Effect.succeed("same-tree"),
      resolveHeadCommitOid: () => Effect.succeed("head-sha"),
      hasCheckpointRef: () => Effect.succeed(true),
      diffCheckpoints: () => Effect.succeed("saved patch"),
      copyCheckpointRef: () =>
        Effect.sync(() => {
          calls.push("copy");
          return true;
        }),
      captureCheckpoint: () =>
        Effect.sync(() => {
          calls.push("capture");
        }),
    } satisfies CheckpointStoreShape;

    const result = await Effect.runPromise(
      declareAgentCheckpoint(store, {
        threadId: sourceThreadId,
        cwd: "/tmp/repo",
        summary: "Feature complete",
        notRun: ["end-to-end tests"],
        incomplete: [],
        nextStep: "Review the diff",
      }),
    );

    expect(result.checkpointRef).toBe(declaredTreeRef);
    expect(result.baseCheckpointRef).toBe(declaredBaseRef);
    expect(result.diff).toBe("saved patch");
    expect(result.unchanged).toBe(true);
    expect(calls).toEqual([]);
  });

  it("captures base+tree refs when cwd is a git repo", async () => {
    const calls: string[] = [];
    const store = {
      ...unusedStore(),
      isGitRepository: () => Effect.succeed(true),
      resolveCheckpointTreeOid: () => Effect.succeed(null),
      resolveHeadCommitOid: () => Effect.succeed("head-sha"),
      resolveWorkingTreeOid: () => Effect.succeed("tree-oid-1"),
      copyCheckpointRef: (input) =>
        Effect.sync(() => {
          calls.push(`copy:${input.fromCheckpointRef}->${input.toCheckpointRef}`);
          return true;
        }),
      captureCheckpoint: (input) =>
        Effect.sync(() => {
          calls.push(`capture:${input.checkpointRef}`);
        }),
      hasCheckpointRef: () => Effect.succeed(true),
      restoreCheckpoint: () => Effect.succeed(true),
      diffCheckpoints: () => Effect.succeed("diff patch"),
      reverseCheckpointDiff: () => Effect.succeed(true),
      deleteCheckpointRefs: () => Effect.void,
    } satisfies CheckpointStoreShape;

    const result = await Effect.runPromise(
      captureAgentHandoffCheckpoint(store, {
        cwd: "/tmp/repo",
        sourceThreadId,
        destThreadId,
      }),
    );

    expect(result).toEqual({
      checkpointRef: treeRef,
      baseCheckpointRef: baseRef,
      baseHeadSha: "head-sha",
      checkpointStatus: "captured",
      unchanged: false,
    });
    expect(calls).toEqual([
      `copy:${CheckpointRef.makeUnsafe("HEAD")}->${baseRef}`,
      `capture:${treeRef}`,
    ]);
  });

  it("no-ops when the working tree already matches the seam checkpoint", async () => {
    const calls: string[] = [];
    const store = {
      ...unusedStore(),
      isGitRepository: () => Effect.succeed(true),
      resolveCheckpointTreeOid: () => Effect.succeed("same-tree"),
      resolveWorkingTreeOid: () => Effect.succeed("same-tree"),
      resolveHeadCommitOid: () => Effect.succeed("head-sha"),
      hasCheckpointRef: () => Effect.succeed(true),
      copyCheckpointRef: () =>
        Effect.sync(() => {
          calls.push("copy");
          return true;
        }),
      captureCheckpoint: () =>
        Effect.sync(() => {
          calls.push("capture");
        }),
    } satisfies CheckpointStoreShape;

    const result = await Effect.runPromise(
      captureAgentHandoffCheckpoint(store, {
        cwd: "/tmp/repo",
        sourceThreadId,
        destThreadId,
      }),
    );

    expect(result).toEqual({
      checkpointRef: treeRef,
      baseCheckpointRef: baseRef,
      baseHeadSha: "head-sha",
      checkpointStatus: "captured",
      unchanged: true,
    });
    expect(calls).toEqual([]);
  });

  it("recaptures when the working tree changed since the last declaration", async () => {
    const calls: string[] = [];
    const store = {
      ...unusedStore(),
      isGitRepository: () => Effect.succeed(true),
      resolveCheckpointTreeOid: () => Effect.succeed("old-tree"),
      resolveWorkingTreeOid: () => Effect.succeed("new-tree"),
      resolveHeadCommitOid: () => Effect.succeed("head-sha"),
      copyCheckpointRef: () =>
        Effect.sync(() => {
          calls.push("copy");
          return true;
        }),
      captureCheckpoint: () =>
        Effect.sync(() => {
          calls.push("capture");
        }),
    } satisfies CheckpointStoreShape;

    const result = await Effect.runPromise(
      captureAgentHandoffCheckpoint(store, {
        cwd: "/tmp/repo",
        sourceThreadId,
        destThreadId,
      }),
    );

    expect(result.unchanged).toBe(false);
    expect(result.checkpointStatus).toBe("captured");
    expect(calls).toEqual(["copy", "capture"]);
  });

  it("returns not_applicable outside a git repo", async () => {
    const store = {
      ...unusedStore(),
      isGitRepository: () => Effect.succeed(false),
    } satisfies CheckpointStoreShape;

    const result = await Effect.runPromise(
      captureAgentHandoffCheckpoint(store, {
        cwd: "/tmp/not-git",
        sourceThreadId,
        destThreadId,
      }),
    );

    expect(result.checkpointStatus).toBe("not_applicable");
    expect(result.checkpointRef).toBeNull();
    expect(result.unchanged).toBe(false);
  });

  it("diffs and restores from a captured handoff", async () => {
    const store = {
      ...unusedStore(),
      isGitRepository: () => Effect.succeed(true),
      copyCheckpointRef: () => Effect.succeed(true),
      captureCheckpoint: () => Effect.void,
      hasCheckpointRef: () => Effect.succeed(true),
      restoreCheckpoint: (input) =>
        Effect.sync(() => {
          expect(input.checkpointRef).toBe(treeRef);
          return true;
        }),
      diffCheckpoints: (input) =>
        Effect.sync(() => {
          expect(input.fromCheckpointRef).toBe(baseRef);
          expect(input.toCheckpointRef).toBe(treeRef);
          return "seam patch";
        }),
      reverseCheckpointDiff: () => Effect.succeed(true),
      deleteCheckpointRefs: () => Effect.void,
    } satisfies CheckpointStoreShape;

    const handoff = {
      sourceThreadId,
      sourceProvider: "claudeAgent" as const,
      importedAt: "2026-07-27T12:00:00.000Z",
      bootstrapStatus: "pending" as const,
      summary: null,
      objective: null,
      unfinishedSteps: [],
      repoSnapshot: null,
      diffAckStatus: "pending" as const,
      checkpointRef: treeRef,
      baseCheckpointRef: baseRef,
      baseHeadSha: "abc",
      checkpointStatus: "captured" as const,
    };

    const diff = await Effect.runPromise(
      diffAgentHandoffCheckpoint(store, {
        threadId: destThreadId,
        cwd: "/tmp/repo",
        handoff,
      }),
    );
    expect(diff.diff).toBe("seam patch");
    expect(diff.checkpointStatus).toBe("captured");

    const restored = await Effect.runPromise(
      restoreAgentHandoffCheckpoint(store, {
        threadId: destThreadId,
        cwd: "/tmp/repo",
        handoff,
      }),
    );
    expect(restored).toEqual({ restored: true, checkpointRef: treeRef });
  });
});
