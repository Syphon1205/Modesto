// FILE: EnvironmentSharedContextSection.tsx
// Purpose: Compact shared-context summary and handoff copy action for the Environment panel.
// Layer: Environment panel section

import {
  type ContextArtifactKind,
  type SharedContextBundle,
  type ThreadId,
} from "@modesto/contracts";
import { formatSharedContextNarrative } from "@modesto/shared/sharedContext";
import { useCallback, useEffect, useMemo, useState } from "react";

import { copyTextToClipboard } from "~/hooks/useCopyToClipboard";
import { CheckIcon, CopyIcon, LoaderIcon, RefreshCwIcon } from "~/lib/icons";
import { readNativeApi } from "~/nativeApi";

import { EnvironmentCollapsibleSection } from "./EnvironmentRow";

const ARTIFACT_KIND_LABELS: Partial<Record<ContextArtifactKind, string>> = {
  "unfinished-task": "tasks",
  "git-change": "git",
  checkpoint: "checkpoints",
  file: "files",
  handoff: "handoffs",
  note: "notes",
  pin: "pins",
  plan: "plans",
  review: "reviews",
  session: "sessions",
  source: "sources",
  terminal: "terminal",
};

export function EnvironmentSharedContextSection({
  activeThreadId,
  enabled,
}: {
  activeThreadId: ThreadId;
  enabled: boolean;
}) {
  const [bundle, setBundle] = useState<SharedContextBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const api = readNativeApi();
    if (!api) {
      setBundle(null);
      setError("Shared context is unavailable.");
      return;
    }

    setLoading(true);
    setError(null);
    void api.orchestration.getSharedContextBundle({ threadId: activeThreadId }).then(
      (nextBundle) => {
        if (cancelled) return;
        setBundle(nextBundle);
        setLoading(false);
      },
      (loadError: unknown) => {
        if (cancelled) return;
        setBundle(null);
        setError(loadError instanceof Error ? loadError.message : "Could not load shared context.");
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [activeThreadId, enabled, refreshToken]);

  const counts = useMemo(() => {
    if (!bundle) return [];
    const countByKind = new Map<ContextArtifactKind, number>();
    for (const artifact of bundle.artifacts) {
      countByKind.set(artifact.kind, (countByKind.get(artifact.kind) ?? 0) + 1);
    }
    return [...countByKind.entries()]
      .toSorted((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 6);
  }, [bundle]);

  const copyForHandoff = useCallback(async () => {
    if (!bundle) return;
    await copyTextToClipboard(formatSharedContextNarrative(bundle));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [bundle]);

  return (
    <EnvironmentCollapsibleSection label="Shared context">
      <div className="grid gap-2 px-2 pb-1.5 pt-1">
        {loading && !bundle ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LoaderIcon className="size-3.5 animate-spin" aria-hidden />
            Gathering context…
          </div>
        ) : error ? (
          <p className="text-xs leading-relaxed text-destructive">{error}</p>
        ) : bundle ? (
          <>
            <div className="flex flex-wrap gap-1">
              {counts.map(([kind, count]) => (
                <span
                  key={kind}
                  className="rounded-md bg-[var(--color-background-elevated-secondary)] px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {count} {ARTIFACT_KIND_LABELS[kind] ?? kind}
                </span>
              ))}
              {bundle.artifacts.length === 0 ? (
                <span className="text-xs text-muted-foreground">No durable artifacts yet</span>
              ) : null}
            </div>
            <p className="line-clamp-4 whitespace-pre-line text-[11px] leading-relaxed text-muted-foreground">
              {bundle.narrative}
            </p>
          </>
        ) : null}
        <div className="flex items-center gap-3 text-[11px]">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            disabled={!bundle}
            onClick={() => void copyForHandoff()}
          >
            {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
            {copied ? "Copied" : "Copy for handoff"}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            disabled={loading}
            onClick={() => setRefreshToken((value) => value + 1)}
          >
            <RefreshCwIcon className={loading ? "size-3 animate-spin" : "size-3"} />
            Refresh
          </button>
        </div>
      </div>
    </EnvironmentCollapsibleSection>
  );
}
