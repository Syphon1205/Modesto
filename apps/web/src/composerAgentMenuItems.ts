// FILE: composerAgentMenuItems.ts
// Purpose: Build composer menu items for @agent(task) multi-agent delegation.
// Layer: Composer discovery helpers
// Exports: buildComposerAgentMenuItems

import { getAgentMentionAutocompleteAliases, type ProviderKind } from "@modesto/contracts";
import {
  normalizeProviderDiscoveryText,
  rankProviderDiscoveryItems,
} from "~/lib/providerDiscovery";
import type { ComposerCommandItem } from "../components/chat/ComposerCommandMenu";

export type DynamicComposerAgent = {
  readonly name: string;
  readonly displayName: string;
};

export function buildComposerAgentMenuItems(input: {
  readonly provider: ProviderKind;
  readonly query?: string;
  readonly dynamicAgents?: ReadonlyArray<DynamicComposerAgent>;
}): ComposerCommandItem[] {
  const query = normalizeProviderDiscoveryText(input.query ?? "");
  const dynamicAgents = input.dynamicAgents ?? [];

  if (dynamicAgents.length > 0) {
    return rankProviderDiscoveryItems(dynamicAgents, query, ({ name, displayName }) => [
      { value: name },
      { value: displayName },
    ]).map(({ name, displayName }) => ({
      id: `agent:${input.provider}:${name}`,
      type: "agent" as const,
      provider: input.provider,
      alias: name,
      color: "violet" as const,
      label: `@${name}`,
      description: displayName,
    }));
  }

  return rankProviderDiscoveryItems(
    getAgentMentionAutocompleteAliases(input.provider),
    query,
    ({ alias, displayName }) => [{ value: alias }, { value: displayName }],
  ).map(({ alias, displayName, color }) => ({
    id: `agent:${input.provider}:${alias}`,
    type: "agent" as const,
    provider: input.provider,
    alias,
    color,
    label: `@${alias}`,
    description: displayName,
  }));
}
