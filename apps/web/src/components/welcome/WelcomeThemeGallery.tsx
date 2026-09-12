// FILE: WelcomeThemeGallery.tsx
// Purpose: The appearance step's theme picker. Every theme is a box you can
//          click that names itself and shows its accent hex, in its own
//          palette — the swatch row below is the same set of choices in plain
//          DOM, so selection never depends on the WebGL stage being up.

import { BUILT_IN_THEMES } from "@modesto/shared/themePalettes";
import { CheckIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
import "./welcomeHero.css";

const THEME_BLURBS: Record<string, string> = {
  [WELCOME_DEFAULT_THEME_ID]: "Modesto as it ships. Neutral, flat, out of the way.",
  modesto: "Paper, ink, and one lime accent — the look from the site.",
  signal: "Paper, ink, and one lime accent — the look from the site.",
  grove: "Moss and leaf. A calmer green for long sessions.",
  ocean: "Cool coastal blue. Clear water, long horizon.",
  ember: "Warm firelight. Amber on charcoal.",
  iris: "Violet night. A little more drama.",
};

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
    caseHex: Number.parseInt(accent.slice(1), 16),
    canvas: opaqueHex(colors.canvas, "#111111"),
    accent,
    code: accent.toUpperCase(),
    text: opaqueHex(colors.text, "#f5f5f5"),
    muted: opaqueHex(colors.textMuted, "#9a9a9a"),
    surface: opaqueHex(colors.surfaceRaised, "#222222"),
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
  const stageRef = useRef<HTMLDivElement>(null);
  const stageApiRef = useRef<{ setSelected: (id: string) => void } | null>(null);
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const [live, setLive] = useState(false);
  onSelectRef.current = onSelect;

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
  const selected = tiles.find((tile) => tile.id === activeId) ?? tiles[0];
  selectedRef.current = activeId;

  useEffect(() => {
    const host = stageRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let dispose: (() => void) | undefined;
    const readyWatcher = new MutationObserver(() => {
      if (host.dataset.ready === "true") setLive(true);
    });
    readyWatcher.observe(host, { attributes: true, attributeFilter: ["data-ready"] });

    void import("./welcomeBrand3d")
      .then(({ mountThemeTiles }) =>
        mountThemeTiles(
          host,
          tiles.map(({ preview: _preview, ...spec }) => spec),
          {
            selectedId: selectedRef.current,
            onSelect: (id) => onSelectRef.current(id),
          },
        ),
      )
      .then((stage) => {
        if (cancelled) {
          stage?.dispose();
          return;
        }
        if (!stage) return;
        stageApiRef.current = stage;
        stage.setSelected(selectedRef.current);
        dispose = () => stage.dispose();
      })
      .catch(() => {
        /* CSS tiles remain as the fallback. */
      });

    return () => {
      cancelled = true;
      readyWatcher.disconnect();
      setLive(false);
      host.dataset.ready = "";
      stageApiRef.current = null;
      dispose?.();
    };
  }, [tiles]);

  useEffect(() => {
    stageApiRef.current?.setSelected(activeId);
  }, [activeId]);

  return (
    <div className="grid gap-6">
      {/* The wrapper must carry its own height. Both children are absolutely
        positioned once the WebGL stage is up, so a wrapper sized by its
        content collapses to 0 — which is exactly why the 3D fan rendered into
        a zero-height canvas and never appeared. */}
      <div className="relative mx-auto min-h-[340px] w-full min-w-0 max-w-[1500px] sm:aspect-[16/5.4]">
        <div
          aria-hidden={live}
          className={cn(
            "welcome-theme-fan absolute inset-0 grid grid-cols-2 content-center gap-3 px-6 sm:grid-cols-3 sm:px-10 lg:grid-cols-6",
            live && "pointer-events-none opacity-0",
          )}
        >
          {tiles.map((tile, index) => (
            <ThemeTileButton
              key={tile.id}
              tile={tile}
              appearance={appearance}
              index={index}
              isActive={activeId === tile.id}
              onSelect={onSelect}
            />
          ))}
        </div>
        <div
          ref={stageRef}
          className={cn(
            "absolute inset-0 z-10 transition-opacity duration-700 ease-out",
            live ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />
      </div>

      {/* The same choices in plain DOM. When the WebGL fan is up this is the
        only keyboard- and screen-reader-reachable way to pick a theme, so it
        carries the full identity — name and accent hex — not just a label. */}
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Theme">
        {tiles.map((tile) => {
          const isActive = activeId === tile.id;
          return (
            <button
              key={tile.id}
              type="button"
              aria-pressed={isActive}
              aria-label={`Use the ${tile.label} theme, accent ${tile.code}`}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-transparent bg-accent/40 text-foreground"
                  : "border-border bg-card/60 text-muted-foreground hover:bg-accent/20 hover:text-foreground",
              )}
              style={isActive ? { boxShadow: "inset 0 0 0 1px var(--ring)" } : undefined}
              onClick={() => onSelect(tile.id)}
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full ring-1 ring-black/20 dark:ring-white/25"
                style={{ background: tile.accent }}
              />
              <span className="text-sm font-medium">{tile.label}</span>
              <span className="font-mono text-[11px] tracking-tight opacity-75">{tile.code}</span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {selected ? (THEME_BLURBS[selected.id] ?? `${selected.label} is a full palette.`) : null}
      </p>
    </div>
  );
}

function ThemeTileButton({
  tile,
  appearance,
  index,
  isActive,
  onSelect,
}: {
  readonly tile: ThemeTile;
  readonly appearance: ThemeAppearance;
  readonly index: number;
  readonly isActive: boolean;
  readonly onSelect: (themeId: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      aria-label={`Use the ${tile.label} theme, accent ${tile.code}`}
      className={cn(
        "welcome-theme-tile relative flex cursor-pointer flex-col items-center gap-3 rounded-[22px] border px-3 py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isActive ? "border-transparent" : "border-border/70",
      )}
      style={{
        background: tile.canvas,
        color: tile.text,
        boxShadow: isActive
          ? `inset 0 0 0 2px ${tile.accent}, 0 18px 40px color-mix(in oklab, ${tile.accent} 30%, transparent)`
          : "0 16px 32px rgb(0 0 0 / 0.18)",
        transform: `rotateY(${(index - 2) * 7}deg) rotateX(8deg)`,
      }}
      onClick={() => onSelect(tile.id)}
    >
      {isActive ? (
        <span
          aria-hidden
          className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full"
          style={{ background: tile.accent, color: tile.canvas }}
        >
          <CheckIcon className="size-3" strokeWidth={3} />
        </span>
      ) : null}
      <ThemePreviewCircle colors={tile.preview} mode={appearance} />
      <span className="grid w-full justify-items-center gap-1.5">
        {/* The theme's own `text` colour on its own `canvas`, at full opacity:
          the palette guarantees that pair is legible, whereas the inherited
          app foreground on a foreign canvas does not. */}
        <span className="text-sm font-semibold tracking-tight" style={{ color: tile.text }}>
          {tile.label}
        </span>
        <span
          className="rounded-full px-2 py-0.5 font-mono text-[11px] font-medium tracking-tight"
          style={{ background: tile.surface, color: tile.accent }}
        >
          {tile.code}
        </span>
      </span>
    </button>
  );
}
