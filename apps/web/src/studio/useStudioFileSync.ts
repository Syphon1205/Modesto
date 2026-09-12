import { scopedThreadKey } from "@modesto/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef } from "@modesto/contracts";
import { useEffect, useRef } from "react";

import {
  confirmProjectFileQueryData,
  setProjectFileQueryData,
} from "../components/files/projectFilesQueryState";
import { projectEnvironment } from "../state/projects";
import { useAtomCommand } from "../state/use-atom-command";
import { useStudioDocumentStore } from "./documentStore";
import { starterStudioText, suggestStudioPath, type StudioKind } from "./studioKinds";

const PERSIST_DEBOUNCE_MS = 280;

export function useStudioFileSync(input: {
  readonly kind: StudioKind;
  readonly threadRef: ScopedThreadRef | null;
  readonly environmentId?: EnvironmentId | null | undefined;
  readonly cwd?: string | null | undefined;
}): void {
  const writeFile = useAtomCommand(projectEnvironment.writeFile, { reportFailure: false });
  const persistGeneration = useRef(0);
  const writing = useRef(false);
  const { kind, threadRef, environmentId, cwd } = input;
  const storeKey = threadRef ? `${kind}:${scopedThreadKey(threadRef)}` : null;

  const persistRevision = useStudioDocumentStore((state) =>
    storeKey ? (state.persistRevisionByKey[storeKey] ?? 0) : 0,
  );
  const generating = useStudioDocumentStore((state) =>
    storeKey ? state.generatingByKey[storeKey] === true : false,
  );
  const sourcePath = useStudioDocumentStore((state) =>
    storeKey ? (state.sourcePathByKey[storeKey] ?? null) : null,
  );

  useEffect(() => {
    if (!threadRef || !environmentId || !cwd || !storeKey) return;
    const store = useStudioDocumentStore.getState();
    const dirty = store.dirtyByKey[storeKey] === true;
    const shouldCreateForBuild = generating && !store.sourcePathByKey[storeKey];
    if (!dirty && !shouldCreateForBuild) return;

    persistGeneration.current += 1;
    const persistLatest = async (): Promise<void> => {
      const started = persistGeneration.current;
      if (writing.current) return;
      writing.current = true;
      const latest = useStudioDocumentStore.getState();
      const text = latest.textByKey[storeKey] ?? starterStudioText(kind);
      const persistPath = latest.sourcePathByKey[storeKey] ?? suggestStudioPath(kind, text);
      setProjectFileQueryData(environmentId, cwd, persistPath, text);
      const result = await writeFile({
        environmentId,
        input: { cwd, relativePath: persistPath, contents: text },
      });
      writing.current = false;
      if (started !== persistGeneration.current) {
        await persistLatest();
        return;
      }
      if (result._tag !== "Success") return;
      confirmProjectFileQueryData(environmentId, cwd, persistPath, text);
      latest.markPersisted(kind, threadRef, text, persistPath);
    };
    const timer = window.setTimeout(
      () => {
        void persistLatest();
      },
      dirty ? PERSIST_DEBOUNCE_MS : 0,
    );
    return () => window.clearTimeout(timer);
  }, [
    cwd,
    environmentId,
    generating,
    kind,
    persistRevision,
    sourcePath,
    storeKey,
    threadRef,
    writeFile,
  ]);
}
