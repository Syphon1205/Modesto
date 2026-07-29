// FILE: SourcesPanel.tsx
// Purpose: Compact expandable Sources card for web-enabled assistant responses.
// Layer: Chat UI
// Exports: SourcesPanel

import { useState } from "react";

import { LinkChipIcon } from "~/components/LinkChipIcon";
import { DisclosureChevron } from "~/components/ui/DisclosureChevron";
import { DisclosureRegion } from "~/components/ui/DisclosureRegion";
import { openExternalLink } from "~/lib/linkChips";
import { cn } from "~/lib/utils";
import type { TurnSource } from "~/lib/turnSources";

const MAX_COLLAPSED_ICONS = 5;

export function SourcesPanel(props: {
  sources: ReadonlyArray<TurnSource>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const sources = props.sources;
  if (sources.length === 0) {
    return null;
  }

  const collapsedIcons = sources.slice(0, MAX_COLLAPSED_ICONS);
  const overflowCount = Math.max(0, sources.length - collapsedIcons.length);

  return (
    <div
      className={cn(
        "mt-2 min-w-0 overflow-hidden rounded-xl border border-border/60 bg-background/55",
        props.className,
      )}
    >
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/30"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex shrink-0 items-center">
            {collapsedIcons.map((source, index) => (
              <span
                key={`${source.url}:${index}`}
                className={cn(
                  "inline-flex size-5 items-center justify-center overflow-hidden rounded-full border border-background bg-muted/40",
                  index > 0 && "-ml-1.5",
                )}
                title={source.title}
              >
                <LinkChipIcon url={source.url} className="size-3.5" />
              </span>
            ))}
            {overflowCount > 0 ? (
              <span className="-ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-background bg-muted px-1 text-[10px] font-medium text-muted-foreground">
                +{overflowCount}
              </span>
            ) : null}
          </div>
          <span className="truncate text-xs font-medium text-foreground">
            {sources.length} {sources.length === 1 ? "source" : "sources"}
          </span>
        </div>
        <DisclosureChevron open={open} className="size-3.5 shrink-0 text-muted-foreground/70" />
      </button>

      <DisclosureRegion open={open}>
        <ul className="space-y-1 border-t border-border/50 px-2 py-2">
          {sources.map((source) => (
            <li key={source.url} className="min-w-0">
              <button
                type="button"
                className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
                title={`${source.title}\n${source.url}`}
                onClick={() => openExternalLink(source.url)}
              >
                <span className="inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted/50">
                  <LinkChipIcon url={source.url} className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">
                    {source.title}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {source.domain}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DisclosureRegion>
    </div>
  );
}
