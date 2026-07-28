// FILE: ComposerChromeBubbles.test.tsx
// Purpose: Guards show-when-necessary gating for composer chrome bubbles.
// Layer: Unit test

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ComposerChromeBubbles } from "./ComposerChromeBubbles";
import type { ActiveTaskListState } from "../../session-logic";

const taskList = {
  turnId: "turn-1",
  tasks: [
    { task: "Wire bubbles", status: "completed" },
    { task: "Ship plan mode", status: "inProgress" },
  ],
} as ActiveTaskListState;

describe("ComposerChromeBubbles", () => {
  it("renders nothing when no bubbles are needed", () => {
    const html = renderToStaticMarkup(
      <ComposerChromeBubbles
        changes={null}
        isWorking={false}
        workingCount={0}
        activeTaskList={null}
      />,
    );
    expect(html).toBe("");
  });

  it("shows Changes, Working, and Tasks when active", () => {
    const html = renderToStaticMarkup(
      <ComposerChromeBubbles
        changes={{ additions: 12, deletions: 3, hasChanges: true }}
        onOpenChanges={vi.fn()}
        isWorking={true}
        workingCount={2}
        activeTaskList={taskList}
        onOpenTasks={vi.fn()}
      />,
    );
    expect(html).toContain("Changes");
    expect(html).toContain("+12");
    expect(html).toContain("-3");
    expect(html).toContain("2 Working");
    expect(html).toContain("1/2 tasks");
    expect(html).not.toContain("Multi-agent");
    expect(html).toContain('data-testid="composer-chrome-bubbles"');
  });

  it("hides Changes when the working tree is clean", () => {
    const html = renderToStaticMarkup(
      <ComposerChromeBubbles
        changes={{ additions: 0, deletions: 0, hasChanges: false }}
        onOpenChanges={vi.fn()}
        isWorking={false}
        workingCount={0}
        activeTaskList={null}
      />,
    );
    expect(html).not.toContain("Changes");
    expect(html).toBe("");
  });
});
