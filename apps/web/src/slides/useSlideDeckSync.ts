import { scopedThreadKey } from "@modesto/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef } from "@modesto/contracts";
import { executeAtomQuery } from "@modesto/client-runtime/state/runtime";
import { useEffect, useRef } from "react";

import {
  getProjectFileQueryAtom,
  resolveProjectFileQueryData,
} from "../components/files/projectFilesQueryState";
import { appAtomRegistry } from "../rpc/atomRegistry";
import {
  isStarterSlideDeckMarkdown,
  latestSlideDeckMarkdownPath,
  resolveSlideDeckFromTranscript,
} from "./slideDeck";
import { useSlidesStore } from "./slidesStore";

export function useSlideDeckSync(input: {
  readonly threadRef: ScopedThreadRef | null;
  readonly messages: ReadonlyArray<{
    readonly role: string;
    readonly text: string;
  }> | null;
  readonly checkpointFiles: ReadonlyArray<{ readonly path: string }>;
  readonly turnSettled: boolean;
  readonly environmentId: EnvironmentId | null | undefined;
  readonly cwd: string | null | undefined;
}): void {
  const threadRef = input.threadRef;
  const loadGeneration = useRef(0);

  useEffect(() => {
    if (!threadRef || !input.messages) return;
    const resolved = resolveSlideDeckFromTranscript({
      messages: input.messages,
      checkpointFiles: input.checkpointFiles,
    });
    const store = useSlidesStore.getState();
    const key = scopedThreadKey(threadRef);
    if (resolved.markdown) {
      store.applyRemoteDeck(threadRef, resolved.markdown, resolved.sourcePath);
      return;
    }
    if (input.turnSettled && store.generatingByThreadKey[key]) {
      const markdown = store.markdownByThreadKey[key];
      if (!markdown || isStarterSlideDeckMarkdown(markdown)) {
        store.finishBuild(threadRef);
      }
    }
  }, [input.checkpointFiles, input.messages, input.turnSettled, threadRef]);

  useEffect(() => {
    if (!threadRef) return;
    const pathFromFiles = latestSlideDeckMarkdownPath(input.checkpointFiles);
    const resolved = resolveSlideDeckFromTranscript({
      messages: input.messages ?? [],
      checkpointFiles: input.checkpointFiles,
    });
    const path = pathFromFiles ?? (input.turnSettled ? resolved.sourcePath : null);
    const cwd = input.cwd;
    const environmentId = input.environmentId;
    if (!path || !cwd || !environmentId || !path.toLowerCase().endsWith(".md")) return;
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
      useSlidesStore.getState().applyRemoteDeck(threadRef, data.contents, path);
    })();
  }, [
    input.checkpointFiles,
    input.cwd,
    input.environmentId,
    input.messages,
    input.turnSettled,
    threadRef,
  ]);
}
