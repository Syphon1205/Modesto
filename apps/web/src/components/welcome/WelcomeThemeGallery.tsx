// FILE: WelcomeThemeGallery.tsx
// Purpose: Compact theme choices for the setup dialog. These deliberately use
//          the same flat cards as the current settings experience.

import { BUILT_IN_THEMES } from "@modesto/shared/themePalettes";
import { CheckIcon } from "lucide-react";
import { useMemo } from "react";

import { ThemePreviewCircle } from "~/components/settings/ThemePreviewCircles";
import { cn } from "~/lib/utils";
import {
  getStandardThemeColors,
  getThemeColorsForMode,
  themeColorToHex,
  type ThemeAppearance,
  type ThemeColors,
  type ThemeDefinition,
} from "~/themePalette";

import { isWelcomeDefaultThemeActive, WELCOME_DEFAULT_THEME_ID } from "./welcomeSetup";
function opaqueHex(value: string, fallback: string): string {
  const hex = themeColorToHex(value);
  if (!hex?.startsWith("#") || hex.length < 7) return fallback;
  return `#${hex.slice(1, 7)}`;
}

function colorSpec(id: string, label: string, colors: ThemeColors) {
  const accent = opaqueHex(colors.accent, "#888888");
  return {
    id,
    label,
    preview: {
      sidebar: colors.sidebar,
      canvas: colors.canvas,
      surface: colors.surface,
      accentSurface: colors.accentSurface,
      accent: colors.accent,
      messageSurface: colors.messageSurface,
      messageAction: colors.messageAction,
    },
    accent,
    code: accent.toUpperCase(),
  };
}

function tileSpec(definition: ThemeDefinition, appearance: ThemeAppearance) {
  const colors = getThemeColorsForMode(definition, appearance) ?? definition.colors;
  return colorSpec(definition.id, definition.label, colors);
}

function defaultTileSpec(appearance: ThemeAppearance) {
  return colorSpec(WELCOME_DEFAULT_THEME_ID, "Modesto", getStandardThemeColors(appearance));
}

type ThemeTile = ReturnType<typeof tileSpec>;

export function WelcomeThemeGallery({
  selectedId,
  appearance,
  onSelect,
}: {
  readonly selectedId: string;
  readonly appearance: ThemeAppearance;
  readonly onSelect: (themeId: string) => void;
}) {
  // The default palette leads: it is what the user is already looking at, and
  // leaving it out made the row read as "pick one of these four instead".
  const tiles = useMemo(
    () => [
      defaultTileSpec(appearance),
      ...BUILT_IN_THEMES.map((definition) => tileSpec(definition, appearance)),
    ],
    [appearance],
  );
  const installedThemeIds = useMemo(() => BUILT_IN_THEMES.map((theme) => theme.id), []);
  const activeId = isWelcomeDefaultThemeActive({ selectedId, installedThemeIds })
    ? WELCOME_DEFAULT_THEME_ID
    : selectedId;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Theme">
      {tiles.map((tile) => (
        <ThemeTileButton
          key={tile.id}
          tile={tile}
          appearance={appearance}
          isActive={activeId === tile.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function ThemeTileButton({
  tile,
  appearance,
  isActive,
  onSelect,
}: {
  readonly tile: ThemeTile;
  readonly appearance: ThemeAppearance;
  readonly isActive: boolean;
  readonly onSelect: (themeId: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      aria-label={`Use the ${tile.label} theme, accent ${tile.code}`}
      className={cn(
        "relative flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border bg-background p-2.5 text-left outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring",
        isActive ? "border-foreground/45" : "border-border",
      )}
      onClick={() => onSelect(tile.id)}
    >
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border border-black/10 dark:border-white/10 [&>span]:size-9 [&>span]:border-0">
        <ThemePreviewCircle colors={tile.preview} mode={appearance} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">{tile.label}</span>
        <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <span
            aria-hidden
            className="size-2.5 rounded-full ring-1 ring-black/15 dark:ring-white/20"
            style={{ background: tile.accent }}
          />
          {tile.code}
        </span>
      </span>
      {isActive ? <CheckIcon className="size-3.5 shrink-0 text-foreground" aria-hidden /> : null}
    </button>
  );
}
