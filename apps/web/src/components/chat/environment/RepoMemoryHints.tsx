// FILE: RepoMemoryHints.tsx
// Purpose: Lists repository memory artifacts in the Environment panel.
// Layer: Environment panel section
// Exports: RepoMemoryHints

import { useQueries } from "@tanstack/react-query";
import { ensureNativeApi } from "~/nativeApi";
import { listRepoMemoryCandidatePaths } from "~/lib/repoMemory";
import { EnvironmentCollapsibleSection, EnvironmentRow } from "./EnvironmentRow";
import { FileEntryIcon } from "../FileEntryIcon";

export function RepoMemoryHints({ cwd }: { cwd: string | null }) {
  const candidates = listRepoMemoryCandidatePaths();
  const reads = useQueries({
    queries: candidates.map((relativePath) => ({
      queryKey: ["repo-memory", cwd, relativePath] as const,
      queryFn: async () => {
        const api = ensureNativeApi();
        if (!cwd) {
          return null;
        }
        try {
          await api.projects.readFile({ cwd, relativePath });
          return relativePath;
        } catch {
          return null;
        }
      },
      enabled: cwd !== null,
      staleTime: 60_000,
      retry: false,
    })),
  });

  const availablePaths = reads
    .map((result) => (result.isSuccess ? result.data : null))
    .filter((path): path is (typeof candidates)[number] => path !== null);

  if (availablePaths.length === 0) {
    return null;
  }

  return (
    <EnvironmentCollapsibleSection label="Repo memory" defaultOpen={false}>
      {availablePaths.map((relativePath) => (
        <EnvironmentRow
          key={relativePath}
          icon={
            <FileEntryIcon
              pathValue={relativePath}
              kind={relativePath.includes("/") ? "directory" : "file"}
              className="size-4 shrink-0"
            />
          }
          label={relativePath}
        />
      ))}
    </EnvironmentCollapsibleSection>
  );
}
