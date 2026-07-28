import { describe, expect, it, vi } from "vitest";

import {
  startFreshChatForActiveSurface,
  type StartContainerChatResult,
} from "./startContainerChat";

const paths = {
  homeDir: "/Users/tester",
  chatWorkspaceRoot: "/Users/tester/Documents/Modesto/Chats",
  studioWorkspaceRoot: "/Users/tester/Documents/Modesto/Studio",
};

function successfulHandler() {
  return vi.fn(async (): Promise<StartContainerChatResult> => ({ ok: true, threadId: null }));
}

describe("startFreshChatForActiveSurface", () => {
  it("keeps the global New chat action in Studio", async () => {
    const handleNewChat = successfulHandler();
    const handleNewStudioChat = successfulHandler();

    await startFreshChatForActiveSurface({
      activeProject: {
        kind: "studio",
        cwd: "/Users/tester/Documents/Modesto/Studio",
      },
      isStudioRoute: false,
      paths,
      handleNewChat,
      handleNewStudioChat,
    });

    expect(handleNewStudioChat).toHaveBeenCalledOnce();
    expect(handleNewStudioChat).toHaveBeenCalledWith({ fresh: true });
    expect(handleNewChat).not.toHaveBeenCalled();
  });

  it("keeps the global New chat action on the Studio landing route", async () => {
    const handleNewChat = successfulHandler();
    const handleNewStudioChat = successfulHandler();

    await startFreshChatForActiveSurface({
      activeProject: null,
      isStudioRoute: true,
      paths,
      handleNewChat,
      handleNewStudioChat,
    });

    expect(handleNewStudioChat).toHaveBeenCalledOnce();
    expect(handleNewChat).not.toHaveBeenCalled();
  });

  it("keeps the global New chat action in Projects for ordinary or missing projects", async () => {
    for (const activeProject of [
      { kind: "project" as const, cwd: "/Users/tester/Developer/app" },
      null,
    ]) {
      const handleNewChat = successfulHandler();
      const handleNewStudioChat = successfulHandler();

      await startFreshChatForActiveSurface({
        activeProject,
        isStudioRoute: false,
        paths,
        handleNewChat,
        handleNewStudioChat,
      });

      expect(handleNewChat).toHaveBeenCalledOnce();
      expect(handleNewChat).toHaveBeenCalledWith({ fresh: true });
      expect(handleNewStudioChat).not.toHaveBeenCalled();
    }
  });
});
