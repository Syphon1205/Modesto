import {
  BracesIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  Code2Icon,
  DownloadIcon,
  ExternalLinkIcon,
  PackageIcon,
  PaletteIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ensureLocalApi } from "~/localApi";
import {
  importOpenVsxAppearanceExtension,
  searchOpenVsxCompatibleExtensions,
  type OpenVsxThemeExtension,
} from "~/openVsxThemes";
import { useDebouncedValue } from "~/state/queries";
import { getStoredCustomThemeCollection, replaceCustomThemeCollection } from "~/themePalette";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Spinner } from "./ui/spinner";

const DOWNLOADS = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});
const INSTALLED_EXTENSIONS_KEY = "modesto:open-vsx-extensions:v1";
type ExtensionFilter = "all" | "themes" | "icons" | "languages" | "snippets";
const FILTERS: ReadonlyArray<{ id: ExtensionFilter; label: string }> = [
  { id: "all", label: "For Modesto" },
  { id: "themes", label: "Themes" },
  { id: "icons", label: "File icons" },
  { id: "languages", label: "Languages" },
  { id: "snippets", label: "Snippets" },
];

function capabilityLabels(extension: OpenVsxThemeExtension): string[] {
  return [
    ...(extension.supportsColorThemes ? ["Themes"] : []),
    ...(extension.supportsFileIconThemes ? ["Icons"] : []),
    ...(extension.supportsLanguages ? ["Languages"] : []),
    ...(extension.supportsSnippets ? ["Snippets"] : []),
  ];
}

function readInstalledExtensionIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(INSTALLED_EXTENSIONS_KEY) ?? "[]",
    );
    return new Set(
      Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function ExtensionIcon({
  extension,
  size = "sm",
}: {
  extension: OpenVsxThemeExtension;
  size?: "sm" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ${size === "lg" ? "size-14" : "size-9"}`}
    >
      {extension.iconUrl && !failed ? (
        <img
          src={extension.iconUrl}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <PackageIcon
          className={
            size === "lg" ? "size-6 text-muted-foreground" : "size-4 text-muted-foreground"
          }
        />
      )}
    </div>
  );
}

export function VsCodeExtensionLibrary({
  initialFilter = "all",
}: {
  initialFilter?: ExtensionFilter;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReadonlyArray<OpenVsxThemeExtension>>([]);
  const [selected, setSelected] = useState<OpenVsxThemeExtension | null>(null);
  const [filter, setFilter] = useState<ExtensionFilter>(initialFilter);
  const [installedIds, setInstalledIds] = useState(readInstalledExtensionIds);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebouncedValue(query.trim(), 350);
  const request = useRef<AbortController | null>(null);

  const search = useCallback(async (value: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const nextResults = await searchOpenVsxCompatibleExtensions(value, {
        signal: controller.signal,
        sortBy: value ? "relevance" : "downloadCount",
      });
      if (!controller.signal.aborted) setResults(nextResults);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Extension search failed.");
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void search(debounced);
    return () => request.current?.abort();
  }, [debounced, search]);

  useEffect(() => setFilter(initialFilter), [initialFilter]);

  const install = async (extension: OpenVsxThemeExtension) => {
    const controller = new AbortController();
    setInstallingId(extension.id);
    setError(null);
    try {
      const previousThemes = getStoredCustomThemeCollection(extension.collectionId);
      const imported = await importOpenVsxAppearanceExtension(extension, controller.signal);
      if (imported.themes.length > 0) {
        replaceCustomThemeCollection(extension.collectionId, imported.themes, {
          expectedCollection: previousThemes,
        });
      }
      const next = new Set(installedIds).add(extension.id);
      window.localStorage.setItem(INSTALLED_EXTENSIONS_KEY, JSON.stringify([...next]));
      setInstalledIds(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That extension could not be added.");
    } finally {
      setInstallingId(null);
    }
  };

  const openListing = (extension: OpenVsxThemeExtension) => {
    const name = extension.id.slice(extension.publisher.length + 1);
    const url = `https://open-vsx.org/extension/${encodeURIComponent(extension.publisher)}/${encodeURIComponent(name)}`;
    void ensureLocalApi()
      .shell.openExternal(url)
      .catch(() => setError("Could not open Open VSX."));
  };

  const hasQuery = Boolean(query.trim());
  const visibleResults = results.filter(
    (extension) =>
      filter === "all" ||
      (filter === "themes" && extension.supportsColorThemes) ||
      (filter === "icons" && extension.supportsFileIconThemes) ||
      (filter === "languages" && extension.supportsLanguages) ||
      (filter === "snippets" && extension.supportsSnippets),
  );

  return (
    <section className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_52%)] p-5">
        <div className="relative max-w-xl">
          <div className="mb-3 flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <SparklesIcon className="size-4" />
          </div>
          <h2 className="font-heading text-lg font-semibold">Make Modesto yours</h2>
          <p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
            Discover verified Open VSX themes, file icons, language definitions, and snippets. See
            exactly what works before adding anything.
          </p>
        </div>
      </div>
      <div className="relative">
        {loading ? (
          <Spinner className="absolute left-2.5 top-2 size-3.5" />
        ) : (
          <SearchIcon className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
        )}
        <Input
          className="h-9 rounded-xl pl-8 text-xs"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search Open VSX…"
          aria-label="Search compatible extensions"
        />
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Extension type">
        {FILTERS.map((item) => (
          <Button
            key={item.id}
            size="xs"
            variant={filter === item.id ? "secondary" : "ghost"}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
      {!loading && results.length === 0 && !error ? (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed text-center">
          <PackageIcon className="mb-2 size-5 text-muted-foreground" />
          <p className="text-sm font-medium">
            {hasQuery ? "No compatible extensions found" : "No popular extensions available"}
          </p>
          {hasQuery ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Try a theme or file icon extension.
            </p>
          ) : null}
        </div>
      ) : null}
      {!loading && results.length > 0 && visibleResults.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center">
          <p className="text-sm font-medium">Nothing in this category yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try another extension type or search.
          </p>
        </div>
      ) : null}
      {visibleResults.length > 0 ? (
        <div className="space-y-2.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-xs font-medium">
                {hasQuery ? "Search results" : "Popular right now"}
              </h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {hasQuery
                  ? `Compatible matches for “${query.trim()}”`
                  : "Popular extensions with features Modesto can load"}
              </p>
            </div>
            {loading ? <span className="text-[11px] text-muted-foreground">Updating…</span> : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleResults.map((extension) => (
              <button
                type="button"
                key={extension.id}
                className="group flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-card/45 p-3 text-left transition-[background-color,border-color,transform] hover:-translate-y-px hover:border-primary/25 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setSelected(extension)}
              >
                <ExtensionIcon extension={extension} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{extension.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {extension.publisher} · {DOWNLOADS.format(extension.downloadCount)} downloads
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {capabilityLabels(extension).map((label) => (
                      <span
                        key={label}
                        className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
                      >
                        {label}
                      </span>
                    ))}
                  </span>
                </span>
                {installedIds.has(extension.id) ? (
                  <CheckCircle2Icon
                    aria-label="Installed"
                    className="size-4 shrink-0 text-primary"
                  />
                ) : (
                  <ChevronRightIcon
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && installingId === null) setSelected(null);
        }}
      >
        {selected ? (
          <DialogPopup className="max-w-lg" showCloseButton={installingId === null}>
            <DialogHeader>
              <div className="flex items-start gap-3 pr-8">
                <ExtensionIcon extension={selected} size="lg" />
                <div className="min-w-0 pt-0.5">
                  <DialogTitle className="truncate">{selected.name}</DialogTitle>
                  <DialogDescription className="mt-1">
                    {selected.publisher} · version {selected.version}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <DialogPanel className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                {selected.description || "No description was provided by the publisher."}
              </p>
              {error ? (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                >
                  {error}
                </p>
              ) : null}
              <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheckIcon className="size-4 text-primary" />
                  {selected.hasRuntimeCode ? "Compatible features" : "Works in Modesto"}
                </div>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  {selected.hasRuntimeCode
                    ? "The features below work in Modesto. This extension also contains VS Code runtime features such as commands, language servers, or debuggers that require a future isolated extension host."
                    : "Modesto verifies the package checksum and loads its supported contributions without executing extension code."}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {selected.supportsColorThemes ? (
                    <div className="flex items-center gap-2 rounded-lg bg-background/70 px-2.5 py-2 text-xs">
                      <PaletteIcon className="size-3.5 text-primary" />
                      Color themes
                    </div>
                  ) : null}
                  {selected.supportsFileIconThemes ? (
                    <div className="flex items-center gap-2 rounded-lg bg-background/70 px-2.5 py-2 text-xs">
                      <PackageIcon className="size-3.5 text-primary" />
                      File icons
                    </div>
                  ) : null}
                  {selected.supportsLanguages ? (
                    <div className="flex items-center gap-2 rounded-lg bg-background/70 px-2.5 py-2 text-xs">
                      <Code2Icon className="size-3.5 text-primary" />
                      Languages
                    </div>
                  ) : null}
                  {selected.supportsSnippets ? (
                    <div className="flex items-center gap-2 rounded-lg bg-background/70 px-2.5 py-2 text-xs">
                      <BracesIcon className="size-3.5 text-primary" />
                      Snippets
                    </div>
                  ) : null}
                </div>
              </div>
              {installedIds.has(selected.id) ? (
                <div className="flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs leading-5">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p>
                    Installed in Modesto. Its supported features are active in the editor and
                    Appearance settings.
                  </p>
                </div>
              ) : null}
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Downloads</dt>
                  <dd className="mt-1 font-medium">{DOWNLOADS.format(selected.downloadCount)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">License</dt>
                  <dd className="mt-1 font-medium">{selected.license}</dd>
                </div>
              </dl>
            </DialogPanel>
            <DialogFooter className="sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => openListing(selected)}
                disabled={installingId !== null}
              >
                <ExternalLinkIcon />
                Open VSX
              </Button>
              <Button onClick={() => void install(selected)} disabled={installingId !== null}>
                {installingId === selected.id ? (
                  <Spinner />
                ) : installedIds.has(selected.id) ? (
                  <CheckCircle2Icon />
                ) : (
                  <DownloadIcon />
                )}
                {installingId === selected.id
                  ? "Adding…"
                  : installedIds.has(selected.id)
                    ? "Update in Modesto"
                    : "Add to Modesto"}
              </Button>
            </DialogFooter>
          </DialogPopup>
        ) : null}
      </Dialog>
    </section>
  );
}
