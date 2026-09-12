// FILE: ProviderModelReleaseNotification.tsx
// Purpose: Announce models a provider has just started offering - "Grok 4.6 is
//          out" - in the bottom-right updates stack.
// Layer: Updates UI
//
// This sits alongside the provider *version* notifications rather than inside
// them: a newer CLI is something the user has to act on, a new model is news
// they can act on whenever they like. Both belong in the same corner, but they
// are not the same event and are not worth collapsing into one message.

import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { SparklesIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { primaryServerProvidersAtom } from "~/state/server";
import { PROVIDER_ICON_BY_PROVIDER } from "../chat/providerIconUtils";
import { stackedThreadToast, updatesToastManager } from "../ui/toast";
import {
  currentProviderModelSlugs,
  describeProviderModelReleaseSource,
  describeProviderModelReleases,
  detectNewProviderModels,
  providerModelReleaseKey,
  type ProviderModelRelease,
} from "./providerModelReleases";
import { useSeenProviderModels } from "./seenProviderModels";

// Announced this session. The persisted seen-set is the durable guard; this is
// only here to stop a re-render from stacking duplicates before the write
// settles.
const announcedReleaseKeys = new Set<string>();

function ProviderModelReleaseIcon({ release }: { readonly release: ProviderModelRelease }) {
  const ProviderIcon = PROVIDER_ICON_BY_PROVIDER[release.driver];

  if (!ProviderIcon) {
    return <SparklesIcon aria-hidden="true" className="size-4 text-success" strokeWidth={2.25} />;
  }

  return (
    <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
      <ProviderIcon aria-hidden="true" className="size-4" />
      <span className="absolute -right-1 -bottom-1 inline-flex size-3 items-center justify-center rounded-full bg-popover">
        <SparklesIcon aria-hidden="true" className="size-2.5 text-success" strokeWidth={2.5} />
      </span>
    </span>
  );
}

export function ProviderModelReleaseNotification() {
  const navigate = useNavigate();
  const providers = useAtomValue(primaryServerProvidersAtom);
  const { seen, recordSeen } = useSeenProviderModels();
  const recordSeenRef = useRef(recordSeen);
  recordSeenRef.current = recordSeen;

  const releases = useMemo(() => detectNewProviderModels({ providers, seen }), [providers, seen]);
  const releaseKey = useMemo(() => providerModelReleaseKey(releases), [releases]);
  const currentSlugs = useMemo(() => currentProviderModelSlugs(providers), [providers]);

  // Record what each provider offers as soon as we have it. On a provider's
  // first appearance this is the silent seeding pass that stops a fresh install
  // announcing its whole catalog; afterwards it is what retires an
  // announcement.
  useEffect(() => {
    if (Object.keys(currentSlugs).length === 0) return;
    recordSeenRef.current(currentSlugs);
  }, [currentSlugs]);

  useEffect(() => {
    if (!releaseKey || releases.length === 0) return;
    if (announcedReleaseKeys.has(releaseKey)) return;
    announcedReleaseKeys.add(releaseKey);

    const title = describeProviderModelReleases(releases);
    const description = describeProviderModelReleaseSource(releases);
    if (!title) return;

    const first = releases[0];
    updatesToastManager.add(
      stackedThreadToast({
        type: "info",
        title,
        description,
        timeout: 0,
        actionProps: {
          children: "Models",
          onClick: () => void navigate({ to: "/settings/providers" }),
        },
        actionVariant: "outline",
        data: {
          hideCopyButton: true,
          ...(first ? { leadingIcon: <ProviderModelReleaseIcon release={first} /> } : {}),
        },
      }),
    );
  }, [navigate, releaseKey, releases]);

  return null;
}
