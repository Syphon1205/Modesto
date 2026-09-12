// FILE: GithubCopilotTextGeneration.ts
// Purpose: Commit message / PR content / branch name / thread title
//          generation via GitHub Copilot's ACP session, adapted from
//          GrokTextGeneration.ts. No live model-switch step here (unlike
//          Grok's applyGrokAcpModelSelection) - the requested model is passed
//          straight into the spawn command, since GithubCopilotAcpSupport.ts
//          only ever sets it at process start.
// @module textGeneration/GithubCopilotTextGeneration

import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import { ChildProcessSpawner } from "effect/unstable/process";
import type * as EffectAcpErrors from "effect-acp/errors";

import { type GithubCopilotSettings, type ModelSelection } from "@modesto/contracts";
import { sanitizeBranchFragment, sanitizeFeatureBranchName } from "@modesto/shared/git";
import { extractJsonObject } from "@modesto/shared/schemaJson";

import { TextGenerationError } from "@modesto/contracts";
import * as TextGeneration from "./TextGeneration.ts";
import {
  buildBranchNamePrompt,
  buildCommitMessagePrompt,
  buildPrContentPrompt,
  buildThreadTitlePrompt,
} from "./TextGenerationPrompts.ts";
import {
  sanitizeCommitSubject,
  sanitizePrTitle,
  sanitizeThreadTitle,
} from "./TextGenerationUtils.ts";
import {
  githubCopilotAcpSpawnFlagsFromModelSelection,
  makeGithubCopilotAcpRuntime,
} from "../provider/acp/GithubCopilotAcpSupport.ts";

const GITHUB_COPILOT_TIMEOUT_MS = 180_000;

const isTextGenerationError = Schema.is(TextGenerationError);

