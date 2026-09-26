import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { GeminiSettings } from "@modesto/contracts";

import { buildInitialGeminiProviderSnapshot, checkGeminiProviderStatus } from "./GeminiProvider.ts";

const decodeGeminiSettings = Schema.decodeSync(GeminiSettings);

describe("buildInitialGeminiProviderSnapshot", () => {
  it.effect("returns a disabled snapshot when settings.enabled is false", () =>
    Effect.gen(function* () {
      const snapshot = yield* buildInitialGeminiProviderSnapshot(
        decodeGeminiSettings({ enabled: false }),
      );
      expect(snapshot.enabled).toBe(false);
      expect(snapshot.status).toBe("disabled");
      expect(snapshot.installed).toBe(false);
      expect(snapshot.message).toContain("disabled");
    }),
  );

  it.effect("returns a pending snapshot by default — Gemini is enabled", () =>
    Effect.gen(function* () {
      const snapshot = yield* buildInitialGeminiProviderSnapshot(decodeGeminiSettings({}));
      expect(snapshot.enabled).toBe(true);
      expect(snapshot.installed).toBe(true);
      expect(snapshot.status).toBe("warning");
      expect(snapshot.message).toContain("Checking Gemini");
      expect(snapshot.models.map((m) => m.slug)).toEqual([
        "auto-gemini-3",
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-3-pro",
        "gemini-3-flash",
      ]);
    }),
  );
});

it.layer(NodeServices.layer)("checkGeminiProviderStatus", (it) => {
  it.effect("reports the binary as missing when the binary path does not resolve", () =>
    Effect.gen(function* () {
      const snapshot = yield* checkGeminiProviderStatus(
        decodeGeminiSettings({
          enabled: true,
          binaryPath: "/definitely/not/installed/gemini-binary",
        }),
      );
      expect(snapshot.enabled).toBe(true);
      expect(snapshot.installed).toBe(false);
      expect(snapshot.status).toBe("error");
      expect(snapshot.message).toMatch(/not installed|not on PATH|Failed to execute/);
    }),
  );

  it.effect("reports an installed CLI as unhealthy when --version exits non-zero", () =>
    Effect.gen(function* () {
      const secretStderr = "broken gemini install: secret-token-value";
      const snapshot = yield* Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped({ prefix: "modesto-gemini-version-" });
          const geminiPath = path.join(dir, "gemini");
          yield* fs.writeFileString(
            geminiPath,
            ["#!/bin/sh", `printf "%s\\n" "${secretStderr}" >&2`, "exit 2", ""].join("\n"),
          );
          yield* fs.chmod(geminiPath, 0o755);

          return yield* checkGeminiProviderStatus(
            decodeGeminiSettings({ enabled: true, binaryPath: geminiPath }),
          );
        }),
      );

      expect(snapshot.enabled).toBe(true);
      expect(snapshot.installed).toBe(true);
      expect(snapshot.status).toBe("error");
      expect(snapshot.message).toBe("Gemini CLI is installed but failed to run.");
      expect(snapshot.message).not.toContain(secretStderr);
    }),
  );

  it.effect("falls back to built-in models when ACP model discovery fails", () =>
    Effect.gen(function* () {
      const snapshot = yield* Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped({ prefix: "modesto-gemini-success-" });
          const geminiPath = path.join(dir, "gemini");
          yield* fs.writeFileString(
            geminiPath,
            [
              "#!/bin/sh",
              'if [ "$1" = "--version" ]; then',
              '  printf "0.60.0\\n"',
              "  exit 0",
              "fi",
              'printf "unknown flag\\n" >&2',
              "exit 1",
              "",
            ].join("\n"),
          );
          yield* fs.chmod(geminiPath, 0o755);

          return yield* checkGeminiProviderStatus(
            decodeGeminiSettings({ enabled: true, binaryPath: geminiPath }),
          );
        }),
      );

      expect(snapshot.installed).toBe(true);
      expect(snapshot.version).toBe("0.60.0");
      expect(snapshot.status).toBe("warning");
      expect(snapshot.models.map((m) => m.slug)).toEqual([
        "auto-gemini-3",
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-3-pro",
        "gemini-3-flash",
      ]);
      expect(snapshot.message).toContain("ACP startup failed");
    }),
  );

  it.effect("detects deprecated individual tier auth error and sets unauthenticated status", () =>
    Effect.gen(function* () {
      const snapshot = yield* Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped({ prefix: "modesto-gemini-auth-" });
          const geminiPath = path.join(dir, "gemini");
          yield* fs.writeFileString(
            geminiPath,
            [
              "#!/usr/bin/env node",
              'if (process.argv[2] === "--version") {',
              '  console.log("0.60.0");',
              "  process.exit(0);",
              "}",
              'const readline = require("node:readline");',
              "const rl = readline.createInterface({ input: process.stdin });",
              'rl.on("line", (line) => {',
              "  try {",
              "    const req = JSON.parse(line);",
              '    if (req.method === "initialize") {',
              '      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: req.id, result: { protocolVersion: 1, authMethods: [], agentInfo: { name: "gemini-cli", version: "0.60.0" } } }) + "\\n");',
              '    } else if (req.method === "session/new") {',
              '      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: req.id, error: { code: -32000, message: "IneligibleTierError: This client is no longer supported for Gemini Code Assist for individuals." } }) + "\\n");',
              "    }",
              "  } catch {}",
              "});",
            ].join("\n"),
          );
          yield* fs.chmod(geminiPath, 0o755);

          return yield* checkGeminiProviderStatus(
            decodeGeminiSettings({ enabled: true, binaryPath: geminiPath }),
          );
        }),
      );

      expect(snapshot.installed).toBe(true);
      expect(snapshot.version).toBe("0.60.0");
      expect(snapshot.status).toBe("warning");
      expect(snapshot.auth?.status).toBe("unauthenticated");
      expect(snapshot.message).toContain("Gemini CLI authentication required");
    }),
  );
});
