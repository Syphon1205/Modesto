import { describe, expect, it } from "vite-plus/test";

import {
  CHAT_LANDING_SUGGESTION_CATEGORIES,
  matchLandingSuggestionsForCategories,
  resolveLandingCategoryCardDescription,
} from "./ChatLandingSuggestions.logic";

describe("chat landing suggestions", () => {
  it("offers four non-coding conversation categories", () => {
    expect(CHAT_LANDING_SUGGESTION_CATEGORIES.map((category) => category.id)).toEqual([
      "explain",
      "write",
      "brainstorm",
      "plan",
    ]);
  });

  it("matches typed chat starters against only the supplied categories", () => {
    const matches = matchLandingSuggestionsForCategories(
      "brainstorm",
      CHAT_LANDING_SUGGESTION_CATEGORIES,
    );

    expect(matches).toHaveLength(4);
    expect(matches.every((match) => match.categoryId === "brainstorm")).toBe(true);
  });

  it("rotates conversational card copy deterministically", () => {
    const category = CHAT_LANDING_SUGGESTION_CATEGORIES[0]!;

    expect(resolveLandingCategoryCardDescription(category, 0, 0)).toBe("a complicated idea simply");
    expect(resolveLandingCategoryCardDescription(category, 1, 0)).toBe("something I am learning");
  });
});
