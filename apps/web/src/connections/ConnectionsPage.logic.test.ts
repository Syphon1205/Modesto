import { describe, expect, it } from "vite-plus/test";

import { NATIVE_APPS } from "@modesto/shared/nativeApps";

import {
  CATEGORY_ORDER,
  canReportSignIn,
  categoryMatchCounts,
  connectionCopyForWebApp,
  countConnectedApps,
  filterConnectionApps,
  filterConnectionNativeApps,
  groupConnectionApps,
} from "./ConnectionsPage.logic";
import type { WebAppConnectionStatuses } from "./useWebAppConnections";
import { WEB_APPS } from "./webApps";

describe("filterConnectionApps", () => {
  it("keeps the whole catalog in curated order when nothing is typed", () => {
    const all = filterConnectionApps({ query: "", category: "all" });
    expect(all).toHaveLength(WEB_APPS.length);
    expect(all[0]).toBe(WEB_APPS[0]);
  });

  it("cuts the catalog down to one category", () => {
    const crm = filterConnectionApps({ query: "", category: "crm" });
    expect(crm.length).toBeGreaterThan(0);
    expect(crm.every((app) => app.category === "crm")).toBe(true);
  });

  it("finds an app by name", () => {
    const hits = filterConnectionApps({ query: "slack", category: "all" });
    expect(hits[0]?.id).toBe("slack");
  });

  it("tolerates a typo, the same way the composer mention menu does", () => {
    const hits = filterConnectionApps({ query: "slak", category: "all" });
    expect(hits.map((app) => app.id)).toContain("slack");
  });

  it("ignores surrounding whitespace", () => {
    expect(filterConnectionApps({ query: "  ", category: "all" })).toHaveLength(WEB_APPS.length);
  });

  it("applies query and category together", () => {
    const hits = filterConnectionApps({ query: "slack", category: "crm" });
    expect(hits).toHaveLength(0);
  });
});

describe("groupConnectionApps", () => {
  it("drops empty categories and keeps the configured order", () => {
    const groups = groupConnectionApps(filterConnectionApps({ query: "", category: "all" }));
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((group) => group.apps.length > 0)).toBe(true);
    const order = groups.map((group) => group.id);
    const expected = CATEGORY_ORDER.filter((id) => order.includes(id));
    expect(order).toEqual(expected);
  });

  it("places every matching app in exactly one group", () => {
    const apps = filterConnectionApps({ query: "", category: "all" });
    const grouped = groupConnectionApps(apps).flatMap((group) => group.apps);
    expect(grouped).toHaveLength(apps.length);
    expect(new Set(grouped).size).toBe(apps.length);
  });
});

describe("filterConnectionNativeApps", () => {
  it("lists the Adobe suite when nothing is typed", () => {
    const apps = filterConnectionNativeApps({ query: "", category: "all" });
    expect(apps).toHaveLength(NATIVE_APPS.length);
    expect(apps[0]?.id).toBe("photoshop");
  });

  it("finds Photoshop by mention", () => {
    const hits = filterConnectionNativeApps({ query: "photoshop", category: "all" });
    expect(hits.map((app) => app.id)).toContain("photoshop");
  });

  it("hides Adobe apps outside the adobe filter", () => {
    expect(filterConnectionNativeApps({ query: "", category: "design" })).toHaveLength(0);
  });
});

describe("categoryMatchCounts", () => {
  it("counts the whole catalog under `all`", () => {
    expect(categoryMatchCounts("").all).toBe(WEB_APPS.length + NATIVE_APPS.length);
  });

  it("category counts add up to the `all` count", () => {
    const counts = categoryMatchCounts("");
    const summed = CATEGORY_ORDER.reduce((total, id) => total + counts[id], 0) + counts.adobe;
    expect(summed).toBe(counts.all);
  });

  it("narrows with the query", () => {
    const counts = categoryMatchCounts("slack");
    expect(counts.all).toBeLessThan(WEB_APPS.length);
    expect(counts.chat).toBeGreaterThan(0);
  });
});

describe("countConnectedApps", () => {
  const statuses = (overrides: WebAppConnectionStatuses): WebAppConnectionStatuses => ({
    ...Object.fromEntries(WEB_APPS.map((app) => [app.id, { kind: "signed-out" } as const])),
    ...overrides,
  });

  it("counts only connected apps", () => {
    expect(
      countConnectedApps(
        statuses({
          slack: { kind: "connected", expiresAt: null },
          github: { kind: "connected", expiresAt: null },
        }),
      ),
    ).toBe(2);
  });

  it("does not count a still-checking app as connected", () => {
    expect(countConnectedApps(statuses({ slack: { kind: "checking" } }))).toBe(0);
  });
});

describe("canReportSignIn", () => {
  it("is false when every app reports `unavailable`", () => {
    const allUnavailable = Object.fromEntries(
      WEB_APPS.map((app) => [app.id, { kind: "unavailable" } as const]),
    );
    expect(canReportSignIn(allUnavailable)).toBe(false);
  });

  it("is true as soon as one app has a real answer", () => {
    const mixed = {
      ...Object.fromEntries(WEB_APPS.map((app) => [app.id, { kind: "unavailable" } as const])),
      slack: { kind: "signed-out" } as const,
    };
    expect(canReportSignIn(mixed)).toBe(true);
  });
});

describe("connectionCopyForWebApp", () => {
  it("copies an MCP install prompt for Salesforce", () => {
    const salesforce = WEB_APPS.find((app) => app.id === "salesforce");
    expect(salesforce).toBeDefined();
    const copy = connectionCopyForWebApp(salesforce!);
    expect(copy.kind).toBe("mcp");
    expect(copy.text).toContain("claude mcp add --transport http --scope user salesforce");
    expect(copy.text).toContain("codex mcp add salesforce --url");
  });

  it("copies the Higgsfield MCP URL for chat install", () => {
    const higgsfield = WEB_APPS.find((app) => app.id === "higgsfield");
    expect(higgsfield).toBeDefined();
    const copy = connectionCopyForWebApp(higgsfield!);
    expect(copy.kind).toBe("mcp");
    expect(copy.text).toContain("https://mcp.higgsfield.ai/mcp");
  });

  it("copies HTTP MCP commands for Canva and Supabase", () => {
    const canva = connectionCopyForWebApp(WEB_APPS.find((app) => app.id === "canva")!);
    expect(canva.kind).toBe("mcp");
    expect(canva.text).toContain("https://mcp.canva.com/mcp");
    const supabase = connectionCopyForWebApp(WEB_APPS.find((app) => app.id === "supabase")!);
    expect(supabase.kind).toBe("mcp");
    expect(supabase.text).toContain("https://mcp.supabase.com/mcp");
  });

  it("falls back to an @ mention when there is no MCP server", () => {
    const outlook = WEB_APPS.find((app) => app.id === "outlook");
    expect(outlook).toBeDefined();
    const copy = connectionCopyForWebApp(outlook!);
    expect(copy).toEqual({ key: "mention:outlook", text: "@outlook", kind: "mention" });
  });
});
