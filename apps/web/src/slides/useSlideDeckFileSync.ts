import { scopedThreadKey } from "@modesto/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef } from "@modesto/contracts";
import { useEffect, useRef } from "react";

import {
  confirmProjectFileQueryData,
  setProjectFileQueryData,
} from "../components/files/projectFilesQueryState";
import { projectEnvironment } from "../state/projects";
import { useAtomCommand } from "../state/use-atom-command";
import { starterSlideDeckMarkdown } from "./slideDeck";
import { resolveSlideDeckPersistPath } from "./slideDeckPersist";
import { useSlidesStore } from "./slidesStore";

const PERSIST_DEBOUNCE_MS = 280;

export function useSlideDeckFileSync(input: {
  readonly threadRef: ScopedThreadRef | null;
  readonly environmentId?: EnvironmentId | null | undefined;
  readonly cwd?: string | null | undefined;
}): void {
  const writeFile = useAtomCommand(projectEnvironment.writeFile, { reportFailure: false });
  const persistGeneration = useRef(0);
  const writing = useRef(false);
  const threadRef = input.threadRef;
  const environmentId = input.environmentId;
  const cwd = input.cwd;

  const persistRevision = useSlidesStore((state) => {
    if (!threadRef) return 0;
    return state.persistRevisionByThreadKey[scopedThreadKey(threadRef)] ?? 0;
  });
  const generating = useSlidesStore((state) => {
    if (!threadRef) return false;
    return state.generatingByThreadKey[scopedThreadKey(threadRef)] === true;
  });
  const sourcePath = useSlidesStore((state) => {
    if (!threadRef) return null;
    return state.sourcePathByThreadKey[scopedThreadKey(threadRef)] ?? null;
  });
  useEffect(() => {
    if (!threadRef || !environmentId || !cwd) return;
    const store = useSlidesStore.getState();
    const key = scopedThreadKey(threadRef);
    const dirty = store.dirtyByThreadKey[key] === true;
    const shouldCreateForBuild = generating && !store.sourcePathByThreadKey[key];
    if (!dirty && !shouldCreateForBuild) return;

    persistGeneration.current += 1;
    const delay = dirty ? PERSIST_DEBOUNCE_MS : 0;
    const persistLatest = async (): Promise<void> => {
      const started = persistGeneration.current;
      if (writing.current) return;
      writing.current = true;
      const latest = useSlidesStore.getState();
      const latestMarkdown = latest.markdownByThreadKey[key] ?? starterSlideDeckMarkdown();
      const persistPath = resolveSlideDeckPersistPath(
        latest.sourcePathByThreadKey[key],
        latestMarkdown,
      );
      setProjectFileQueryData(environmentId, cwd, persistPath, latestMarkdown);
      const result = await writeFile({
        environmentId,
        input: { cwd, relativePath: persistPath, contents: latestMarkdown },
      });
      writing.current = false;
      if (started !== persistGeneration.current) {
        await persistLatest();
        return;
      }
      if (result._tag !== "Success") return;
      confirmProjectFileQueryData(environmentId, cwd, persistPath, latestMarkdown);
      latest.markPersisted(threadRef, latestMarkdown, persistPath);
    };
    const timer = window.setTimeout(() => {
      void persistLatest();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [cwd, environmentId, generating, persistRevision, sourcePath, threadRef, writeFile]);
}
