import { useAppNavigate } from "~/hooks/useAppNavigate";
import { useEffect, useState } from "react";
import { BookOpenIcon, ChevronDownIcon, CopyIcon, PlusIcon, SearchIcon } from "lucide-react";
import { WORK_MARKETPLACE_ITEMS, type MarketplaceItem } from "~/connections/connectionsCatalog";
import { connectionCopyForMarketplaceItem } from "~/connections/ConnectionsPage.logic";
import { writeTextToClipboard } from "~/hooks/useCopyToClipboard";
import { isElectron } from "~/env";
import { WorkspacePageHeader } from "./WorkspacePageHeader";
import { PluginLibrary } from "./PluginLibrary";
import { SkillPackLibrary } from "./SkillPackLibrary";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "./ui/menu";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "./ui/dialog";
import { webAppIcon } from "./WebAppIcons";
import { VsCodeExtensionLibrary } from "./VsCodeExtensionLibrary";

const CATEGORIES = [
  "Featured",
  "MCP",
  "Plugins",
  "Skills",
  "Extensions",
  "Canvas",
  "Installed",
] as const;
type Category = (typeof CATEGORIES)[number];
const CUSTOMIZE_CATEGORY_KEY = "modesto:customize-category";
const CUSTOMIZE_EXTENSION_FILTER_KEY = "modesto:customize-extension-filter";

function readInitialCategory(): Category {
  const value = window.sessionStorage.getItem(CUSTOMIZE_CATEGORY_KEY);
  window.sessionStorage.removeItem(CUSTOMIZE_CATEGORY_KEY);
  return CATEGORIES.includes(value as Category) ? (value as Category) : "Featured";
}

function readInitialExtensionFilter(): "all" | "icons" {
  const value = window.sessionStorage.getItem(CUSTOMIZE_EXTENSION_FILTER_KEY);
  window.sessionStorage.removeItem(CUSTOMIZE_EXTENSION_FILTER_KEY);
  return value === "icons" ? "icons" : "all";
}

function CatalogIcon({ item, large = false }: { item: MarketplaceItem; large?: boolean }) {
  const Icon = item.kind === "skill-pack" ? BookOpenIcon : webAppIcon(item.id);
  return (
    <span
      className={`${large ? "size-14" : "size-9"} flex shrink-0 items-center justify-center rounded-lg bg-muted/60 text-foreground`}
    >
      <Icon className={large ? "size-9" : "size-5"} aria-hidden />
    </span>
  );
}

