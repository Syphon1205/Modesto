import type { RepoMemoryFile, RepoMemoryFileKind } from "@modesto/contracts";
import { createHash } from "node:crypto";
import { Effect, FileSystem, Path } from "effect";

import {
  normalizeWorkspaceRoot,
  REPO_MEMORY_ADR_DIRECTORY,
  STATIC_REPO_MEMORY_FILES,
  toPosixRelativePath,
} from "./paths";

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

const statRepoMemoryFile = Effect.fnUntraced(function* (input: {
  readonly workspaceRoot: string;
  readonly relativePath: string;
  readonly kind: RepoMemoryFileKind;
}) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(input.workspaceRoot, input.relativePath);
  const exists = yield* fileSystem.exists(absolutePath);
  if (!exists) {
    return {
      path: input.relativePath,
      kind: input.kind,
      contentHash: null,
      mtimeMs: null,
      exists: false,
    } satisfies RepoMemoryFile;
  }

  const content = yield* fileSystem.readFileString(absolutePath);
  const stat = yield* fileSystem.stat(absolutePath);
  return {
    path: input.relativePath,
    kind: input.kind,
    contentHash: hashContent(content),
    mtimeMs: stat.mtime instanceof Date ? stat.mtime.getTime() : null,
    exists: true,
  } satisfies RepoMemoryFile;
});

const listAdrFiles = Effect.fnUntraced(function* (workspaceRoot: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const adrDirectory = path.join(workspaceRoot, REPO_MEMORY_ADR_DIRECTORY);
  const exists = yield* fileSystem.exists(adrDirectory);
  if (!exists) {
    return [] as ReadonlyArray<RepoMemoryFile>;
  }

  const entries = yield* fileSystem
    .readDirectory(adrDirectory)
    .pipe(Effect.catch(() => Effect.succeed([] as ReadonlyArray<string>)));
  const markdownFiles = entries
    .filter((entry) => entry.toLowerCase().endsWith(".md"))
    .sort((left, right) => left.localeCompare(right));

  const files: RepoMemoryFile[] = [];
  for (const fileName of markdownFiles) {
    const relativePath = toPosixRelativePath(path.join(REPO_MEMORY_ADR_DIRECTORY, fileName));
    files.push(
      yield* statRepoMemoryFile({
        workspaceRoot,
        relativePath,
        kind: "decision-record",
      }),
    );
  }
  return files;
});

export const detectRepoMemoryFiles = Effect.fnUntraced(function* (workspaceRoot: string) {
  const normalizedRoot = yield* normalizeWorkspaceRoot(workspaceRoot);
  const files: RepoMemoryFile[] = [];

  for (const entry of STATIC_REPO_MEMORY_FILES) {
    files.push(
      yield* statRepoMemoryFile({
        workspaceRoot: normalizedRoot,
        relativePath: entry.relativePath,
        kind: entry.kind,
      }),
    );
  }

  files.push(...(yield* listAdrFiles(normalizedRoot)));
  return files;
});
