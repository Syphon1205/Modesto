import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { ReviewAvailability, ReviewProvider } from "@modesto/contracts";
import { Effect } from "effect";

import {
  findExecutableOnPath,
  resolveProviderRuntimeExecutable,
} from "../../provider/providerRuntimeDiscovery.ts";
import { ReviewServiceError } from "../Errors.ts";
import { MODESTO_REVIEW_OUTPUT_JSON_SCHEMA } from "../modestoReviewOutput.ts";
import {
  buildModestoReviewPrompt,
  DEFAULT_MODESTO_REVIEW_CONFIGURATION,
  reviewEffortForDepth,
  reviewTimeoutForDepth,
} from "../modestoReviewPrompt.ts";
import type { ReviewProviderAdapter } from "../Services/ReviewProviderAdapter.ts";

const supportedTargets: ReviewAvailability["supportedTargets"] = [
  "currentFile",
  "selectedCode",
  "uncommittedChanges",
  "stagedChanges",
  "selectedFiles",
  "repository",
  "pullRequest",
];
const execFileAsync = promisify(execFile);

export function parseCodeRabbitAuthStatus(output: string): "yes" | "no" | "unknown" {
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const value = JSON.parse(trimmed) as Record<string, unknown>;
      if (value.authenticated === true || value.status === "authenticated") return "yes";
      if (
        value.authenticated === false ||
        value.status === "not_authenticated" ||
        value.status === "unauthenticated"
      ) {
        return "no";
      }
    } catch {
      const normalized = trimmed.toLowerCase();
      if (normalized.includes("not authenticated") || normalized.includes("not logged in")) {
        return "no";
      }
      if (normalized.includes("authenticated") || normalized.includes("logged in")) return "yes";
    }
  }
  return "unknown";
}

function resolveRuntimeExecutable(runtime: "codex" | "cursor"): string | null {
  const resolution = resolveProviderRuntimeExecutable({
    provider: runtime,
    defaultBinary: runtime === "codex" ? "codex" : "cursor-agent",
  });
  return resolution.source === "unresolved" ? null : resolution.executable;
}

function modestoAvailability(): Effect.Effect<ReviewAvailability> {
  const codex = resolveRuntimeExecutable("codex");
  const cursor = resolveRuntimeExecutable("cursor");
  const executable = codex ?? cursor;
  const supportedRuntimes = [
    ...(codex ? (["codex"] as const) : []),
    ...(cursor ? (["cursor"] as const) : []),
  ];
  return Effect.succeed({
    provider: "modesto",
    displayName: "Modesto Review",
    installation: executable ? "detected" : "not-found",
    executable,
    authenticated: "unknown",
    supportedRuntimes,
    supportedTargets,
    message: executable
      ? `Available runtimes: ${supportedRuntimes.map((runtime) => (runtime === "codex" ? "Codex" : "Cursor")).join(", ")}.`
      : "Modesto Review requires the Codex or Cursor CLI.",
  });
}

export function buildCursorReviewArgs(
  prompt: string,
  configuration: typeof DEFAULT_MODESTO_REVIEW_CONFIGURATION,
): ReadonlyArray<string> {
  return [
    "-p",
    "--trust",
    "--mode",
    "ask",
    "--sandbox",
    "enabled",
    "--output-format",
    "stream-json",
    ...(configuration.model ? ["--model", configuration.model] : []),
    prompt,
  ];
}

export function buildCodexReviewArgs(
  prompt: string,
  configuration: typeof DEFAULT_MODESTO_REVIEW_CONFIGURATION,
  cwd: string,
  schemaPath: string,
): ReadonlyArray<string> {
  return [
    "exec",
    "--json",
    "--ephemeral",
    "--skip-git-repo-check",
    "--output-schema",
    schemaPath,
    "-c",
    `model_reasoning_effort="${reviewEffortForDepth(configuration.depth)}"`,
    ...(configuration.model ? ["--model", configuration.model] : []),
    "--sandbox",
    "read-only",
    "-C",
    cwd,
    prompt,
  ];
}

const modestoAdapter: ReviewProviderAdapter = {
  provider: "modesto",
  availability: modestoAvailability,
  buildCommand: (input, cwd) => {
    const configuration = input.configuration ?? DEFAULT_MODESTO_REVIEW_CONFIGURATION;
    const executable = resolveRuntimeExecutable(configuration.runtime);
    if (!executable) {
      return Effect.fail(
        new ReviewServiceError({
          message: `${configuration.runtime === "codex" ? "Codex" : "Cursor"} CLI is not installed or not on PATH.`,
        }),
      );
    }

    const prompt = buildModestoReviewPrompt(input.target, configuration);
    if (configuration.runtime === "cursor") {
      return Effect.succeed({
        executable,
        args: buildCursorReviewArgs(prompt, configuration),
        outputMode: "cursor-jsonl",
        timeoutMs: reviewTimeoutForDepth(configuration.depth),
      });
    }

    return Effect.try({
      try: () => {
        const temporaryDirectory = mkdtempSync(join(tmpdir(), "modesto-review-"));
        const schemaPath = join(temporaryDirectory, "output.schema.json");
        writeFileSync(schemaPath, JSON.stringify(MODESTO_REVIEW_OUTPUT_JSON_SCHEMA), {
          encoding: "utf8",
          mode: 0o600,
        });
        return {
          executable,
          args: buildCodexReviewArgs(prompt, configuration, cwd, schemaPath),
          outputMode: "codex-jsonl" as const,
          timeoutMs: reviewTimeoutForDepth(configuration.depth),
          cleanup: () => rmSync(temporaryDirectory, { recursive: true, force: true }),
        };
      },
      catch: (cause) =>
        new ReviewServiceError({
          message: "Could not prepare the Modesto Review runtime.",
          cause,
        }),
    });
  },
};

