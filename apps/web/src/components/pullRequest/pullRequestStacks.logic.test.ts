import type { PullRequestListEntry } from "@modesto/contracts";
import { describe, expect, it } from "vitest";

import {
  derivePullRequestStacks,
  findStackFor,
  formatStackPosition,
} from "./pullRequestStacks.logic";

function pr(input: {
  number: number;
  head: string;
  base: string;
  repository?: string;
  state?: "open" | "closed" | "merged";
}): PullRequestListEntry {
  return {
    number: input.number,
    headBranch: input.head,
    baseBranch: input.base,
    repository: input.repository ?? "acme/app",
    state: input.state ?? "open",
    title: `PR ${input.number}`,
  } as unknown as PullRequestListEntry;
}

const numbers = (entries: ReadonlyArray<{ entry: PullRequestListEntry }>) =>
  entries.map((node) => node.entry.number);

describe("deriving stacks from branches", () => {
  it("chains a pull request onto the one whose head it targets", () => {
    const index = derivePullRequestStacks([
      pr({ number: 1, head: "feat/a", base: "main" }),
      pr({ number: 2, head: "feat/b", base: "feat/a" }),
      pr({ number: 3, head: "feat/c", base: "feat/b" }),
    ]);

    expect(index.stacks).toHaveLength(1);
    expect(numbers(index.stacks[0]!.nodes)).toEqual([1, 2, 3]);
    expect(index.nodeByNumber.get(3)?.depth).toBe(2);
    expect(index.nodeByNumber.get(3)?.parentNumber).toBe(2);
  });

  it("keeps siblings as a branching stack rather than inventing an order", () => {
    // Two PRs off one parent are not sequential with each other; flattening
    // them into a chain would imply a merge order that does not exist.
    const index = derivePullRequestStacks([
      pr({ number: 1, head: "feat/a", base: "main" }),
      pr({ number: 2, head: "feat/b", base: "feat/a" }),
      pr({ number: 3, head: "feat/c", base: "feat/a" }),
    ]);

    expect(index.nodeByNumber.get(1)?.childNumbers).toEqual([2, 3]);
    expect(index.nodeByNumber.get(2)?.depth).toBe(1);
    expect(index.nodeByNumber.get(3)?.depth).toBe(1);
  });

  it("never stacks across repositories", () => {
    // The same branch name exists in many repositories; matching on the name
    // alone would invent a stack between unrelated projects.
    const index = derivePullRequestStacks([
      pr({ number: 1, head: "feat/a", base: "main", repository: "acme/app" }),
      pr({ number: 2, head: "feat/b", base: "feat/a", repository: "acme/other" }),
    ]);

    expect(index.stacks).toEqual([]);
  });

  it("ignores anything not open", () => {
    // A merged parent has landed, so its child is no longer stacked on it and
    // should stop being warned about.
    const index = derivePullRequestStacks([
      pr({ number: 1, head: "feat/a", base: "main", state: "merged" }),
      pr({ number: 2, head: "feat/b", base: "feat/a" }),
    ]);

    expect(index.stacks).toEqual([]);
  });

  it("reports nothing when every pull request targets the trunk", () => {
    const index = derivePullRequestStacks([
      pr({ number: 1, head: "feat/a", base: "main" }),
      pr({ number: 2, head: "feat/b", base: "main" }),
    ]);

    expect(index.stacks).toEqual([]);
    expect(index.nodeByNumber.size).toBe(0);
  });

  it("finds two independent stacks", () => {
    const index = derivePullRequestStacks([
      pr({ number: 1, head: "a1", base: "main" }),
      pr({ number: 2, head: "a2", base: "a1" }),
      pr({ number: 10, head: "b1", base: "main" }),
      pr({ number: 11, head: "b2", base: "b1" }),
    ]);

    expect(index.stacks.map((stack) => stack.rootNumber).toSorted((a, b) => a - b)).toEqual([
      1, 10,
    ]);
  });
});

describe("malformed input", () => {
  it("terminates on a cycle instead of looping forever", () => {
    // Renamed branches can produce A-on-B and B-on-A. Reaching this test at all
    // means the walk terminated.
    const index = derivePullRequestStacks([
      pr({ number: 1, head: "feat/a", base: "feat/b" }),
      pr({ number: 2, head: "feat/b", base: "feat/a" }),
    ]);

    expect(index.stacks.length).toBeLessThanOrEqual(1);
  });

  it("does not let a pull request be its own parent", () => {
    const index = derivePullRequestStacks([
      pr({ number: 1, head: "feat/a", base: "feat/a" }),
      pr({ number: 2, head: "feat/b", base: "main" }),
    ]);

    expect(index.stacks).toEqual([]);
  });

  it("is stable when two pull requests claim the same head branch", () => {
    const entries = [
      pr({ number: 1, head: "feat/a", base: "main" }),
      pr({ number: 2, head: "feat/a", base: "main" }),
      pr({ number: 3, head: "feat/b", base: "feat/a" }),
    ];

    const first = derivePullRequestStacks(entries);
    const second = derivePullRequestStacks(entries);
    expect(first.stacks[0]?.rootNumber).toBe(second.stacks[0]?.rootNumber);
  });

  it("handles an empty or single-entry listing", () => {
    expect(derivePullRequestStacks([]).stacks).toEqual([]);
    expect(derivePullRequestStacks([pr({ number: 1, head: "a", base: "main" })]).stacks).toEqual(
      [],
    );
  });
});

describe("labelling a position", () => {
  const index = derivePullRequestStacks([
    pr({ number: 1, head: "feat/a", base: "main" }),
    pr({ number: 2, head: "feat/b", base: "feat/a" }),
    pr({ number: 3, head: "feat/c", base: "feat/b" }),
  ]);

  it("counts from the bottom of the stack", () => {
    expect(formatStackPosition(index, 1)).toBe("1 of 3");
    expect(formatStackPosition(index, 3)).toBe("3 of 3");
  });

  it("says nothing for a pull request that is not stacked", () => {
    expect(formatStackPosition(index, 99)).toBeNull();
  });

  it("finds the stack a pull request belongs to", () => {
    expect(findStackFor(index, 2)?.rootNumber).toBe(1);
    expect(findStackFor(index, 99)).toBeNull();
  });
});
