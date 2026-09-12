import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveSkillPackBundle } from "./skillPackBundle.ts";

const blob = (path: string) => ({ path, sha: `blob-${path}`, type: "blob" });

afterEach(() => vi.unstubAllGlobals());

describe("resolveSkillPackBundle", () => {
  it("discovers conventional skills and pins the installed revision", async () => {
    const tree = [
      blob("skills/review/SKILL.md"),
      blob("skills/review/references/checklist.md"),
      blob("skills/release/SKILL.md"),
    ];
    const files: Record<string, string> = {
      "skills/review/SKILL.md":
        "---\nname: Review code\ndescription: Find risky changes\n---\nReview.",
      "skills/review/references/checklist.md": "Check error paths.",
      "skills/release/SKILL.md": "---\nname: Release\n---\nShip it.",
    };
    vi.stubGlobal("fetch", (request: string | URL | Request) => {
      const url = String(request);
      if (/\/repos\/acme\/skills$/.test(url)) {
        return Promise.resolve(new Response(JSON.stringify({ default_branch: "main" })));
      }
      if (url.includes("/commits/")) {
        return Promise.resolve(new Response(JSON.stringify({ sha: "a".repeat(40) })));
      }
      if (url.includes("/git/trees/")) {
        return Promise.resolve(new Response(JSON.stringify({ tree })));
      }
      const match = Object.entries(files).find(([path]) => url.endsWith(`/${path}`));
      return Promise.resolve(
        new Response(match?.[1] ?? "not found", { status: match ? 200 : 404 }),
      );
    });

    const bundle = await resolveSkillPackBundle({
      url: "https://github.com/acme/skills",
      includeFiles: true,
    });

    expect(bundle.preview.source.revision).toBe("a".repeat(40));
    expect(bundle.preview.skills.map((skill) => skill.name)).toEqual(["Release", "Review code"]);
    expect(bundle.skills.find((skill) => skill.name === "Review code")?.files).toHaveLength(2);
    expect(bundle.preview.providers).toEqual(["codex", "claude"]);
  });
});
