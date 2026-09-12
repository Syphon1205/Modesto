import { assert, describe, it } from "@effect/vitest";

import { planReleaseAssetPrune, type ReleaseAssetSummary } from "./release-asset-prune.ts";

const releases: readonly ReleaseAssetSummary[] = [
  { tagName: "v0.1.9", isDraft: false, assetNames: [] },
  {
    tagName: "v0.1.8.2",
    isDraft: false,
    assetNames: ["latest.yml", "Modesto-0.1.8.2-x64.exe"],
  },
  {
    tagName: "v0.1.8.1",
    isDraft: false,
    assetNames: ["latest.yml", "Modesto-0.1.8.1-x64.exe"],
  },
  { tagName: "v0.1.7", isDraft: false, assetNames: ["Modesto-0.1.7-x64.dmg"] },
  { tagName: "v0.1.6-draft", isDraft: true, assetNames: ["Modesto-0.1.6-x64.dmg"] },
];

describe("planReleaseAssetPrune", () => {
  it("keeps the current Latest feed and strips older releases", () => {
    const plan = planReleaseAssetPrune(releases, { latestTag: "v0.1.8.2" });
    assert.deepStrictEqual(
      plan.map((entry) => entry.tagName),
      ["v0.1.8.1", "v0.1.7"],
    );
    assert.deepStrictEqual(plan[0]?.assetNames, ["latest.yml", "Modesto-0.1.8.1-x64.exe"]);
  });

  it("also preserves explicitly protected tags", () => {
    const plan = planReleaseAssetPrune(releases, {
      latestTag: "v0.1.8.2",
      keepTags: ["v0.1.8.1"],
    });
    assert.deepStrictEqual(
      plan.map((entry) => entry.tagName),
      ["v0.1.7"],
    );
  });

  it("never lists drafts or asset-less releases", () => {
    const plan = planReleaseAssetPrune(releases, { latestTag: "v0.1.8.2" });
    const tags = new Set(plan.map((entry) => entry.tagName));
    assert.isFalse(tags.has("v0.1.9"));
    assert.isFalse(tags.has("v0.1.6-draft"));
  });

  it("refuses to plan a prune when the Latest feed is unknown", () => {
    assert.throws(() => planReleaseAssetPrune(releases, { latestTag: null }));
    assert.throws(() => planReleaseAssetPrune(releases, { latestTag: "  " }));
  });
});
