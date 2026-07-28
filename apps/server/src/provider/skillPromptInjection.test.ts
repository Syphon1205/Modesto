// FILE: skillPromptInjection.test.ts
// Purpose: Verifies which providers receive inlined portable skill instructions
//          and that the inline text respects the turn character budget.
// Layer: Server provider tests

import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildInlineSkillInstructions,
  shouldInlineSkillForProvider,
} from "./skillPromptInjection.ts";

const modestoSkillPath = "/Users/me/.modesto/skills/reviewer/SKILL.md";
const codexSkillPath = "/Users/me/.codex/skills/reviewer/SKILL.md";
const claudeSkillPath = "/Users/me/.claude/skills/reviewer/SKILL.md";
const cursorSkillPath = "/Users/me/.cursor/skills/reviewer/SKILL.md";
const piSkillPath = "/Users/me/.pi/agent/skills/reviewer/SKILL.md";

describe("shouldInlineSkillForProvider", () => {
  it("skips codex-native and modesto roots for codex but inlines foreign provider roots", () => {
    // Codex loads .codex roots natively and ~/.modesto/skills via the extra
    // skill root registered at session start.
    expect(shouldInlineSkillForProvider("codex", modestoSkillPath)).toBe(false);
    expect(shouldInlineSkillForProvider("codex", codexSkillPath)).toBe(false);
    expect(shouldInlineSkillForProvider("codex", claudeSkillPath)).toBe(true);
    expect(shouldInlineSkillForProvider("codex", cursorSkillPath)).toBe(true);
  });

  it("inlines only Modesto-owned paths for cursor", () => {
    expect(shouldInlineSkillForProvider("cursor", modestoSkillPath)).toBe(true);
    expect(shouldInlineSkillForProvider("cursor", cursorSkillPath)).toBe(false);
    expect(shouldInlineSkillForProvider("cursor", codexSkillPath)).toBe(false);
  });

  it("inlines everything except .claude paths for claudeAgent", () => {
    expect(shouldInlineSkillForProvider("claudeAgent", claudeSkillPath)).toBe(false);
    expect(shouldInlineSkillForProvider("claudeAgent", modestoSkillPath)).toBe(true);
    expect(shouldInlineSkillForProvider("claudeAgent", codexSkillPath)).toBe(true);
  });

  it("inlines cross-provider paths for pi but not pi-native skills", () => {
    expect(shouldInlineSkillForProvider("pi", modestoSkillPath)).toBe(true);
    expect(shouldInlineSkillForProvider("pi", claudeSkillPath)).toBe(true);
    expect(shouldInlineSkillForProvider("pi", piSkillPath)).toBe(false);
  });

  it("always inlines for providers without native skill support", () => {
    for (const provider of ["gemini", "grok", "kilo", "opencode"] as const) {
      expect(shouldInlineSkillForProvider(provider, modestoSkillPath)).toBe(true);
      expect(shouldInlineSkillForProvider(provider, claudeSkillPath)).toBe(true);
    }
  });
});

describe("buildInlineSkillInstructions", () => {
  it("inlines skill content for non-native providers and skips unreadable paths", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "skill-inline-"));
    const skillDir = path.join(root, ".modesto", "skills", "reviewer");
    try {
      await mkdir(skillDir, { recursive: true });
      const skillPath = path.join(skillDir, "SKILL.md");
      await writeFile(skillPath, "# Reviewer\n\nAlways review carefully.");

      const text = await buildInlineSkillInstructions({
        provider: "gemini",
        skills: [
          { name: "reviewer", path: skillPath },
          { name: "missing", path: path.join(root, ".modesto", "skills", "missing", "SKILL.md") },
        ],
        maxChars: 10_000,
      });

      expect(text).toContain('<skill name="reviewer"');
      expect(text).toContain("Always review carefully.");
      expect(text).not.toContain("missing");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns empty text when nothing fits in the budget", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "skill-inline-budget-"));
    const skillDir = path.join(root, ".modesto", "skills", "reviewer");
    try {
      await mkdir(skillDir, { recursive: true });
      const skillPath = path.join(skillDir, "SKILL.md");
      await writeFile(skillPath, "content".repeat(100));

      const text = await buildInlineSkillInstructions({
        provider: "gemini",
        skills: [{ name: "reviewer", path: skillPath }],
        maxChars: 50,
      });

      expect(text).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not inline modesto-rooted skills for codex (covered by the extra skill root)", async () => {
    const text = await buildInlineSkillInstructions({
      provider: "codex",
      skills: [{ name: "reviewer", path: modestoSkillPath }],
      maxChars: 10_000,
    });
    expect(text).toBe("");
  });
});
