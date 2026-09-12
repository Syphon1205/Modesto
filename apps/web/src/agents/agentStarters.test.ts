import { describe, expect, it } from "vite-plus/test";
import { AGENT_STARTERS, applyAgentStarter } from "./agentStarters";
import { avatarSpecForName } from "./avatar/agentAvatarRandom";
import { composeBotTaskPrompt, createAgentBot } from "./agentRoster";
import type { AgentBotDraft } from "@modesto/contracts";

const draft: AgentBotDraft = {
  name: "My agent",
  tagline: "",
  persona: "",
  avatar: avatarSpecForName("My agent"),
  model: { providerId: "provider::custom", modelId: "model::custom", variant: null },
  homeProjectKey: "environment:project",
};

describe("agent starters", () => {
  it("preserves a chosen face and workspace defaults when changing roles", () => {
    const result = applyAgentStarter(draft, AGENT_STARTERS[0], true);
    expect(result.avatar).toBe(draft.avatar);
    expect(result.model).toBe(draft.model);
    expect(result.homeProjectKey).toBe(draft.homeProjectKey);
    expect(result.name).toBe("Scout");
  });

  it("gives an untouched starter its reproducible character", () => {
    const result = applyAgentStarter(draft, AGENT_STARTERS[1], false);
    expect(result.avatar).toEqual(avatarSpecForName("Patch"));
  });

  it("carries every starter's instructions through creation into a task", () => {
    for (const starter of AGENT_STARTERS) {
      const bot = createAgentBot({
        draft: applyAgentStarter(draft, starter, false),
        existing: [],
        now: 100,
      });
      const prompt = composeBotTaskPrompt(bot, "Investigate this issue");
      expect(prompt).toContain(starter.persona);
      expect(prompt).toContain("Investigate this issue");
      expect(prompt).toContain(`You are ${starter.name}.`);
    }
  });
});