function coderabbitAvailability(): Effect.Effect<ReviewAvailability> {
  const executable =
    findExecutableOnPath({ binaryName: "coderabbit" }) ??
    findExecutableOnPath({ binaryName: "cr" });
  if (!executable) {
    return Effect.succeed({
      provider: "coderabbit",
      displayName: "CodeRabbit",
      installation: "not-found",
      executable: null,
      authenticated: "no",
      supportedRuntimes: [],
      supportedTargets: ["uncommittedChanges", "stagedChanges", "repository"],
      message: "Install and sign in to the CodeRabbit CLI to run local reviews.",
    });
  }
  return Effect.tryPromise({
    try: async () => {
      const result = await execFileAsync(executable, ["auth", "status", "--agent"], {
        timeout: 10_000,
        maxBuffer: 512 * 1024,
        env: process.env,
      }).catch((error: unknown) => {
        const candidate = error as { stdout?: string; stderr?: string };
        return { stdout: candidate.stdout ?? "", stderr: candidate.stderr ?? "" };
      });
      const authenticated = parseCodeRabbitAuthStatus(`${result.stdout}\n${result.stderr}`);
      return {
        provider: "coderabbit" as const,
        displayName: "CodeRabbit",
        installation: "detected" as const,
        executable,
        authenticated,
        supportedRuntimes: [],
        supportedTargets: ["uncommittedChanges", "stagedChanges", "repository"] as const,
        message:
          authenticated === "yes"
            ? "CodeRabbit CLI is installed and signed in."
            : authenticated === "no"
              ? "CodeRabbit CLI is installed. Sign in to run local reviews."
              : "CodeRabbit CLI detected. Sign-in status could not be confirmed.",
      };
    },
    catch: () => ({
      provider: "coderabbit" as const,
      displayName: "CodeRabbit",
      installation: "detected" as const,
      executable,
      authenticated: "unknown" as const,
      supportedRuntimes: [],
      supportedTargets: ["uncommittedChanges", "stagedChanges", "repository"] as const,
      message: "CodeRabbit CLI detected. Sign-in status could not be confirmed.",
    }),
  }).pipe(Effect.catch((availability) => Effect.succeed(availability)));
}

const coderabbitAdapter: ReviewProviderAdapter = {
  provider: "coderabbit",
  availability: coderabbitAvailability,
  buildCommand: (input) => {
    const executable =
      findExecutableOnPath({ binaryName: "coderabbit" }) ??
      findExecutableOnPath({ binaryName: "cr" });
    if (!executable) {
      return Effect.fail(
        new ReviewServiceError({
          message: "CodeRabbit CLI is not installed or is not on PATH.",
        }),
      );
    }
    const reviewType =
      input.target.type === "uncommittedChanges" || input.target.type === "stagedChanges"
        ? "uncommitted"
        : "all";
    return Effect.succeed({
      executable,
      args: ["review", "--agent", "--type", reviewType],
      outputMode: "coderabbit-jsonl",
      timeoutMs: 30 * 60 * 1_000,
    });
  },
};

const greptileAdapter: ReviewProviderAdapter = {
  provider: "greptile",
  availability: () =>
    Effect.succeed({
      provider: "greptile",
      displayName: "Greptile",
      installation: "not-found",
      executable: null,
      authenticated: "unknown",
      supportedRuntimes: [],
      supportedTargets: ["pullRequest"],
      message:
        "Connect Greptile to the repository on GitHub. Local review execution is not available yet.",
    }),
  buildCommand: () =>
    Effect.fail(
      new ReviewServiceError({
        message:
          "Greptile reviews run through its GitHub integration and cannot be started locally yet.",
      }),
    ),
};

const adapters: ReadonlyMap<ReviewProvider, ReviewProviderAdapter> = new Map<
  ReviewProvider,
  ReviewProviderAdapter
>([
  [modestoAdapter.provider, modestoAdapter],
  [coderabbitAdapter.provider, coderabbitAdapter],
  [greptileAdapter.provider, greptileAdapter],
]);

export function listReviewProviderAdapters(): ReadonlyArray<ReviewProviderAdapter> {
  return [...adapters.values()];
}

export function getReviewProviderAdapter(provider: ReviewProvider): ReviewProviderAdapter {
  const adapter = adapters.get(provider);
  if (!adapter) {
    throw new Error(`Unknown review provider: ${provider}`);
  }
  return adapter;
}
