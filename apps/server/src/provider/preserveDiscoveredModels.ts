// FILE: preserveDiscoveredModels.ts
// Purpose: Keep a provider's previously discovered model list when a refresh
//          comes back with nothing.
// Layer: Provider snapshot policy (pure)
//
// Why this exists: model options in the UI are derived purely from the last
// published `ServerProvider` snapshot - nothing re-fetches them when the model
// picker opens. So a snapshot published with an empty `models` array empties
// the picker until the next successful refresh, which is up to a full health
// interval (5 minutes by default) away.
//
// That is exactly what a slow or failed discovery produces. Discovery for the
// ACP providers means spawning the CLI and completing a real session handshake
// (measured: ~2.3s for `cursor-agent acp`, ~2.0s for `kilo models`), and every
// one of those paths has a timeout branch and a failure branch that fall back
// to "models from settings" - an empty list for anyone who never typed a
// custom model.
//
// The rule here is deliberately narrow: carry the old list forward ONLY when
// the new snapshot has no models at all and the provider is still enabled and
// installed. A provider that went disabled, uninstalled, or that genuinely
// reports a different (even shorter) list is left alone - stale options are
// better than none, but only while there is reason to believe the old ones are
// still real.

import type { ServerProvider } from "@modesto/contracts";

export function preserveDiscoveredModels(
  previous: ServerProvider | null,
  next: ServerProvider,
): ServerProvider {
  if (previous === null) return next;
  if (next.models.length > 0) return next;
  if (previous.models.length === 0) return next;
  // A disabled provider should show nothing; that is a state change, not a
  // failed probe.
  if (!next.enabled || next.status === "disabled") return next;
  // Nothing to keep alive if the binary is gone - an uninstalled provider
  // reporting its old models would be actively misleading.
  if (next.installed === false) return next;

  return { ...next, models: previous.models };
}
