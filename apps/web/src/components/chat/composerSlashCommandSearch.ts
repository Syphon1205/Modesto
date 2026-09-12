import {
  insertRankedSearchResult,
  normalizeSearchQuery,
  scoreQueryMatch,
} from "@modesto/shared/searchRanking";

import { nativeAppSlashTokens } from "@modesto/shared/nativeAppIntent";
import { webAppSlashTokens } from "~/connections/webAppSlash";

import type { ComposerCommandItem } from "./ComposerCommandMenu";
import { scoreProviderSkill } from "../../providerSkillSearch";

type SlashSearchItem = Extract<
  ComposerCommandItem,
  { type: "slash-command" | "provider-slash-command" | "skill" | "web-app" | "native-app" }
>;

const FUZZY_BASE = 100;

function scoreSlashCommandItem(item: SlashSearchItem, query: string): number | null {
  if (item.type === "skill") {
    const skillQuery =
      query === "skill" ? "" : query.startsWith("skill:") ? query.slice("skill:".length) : query;
    return skillQuery ? scoreProviderSkill(item.skill, skillQuery) : 0;
  }

  if (item.type === "native-app") {
    const scores = nativeAppSlashTokens(item.app).flatMap((token) => {
      const score = scoreQueryMatch({
        value: token.toLowerCase(),
        query,
        exactBase: 0,
        prefixBase: 2,
        boundaryBase: 4,
        includesBase: 6,
        fuzzyBase: FUZZY_BASE,
        boundaryMarkers: ["-", "_", "/", " "],
      });
      return score === null ? [] : [score];
    });
    const descriptionScore = scoreQueryMatch({
      value: item.description.toLowerCase(),
      query,
      exactBase: 20,
      prefixBase: 22,
      boundaryBase: 24,
      includesBase: 26,
    });
    if (descriptionScore !== null) scores.push(descriptionScore);
    return scores.length > 0 ? Math.min(...scores) : null;
  }

  if (item.type === "web-app") {
    const scores = webAppSlashTokens(item.app).flatMap((token) => {
      const score = scoreQueryMatch({
        value: token.toLowerCase(),
        query,
        exactBase: 0,
        prefixBase: 2,
        boundaryBase: 4,
        includesBase: 6,
        fuzzyBase: FUZZY_BASE,
        boundaryMarkers: ["-", "_", "/", " "],
      });
      return score === null ? [] : [score];
    });
    const descriptionScore = scoreQueryMatch({
      value: item.description.toLowerCase(),
      query,
      exactBase: 20,
      prefixBase: 22,
      boundaryBase: 24,
      includesBase: 26,
    });
    if (descriptionScore !== null) scores.push(descriptionScore);
    return scores.length > 0 ? Math.min(...scores) : null;
  }

  const primaryValues =
    item.type === "slash-command"
      ? [item.command, ...(item.aliases ?? [])].map((value) => value.toLowerCase())
      : [item.command.name.toLowerCase()];
  const description = item.description.toLowerCase();

  const scores = [
    ...primaryValues.map((value) =>
      scoreQueryMatch({
        value,
        query,
        exactBase: 0,
        prefixBase: 2,
        boundaryBase: 4,
        includesBase: 6,
        fuzzyBase: FUZZY_BASE,
        boundaryMarkers: ["-", "_", "/"],
      }),
    ),
    scoreQueryMatch({
      value: description,
      query,
      exactBase: 20,
      prefixBase: 22,
      boundaryBase: 24,
      includesBase: 26,
    }),
  ].filter((score): score is number => score !== null);

  if (scores.length === 0) {
    return null;
  }

  return Math.min(...scores);
}

function withDidYouMean(item: SlashSearchItem, score: number): SlashSearchItem {
  if (score < FUZZY_BASE) return item;
  if (item.type === "web-app" || item.type === "native-app") return { ...item, didYouMean: true };
  if (item.type === "slash-command") return { ...item, didYouMean: true };
  return item;
}

export function searchSlashCommandItems(
  items: ReadonlyArray<SlashSearchItem>,
  query: string,
): SlashSearchItem[] {
  const normalizedQuery = normalizeSearchQuery(query, { trimLeadingPattern: /^\/+/ });
  if (!normalizedQuery) {
    return [...items];
  }

  const ranked: Array<{
    item: SlashSearchItem;
    score: number;
    tieBreaker: string;
  }> = [];

  for (const item of items) {
    const score = scoreSlashCommandItem(item, normalizedQuery);
    if (score === null) {
      continue;
    }

    insertRankedSearchResult(
      ranked,
      {
        item: withDidYouMean(item, score),
        score,
        tieBreaker:
          item.type === "slash-command"
            ? `0\u0000${item.command}`
            : item.type === "native-app"
              ? `1\u0000${item.app.id}`
              : item.type === "web-app"
                ? `2\u0000${item.app.id}`
                : item.type === "provider-slash-command"
                  ? `3\u0000${item.command.name}\u0000${item.provider}`
                  : `4\u0000${item.skill.name}\u0000${item.provider}`,
      },
      Number.POSITIVE_INFINITY,
    );
  }

  return ranked.map((entry) => entry.item);
}
