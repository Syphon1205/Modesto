import type { RepoMemoryApplyWriteInput, RepoMemoryApplyWriteResult } from "@modesto/contracts";
import { Effect, FileSystem, Path } from "effect";

import { normalizeWorkspaceRoot, resolveRelativePathWithinRoot } from "./paths";

function formatAppendSection(content: string, capturedAt = new Date()): string {
  const dateLabel = capturedAt.toISOString().slice(0, 10);
  const trimmed = content.trim();
  return `\n\n## Durable note (${dateLabel})\n\n${trimmed}\n`;
}

export const applyRepoMemoryWrite = Effect.fnUntraced(function* (input: RepoMemoryApplyWriteInput) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const normalizedRoot = yield* normalizeWorkspaceRoot(input.workspaceRoot);
  const resolved = yield* resolveRelativePathWithinRoot({
    workspaceRoot: normalizedRoot,
    relativePath: input.path,
  });

  const trimmedContent = input.content.trim();
  if (trimmedContent.length === 0) {
    return yield* Effect.fail(new Error("Write content must not be empty"));
  }

  const exists = yield* fileSystem.exists(resolved.absolutePath);

  if (input.mode === "create-only") {
    if (exists) {
      return {
        path: resolved.relativePath,
        created: false,
        appended: false,
        bytesWritten: 0,
      };
    }
    yield* fileSystem
      .makeDirectory(path.dirname(resolved.absolutePath), { recursive: true })
      .pipe(Effect.catch(() => Effect.void));
    yield* fileSystem.writeFileString(resolved.absolutePath, `${trimmedContent}\n`);
    return {
      path: resolved.relativePath,
      created: true,
      appended: false,
      bytesWritten: trimmedContent.length + 1,
    };
  }

  if (input.mode === "append") {
    const section = formatAppendSection(trimmedContent);
    if (!exists) {
      yield* fileSystem
        .makeDirectory(path.dirname(resolved.absolutePath), { recursive: true })
        .pipe(Effect.catch(() => Effect.void));
      yield* fileSystem.writeFileString(resolved.absolutePath, section.trimStart());
      return {
        path: resolved.relativePath,
        created: true,
        appended: true,
        bytesWritten: section.trimStart().length,
      };
    }

    const existing = yield* fileSystem.readFileString(resolved.absolutePath);
    const next = `${existing.endsWith("\n") ? existing.slice(0, -1) : existing}${section}`;
    yield* fileSystem.writeFileString(resolved.absolutePath, next);
    return {
      path: resolved.relativePath,
      created: false,
      appended: true,
      bytesWritten: section.length,
    };
  }

  return yield* Effect.fail(new Error(`Unsupported write mode: ${input.mode}`));
});
