import { BookmarkIcon, CheckIcon, LayersIcon, MailIcon } from "lucide-react";
import { memo, type MouseEvent } from "react";

import { cn } from "~/lib/utils";
import { getSourceControlPresentationForKind } from "~/sourceControlPresentation";
import { formatRelativeTimeLabel } from "~/timestampFormat";

import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { PullRequestChecksPopover } from "./PullRequestChecksPopover";
import type { EnvironmentPullRequestEntry } from "./pullRequestList.logic";
import { openOnHostLabel, showPullRequestLinkContextMenu } from "./pullRequestLinkContextMenu";
import {
  PullRequestActorAvatar,
  PullRequestActorLabel,
  PullRequestDiffStat,
  PullRequestMetaLine,
  PullRequestStateGlyph,
} from "./pullRequestPresentation";

function PullRequestRowImpl({
  entry,
  selected,
  showProjectTitle,
  showProvider,
  environmentLabel,
  matchedElsewhere,
  stack,
  unread,
  onSelect,
  onSave,
  onDone,
  onMarkUnread,
}: {
  entry: EnvironmentPullRequestEntry;
  selected: boolean;
  showProjectTitle: boolean;
  /** Only when the list spans more than one host, where the repository alone is ambiguous. */
  showProvider: boolean;
  /** Names the server this row was read from, where the list spans more than one. */
  environmentLabel?: string;
  /**
   * A search found this, but in something the row does not show — a description, a comment, a
   * commit message. Saying so is the difference between a result and an apparently random row.
   */
  matchedElsewhere?: boolean;
  /** Position in a stack of dependent pull requests; absent when not stacked. */
  stack?: { readonly depth: number; readonly position: string } | undefined;
  unread?: boolean;
  onSelect: (entry: EnvironmentPullRequestEntry) => void;
  onSave?: (entry: EnvironmentPullRequestEntry) => void;
  onDone?: (entry: EnvironmentPullRequestEntry) => void;
  onMarkUnread?: (entry: EnvironmentPullRequestEntry) => void;
}) {
  const { Icon, providerName } = getSourceControlPresentationForKind(entry.provider);
  const stopRow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(entry)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(entry);
        }
      }}
      className={cn(
        "group grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        // Offscreen rows are skipped for style, layout and paint: a long list costs what the
        // viewport shows, not what the pages have loaded. The intrinsic size keeps the
        // scrollbar honest while a row is skipped.
        "[contain-intrinsic-block-size:54px] [content-visibility:auto]",
        unread && !selected ? "bg-accent/25" : null,
        selected ? "bg-accent" : "hover:bg-accent/60",
      )}
    >
      {/* Rail and glyph share the grid's first cell: adding a fourth child
          would break the row's three-column template. Indenting by depth is
          what makes a stack read as a stack at a glance. */}
      <span
        className="flex shrink-0 items-center gap-2"
        style={stack ? { paddingInlineStart: `${stack.depth * 12}px` } : undefined}
      >
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", unread ? "bg-sky-500" : "bg-transparent")}
        />
        {stack && stack.depth > 0 ? (
          <span aria-hidden className="h-5 w-px shrink-0 rounded-full bg-border" />
        ) : null}
        <PullRequestStateGlyph
          state={entry.state}
          isDraft={entry.isDraft}
          mergeability={entry.mergeability}
          baseBranch={entry.baseBranch}
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{entry.title}</span>
        <PullRequestMetaLine className="mt-0.5 text-xs text-muted-foreground/70">
          {stack ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="flex shrink-0 items-center gap-1 rounded-sm bg-muted/40 px-1.5 py-px text-[11px] tabular-nums text-muted-foreground" />
                }
              >
                <LayersIcon className="size-3 shrink-0" aria-hidden />
                {stack.position}
              </TooltipTrigger>
              {/* Naming the branch it sits on is the actionable half: it says
                  what has to merge before this one can. */}
              <TooltipPopup>Stacked on {entry.baseBranch}</TooltipPopup>
            </Tooltip>
          ) : null}
          <span className="flex shrink-0 items-center gap-1">
            {showProvider ? (
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex shrink-0" />}>
                  <Icon aria-label={providerName} className="size-3" />
                </TooltipTrigger>
                <TooltipPopup>{providerName}</TooltipPopup>
              </Tooltip>
            ) : null}
            {/* The number carries the link, here as much as on the detail: a right-click on it
                copies the pull request's own address rather than opening the editing menu. */}
            <span
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void showPullRequestLinkContextMenu({
                  url: entry.url,
                  openLabel: openOnHostLabel(entry.provider),
                  position: { x: event.clientX, y: event.clientY },
                });
              }}
            >
              #{entry.number}
            </span>
          </span>
          {showProjectTitle ? <span className="truncate">{entry.repository}</span> : null}
          {environmentLabel ? (
            <span className="max-w-32 shrink-0 truncate">{environmentLabel}</span>
          ) : null}
          <PullRequestActorLabel actor={entry.author} className="max-w-40 shrink-0" />
          {/* Only a verdict somebody has actually given: "review required" is the absence of
              one, and saying so on every unreviewed row would say nothing. */}
          {entry.reviewDecision === "approved" || entry.reviewDecision === "changes-requested" ? (
            <span
              className={cn(
                "shrink-0",
                entry.reviewDecision === "approved"
                  ? "text-emerald-600/90 dark:text-emerald-400/80"
                  : "text-amber-600/90 dark:text-amber-400/80",
              )}
            >
              {entry.reviewDecision === "approved" ? "Approved" : "Changes requested"}
            </span>
          ) : null}
          {entry.checksState === undefined ? null : (
            <PullRequestChecksPopover
              checksState={entry.checksState}
              environmentId={entry.environmentId}
              reference={{
                projectId: entry.projectId,
                repository: entry.repository,
                number: entry.number,
              }}
            />
          )}
          {matchedElsewhere ? (
            <span className="shrink-0 rounded-full border border-border/60 px-1.5 text-[10px]">
              matched in the description
            </span>
          ) : null}
        </PullRequestMetaLine>
      </span>
      <span className="relative flex shrink-0 flex-col items-end gap-0.5 text-xs text-muted-foreground/70 tabular-nums">
        <span className="flex items-center gap-2 group-hover:invisible group-focus-within:invisible">
          <span className="flex items-center">
            <PullRequestActorAvatar
              actor={entry.author}
              className="size-5 ring-2 ring-background"
            />
          </span>
          <span>{formatRelativeTimeLabel(entry.updatedAt)}</span>
        </span>
        <span className="group-hover:invisible group-focus-within:invisible">
          <PullRequestDiffStat additions={entry.additions} deletions={entry.deletions} />
        </span>
        {onSave || onDone || onMarkUnread ? (
          <span className="absolute inset-y-0 right-0 hidden items-center gap-0.5 group-hover:flex group-focus-within:flex">
            {onSave ? (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Save"
                onClick={(event) => {
                  stopRow(event);
                  onSave(entry);
                }}
              >
                <BookmarkIcon />
              </Button>
            ) : null}
            {onDone ? (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Done"
                onClick={(event) => {
                  stopRow(event);
                  onDone(entry);
                }}
              >
                <CheckIcon />
              </Button>
            ) : null}
            {onMarkUnread ? (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Mark unread"
                onClick={(event) => {
                  stopRow(event);
                  onMarkUnread(entry);
                }}
              >
                <MailIcon />
              </Button>
            ) : null}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * Memoized: the list re-renders on every keystroke of a search and every status poll, and a
 * row whose entry, selection and match state are unchanged has nothing new to say. Effective
 * because the route hands it a stable `onSelect`.
 */
export const PullRequestRow = memo(PullRequestRowImpl);
