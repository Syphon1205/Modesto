// FILE: ChatLandingSuggestions.tsx
// Purpose: Codex-style starter surface for the empty chat landing - a row of
//          rotating prompt-category cards when the composer is empty, and a
//          boxed-free staggered text-wipe stack once the user starts typing.
// Ported from the original (pre-migration) Modesto's chat/ChatLandingSuggestions.tsx.
// The icon set is plain lucide-react here rather than Modesto's full central
// icon-theme system (a separate, much larger port not needed for this feature).

import {
  BookOpenIcon,
  BugIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  Gamepad2Icon,
  GlobeIcon,
  HammerIcon,
  LightbulbIcon,
  ListChecksIcon,
  PencilLineIcon,
  type LucideIcon,
  SearchIcon,
  TelescopeIcon,
} from "lucide-react";
import { memo, useMemo } from "react";

import { MOTION_FADE_CLASS, MOTION_SURFACE_CLASS } from "../../lib/motion";
import { cn } from "../../lib/utils";
import { useInterfaceStyle } from "../../hooks/useSettings";
import {
  LANDING_SUGGESTION_CATEGORIES,
  matchLandingSuggestions,
  matchLandingSuggestionsForCategories,
  type LandingSuggestionCategory,
} from "./ChatLandingSuggestions.logic";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  explain: BookOpenIcon,
  write: PencilLineIcon,
  brainstorm: LightbulbIcon,
  plan: ListChecksIcon,
  explore: TelescopeIcon,
  build: HammerIcon,
  review: ClipboardCheckIcon,
  fix: BugIcon,
  website: GlobeIcon,
  game: Gamepad2Icon,
  app: ClipboardListIcon,
};

const CATEGORY_TONE: Record<string, string> = {
  explain: "text-sky-500 dark:text-sky-300",
  write: "text-rose-500 dark:text-rose-300",
  brainstorm: "text-amber-500 dark:text-amber-300",
  plan: "text-emerald-500 dark:text-emerald-300",
  explore: "text-sky-500 dark:text-sky-300",
  build: "text-violet-500 dark:text-violet-300",
  review: "text-emerald-500 dark:text-emerald-300",
  fix: "text-orange-500 dark:text-orange-300",
};

function SuggestionCard({
  category,
  categoryIndex,
  onSelect,
  copilotStyle,
}: {
  category: LandingSuggestionCategory;
  categoryIndex: number;
  onSelect: (prompt: string) => void;
  copilotStyle: boolean;
}) {
  const Icon = CATEGORY_ICON[category.id] ?? SearchIcon;
  return (
    <button
      type="button"
      onClick={() => {
        onSelect(category.cardPrompt ?? `${category.label} `);
      }}
      style={{ animationDelay: `${categoryIndex * 45}ms` }}
      className={cn(
        "landing-suggestion-card group flex rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-left",
        copilotStyle ? "min-h-[90px] flex-col items-start gap-3" : "min-h-10 items-center gap-2.5",
        MOTION_SURFACE_CLASS,
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      {copilotStyle ? (
        <span className="text-[13px] leading-[1.45] text-foreground/85">
          {category.cardDescriptions[0]}
        </span>
      ) : (
        <span className="truncate text-[13px] font-medium text-foreground/90">
          {category.label}
        </span>
      )}
    </button>
  );
}

function SuggestionRow({
  prompt,
  matchedLength,
  categoryId,
  index,
  onSelect,
}: {
  prompt: string;
  matchedLength: number;
  categoryId: string;
  index: number;
  onSelect: (prompt: string) => void;
}) {
  const Icon = CATEGORY_ICON[categoryId] ?? SearchIcon;
  return (
    <button
      type="button"
      onClick={() => {
        onSelect(prompt);
      }}
      style={{ animationDelay: `${index * 55}ms` }}
      className={cn(
        "landing-suggestion-row group/row flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 text-left text-[13px]",
        MOTION_FADE_CLASS,
        "hover:opacity-100 focus-visible:opacity-100",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40",
      )}
    >
      <Icon
        className={cn(
          "size-3.5 shrink-0 opacity-75 transition-opacity duration-(--motion-fast)",
          "group-hover/row:opacity-100",
          CATEGORY_TONE[categoryId] ?? "text-muted-foreground/60",
        )}
        aria-hidden
      />
      <span className="landing-suggestion-row-text min-w-0 flex-1 truncate">
        <span className="text-muted-foreground/50 transition-colors duration-(--motion-fast) group-hover/row:text-muted-foreground/70">
          {prompt.slice(0, matchedLength)}
        </span>
        <span className="font-medium text-foreground/90 transition-colors duration-(--motion-fast) group-hover/row:text-foreground">
          {prompt.slice(matchedLength)}
        </span>
      </span>
    </button>
  );
}

export interface ChatLandingSuggestionsProps {
  /** Current composer draft - empty shows the card grid, non-empty shows the
   * filtered stack (or nothing, once the prompt has diverged from every
   * starter). */
  readonly prompt: string;
  readonly onSelect: (prompt: string) => void;
  readonly className?: string | undefined;
  readonly categories?: readonly LandingSuggestionCategory[] | undefined;
  /** `list` renders starters as full-width prompt rows (the Codex home). */
  readonly variant?: "cards" | "list" | undefined;
}

export const ChatLandingSuggestions = memo(function ChatLandingSuggestions({
  prompt,
  onSelect,
  className,
  categories = LANDING_SUGGESTION_CATEGORIES,
  variant = "cards",
}: ChatLandingSuggestionsProps) {
  const copilotStyle = useInterfaceStyle() === "github";
  const matches = useMemo(
    () =>
      categories === LANDING_SUGGESTION_CATEGORIES
        ? matchLandingSuggestions(prompt)
        : matchLandingSuggestionsForCategories(prompt, categories),
    [categories, prompt],
  );
  const isEmpty = prompt.trim().length === 0;
  if (!isEmpty && matches.length === 0) {
    return null;
  }

  return (
    <div data-github-suggestions={copilotStyle || undefined} className={cn("w-full", className)}>
      {isEmpty && variant === "list" ? (
        <div data-landing-suggestion-list="" className="flex flex-col">
          {categories.map((category, categoryIndex) => {
            const Icon = CATEGORY_ICON[category.id] ?? SearchIcon;
            const description = category.cardDescriptions[0];
            const prompt = description ? `${category.label} ${description}` : category.label;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelect(category.cardPrompt ?? prompt)}
                style={{ animationDelay: `${categoryIndex * 45}ms` }}
                className={cn(
                  "landing-suggestion-card flex h-11 items-center gap-2.5 border-b border-border/60 px-3 text-left text-[13px] text-muted-foreground last:border-b-0 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  MOTION_FADE_CLASS,
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{prompt}</span>
              </button>
            );
          })}
        </div>
      ) : isEmpty ? (
        <>
          {copilotStyle ? (
            <p className="mb-3 text-center text-xs text-muted-foreground/70">
              Get started with one of these project ideas.
            </p>
          ) : null}
          <div
            className={cn(
              "grid gap-2.5",
              copilotStyle ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
            )}
          >
            {categories.map((category, categoryIndex) => {
              return (
                <SuggestionCard
                  key={category.id}
                  category={category}
                  categoryIndex={categoryIndex}
                  onSelect={onSelect}
                  copilotStyle={copilotStyle}
                />
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-0.5 px-0.5" data-landing-suggestion-stack="">
          {matches.map((match, index) => (
            <SuggestionRow
              key={match.prompt}
              prompt={match.prompt}
              matchedLength={match.matchedLength}
              categoryId={match.categoryId}
              index={index}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
});
