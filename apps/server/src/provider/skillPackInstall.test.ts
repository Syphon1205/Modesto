import * as NodeServices from "@effect/platform-node/NodeServices";
import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { describe, expect } from "vite-plus/test";

import * as ServerConfig from "../config.ts";
import type { SkillPackBundle } from "./skillPackBundle.ts";
import {
  installSkillPack,
  listInstalledSkillPacks,
  previewSkillPackEligibility,
  uninstallSkillPack,
} from "./skillPackInstall.ts";

const TestLayer = ServerConfig.ServerConfig.layerTest(process.cwd(), {
  prefix: "modesto-skill-pack-test-",
}).pipe(Layer.provideMerge(NodeServices.layer));

const bundle: SkillPackBundle = {
  preview: {
    packId: "skillpack_acme",
    name: "acme-skills",
    source: {
      owner: "acme",
      repo: "skills",
      requestedRef: "main",
      revision: "a".repeat(40),
      dir: null,
    },
    skills: [
      { name: "Review", description: "Review code", sourcePath: "review/SKILL.md", fileCount: 2 },
    ],
    providers: ["codex", "claude"],
    eligibility: [
      { provider: "codex", eligible: true, collisionDirectory: null },
      { provider: "claude", eligible: true, collisionDirectory: null },
    ],
    warnings: [],
  },
  skills: [
    {
      name: "Review",
      description: "Review code",
      sourcePath: "review/SKILL.md",
      fileCount: 2,
      slug: "review",
      files: [
        { path: "SKILL.md", content: new TextEncoder().encode("---\nname: Review\n---\nDo it.") },
        { path: "references/checklist.md", content: new TextEncoder().encode("Be careful.") },
      ],
    },
  ],
};

describe("skillPackInstall", () => {
  it.layer(TestLayer)("portable materialization", (it) => {
    it.effect("writes identical skills to both provider targets and uninstalls them", () =>
      Effect.gen(function* () {
        const config = yield* ServerConfig.ServerConfig;
        const path = yield* Path.Path;
        const fileSystem = yield* FileSystem.FileSystem;
        const codexRoot = path.join(config.baseDir, "codex-skills");
        const claudeRoot = path.join(config.baseDir, "claude-skills");
        const installed = yield* installSkillPack({
          bundle,
          baseDir: config.baseDir,
          providers: ["codex", "claude"],
          providerRoots: { codex: codexRoot, claude: claudeRoot },
        });

        const skillDirectory = "acme-skills-review";
        expect(
          yield* fileSystem.readFileString(path.join(codexRoot, skillDirectory, "SKILL.md")),
        ).toContain("name: Review");
        expect(
          yield* fileSystem.readFileString(
            path.join(claudeRoot, skillDirectory, "references", "checklist.md"),
          ),
        ).toBe("Be careful.");
        expect((yield* listInstalledSkillPacks(config.baseDir))[0]?.providers).toEqual([
          "codex",
          "claude",
        ]);

        yield* uninstallSkillPack({ packId: installed.packId, baseDir: config.baseDir });
        expect(yield* fileSystem.exists(path.join(codexRoot, skillDirectory))).toBe(false);
        expect(yield* fileSystem.exists(path.join(claudeRoot, skillDirectory))).toBe(false);
      }),
    );

    it.effect("replaces a previous install without deleting first and reports collisions", () =>
      Effect.gen(function* () {
        const config = yield* ServerConfig.ServerConfig;
        const path = yield* Path.Path;
        const fileSystem = yield* FileSystem.FileSystem;
        const codexRoot = path.join(config.baseDir, "codex-skills");
        const claudeRoot = path.join(config.baseDir, "claude-skills");
        yield* installSkillPack({
          bundle,
          baseDir: config.baseDir,
          providers: ["codex", "claude"],
          providerRoots: { codex: codexRoot, claude: claudeRoot },
        });

        const updated: SkillPackBundle = {
          ...bundle,
          skills: [
            {
              ...bundle.skills[0]!,
              files: [
                {
                  path: "SKILL.md",
                  content: new TextEncoder().encode("---\nname: Review\n---\nUpdated."),
                },
                {
                  path: "references/checklist.md",
                  content: new TextEncoder().encode("Still careful."),
                },
              ],
            },
          ],
        };
        yield* installSkillPack({
          bundle: updated,
          baseDir: config.baseDir,
          providers: ["codex", "claude"],
          providerRoots: { codex: codexRoot, claude: claudeRoot },
        });
        expect(
          yield* fileSystem.readFileString(path.join(codexRoot, "acme-skills-review", "SKILL.md")),
        ).toContain("Updated.");

        const foreign = path.join(codexRoot, "acme-skills-review");
        yield* uninstallSkillPack({ packId: bundle.preview.packId, baseDir: config.baseDir });
        yield* fileSystem.makeDirectory(foreign, { recursive: true });
        yield* fileSystem.writeFileString(path.join(foreign, "SKILL.md"), "hand-written");
        const eligibility = yield* previewSkillPackEligibility({
          bundle,
          baseDir: config.baseDir,
          providers: ["codex", "claude"],
          providerRoots: { codex: codexRoot, claude: claudeRoot },
        });
        expect(eligibility).toEqual([
          {
            provider: "codex",
            eligible: false,
            collisionDirectory: foreign,
          },
          { provider: "claude", eligible: true, collisionDirectory: null },
        ]);
      }),
    );
  });
});
