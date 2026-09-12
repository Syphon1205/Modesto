import * as NodeServices from "@effect/platform-node/NodeServices";
import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { describe, expect } from "vite-plus/test";

import * as ServerConfig from "../config.ts";
import type { ClaudePluginBundle } from "./claudePluginBundle.ts";
import {
  installClaudePlugin,
  listInstalledClaudePlugins,
  uninstallClaudePlugin,
} from "./claudePluginInstall.ts";

const ClaudePluginInstallTestLayer = ServerConfig.ServerConfig.layerTest(process.cwd(), {
  prefix: "modesto-claude-plugin-install-test-",
}).pipe(Layer.provideMerge(NodeServices.layer));

function makeBundle(input?: {
  readonly preview?: Partial<ClaudePluginBundle["preview"]>;
  readonly skillTitle?: string;
  readonly mcpServers?: Readonly<Record<string, unknown>>;
}): ClaudePluginBundle {
  const skillTitle = input?.skillTitle ?? "Make Widget";
  return {
    preview: {
      pluginId: "github:acme/widgets",
      name: "Widgets Plugin",
      description: "Adds widget skills",
      version: "1.0.0",
      source: { owner: "acme", repo: "widgets", ref: "main", dir: null },
      components: [{ type: "skill", name: skillTitle, description: null }],
      warnings: [],
      ...input?.preview,
    },
    mcpServers: input?.mcpServers ?? {},
    files: [
      {
        type: "skill",
        path: `skills/${skillTitle}/SKILL.md`,
        title: skillTitle,
        description: "Builds a widget",
        content: `---\nname: ${skillTitle}\n---\nDo the widget thing.`,
      },
    ],
  };
}

