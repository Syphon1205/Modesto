import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { useMemo, useState } from "react";
import {
  DicesIcon,
  EllipsisIcon,
  PaintbrushIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react";
import { BUNDLED_PALETTES } from "../../themes/catalog";
import {
  getCustomThemes,
  getThemeDefinition,
  installCustomTheme,
  type ThemeAppearance,
  type ThemeDefinition,
} from "../../themePalette";
import { Button } from "../ui/button";
import { getThemeCardDefinition, type ThemeCardDefinition } from "./ThemePreviewCircles";
import { PalettePreview } from "./PalettePreview";
import { toastManager } from "../ui/toast";
import { MOTION_CONTROL_CLASS } from "../../lib/motion";

const VSCODE_PALETTES = BUNDLED_PALETTES;
const RECENT_KEY = "modesto:recent-palettes:v1";
const PICKS = new Set(["GitHub", "Catppuccin", "Nord", "Dracula", "Rosé Pine", "Tokyo Night"]);
function readRecent(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string").slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

export function CopilotPaletteLibrary({
  cards,
  customThemes,
  appearance,
  activeId,
  onSelect,
  onBrowse,
  onCreate,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  cards: ReadonlyArray<ThemeCardDefinition>;
  customThemes: ReadonlyArray<ThemeDefinition>;
  appearance: ThemeAppearance;
  activeId: string | null;
  onSelect: (id: string | null, appearance?: ThemeAppearance) => boolean;
  onBrowse: () => void;
  onCreate: () => void;
  onEdit: (theme: ThemeDefinition) => void;
  onDuplicate: (theme: ThemeDefinition | null) => void;
  onRemove: (theme: ThemeDefinition) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recommended");
  const [recent, setRecent] = useState(readRecent);
  const allCards = useMemo(() => {
    const byId = new Map(cards.map((card) => [card.id, card]));
    for (const theme of VSCODE_PALETTES) byId.set(theme.id, getThemeCardDefinition(theme));
    for (const theme of customThemes) byId.set(theme.id, getThemeCardDefinition(theme));
    return [...byId.values()];
  }, [cards, customThemes]);
  const matching = allCards.filter(
    (card) =>
      card.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
      (filter === "all" || card.previews.some((preview) => preview.mode === filter)),
  );
  const select = (card: ThemeCardDefinition) => {
    try {
      const bundled = VSCODE_PALETTES.find((theme) => theme.id === card.id);
      if (bundled && !getCustomThemes().some((theme) => theme.id === card.id))
        installCustomTheme(bundled);
      const mode = card.previews.some((preview) => preview.mode === appearance)
        ? undefined
        : card.previews[0]?.mode;
      if (!onSelect(card.id === "default" ? null : card.id, mode)) return;
      const next = [card.id, ...recent.filter((id) => id !== card.id)].slice(0, 6);
      setRecent(next);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* Selection still succeeded. */
      }
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Could not apply palette",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };
  const renderCards = (label: string, items: ReadonlyArray<ThemeCardDefinition>) =>
    items.length ? (
      <section aria-label={label} className="space-y-3">
        <h4 className="text-xs text-muted-foreground">{label}</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((card) => {
            const preview =
              card.previews.find((item) => item.mode === appearance) ?? card.previews[0]!;
            const active = card.id === (activeId ?? "default");
            const custom = customThemes.find((theme) => theme.id === card.id);
            const bundled = VSCODE_PALETTES.find((theme) => theme.id === card.id);
            const definition = custom ?? bundled ?? getThemeDefinition(card.id);
            return (
              <div key={card.id} className="group relative min-w-0">
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={`Use ${card.label} theme${active ? ", currently active" : ""}`}
                  className={`copilot-palette-card ${MOTION_CONTROL_CLASS}`}
                  data-active={active}
                  onClick={() => select(card)}
                >
                  <PalettePreview colors={preview.colors} />
                  <span className="flex h-8 items-center gap-1 px-2 text-[11px]">
                    <span className="min-w-0 flex-1 truncate text-left">{card.label}</span>
                    {active ? (
                      <span className="rounded bg-blue-500/10 px-1 py-0.5 text-[10px] text-blue-500">
                        Active
                      </span>
                    ) : card.previews.length === 1 ? (
                      <span className="text-[10px] text-muted-foreground">{preview.mode}</span>
                    ) : null}
                  </span>
                </button>
                <Menu>
                  <MenuTrigger
                    render={
                      <button
                        type="button"
                        aria-label={`Manage ${card.label} theme`}
                        className="absolute right-1 top-1 rounded-md border border-border bg-background p-1 opacity-0 focus:opacity-100 group-hover:opacity-100 data-popup-open:opacity-100"
                      />
                    }
                  >
                    <EllipsisIcon className="size-3.5" />
                  </MenuTrigger>
                  <MenuPopup align="end">
                    <MenuItem
                      onClick={() => {
                        try {
                          if (bundled && !custom) installCustomTheme(bundled);
                          onDuplicate(definition ?? null);
                        } catch {
                          toastManager.add({ type: "error", title: "Could not duplicate theme" });
                        }
                      }}
                    >
                      Duplicate theme
                    </MenuItem>
                    {custom ? (
                      <>
                        <MenuItem onClick={() => onEdit(custom)}>Edit theme</MenuItem>
                        <MenuItem variant="destructive" onClick={() => onRemove(custom)}>
                          Remove imported theme
                        </MenuItem>
                      </>
                    ) : null}
                  </MenuPopup>
                </Menu>
              </div>
            );
          })}
        </div>
      </section>
    ) : null;
  const recentCards = recent.flatMap((id) => matching.find((card) => card.id === id) ?? []);
  const ordered = [...matching].sort((a, b) => a.label.localeCompare(b.label));
  return (
    <div className="space-y-6 px-3 sm:px-4" data-copilot-palettes="">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Palettes</h3>
          <p className="mt-1 text-xs text-muted-foreground">Pick a color palette for the app.</p>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-1.5">
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Reset to default palette"
            onClick={() => onSelect(null)}
          >
            <RotateCcwIcon />
          </Button>
          <label className="flex h-8 w-44 items-center gap-1.5 rounded-md border border-input px-2">
            <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search palettes"
              placeholder={`Search ${allCards.length} palettes…`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </label>
          <Button
            size="icon-xs"
            variant="outline"
            aria-label="Feeling lucky"
            disabled={matching.length === 0}
            onClick={() => {
              const alternatives = matching.filter((card) => card.id !== (activeId ?? "default"));
              const card = alternatives[Math.floor(Math.random() * alternatives.length)];
              if (card) select(card);
            }}
          >
            <DicesIcon />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <select
          aria-label="Filter palettes"
          className="rounded-md border border-input bg-background px-2 py-1"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All appearances</option>
          <option value="light">Light palettes</option>
          <option value="dark">Dark palettes</option>
        </select>
        <select
          aria-label="Sort palettes"
          className="rounded-md border border-input bg-background px-2 py-1"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recommended">Recommended</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
      {sort === "recommended" && !query.trim() ? (
        <>
          {renderCards("Recent", recentCards.slice(0, 3))}
          {renderCards(
            "Featured",
            matching.filter((card) => PICKS.has(card.label)),
          )}
          {renderCards(
            "More palettes",
            ordered.filter((card) => !PICKS.has(card.label)),
          )}
        </>
      ) : (
        renderCards("Palettes", ordered)
      )}
      {matching.length === 0 ? (
        <p role="status" className="py-4 text-center text-sm text-muted-foreground">
          No palettes match “{query}”. Try another name or browse VS Code themes.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onBrowse}>
          <PlusIcon />
          Browse more VS Code themes
        </Button>
        <Button size="sm" variant="ghost" onClick={onCreate}>
          <PaintbrushIcon />
          Create theme
        </Button>
      </div>
    </div>
  );
}
