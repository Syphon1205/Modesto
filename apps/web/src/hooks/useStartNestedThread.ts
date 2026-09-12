import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@modesto/client-runtime/state/runtime";
import { scopeThreadRef } from "@modesto/client-runtime/environment";
import type { NestedChatThreadParent } from "../lib/chatThreadActions";
import type { EnvironmentId } from "@modesto/contracts";
import type { ScopedThreadRef } from "@modesto/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { stackedThreadToast, toastManager } from "../components/ui/toast";
import { buildNestedChatThreadCreateInput } from "../lib/chatThreadActions";
import { newThreadId } from "../lib/utils";
import { readThreadShell } from "../state/entities";
import { threadEnvironment } from "../state/threads";
import { useAtomCommand } from "../state/use-atom-command";

async function waitForThreadShell(threadRef: ScopedThreadRef, timeoutMs = 3_000): Promise<boolean> {
  if (readThreadShell(threadRef) !== null) return true;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (readThreadShell(threadRef) !== null) return true;
  }
  return false;
}

/**
 * Starts a chat nested under another chat, then opens it. Model and runtime
 * carry over from the parent. Asking the model to start coding work still
 * creates a separate code/project thread.
 */
export function useStartNestedThread() {
  const createThread = useAtomCommand(threadEnvironment.create, { reportFailure: false });
  const navigate = useNavigate();

  return useCallback(
    async (
      parent: NestedChatThreadParent & { readonly environmentId: EnvironmentId },
    ): Promise<boolean> => {
      const nextThreadId = newThreadId();
      const nextThreadRef = scopeThreadRef(parent.environmentId, nextThreadId);
      const result = await createThread({
        environmentId: parent.environmentId,
        input: buildNestedChatThreadCreateInput(parent, nextThreadId, new Date().toISOString()),
      });
      if (result._tag === "Failure") {
        if (!isAtomCommandInterrupted(result)) {
          const error = squashAtomCommandFailure(result);
          toastManager.add(
            stackedThreadToast({
              type: "error",
              title: "Could not start thread",
              description: error instanceof Error ? error.message : "An error occurred.",
            }),
          );
        }
        return false;
      }
      const appeared = await waitForThreadShell(nextThreadRef);
      if (!appeared) {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Could not start thread",
            description: "The new thread did not appear. Try again.",
          }),
        );
        return false;
      }
      await navigate({
        to: "/$environmentId/$threadId",
        params: {
          environmentId: parent.environmentId,
          threadId: nextThreadId,
        },
      });
      return true;
    },
    [createThread, navigate],
  );
}
