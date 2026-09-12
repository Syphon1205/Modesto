import { describe, expect, it } from "vite-plus/test";
import { ProviderInstanceId } from "@modesto/contracts";
import { createModelSelection } from "@modesto/shared/model";

import {
  buildGithubCopilotAcpSpawnInput,
  githubCopilotAcpSpawnFlagsFromModelSelection,
} from "./GithubCopilotAcpSupport.ts";

describe("buildGithubCopilotAcpSpawnInput", () => {
  it("starts the Copilot CLI in ACP mode with no extra flags by default", () => {
    expect(buildGithubCopilotAcpSpawnInput(undefined, "/tmp/project", undefined)).toEqual({
      command: "copilot",
      args: ["--acp"],
      cwd: "/tmp/project",
    });
  });

  it("honors a custom binary path", () => {
    expect(
      buildGithubCopilotAcpSpawnInput(
        { binaryPath: "/usr/local/bin/copilot" },
        "/tmp/project",
        undefined,
      ),
    ).toEqual({
      command: "/usr/local/bin/copilot",
      args: ["--acp"],
      cwd: "/tmp/project",
    });
  });

  it("passes model, effort, and long-context flags at spawn time", () => {
    expect(
      buildGithubCopilotAcpSpawnInput({ binaryPath: "copilot" }, "/tmp/project", {
        model: "gpt-5.4",
        reasoningEffort: "high",
        contextWindow: "long_context",
      }),
    ).toEqual({
      command: "copilot",
      args: ["--acp", "--model", "gpt-5.4", "--effort", "high", "--context", "long_context"],
      cwd: "/tmp/project",
    });
  });

  it("omits the default context window so Copilot keeps its own default", () => {
    expect(
      buildGithubCopilotAcpSpawnInput({ binaryPath: "copilot" }, "/tmp/project", {
        contextWindow: "default",
      }),
    ).toEqual({
      command: "copilot",
      args: ["--acp"],
      cwd: "/tmp/project",
    });
  });
});

describe("githubCopilotAcpSpawnFlagsFromModelSelection", () => {
  it("reads model and option descriptors from the picker selection", () => {
    expect(
      githubCopilotAcpSpawnFlagsFromModelSelection(
        createModelSelection(ProviderInstanceId.make("githubCopilot"), "claude-sonnet-4.6", [
          { id: "reasoningEffort", value: "xhigh" },
          { id: "contextWindow", value: "long_context" },
        ]),
      ),
    ).toEqual({
      model: "claude-sonnet-4.6",
      reasoningEffort: "xhigh",
      contextWindow: "long_context",
    });
  });
});
