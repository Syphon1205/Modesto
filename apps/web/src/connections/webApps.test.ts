import { describe, expect, it } from "vite-plus/test";

import { webAppIcon, WEB_APP_ICON_BY_ID } from "~/components/WebAppIcons";
import {
  collectWebAppsFromPrompt,
  matchWebAppMentions,
  resolveWebAppMention,
  serializeComposerWebAppMention,
  WEB_APPS,
  webAppForMentionPath,
} from "./webApps";

describe("web app catalog", () => {
  it("keeps ids unique and gives every app a real icon", () => {
    const ids = WEB_APPS.map((app) => app.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const app of WEB_APPS) {
      // A missing entry silently falls back to the generic globe, which reads
      // as "some website" next to a mention that names a specific product.
      expect(WEB_APP_ICON_BY_ID[app.id], `no icon for ${app.id}`).toBeDefined();
      expect(webAppIcon(app.id)).toBe(WEB_APP_ICON_BY_ID[app.id]);
    }
  });

  it("gives every app the cookies a sign-in probe will look for", () => {
    for (const app of WEB_APPS) {
      expect(app.sessionCookieNames.length, `no session cookies for ${app.id}`).toBeGreaterThan(0);
      expect(app.cookieDomain.startsWith("."), `${app.id} domain should be host-wide`).toBe(true);
    }
  });
});

describe("resolveWebAppMention", () => {
  it("matches the id, the display name, and declared aliases", () => {
    expect(resolveWebAppMention("gmail")?.id).toBe("gmail");
    expect(resolveWebAppMention("Gmail")?.id).toBe("gmail");
    expect(resolveWebAppMention("google mail")?.id).toBe("gmail");
    expect(resolveWebAppMention("google-mail")?.id).toBe("gmail");
    expect(resolveWebAppMention("sheets")?.id).toBe("google-sheets");
    expect(resolveWebAppMention("Google Sheets")?.id).toBe("google-sheets");
    expect(resolveWebAppMention("teams")?.id).toBe("teams");
    expect(resolveWebAppMention("microsoft teams")?.id).toBe("teams");
    expect(resolveWebAppMention("linear")?.id).toBe("linear");
    expect(resolveWebAppMention("jira")?.id).toBe("jira");
    expect(resolveWebAppMention("atlassian")?.id).toBe("jira");
    expect(resolveWebAppMention("sentry")?.id).toBe("sentry");
    expect(resolveWebAppMention("github")?.id).toBe("github");
    expect(resolveWebAppMention("gh")?.id).toBe("github");
    expect(resolveWebAppMention("vercel")?.id).toBe("vercel");
    expect(resolveWebAppMention("now")?.id).toBe("vercel");
    expect(resolveWebAppMention("reminders")?.id).toBe("google-tasks");
    expect(resolveWebAppMention("messages")?.id).toBe("google-messages");
    expect(resolveWebAppMention("gchat")?.id).toBe("google-chat");
    expect(resolveWebAppMention("drive")?.id).toBe("google-drive");
    expect(resolveWebAppMention("salesforce")?.id).toBe("salesforce");
    expect(resolveWebAppMention("sfdc")?.id).toBe("salesforce");
    expect(resolveWebAppMention("hubspot")?.id).toBe("hubspot");
    expect(resolveWebAppMention("hs")?.id).toBe("hubspot");
    expect(resolveWebAppMention("figma")?.id).toBe("figma");
    expect(resolveWebAppMention("higgsfield")?.id).toBe("higgsfield");
    expect(resolveWebAppMention("higgs")?.id).toBe("higgsfield");
    expect(resolveWebAppMention("discord")?.id).toBe("discord");
    expect(resolveWebAppMention("canva")?.id).toBe("canva");
    expect(resolveWebAppMention("supabase")?.id).toBe("supabase");
    expect(resolveWebAppMention("zoom")?.id).toBe("zoom");
    expect(resolveWebAppMention("framer")?.id).toBe("framer");
    expect(resolveWebAppMention("asana")?.id).toBe("asana");
    expect(resolveWebAppMention("stripe")?.id).toBe("stripe");
    expect(resolveWebAppMention("dropbox")?.id).toBe("dropbox");
  });

  it("returns nothing for an unknown or empty mention", () => {
    expect(resolveWebAppMention("")).toBeUndefined();
    expect(resolveWebAppMention("   ")).toBeUndefined();
    expect(resolveWebAppMention("myspace")).toBeUndefined();
  });

  it("does not confuse the two mail apps", () => {
    expect(resolveWebAppMention("outlook")?.id).toBe("outlook");
    expect(resolveWebAppMention("hotmail")?.id).toBe("outlook");
  });
});

describe("matchWebAppMentions", () => {
  it("offers everything for an empty query and narrows as you type", () => {
    expect(matchWebAppMentions("")).toHaveLength(WEB_APPS.length);
    // Gmail is in this list through its `google-mail` alias, not its name -
    // typing "goog" should reach every Google app the user might mean.
    expect(matchWebAppMentions("goog").map((app) => app.id)).toEqual([
      "gmail",
      "google-drive",
      "google-sheets",
      "google-docs",
      "google-slides",
      "google-calendar",
      "google-tasks",
      "google-messages",
      "google-chat",
    ]);
    expect(matchWebAppMentions("mail").map((app) => app.id)).toEqual(["gmail", "outlook"]);
    expect(matchWebAppMentions("team").map((app) => app.id)).toEqual(["teams"]);
    expect(matchWebAppMentions("lin").map((app) => app.id)).toEqual([
      "calendly",
      "linear",
      "linkedin",
    ]);
    expect(matchWebAppMentions("remind").map((app) => app.id)).toEqual(["google-tasks"]);
    expect(matchWebAppMentions("slack").map((app) => app.id)).toEqual(["slack"]);
  });
});

describe("collectWebAppsFromPrompt", () => {
  it("collects unique mentioned apps in prompt order", () => {
    expect(
      collectWebAppsFromPrompt("Check @gmail then @sheets and @gmail again").map((app) => app.id),
    ).toEqual(["gmail", "google-sheets"]);
  });

  it("still matches a mention at the end of the prompt", () => {
    expect(collectWebAppsFromPrompt("Open @gmail").map((app) => app.id)).toEqual(["gmail"]);
  });

  it("collects CRM and Drive mentions from a mixed prompt", () => {
    expect(
      collectWebAppsFromPrompt("pull up sales from @drive and @salesforce then @hubspot").map(
        (app) => app.id,
      ),
    ).toEqual(["google-drive", "salesforce", "hubspot"]);
  });
});

describe("webAppForMentionPath", () => {
  it("treats bare catalog tokens as apps and leaves file paths alone", () => {
    expect(webAppForMentionPath("drive")?.id).toBe("google-drive");
    expect(webAppForMentionPath("salesforce")?.id).toBe("salesforce");
    expect(webAppForMentionPath("src/drive")).toBeUndefined();
    expect(serializeComposerWebAppMention("drive")).toBe("@drive");
    expect(serializeComposerWebAppMention("README.md")).toBeNull();
  });
});
