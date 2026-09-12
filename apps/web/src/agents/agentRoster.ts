// FILE: agentRoster.ts
// Purpose: Pure roster logic for agent bots — creating, editing, ordering, and
//          rolling thread state up into a single per-bot activity. React-free
//          so every rule here is directly testable.
// Layer: Agents UI (logic)

import type { AgentBot, AgentBotActivity, AgentBotDraft } from "@modesto/contracts";
import type { AgentAwarenessPhase } from "@modesto/shared/agentAwareness";
import { avatarSpecForName, normalizeAvatarSpec } from "./avatar/agentAvatarRandom";

/**
 * One thread a bot started, as the roster needs it.
 *
 * `phase` is the canonical thread phase from `projectThreadAwareness` rather
 * than a status this module re-derives: the rules for "is this thread waiting
 * on me" are subtle (pending approvals vs pending input vs an errored session
 * behind a completed turn) and they already live in one place. Duplicating
 * them here would guarantee the roster and the ambient orb eventually
 * disagreed about the same thread.
 */
export interface AgentRosterThread {
  readonly botId: string;
  readonly phase: AgentAwarenessPhase | null;
  readonly updatedAt: number;
}

/**
 * The bot's single activity, rolled up from its threads.
 *
 * Order matters and is not arbitrary: anything that needs a human ("waiting")
 * outranks work in flight, because the roster's job is to surface the thing
 * the user has to act on. A failure only shows once nothing is live — a bot
 * that already retried and is working again is not a failed bot.
 */
export function rollUpBotActivity(threads: ReadonlyArray<AgentRosterThread>): AgentBotActivity {
  if (threads.length === 0) return "idle";
  const has = (...phases: ReadonlyArray<AgentAwarenessPhase>): boolean =>
    threads.some((thread) => thread.phase !== null && phases.includes(thread.phase));
  if (has("waiting_for_approval", "waiting_for_input")) return "waiting";
  if (has("running", "starting")) return "working";
  if (has("failed")) return "failed";
  if (has("completed")) return "done";
  return "idle";
}

export function threadsForBot(
  threads: ReadonlyArray<AgentRosterThread>,
  botId: string,
): ReadonlyArray<AgentRosterThread> {
  return threads.filter((thread) => thread.botId === botId);
}

/** Activity for every bot in one pass, so a roster render is O(threads + bots). */
export function rollUpRosterActivity(
  bots: ReadonlyArray<AgentBot>,
  threads: ReadonlyArray<AgentRosterThread>,
): ReadonlyMap<string, AgentBotActivity> {
  const byBot = new Map<string, Array<AgentRosterThread>>();
  for (const thread of threads) {
    const bucket = byBot.get(thread.botId);
    if (bucket) bucket.push(thread);
    else byBot.set(thread.botId, [thread]);
  }
  return new Map(bots.map((bot) => [bot.id, rollUpBotActivity(byBot.get(bot.id) ?? [])]));
}

/** Ids are opaque; `crypto.randomUUID` where available, time+entropy otherwise. */
export function createAgentBotId(): string {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return `bot_${globalCrypto.randomUUID()}`;
  }
  return `bot_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Names are not unique keys (ids are), but two bots called "Scout" in one
 * roster defeats the point of a roster you can recognise, so duplicates get a
 * numeric suffix on the way in.
 */
export function uniqueBotName(
  name: string,
  existing: ReadonlyArray<AgentBot>,
  ignoreId?: string,
): string {
  const trimmed = name.trim() || "Agent";
  const taken = new Set(
    existing.filter((bot) => bot.id !== ignoreId).map((bot) => bot.name.trim().toLowerCase()),
  );
  if (!taken.has(trimmed.toLowerCase())) return trimmed;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${trimmed} ${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${trimmed} ${Date.now().toString(36)}`;
}

export interface CreateAgentBotInput {
  readonly draft: AgentBotDraft;
  readonly existing: ReadonlyArray<AgentBot>;
  readonly now: number;
}

export function createAgentBot(input: CreateAgentBotInput): AgentBot {
  const name = uniqueBotName(input.draft.name, input.existing);
  return {
    id: createAgentBotId(),
    name,
    tagline: input.draft.tagline.trim().slice(0, 120),
    persona: input.draft.persona.trim().slice(0, 8_000),
    // A bot created without opening the lab still gets a face, derived from
    // its name — an empty circle in the roster reads as a broken row.
    avatar: normalizeAvatarSpec(input.draft.avatar ?? avatarSpecForName(name)),
    model: input.draft.model,
    homeProjectKey: input.draft.homeProjectKey,
    createdAt: input.now,
    updatedAt: input.now,
    archived: false,
  };
}

export function applyAgentBotDraft(
  bot: AgentBot,
  draft: AgentBotDraft,
  existing: ReadonlyArray<AgentBot>,
  now: number,
): AgentBot {
  return {
    ...bot,
    name: uniqueBotName(draft.name, existing, bot.id),
    tagline: draft.tagline.trim().slice(0, 120),
    persona: draft.persona.trim().slice(0, 8_000),
    avatar: normalizeAvatarSpec(draft.avatar),
    model: draft.model,
    homeProjectKey: draft.homeProjectKey,
    updatedAt: now,
  };
}

export function draftFromBot(bot: AgentBot): AgentBotDraft {
  return {
    name: bot.name,
    tagline: bot.tagline,
    persona: bot.persona,
    avatar: bot.avatar,
    model: bot.model,
    homeProjectKey: bot.homeProjectKey,
  };
}

/**
 * Roster order: bots that need attention first, then the rest by recency.
 *
 * Within the attention band the order is stable by id rather than by
 * timestamp, so a row never swaps places under the cursor just because a
 * token arrived — the same rule the Agents panel already follows.
 */
const ACTIVITY_RANK: Record<AgentBotActivity, number> = {
  waiting: 0,
  working: 1,
  failed: 2,
  done: 3,
  idle: 4,
};

export function sortRoster(
  bots: ReadonlyArray<AgentBot>,
  activityOf: (bot: AgentBot) => AgentBotActivity,
): ReadonlyArray<AgentBot> {
  return bots.toSorted((left, right) => {
    const rank = ACTIVITY_RANK[activityOf(left)] - ACTIVITY_RANK[activityOf(right)];
    if (rank !== 0) return rank;
    if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt;
    return left.id.localeCompare(right.id);
  });
}

export function visibleBots(bots: ReadonlyArray<AgentBot>): ReadonlyArray<AgentBot> {
  return bots.filter((bot) => !bot.archived);
}

export function searchBots(bots: ReadonlyArray<AgentBot>, query: string): ReadonlyArray<AgentBot> {
  const needle = query.trim().toLowerCase();
  if (needle === "") return bots;
  return bots.filter(
    (bot) =>
      bot.name.toLowerCase().includes(needle) ||
      bot.tagline.toLowerCase().includes(needle) ||
      bot.persona.toLowerCase().includes(needle),
  );
}

/**
 * The opening message for a task this bot runs.
 *
 * The persona is prepended as a plain block rather than sent through a
 * provider-specific system-prompt field: drivers disagree about whether they
 * even have one, and a bot whose character silently evaporates on half the
 * providers is worse than one that always states it.
 */
export function composeBotTaskPrompt(bot: AgentBot, task: string): string {
  const persona = bot.persona.trim();
  const body = task.trim();
  if (persona === "") return body;
  return `You are ${bot.name}.\n\n${persona}\n\n---\n\n${body}`;
}
