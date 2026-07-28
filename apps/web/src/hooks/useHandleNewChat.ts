import { useCallback } from "react";

import { ensureHomeChatProject } from "../lib/chatProjects";
import { startContainerChat, type StartContainerChatResult } from "../lib/startContainerChat";
import { useWorkspaceStore } from "../workspaceStore";
import { useHandleNewThread } from "./useHandleNewThread";
import type { ThreadId } from "@modesto/contracts";

export function useHandleNewChat() {
  const homeDir = useWorkspaceStore((state) => state.homeDir);
  const chatWorkspaceRoot = useWorkspaceStore((state) => state.chatWorkspaceRoot);
  const { handleNewThread } = useHandleNewThread();

  const handleNewChat = useCallback(
    async (options?: {
      fresh?: boolean;
      surface?: "code" | "research";
      onThreadReady?: (threadId: ThreadId) => void;
    }): Promise<StartContainerChatResult> => {
      if (!homeDir) {
        return {
          ok: false,
          error: "Home folder is not available yet.",
        };
      }

      return startContainerChat({
        ensureProjectId: () => ensureHomeChatProject({ homeDir, chatWorkspaceRoot }),
        handleNewThread,
        fresh: options?.fresh,
        navigation: {
          surface: options?.surface ?? "code",
          ...(options?.onThreadReady ? { onThreadReady: options.onThreadReady } : {}),
        },
        errorLabel: "Unable to prepare a new chat.",
      });
    },
    [chatWorkspaceRoot, handleNewThread, homeDir],
  );

  return { handleNewChat };
}
