// FILE: ChatLandingSuggestions.logic.ts
// Purpose: Pure data + matching for the empty-landing suggestion cards and the
//          typing-triggered suggestion stack (Codex-style "What should we
//          build?" starters), including rotating card copy variants.
// Layer: Web UI copy/logic
// Exports: LANDING_SUGGESTION_CATEGORIES, LandingSuggestionCategory,
//          LandingSuggestionMatch, matchLandingSuggestions,
//          resolveLandingCategoryCardDescription

export interface LandingSuggestionCategory {
  readonly id: string;
  /** Bold lead word shared by every prompt in this category, e.g. "Explore". */
  readonly label: string;
  /** Optional full prompt inserted when the card itself is clicked. */
  readonly cardPrompt?: string;
  /**
   * Card subtitle variants completing the sentence, e.g. "and understand code".
   * The empty landing rotates through these so the four tiles feel alive.
   */
  readonly cardDescriptions: readonly string[];
  /** Full starter prompts, each beginning with `label`. */
  readonly prompts: readonly string[];
}

export const LANDING_SUGGESTION_CATEGORIES: readonly LandingSuggestionCategory[] = [
  {
    id: "explore",
    label: "Explore",
    cardDescriptions: [
      "and understand code",
      "how a feature works",
      "implementation options",
      "and document an API",
    ],
    prompts: [
      "Explore and explain how a feature works",
      "Explore implementation options for a feature",
      "Explore and compare architectural approaches",
      "Explore and document an API",
    ],
  },
  {
    id: "build",
    label: "Build",
    cardDescriptions: [
      "a new feature, app, or tool",
      "a small automation",
      "a first draft to iterate on",
      "tests alongside a feature",
    ],
    prompts: [
      "Build a new feature end to end",
      "Build a small tool to automate a task",
      "Build a first draft, then iterate from feedback",
      "Build tests alongside a new feature",
    ],
  },
  {
    id: "review",
    label: "Review",
    cardDescriptions: [
      "code and suggest changes",
      "this pull request",
      "recent changes for quality",
      "code for security issues",
    ],
    prompts: [
      "Review this pull request for correctness",
      "Review recent changes and suggest improvements",
      "Review code for security issues",
      "Review and simplify a messy function",
    ],
  },
  {
    id: "fix",
    label: "Fix",
    cardDescriptions: [
      "issues and failures",
      "a failing test",
      "a crash and find the cause",
      "flaky CI and stabilize it",
    ],
    prompts: [
      "Fix a failing test",
      "Fix a bug reported by a user",
      "Fix a crash and explain the root cause",
      "Fix flaky CI and stabilize it",
    ],
  },
];

/** Lightweight starters for a conversation that is not scoped to coding work. */
export const CHAT_LANDING_SUGGESTION_CATEGORIES: readonly LandingSuggestionCategory[] = [
  {
    id: "explain",
    label: "Explain",
    cardDescriptions: [
      "a complicated idea simply",
      "something I am learning",
      "the tradeoffs in a decision",
      "a topic step by step",
    ],
    prompts: [
      "Explain a complicated idea in simple terms",
      "Explain the tradeoffs in a decision I am making",
      "Explain a topic step by step",
      "Explain something I am learning with examples",
    ],
  },
  {
    id: "write",
    label: "Write",
    cardDescriptions: [
      "and refine a first draft",
      "a clear message",
      "a polished summary",
      "something in my voice",
    ],
    prompts: [
      "Write and refine a first draft with me",
      "Write a clear message for someone",
      "Write a polished summary from my notes",
      "Write something concise in my voice",
    ],
  },
  {
    id: "brainstorm",
    label: "Brainstorm",
    cardDescriptions: [
      "ideas for something new",
      "different ways to approach this",
      "names and creative directions",
      "possibilities without judging yet",
    ],
    prompts: [
      "Brainstorm ideas for something new",
      "Brainstorm different ways to approach a problem",
      "Brainstorm names and creative directions",
      "Brainstorm possibilities before we narrow them down",
    ],
  },
  {
    id: "plan",
    label: "Plan",
    cardDescriptions: [
      "my next steps",
      "a project from start to finish",
      "a realistic schedule",
      "around constraints and priorities",
    ],
    prompts: [
      "Plan my next steps for a goal",
      "Plan a project from start to finish",
      "Plan a realistic schedule for this week",
      "Plan around my constraints and priorities",
    ],
  },
];

/** How often empty-landing card subtitles rotate (ms). */
export const LANDING_CATEGORY_ROTATION_MS = 5_500;

export interface LandingSuggestionMatch {
  readonly categoryId: string;
  readonly prompt: string;
  /** Length of the leading substring that matches the typed text — used to
   * mute the matched portion and emphasize the remainder. */
  readonly matchedLength: number;
}

const MAX_SUGGESTION_MATCHES = 4;

/**
 * Picks which card subtitle to show for a category. Rotation is staggered by
 * category index so the four tiles don't flip in lockstep.
 */
export function resolveLandingCategoryCardDescription(
  category: LandingSuggestionCategory,
  rotationTick: number,
  categoryIndex: number,
): string {
  const variants = category.cardDescriptions;
  if (variants.length === 0) {
    return "";
  }
  const offset = (rotationTick + categoryIndex) % variants.length;
  return variants[offset] ?? variants[0]!;
}

/**
 * Matches the typed prefix against every starter prompt, case-insensitively,
 * ranking prompts that start with the typed text ahead of ones that merely
 * contain it. Returns at most {@link MAX_SUGGESTION_MATCHES} results, or an
 * empty array once the prompt has diverged from every starter (normal typing
 * should fall through to nothing, not a stale suggestion list).
 */
export function matchLandingSuggestions(rawPrompt: string): readonly LandingSuggestionMatch[] {
  return matchLandingSuggestionsForCategories(rawPrompt, LANDING_SUGGESTION_CATEGORIES);
}

export function matchLandingSuggestionsForCategories(
  rawPrompt: string,
  categories: readonly LandingSuggestionCategory[],
): readonly LandingSuggestionMatch[] {
  const needle = rawPrompt.trim().toLowerCase();
  if (needle.length === 0) {
    return [];
  }
  const prefixMatches: LandingSuggestionMatch[] = [];
  const containsMatches: LandingSuggestionMatch[] = [];
  for (const category of categories) {
    for (const prompt of category.prompts) {
      const haystack = prompt.toLowerCase();
      if (haystack.startsWith(needle)) {
        prefixMatches.push({ categoryId: category.id, prompt, matchedLength: needle.length });
        continue;
      }
      if (haystack.includes(needle)) {
        containsMatches.push({ categoryId: category.id, prompt, matchedLength: needle.length });
      }
    }
  }
  return [...prefixMatches, ...containsMatches].slice(0, MAX_SUGGESTION_MATCHES);
}