describe("claudePluginInstall", () => {
  it.layer(ClaudePluginInstallTestLayer)("installClaudePlugin", (it) => {
    it.effect("writes plugin files under a namespaced slug and registers the plugin", () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const config = yield* ServerConfig.ServerConfig;
        const claudeDir = path.join(config.baseDir, "fake-claude-home", ".claude");

        const installed = yield* installClaudePlugin({
          bundle: makeBundle(),
          baseDir: config.baseDir,
          claudeDirOverride: claudeDir,
        });

        expect(installed.pluginId).toBe("github:acme/widgets");
        expect(installed.namespace).toBe("widgets-plugin");
        expect(installed.files).toHaveLength(1);

        const skillPath = installed.files[0]!.path;
        expect(skillPath).toBe(
          path.join(claudeDir, "skills", "widgets-plugin-make-widget", "SKILL.md"),
        );
        const written = yield* fileSystem.readFileString(skillPath);
        expect(written).toContain("Do the widget thing.");

        const listed = yield* listInstalledClaudePlugins(config.baseDir);
        expect(listed.map((plugin) => plugin.pluginId)).toEqual(["github:acme/widgets"]);
      }),
    );

    it.effect("reinstalling the same plugin replaces its previous files", () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const config = yield* ServerConfig.ServerConfig;
        const claudeDir = path.join(config.baseDir, "fake-claude-home-2", ".claude");

        const first = yield* installClaudePlugin({
          bundle: makeBundle(),
          baseDir: config.baseDir,
          claudeDirOverride: claudeDir,
        });
        const firstSkillPath = first.files[0]!.path;

        const second = yield* installClaudePlugin({
          bundle: makeBundle({ skillTitle: "Make Widget V2" }),
          baseDir: config.baseDir,
          claudeDirOverride: claudeDir,
        });

        // The old skill directory is gone, not left behind as an orphan.
        const oldStillExists = yield* fileSystem
          .exists(path.dirname(firstSkillPath))
          .pipe(Effect.orElseSucceed(() => false));
        expect(oldStillExists).toBe(false);

        const listed = yield* listInstalledClaudePlugins(config.baseDir);
        expect(listed).toHaveLength(1);
        expect(listed[0]!.installedAt).toBe(second.installedAt);
      }),
    );

    it.effect("uninstall removes files and drops the plugin from the registry", () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const config = yield* ServerConfig.ServerConfig;
        const claudeDir = path.join(config.baseDir, "fake-claude-home-3", ".claude");

        const installed = yield* installClaudePlugin({
          bundle: makeBundle(),
          baseDir: config.baseDir,
          claudeDirOverride: claudeDir,
        });
        const skillDir = path.dirname(installed.files[0]!.path);

        yield* uninstallClaudePlugin({ pluginId: installed.pluginId, baseDir: config.baseDir });

        const stillExists = yield* fileSystem
          .exists(skillDir)
          .pipe(Effect.orElseSucceed(() => false));
        expect(stillExists).toBe(false);

        const listed = yield* listInstalledClaudePlugins(config.baseDir);
        expect(listed).toHaveLength(0);
      }),
    );

    it.effect("registers declared MCP servers in Claude's own config", () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const config = yield* ServerConfig.ServerConfig;
        const claudeHome = path.join(config.baseDir, "mcp-install-home");
        const claudeDir = path.join(claudeHome, ".claude");
        const configPath = path.join(claudeHome, ".claude.json");
        // Claude's config is a live file holding much more than MCP servers;
        // an install must leave everything it does not own intact.
        yield* fileSystem.makeDirectory(claudeHome, { recursive: true });
        yield* fileSystem.writeFileString(
          configPath,
          JSON.stringify({ userID: "abc-123", mcpServers: { mine: { type: "http" } } }),
        );

        const installed = yield* installClaudePlugin({
          bundle: makeBundle({
            mcpServers: { widgets: { type: "http", url: "https://mcp.acme.test/mcp" } },
          }),
          baseDir: config.baseDir,
          claudeDirOverride: claudeDir,
        });

        expect(installed.mcpServers).toEqual(["widgets"]);
        const document = JSON.parse(yield* fileSystem.readFileString(configPath)) as {
          userID: string;
          mcpServers: Record<string, unknown>;
        };
        expect(document.userID).toBe("abc-123");
        expect(Object.keys(document.mcpServers).toSorted()).toEqual(["mine", "widgets"]);

        // These tests share one registry; leave it as it was found.
        yield* uninstallClaudePlugin({
          pluginId: "github:acme/widgets",
          baseDir: config.baseDir,
          claudeDirOverride: claudeDir,
        });
      }),
    );

    it.effect("uninstall takes back only the servers it added", () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const config = yield* ServerConfig.ServerConfig;
        const claudeHome = path.join(config.baseDir, "mcp-uninstall-home");
        const claudeDir = path.join(claudeHome, ".claude");
        const configPath = path.join(claudeHome, ".claude.json");
        yield* fileSystem.makeDirectory(claudeHome, { recursive: true });
        yield* fileSystem.writeFileString(
          configPath,
          JSON.stringify({ mcpServers: { "user-owned": { type: "http" } } }),
        );

        yield* installClaudePlugin({
          bundle: makeBundle({ mcpServers: { widgets: { type: "http" } } }),
          baseDir: config.baseDir,
          claudeDirOverride: claudeDir,
        });
        yield* uninstallClaudePlugin({
          pluginId: "github:acme/widgets",
          baseDir: config.baseDir,
          claudeDirOverride: claudeDir,
        });

        const document = JSON.parse(yield* fileSystem.readFileString(configPath)) as {
          mcpServers: Record<string, unknown>;
        };
        // The user's own server must survive removing the plugin.
        expect(Object.keys(document.mcpServers)).toEqual(["user-owned"]);
      }),
    );

    it.effect("reinstalling drops servers the plugin no longer declares", () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const config = yield* ServerConfig.ServerConfig;
        const claudeHome = path.join(config.baseDir, "mcp-reinstall-home");
        const claudeDir = path.join(claudeHome, ".claude");
        const configPath = path.join(claudeHome, ".claude.json");

        yield* installClaudePlugin({
          bundle: makeBundle({ mcpServers: { old: { type: "http" } } }),
          baseDir: config.baseDir,
          claudeDirOverride: claudeDir,
        });
        const reinstalled = yield* installClaudePlugin({
          bundle: makeBundle({ mcpServers: { fresh: { type: "http" } } }),
          baseDir: config.baseDir,
          claudeDirOverride: claudeDir,
        });

        expect(reinstalled.mcpServers).toEqual(["fresh"]);
        const document = JSON.parse(yield* fileSystem.readFileString(configPath)) as {
          mcpServers: Record<string, unknown>;
        };
        expect(Object.keys(document.mcpServers)).toEqual(["fresh"]);

        yield* uninstallClaudePlugin({
          pluginId: "github:acme/widgets",
          baseDir: config.baseDir,
          claudeDirOverride: claudeDir,
        });
      }),
    );

    it.effect("uninstalling an unknown plugin id is a harmless no-op", () =>
      Effect.gen(function* () {
        const config = yield* ServerConfig.ServerConfig;
        yield* uninstallClaudePlugin({
          pluginId: "github:nobody/nothing",
          baseDir: config.baseDir,
        });
        const listed = yield* listInstalledClaudePlugins(config.baseDir);
        expect(listed).toHaveLength(0);
      }),
    );
  });
});