export const makeGithubCopilotTextGeneration = Effect.fn("makeGithubCopilotTextGeneration")(
  function* (
    githubCopilotSettings: GithubCopilotSettings,
    environment: NodeJS.ProcessEnv = process.env,
  ) {
    const crypto = yield* Crypto.Crypto;
    const commandSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;

    const runGithubCopilotJson = <S extends Schema.Top>({
      operation,
      cwd,
      prompt,
      outputSchemaJson,
      modelSelection,
    }: {
      operation:
        | "generateCommitMessage"
        | "generatePrContent"
        | "generateBranchName"
        | "generateThreadTitle";
      cwd: string;
      prompt: string;
      outputSchemaJson: S;
      modelSelection: ModelSelection;
    }): Effect.Effect<S["Type"], TextGenerationError, S["DecodingServices"]> =>
      Effect.gen(function* () {
        const outputRef = yield* Ref.make("");
        const runtime = yield* makeGithubCopilotAcpRuntime({
          githubCopilotSettings,
          environment,
          childProcessSpawner: commandSpawner,
          cwd,
          ...githubCopilotAcpSpawnFlagsFromModelSelection(modelSelection),
          clientInfo: { name: "t3-code-git-text", version: "0.0.0" },
        }).pipe(Effect.provideService(Crypto.Crypto, crypto));

        yield* runtime.handleSessionUpdate((notification) => {
          const update = notification.update;
          if (update.sessionUpdate !== "agent_message_chunk") {
            return Effect.void;
          }
          const content = update.content;
          if (content.type !== "text") {
            return Effect.void;
          }
          return Ref.update(outputRef, (current) => current + content.text);
        });

        const promptResult = yield* Effect.gen(function* () {
          yield* runtime.start();
          return yield* runtime.prompt({
            prompt: [{ type: "text", text: prompt }],
          });
        }).pipe(
          Effect.timeoutOption(GITHUB_COPILOT_TIMEOUT_MS),
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.fail(
                  new TextGenerationError({
                    operation,
                    detail: "GitHub Copilot ACP request timed out.",
                  }),
                ),
              onSome: (value) => Effect.succeed(value),
            }),
          ),
          Effect.mapError((cause: EffectAcpErrors.AcpError | TextGenerationError) =>
            isTextGenerationError(cause)
              ? cause
              : new TextGenerationError({
                  operation,
                  detail: "GitHub Copilot ACP request failed.",
                  cause,
                }),
          ),
        );

        const trimmed = (yield* Ref.get(outputRef)).trim();
        if (!trimmed) {
          return yield* new TextGenerationError({
            operation,
            detail:
              promptResult.stopReason === "cancelled"
                ? "GitHub Copilot ACP request was cancelled."
                : "GitHub Copilot returned empty output.",
          });
        }

        const decodeOutput = Schema.decodeEffect(Schema.fromJsonString(outputSchemaJson));
        return yield* decodeOutput(extractJsonObject(trimmed)).pipe(
          Effect.catchTags({
            SchemaError: (cause) =>
              Effect.fail(
                new TextGenerationError({
                  operation,
                  detail: "GitHub Copilot returned invalid structured output.",
                  cause,
                }),
              ),
          }),
        );
      }).pipe(
        Effect.mapError((cause) =>
          isTextGenerationError(cause)
            ? cause
            : new TextGenerationError({
                operation,
                detail: "GitHub Copilot ACP text generation failed.",
                cause,
              }),
        ),
        Effect.scoped,
      );

    const generateCommitMessage: TextGeneration.TextGeneration["Service"]["generateCommitMessage"] =
      Effect.fn("GithubCopilotTextGeneration.generateCommitMessage")(function* (input) {
        const { prompt, outputSchema } = buildCommitMessagePrompt({
          branch: input.branch,
          stagedSummary: input.stagedSummary,
          stagedPatch: input.stagedPatch,
          includeBranch: input.includeBranch === true,
          policy: input.policy,
        });

        const generated = yield* runGithubCopilotJson({
          operation: "generateCommitMessage",
          cwd: input.cwd,
          prompt,
          outputSchemaJson: outputSchema,
          modelSelection: input.modelSelection,
        });

        return {
          subject: sanitizeCommitSubject(generated.subject),
          body: generated.body.trim(),
          ...("branch" in generated && typeof generated.branch === "string"
            ? { branch: sanitizeFeatureBranchName(generated.branch) }
            : {}),
        };
      });

    const generatePrContent: TextGeneration.TextGeneration["Service"]["generatePrContent"] =
      Effect.fn("GithubCopilotTextGeneration.generatePrContent")(function* (input) {
        const { prompt, outputSchema } = buildPrContentPrompt({
          baseBranch: input.baseBranch,
          headBranch: input.headBranch,
          commitSummary: input.commitSummary,
          diffSummary: input.diffSummary,
          diffPatch: input.diffPatch,
          policy: input.policy,
          changeRequestTemplate: input.changeRequestTemplate,
        });

        const generated = yield* runGithubCopilotJson({
          operation: "generatePrContent",
          cwd: input.cwd,
          prompt,
          outputSchemaJson: outputSchema,
          modelSelection: input.modelSelection,
        });

        return {
          title: sanitizePrTitle(generated.title),
          body: generated.body.trim(),
        };
      });

    const generateBranchName: TextGeneration.TextGeneration["Service"]["generateBranchName"] =
      Effect.fn("GithubCopilotTextGeneration.generateBranchName")(function* (input) {
        const { prompt, outputSchema } = buildBranchNamePrompt({
          message: input.message,
          attachments: input.attachments,
        });

        const generated = yield* runGithubCopilotJson({
          operation: "generateBranchName",
          cwd: input.cwd,
          prompt,
          outputSchemaJson: outputSchema,
          modelSelection: input.modelSelection,
        });

        return {
          branch: sanitizeBranchFragment(generated.branch),
        };
      });

    const generateThreadTitle: TextGeneration.TextGeneration["Service"]["generateThreadTitle"] =
      Effect.fn("GithubCopilotTextGeneration.generateThreadTitle")(function* (input) {
        const { prompt, outputSchema } = buildThreadTitlePrompt({
          message: input.message,
          previousTitle: input.previousTitle,
          attachments: input.attachments,
        });

        const generated = yield* runGithubCopilotJson({
          operation: "generateThreadTitle",
          cwd: input.cwd,
          prompt,
          outputSchemaJson: outputSchema,
          modelSelection: input.modelSelection,
        });

        return {
          title: sanitizeThreadTitle(generated.title),
        } satisfies TextGeneration.ThreadTitleGenerationResult;
      });

    return {
      generateCommitMessage,
      generatePrContent,
      generateBranchName,
      generateThreadTitle,
    } satisfies TextGeneration.TextGeneration["Service"];
  },
);
