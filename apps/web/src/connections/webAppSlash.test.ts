import { describe, expect, it } from "vite-plus/test";

import {
  parseWebAppComposerCommand,
  resolveWebAppSendPrompt,
  resolveWebAppSlashName,
} from "./webAppSlash";
import { searchWebAppMentions, WEB_APP_BY_ID, webAppMentionLabel } from "./webApps";

describe("web app slash and mentions", () => {
  it("resolves /teams, /slack, /gmail, /reminders, and /messages", () => {
    expect(resolveWebAppSlashName("teams")?.id).toBe("teams");
    expect(resolveWebAppSlashName("/slack")?.id).toBe("slack");
    expect(resolveWebAppSlashName("gmail")?.id).toBe("gmail");
    expect(resolveWebAppSlashName("reminders")?.id).toBe("google-tasks");
    expect(resolveWebAppSlashName("messages")?.id).toBe("google-messages");
    expect(resolveWebAppSlashName("salesforce")?.id).toBe("salesforce");
    expect(resolveWebAppSlashName("hubspot")?.id).toBe("hubspot");
    expect(resolveWebAppSlashName("higgsfield")?.id).toBe("higgsfield");
    expect(resolveWebAppSlashName("canva")?.id).toBe("canva");
    expect(resolveWebAppSlashName("drive")?.id).toBe("google-drive");
  });

  it("leaves built-in canvas commands for Canvas, not Google Docs", () => {
    expect(resolveWebAppSlashName("docs")).toBeUndefined();
    expect(resolveWebAppSlashName("slides")).toBeUndefined();
  });

  it("rewrites a slash send into an @ mention the browser opener already understands", () => {
    const parsed = parseWebAppComposerCommand("/slack check my DMs");
    expect(parsed?.app.id).toBe("slack");
    expect(parsed?.task).toBe("check my DMs");
    const prompt = resolveWebAppSendPrompt(parsed!.app, parsed!.task);
    expect(prompt).toContain("@slack");
    expect(prompt).toContain("check my DMs");
  });

  it("keeps picker labels in the @ category", () => {
    expect(webAppMentionLabel(WEB_APP_BY_ID.gmail!)).toBe("@gmail");
    expect(webAppMentionLabel(WEB_APP_BY_ID["google-tasks"]!)).toBe("@reminders");
    expect(webAppMentionLabel(WEB_APP_BY_ID.slack!)).toBe("@slack");
  });
});

describe("searchWebAppMentions", () => {
  it("asks if you meant Slack for a close typo", () => {
    const matches = searchWebAppMentions("slak");
    expect(matches.some((match) => match.app.id === "slack" && match.didYouMean)).toBe(true);
  });

  it("does not mark an exact prefix as a guess", () => {
    const matches = searchWebAppMentions("team");
    expect(matches).toEqual([
      expect.objectContaining({ app: expect.objectContaining({ id: "teams" }), didYouMean: false }),
    ]);
  });
});
