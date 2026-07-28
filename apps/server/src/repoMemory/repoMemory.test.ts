import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import { createHash } from "node:crypto";
import { Effect, FileSystem, Path } from "effect";

import { applyRepoMemoryWrite, detectRepoMemoryFiles, suggestDurableWritebacks } from "./index";

const hashContent = (content: string) => createHash("sha256").update(content).digest("hex");

const withTempWorkspace = <A, E, R>(use: (workspaceRoot: string) => Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const workspaceRoot = yield* fileSystem
      .makeTempDirectory({ prefix: "modesto-repo-memory-" })
      .pipe(Effect.map((dir) => path.resolve(dir)));
    return yield* use(workspaceRoot).pipe(
      Effect.ensuring(fileSystem.remove(workspaceRoot, { recursive: true }).pipe(Effect.orDie)),
    );
  });

it.layer(NodeServices.layer)("repoMemory", (it) => {
  it.effect("detectRepoMemoryFiles reports static files and ADR entries", () =>
    withTempWorkspace((workspaceRoot) =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;

        yield* fileSystem.writeFileString(
          path.join(workspaceRoot, "AGENTS.md"),
          "# Agents\nAlways run bun run test.\n",
        );
        yield* fileSystem.makeDirectory(path.join(workspaceRoot, "docs"), { recursive: true });
        yield* fileSystem.writeFileString(
          path.join(workspaceRoot, "docs", "architecture.md"),
          "# Architecture\n",
        );
        yield* fileSystem.makeDirectory(path.join(workspaceRoot, "docs", "adr"), {
          recursive: true,
        });
        yield* fileSystem.writeFileString(
          path.join(workspaceRoot, "docs", "adr", "001-use-effect.md"),
          "# ADR 001\n",
        );

        const files = yield* detectRepoMemoryFiles(workspaceRoot);
        const agents = files.find((file) => file.path === "AGENTS.md");
        const architecture = files.find((file) => file.path === "docs/architecture.md");
        const adr = files.find((file) => file.path === "docs/adr/001-use-effect.md");
        const readme = files.find((file) => file.path === "README.md");

        assert.isDefined(agents);
        assert.strictEqual(agents.kind, "agents");
        assert.isTrue(agents.exists);
        assert.strictEqual(agents.contentHash, hashContent("# Agents\nAlways run bun run test.\n"));
        assert.isDefined(agents.mtimeMs);

        assert.isDefined(architecture);
        assert.strictEqual(architecture.kind, "architecture");
        assert.isTrue(architecture.exists);

        assert.isDefined(adr);
        assert.strictEqual(adr.kind, "decision-record");
        assert.isTrue(adr.exists);

        assert.isDefined(readme);
        assert.isFalse(readme.exists);
        assert.isNull(readme.contentHash);
        assert.isNull(readme.mtimeMs);
      }),
    ),
  );

  it.effect("applyRepoMemoryWrite create-only skips existing files", () =>
    withTempWorkspace((workspaceRoot) =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const targetPath = path.join(workspaceRoot, "AGENTS.md");
        yield* fileSystem.writeFileString(targetPath, "existing\n");

        const skipped = yield* applyRepoMemoryWrite({
          workspaceRoot,
          path: "AGENTS.md",
          content: "new guidance",
          mode: "create-only",
        });
        assert.isFalse(skipped.created);
        assert.isFalse(skipped.appended);
        assert.strictEqual(skipped.bytesWritten, 0);
        assert.strictEqual(yield* fileSystem.readFileString(targetPath), "existing\n");

        const created = yield* applyRepoMemoryWrite({
          workspaceRoot,
          path: "CLAUDE.md",
          content: "Claude guidance",
          mode: "create-only",
        });
        assert.isTrue(created.created);
        assert.isFalse(created.appended);
        assert.strictEqual(
          yield* fileSystem.readFileString(path.join(workspaceRoot, "CLAUDE.md")),
          "Claude guidance\n",
        );
      }),
    ),
  );

  it.effect("applyRepoMemoryWrite append adds a dated section", () =>
    withTempWorkspace((workspaceRoot) =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const targetPath = path.join(workspaceRoot, "AGENTS.md");
        yield* fileSystem.writeFileString(targetPath, "# Agents\n");

        const appended = yield* applyRepoMemoryWrite({
          workspaceRoot,
          path: "AGENTS.md",
          content: "Never run bun test directly.",
          mode: "append",
        });
        assert.isFalse(appended.created);
        assert.isTrue(appended.appended);

        const written = yield* fileSystem.readFileString(targetPath);
        assert.match(written, /## Durable note \(\d{4}-\d{2}-\d{2}\)/);
        assert.include(written, "Never run bun test directly.");
      }),
    ),
  );

  it.effect("suggestDurableWritebacks proposes AGENTS.md guidance without writing", () =>
    withTempWorkspace((workspaceRoot) =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* fileSystem.writeFileString(path.join(workspaceRoot, "AGENTS.md"), "# Agents\n");

        const result = yield* suggestDurableWritebacks({
          workspaceRoot,
          conversationNotes:
            "We decided to always use bun run test instead of bun test in this repo.",
        });

        assert.isAtLeast(result.suggestions.length, 1);
        assert.strictEqual(result.suggestions[0]?.targetPath, "AGENTS.md");
        assert.isFalse(yield* fileSystem.exists(path.join(workspaceRoot, "CLAUDE.md")));
      }),
    ),
  );
});
