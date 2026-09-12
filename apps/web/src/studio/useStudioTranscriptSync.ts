import { scopedThreadKey } from "@modesto/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef } from "@modesto/contracts";
import { executeAtomQuery } from "@modesto/client-runtime/state/runtime";
import { useEffect, useRef } from "react";

import {
  getProjectFileQueryAtom,
  resolveProjectFileQueryData,
} from "../components/files/projectFilesQueryState";
import { appAtomRegistry } from "../rpc/atomRegistry";
import { useStudioDocumentStore } from "./documentStore";
import {
  extractStudioText,
  isStarterStudioText,
  isStudioBuildPrompt,
  latestStudioPath,
  type StudioKind,
} from "./studioKinds";

export function useStudioTranscriptSync(input: {
  readonly kind: StudioKind;
  readonly threadRef: ScopedThreadRef | null;
  readonly messages: ReadonlyArray<{ readonly role: string; readonly text: string }> | null;
  readonly checkpointFiles: ReadonlyArray<{ readonly path: string }>;
  readonly turnSettled: boolean;
  readonly environmentId: EnvironmentId | null | undefined;
  readonly cwd: string | null | undefined;
}): void {
  const { kind, threadRef } = input;
  const loadGeneration = useRef(0);

  useEffect(() => {
    if (!threadRef || !input.messages) return;
    let latestBuild = -1;
    for (let index = input.messages.length - 1; index >= 0; index -= 1) {
      const message = input.messages[index];
      if (message?.role === "user" && isStudioBuildPrompt(kind, message.text)) {
        latestBuild = index;
        break;
      }
    }
    const later =
      latestBuild >= 0
        ? input.messages
            .slice(latestBuild + 1)
            .filter((message) => message.role === "assistant")
            .map((message) => message.text)
            .join("\n\n")
        : "";
    const extracted = later.length > 0 ? extractStudioText(kind, later) : null;
    const path = latestStudioPath(kind, input.checkpointFiles);
    const store = useStudioDocumentStore.getState();
    if (extracted) {
      store.applyRemote(kind, threadRef, extracted, path);
      return;
    }
    if (input.turnSettled) {
      const current = store.textByKey[`${kind}:${scopedThreadKey(threadRef)}`];
      if (!current || isStarterStudioText(kind, current)) {
        store.finishBuild(kind, threadRef);
      }
    }
  }, [input.checkpointFiles, input.messages, input.turnSettled, kind, threadRef]);

  useEffect(() => {
    if (!threadRef) return;
    const path = latestStudioPath(kind, input.checkpointFiles);
    const cwd = input.cwd;
    const environmentId = input.environmentId;
    if (!path || !cwd || !environmentId) return;
    const generation = (loadGeneration.current += 1);
    void (async () => {
      const result = await executeAtomQuery(
        appAtomRegistry,
        getProjectFileQueryAtom(environmentId, cwd, path),
        { reportDefect: false, reportFailure: false },
      );
      if (generation !== loadGeneration.current) return;
      const data = resolveProjectFileQueryData(
        environmentId,
        cwd,
        path,
        result._tag === "Success" ? result.value : null,
      );
      if (!data || data.truncated || data.contents.trim().length === 0) return;
      useStudioDocumentStore.getState().applyRemote(kind, threadRef, data.contents, path);
    })();
  }, [input.checkpointFiles, input.cwd, input.environmentId, kind, threadRef]);
}
