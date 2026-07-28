import { Effect, Path } from "effect";

import type { RepoMemoryFileKind } from "@modesto/contracts";

export const STATIC_REPO_MEMORY_FILES: ReadonlyArray<{
  readonly relativePath: string;
  readonly kind: RepoMemoryFileKind;
}> = [
  { relativePath: "AGENTS.md", kind: "agents" },
  { relativePath: "CLAUDE.md", kind: "claude" },
  { relativePath: "README.md", kind: "readme" },
  { relativePath: "ARCHITECTURE.md", kind: "architecture" },
  { relativePath: "DECISIONS.md", kind: "decision-record" },
  { relativePath: "docs/architecture.md", kind: "architecture" },
  { relativePath: "docs/ARCHITECTURE.md", kind: "architecture" },
];

export const REPO_MEMORY_ADR_DIRECTORY = "docs/adr";

export function toPosixRelativePath(input: string): string {
  return input.replaceAll("\\", "/");
}

export const normalizeWorkspaceRoot = Effect.fnUntraced(function* (workspaceRoot: string) {
  const path = yield* Path.Path;
  return path.resolve(workspaceRoot.trim());
});

export const resolveRelativePathWithinRoot = Effect.fnUntraced(function* (input: {
  readonly workspaceRoot: string;
  readonly relativePath: string;
}) {
  const path = yield* Path.Path;
  const normalizedRelativePath = toPosixRelativePath(input.relativePath.trim());
  if (path.isAbsolute(normalizedRelativePath)) {
    return yield* Effect.fail(
      new Error(`Path must be relative to workspace root: ${input.relativePath}`),
    );
  }
  const absolutePath = path.resolve(input.workspaceRoot, normalizedRelativePath);
  const relativeToRoot = path.relative(input.workspaceRoot, absolutePath);
  if (
    relativeToRoot.startsWith("..") ||
    relativeToRoot === ".." ||
    path.isAbsolute(relativeToRoot)
  ) {
    return yield* Effect.fail(new Error(`Path escapes workspace root: ${input.relativePath}`));
  }
  return {
    absolutePath,
    relativePath: toPosixRelativePath(relativeToRoot),
  };
});
