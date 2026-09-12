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
  HammerIcon,
  LightbulbIcon,
  ListChecksIcon,
  PencilLineIcon,
  type LucideIcon,
  SearchIcon,
  TelescopeIcon,
} from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

import { MOTION_FADE_CLASS, MOTION_SURFACE_CLASS } from "../../lib/motion";
import { cn } from "../../lib/utils";
import {
  LANDING_CATEGORY_ROTATION_MS,
  LANDING_SUGGESTION_CATEGORIES,
  matchLandingSuggestions,
  matchLandingSuggestionsForCategories,
  resolveLandingCategoryCardDescription,
  type LandingSuggestionCategory,
} from "./ChatLandingSuggestions.logic";

// Border + shadow chrome for the raised card surface. A trimmed-down stand-in
// for Modesto's RAISED_SURFACE_CHROME_CLASS_NAME (composerPickerStyles.ts),
// which pulls in design tokens this tree doesn't have yet.
const RAISED_SURFACE_CHROME_CLASS_NAME = "border border-border shadow-sm dark:border-white/[0.06]";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  explain: BookOpenIcon,
  write: PencilLineIcon,
  brainstorm: LightbulbIcon,
  plan: ListChecksIcon,
  explore: TelescopeIcon,
  build: HammerIcon,
  review: ClipboardCheckIcon,
  fix: BugIcon,
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
  description,
  descriptionKey,
  onSelect,
}: {
  category: LandingSuggestionCategory;
  categoryIndex: number;
  description: string;
  descriptionKey: string;
  onSelect: (prompt: string) => void;
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
        "landing-suggestion-card group flex min-h-[6rem] flex-col gap-3 rounded-2xl bg-card/60 px-4 py-4 text-left",
        MOTION_SURFACE_CLASS,
        RAISED_SURFACE_CHROME_CLASS_NAME,
        "hover:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      )}
    >
      <Icon className={cn("size-4 shrink-0", CATEGORY_TONE[category.id])} aria-hidden />
      <span className="min-h-8 text-[13px] leading-snug text-foreground/90">
        <span className="font-medium">{category.label}</span>{" "}
        <span key={descriptionKey} className="landing-suggestion-card-copy">
          {description}
        </span>
      </span>
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
}

export const ChatLandingSuggestions = memo(function ChatLandingSuggestions({
  prompt,
  onSelect,
  className,
  categories = LANDING_SUGGESTION_CATEGORIES,
}: ChatLandingSuggestionsProps) {
  const matches = useMemo(
    () =>
      categories === LANDING_SUGGESTION_CATEGORIES
        ? matchLandingSuggestions(prompt)
        : matchLandingSuggestionsForCategories(prompt, categories),
    [categories, prompt],
  );
  const isEmpty = prompt.trim().length === 0;
  const [rotationTick, setRotationTick] = useState(0);

  useEffect(() => {
    if (!isEmpty) {
      return;
    }
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      return;
    }
    const timer = window.setInterval(() => {
      setRotationTick((tick) => tick + 1);
    }, LANDING_CATEGORY_ROTATION_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [isEmpty]);

  if (!isEmpty && matches.length === 0) {
    return null;
  }

  return (
    <div className={cn("w-full", className)}>
      {isEmpty ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {categories.map((category, categoryIndex) => {
            const description = resolveLandingCategoryCardDescription(
              category,
              rotationTick,
              categoryIndex,
            );
            return (
              <SuggestionCard
                key={category.id}
                category={category}
                categoryIndex={categoryIndex}
                description={description}
                descriptionKey={`${category.id}:${description}:${rotationTick}`}
                onSelect={onSelect}
              />
            );
          })}
        </div>
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