export function CopilotCustomizePage() {
  const [category, setCategory] = useState<Category>(readInitialCategory);
  const [extensionFilter, setExtensionFilter] = useState<"all" | "icons">(
    readInitialExtensionFilter,
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MarketplaceItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const navigate = useAppNavigate();
  const matches = WORK_MARKETPLACE_ITEMS.filter((item) =>
    `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  const featured = matches.filter((item) =>
    ["impeccable", "playwright", "anthropic-document-skills"].includes(item.id),
  );
  const developerTools = matches.filter(
    (item) => item.filter === "dev" && !featured.includes(item),
  );
  const connections = matches.filter(
    (item) => item.kind === "mcp" && item.filter !== "dev" && !featured.includes(item),
  );
  const select = (item: MarketplaceItem) => {
    setSelected(item);
    setCopied(false);
    setCopyError(false);
  };
  const copy = selected ? connectionCopyForMarketplaceItem(selected) : null;
  useEffect(() => {
    const openExtensions = () => {
      setCategory("Extensions");
      setExtensionFilter("icons");
    };
    window.addEventListener("modesto:open-icon-extension-library", openExtensions);
    return () => window.removeEventListener("modesto:open-icon-extension-library", openExtensions);
  }, []);
  const renderRows = (items: readonly MarketplaceItem[]) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className="flex min-w-0 items-center gap-3 rounded-xl border border-border p-3 text-left hover:bg-muted/40"
          onClick={() => select(item)}
        >
          <CatalogIcon item={item} />
          <span className="min-w-0 flex-1">
            <span className="text-[13px] font-medium">
              {item.name}
              <span className="ml-2 rounded border border-border px-1 text-[10px] font-normal text-muted-foreground">
                {item.kind === "mcp" ? "MCP" : item.kind === "skill-pack" ? "Skill" : "Extension"}
              </span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {item.description}
            </span>
          </span>
          <PlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background">
      <WorkspacePageHeader electron={isElectron}>
        <h1 className="flex-1 text-[13px] font-medium">Customize</h1>
        <Menu>
          <MenuTrigger render={<Button size="xs" className="copilot-primary-button" />}>
            <PlusIcon />
            Add
            <ChevronDownIcon />
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onClick={() => setCategory("MCP")}>MCP server</MenuItem>
            <MenuItem onClick={() => setCategory("Plugins")}>Plugin</MenuItem>
            <MenuItem onClick={() => setCategory("Skills")}>Skill</MenuItem>
          </MenuPopup>
        </Menu>
      </WorkspacePageHeader>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div role="tablist" aria-label="Extension categories" className="flex items-center gap-1">
          {CATEGORIES.map((tab, index) => (
            <button
              type="button"
              key={tab}
              role="tab"
              id={`customize-tab-${tab}`}
              aria-controls="customize-panel"
              aria-selected={category === tab}
              tabIndex={category === tab ? 0 : -1}
              className={`rounded-md px-2 py-1 text-xs ${category === tab ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              onClick={() => setCategory(tab)}
              onKeyDown={(event) => {
                const nextIndex =
                  event.key === "ArrowRight"
                    ? (index + 1) % CATEGORIES.length
                    : event.key === "ArrowLeft"
                      ? (index + CATEGORIES.length - 1) % CATEGORIES.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? CATEGORIES.length - 1
                          : null;
                if (nextIndex === null) return;
                event.preventDefault();
                const next = CATEGORIES[nextIndex]!;
                setCategory(next);
                document.getElementById(`customize-tab-${next}`)?.focus();
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        {category !== "Extensions" ? (
          <div className="relative w-80 max-w-full">
            <SearchIcon className="absolute left-2 top-1.5 size-3.5 text-muted-foreground" />
            <Input
              className="h-7 pl-7 text-xs"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={`Search ${category.toLowerCase()} extensions…`}
              aria-label={`Search ${category.toLowerCase()} extensions`}
            />
          </div>
        ) : null}
      </div>
      <div
        role="tabpanel"
        id="customize-panel"
        aria-labelledby={`customize-tab-${category}`}
        className="min-h-0 flex-1 overflow-auto px-6"
      >
        <div className="mx-auto w-full max-w-[848px] space-y-9 py-7">
          {category === "Featured" ? (
            <>
              <section>
                <h2 className="text-sm font-medium">Editor’s picks</h2>
                <p className="mb-4 mt-1 text-xs text-muted-foreground">
                  Standout ways to customize Modesto.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {featured.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="overflow-hidden rounded-xl border border-border text-left hover:bg-muted/30"
                      onClick={() => select(item)}
                    >
                      <span className="flex h-36 items-center justify-center border-b border-border bg-muted/40">
                        <CatalogIcon item={item} large />
                      </span>
                      <span className="block p-3">
                        <span className="text-sm font-medium">{item.name}</span>
                        <span className="mt-2 block min-h-10 text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </span>
                        <span className="mt-3 flex items-center gap-2 text-xs">
                          <PlusIcon className="size-3.5" />
                          View details
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h2 className="text-sm font-medium">Plan, build, and ship</h2>
                <p className="mb-4 mt-1 text-xs text-muted-foreground">
                  Tools for planning work, testing experiences, and shipping with confidence.
                </p>
                {renderRows(developerTools)}
              </section>
              <section>
                <h2 className="text-sm font-medium">Connect your work</h2>
                <p className="mb-4 mt-1 text-xs text-muted-foreground">
                  Bring the tools and context you use every day into Modesto.
                </p>
                {renderRows(connections)}
              </section>
              {matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching extensions.</p>
              ) : null}
            </>
          ) : category === "MCP" ? (
            <>
              {renderRows(matches.filter((item) => item.kind === "mcp"))}
              {!matches.some((item) => item.kind === "mcp") ? (
                <p className="text-sm text-muted-foreground">No matching MCP servers.</p>
              ) : null}
            </>
          ) : category === "Skills" ? (
            <SkillPackLibrary query={query} />
          ) : category === "Plugins" ? (
            <PluginLibrary embedded query={query} />
          ) : category === "Extensions" ? (
            <VsCodeExtensionLibrary initialFilter={extensionFilter} />
          ) : category === "Canvas" ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-center">
              <h2 className="text-sm font-medium">Canvas extensions</h2>
              <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                Canvas experiences installed for your coding agents will appear here.
              </p>
            </div>
          ) : (
            <>
              <SkillPackLibrary query={query} installedOnly />
              <PluginLibrary embedded installedOnly query={query} />
            </>
          )}
        </div>
      </div>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogPopup className="max-w-lg p-6">
          {selected ? (
            <>
              <CatalogIcon item={selected} large />
              <DialogTitle className="mt-4">{selected.name}</DialogTitle>
              <DialogDescription className="mt-2">{selected.description}</DialogDescription>
              {copy ? (
                <>
                  <p className="mt-5 text-sm text-muted-foreground">
                    Run this command in your provider’s terminal to add the server.
                  </p>
                  <pre className="my-3 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-muted/40 p-3 text-xs">
                    {copy.text}
                  </pre>
                  <Button
                    onClick={() => {
                      void writeTextToClipboard(copy.text)
                        .then(setCopied)
                        .catch(() => setCopyError(true));
                    }}
                  >
                    <CopyIcon />
                    {copied ? "Copied" : "Copy install command"}
                  </Button>
                  {copyError ? (
                    <p role="alert" className="mt-2 text-sm text-destructive">
                      Could not copy. Select and copy the command above.
                    </p>
                  ) : null}
                </>
              ) : selected.install === "external" ? (
                <a
                  className="mt-5 inline-flex text-sm underline"
                  href={selected.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {selected.cta}
                </a>
              ) : (
                <Button
                  className="mt-5"
                  onClick={() => {
                    setSelected(null);
                    void navigate({ to: "/settings/providers" });
                  }}
                >
                  Open settings
                </Button>
              )}
            </>
          ) : null}
        </DialogPopup>
      </Dialog>
    </div>
  );
}
