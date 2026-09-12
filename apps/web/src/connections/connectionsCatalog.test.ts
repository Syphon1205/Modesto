import { describe, expect, it } from "vite-plus/test";

import {
  findMarketplaceItemById,
  marketplaceInstallClipboardText,
  WORK_MARKETPLACE_ITEMS,
} from "./connectionsCatalog";

describe("marketplaceInstallClipboardText", () => {
  it("gives Salesforce a pasteable Claude and Codex HTTP command", () => {
    const item = findMarketplaceItemById("salesforce");
    expect(item).toBeDefined();
    const text = marketplaceInstallClipboardText(item!);
    expect(text).toContain(
      "claude mcp add --transport http --scope user salesforce https://api.salesforce.com/platform/mcp/v1/",
    );
    expect(text).toContain(
      "codex mcp add salesforce --url https://api.salesforce.com/platform/mcp/v1/",
    );
  });

  it("gives Higgsfield the hosted MCP URL plus the CLI fallback", () => {
    const item = findMarketplaceItemById("higgsfield");
    expect(item).toBeDefined();
    const text = marketplaceInstallClipboardText(item!);
    expect(text).toContain("https://mcp.higgsfield.ai/mcp");
    expect(text).toContain(
      "claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp",
    );
    expect(text).toContain("codex mcp add higgsfield --url https://mcp.higgsfield.ai/mcp");
    expect(text).toContain("@higgsfield/cli");
  });

  it("gives Canva and Supabase pasteable HTTP commands", () => {
    const canva = marketplaceInstallClipboardText(findMarketplaceItemById("canva")!);
    expect(canva).toContain("https://mcp.canva.com/mcp");
    const supabase = marketplaceInstallClipboardText(findMarketplaceItemById("supabase")!);
    expect(supabase).toContain("https://mcp.supabase.com/mcp");
  });

  it("gives stdio servers a command after --", () => {
    const item = findMarketplaceItemById("playwright");
    expect(item).toBeDefined();
    const text = marketplaceInstallClipboardText(item!);
    expect(text).toContain(
      "claude mcp add --scope user playwright -- npx -y @playwright/mcp@latest",
    );
    expect(text).toContain("codex mcp add playwright -- npx -y @playwright/mcp@latest");
  });

  it("does not invent a command for settings-only catalog rows", () => {
    const item = WORK_MARKETPLACE_ITEMS.find((entry) => entry.install === "settings");
    expect(item).toBeDefined();
    expect(marketplaceInstallClipboardText(item!)).toBeNull();
  });
});
