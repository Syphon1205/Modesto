// FILE: repoMemory.ts
// Purpose: Detects repository memory artifacts for lightweight continuity hints.
// Layer: Web utilities
// Exports: repo memory candidate helpers

export const REPO_MEMORY_CANDIDATE_PATHS = [
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "ARCHITECTURE.md",
  "docs/adr",
] as const;

export type RepoMemoryCandidatePath = (typeof REPO_MEMORY_CANDIDATE_PATHS)[number];

export function listRepoMemoryCandidatePaths(): readonly RepoMemoryCandidatePath[] {
  return REPO_MEMORY_CANDIDATE_PATHS;
}

export function isRepoMemoryCandidatePath(path: string): path is RepoMemoryCandidatePath {
  return (REPO_MEMORY_CANDIDATE_PATHS as readonly string[]).includes(path);
}

export function normalizeRepoMemoryCandidatePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "");
}
