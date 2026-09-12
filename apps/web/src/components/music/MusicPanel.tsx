// FILE: MusicPanel.tsx
// Purpose: A right-panel Music surface. After library access, Apple Music
//          shows playlists and songs from this Mac. Other services still
//          use the preview webview (desktop) or open externally (browser).

import { scopedThreadKey } from "@modesto/client-runtime/environment";
import type { DesktopListeningLibrary, ScopedThreadRef } from "@modesto/contracts";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  HouseIcon,
  RotateCwIcon,
  SearchIcon,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AsyncResult } from "effect/unstable/reactivity";

import { BrowserSurfaceSlot } from "~/browser/BrowserSurfaceSlot";
import { previewRuntimeTabId } from "~/browser/previewRuntimeTabId";
import { MusicLibraryBrowser } from "~/components/music/MusicLibraryBrowser";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { readLocalApi } from "~/localApi";
import {
  LISTENING_SERVICES,
  listeningServiceById,
  searchUrlForListeningService,
  type ListeningService,
  type ListeningServiceId,
} from "~/music/listeningServices";
import { isListeningLibraryGranted, partitionListeningServices } from "~/music/musicLibraryAccess";
import { useMusicPlayerStore } from "~/music/musicPlayerStore";
import {
  DISCLOSURE_INNER_CLASS,
  disclosureChevronClassName,
  disclosureContentClassName,
  disclosureShellClassName,
} from "~/lib/disclosureMotion";
import { cn } from "~/lib/utils";
import { previewBridge } from "~/components/preview/previewBridge";
import { openPreviewSession } from "~/components/preview/openPreviewSession";
import { usePreviewSession } from "~/components/preview/usePreviewSession";
import {
  parsePreviewMediaMetadata,
  PREVIEW_MEDIA_METADATA_EXPRESSION,
  type PreviewMediaMetadata,
} from "~/components/preview/previewMediaMetadata";
import { isPreviewSupportedInRuntime, useThreadPreviewState } from "~/previewStateStore";
import { listeningListLibraries } from "~/state/listening";
import { previewEnvironment } from "~/state/preview";
import { useAtomCommand } from "~/state/use-atom-command";

export function MusicPanel({ threadRef }: { readonly threadRef: ScopedThreadRef }) {
  const previewSupported = isPreviewSupportedInRuntime();
  const providerId = useMusicPlayerStore((state) => state.providerId);
  const setProviderId = useMusicPlayerStore((state) => state.setProviderId);
  const grantedServiceIds = useMusicPlayerStore((state) => state.grantedServiceIds);
  const grantService = useMusicPlayerStore((state) => state.grantService);
  const revokeService = useMusicPlayerStore((state) => state.revokeService);
  const setTabId = useMusicPlayerStore((state) => state.setTabId);
  const threadKey = scopedThreadKey(threadRef);
  const tabId = useMusicPlayerStore((state) => state.tabIdByThreadKey[threadKey]);
  const service = listeningServiceById(providerId);
  const openPreview = useAtomCommand(previewEnvironment.open, { reportFailure: false });
  const listLibrariesRpc = useAtomCommand(listeningListLibraries, { reportFailure: false });
  const previewState = useThreadPreviewState(threadRef);
  usePreviewSession(threadRef);

  const snapshot = tabId ? (previewState.sessions[tabId] ?? null) : null;
  const desktopOverlay = tabId ? (previewState.desktopByTabId[tabId] ?? null) : null;
  const runtimeTabId = tabId
    ? previewRuntimeTabId(threadRef, previewState.serverEpoch, tabId)
    : null;
  const pageUrl = snapshot?.navStatus._tag === "Idle" ? null : (snapshot?.navStatus.url ?? null);
  const pageTitle =
    snapshot?.navStatus._tag === "Idle" ? null : (snapshot?.navStatus.title ?? null);
  const loading = desktopOverlay?.loading ?? snapshot?.navStatus._tag === "Loading";
  const canGoBack = desktopOverlay?.canGoBack ?? snapshot?.canGoBack ?? false;
  const canGoForward = desktopOverlay?.canGoForward ?? snapshot?.canGoForward ?? false;
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaMetadata, setMediaMetadata] = useState<PreviewMediaMetadata | null>(null);
  const [opening, setOpening] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [libraries, setLibraries] = useState<readonly DesktopListeningLibrary[] | null>(null);
  const [librariesReady, setLibrariesReady] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);

  const granted = isListeningLibraryGranted(grantedServiceIds, providerId);
  const nativeLibrary = granted && providerId === "apple-music";
  const partitioned = useMemo(() => partitionListeningServices(libraries), [libraries]);
  const pickerServices = useMemo(() => {
    const ids = new Set<ListeningServiceId>([
      ...partitioned.detected.map((candidate) => candidate.id),
      ...grantedServiceIds,
    ]);
    if (ids.size === 0) return LISTENING_SERVICES;
    return LISTENING_SERVICES.filter((candidate) => ids.has(candidate.id));
  }, [grantedServiceIds, partitioned.detected]);

  useEffect(() => {
    const list = window.desktopBridge?.listListeningLibraries;
    let cancelled = false;
    const apply = (next: readonly DesktopListeningLibrary[] | null) => {
      if (!cancelled) setLibraries(next);
    };
    void (async () => {
      try {
        if (list) {
          apply((await list()).libraries);
          return;
        }
        const result = await listLibrariesRpc({
          environmentId: threadRef.environmentId,
          input: {},
        });
        if (AsyncResult.isSuccess(result)) {
          apply(result.value.libraries);
          return;
        }
        apply(null);
      } catch {
        apply(null);
      } finally {
        if (!cancelled) setLibrariesReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listLibrariesRpc, threadRef.environmentId]);

  useEffect(() => {
    if (!librariesReady || granted) return;
    const installed = libraries?.filter((library) => library.installed) ?? [];
    if (installed.length === 0) return;
    if (installed.some((library) => library.id === providerId)) return;
    setProviderId(installed[0]!.id);
  }, [granted, libraries, librariesReady, providerId, setProviderId]);

  const navigateTo = useCallback(
    async (url: string) => {
      if (runtimeTabId && previewBridge) {
        await previewBridge.navigate(runtimeTabId, url);
        return;
      }
      setOpening(true);
      try {
        const result = await openPreviewSession({
          openPreview,
          threadRef,
          url,
        });
        if (result._tag === "Success") {
          setTabId(threadRef, result.value.tabId);
        }
      } finally {
        setOpening(false);
      }
    },
    [openPreview, runtimeTabId, setTabId, threadRef],
  );

  useEffect(() => {
    if (!granted || nativeLibrary || !previewSupported || tabId || opening) return;
    void navigateTo(service.homeUrl);
  }, [granted, nativeLibrary, navigateTo, opening, previewSupported, service.homeUrl, tabId]);

  useEffect(() => {
    if (
      !granted ||
      !previewSupported ||
      !runtimeTabId ||
      !previewBridge ||
      !desktopOverlay?.hasWebContents
    ) {
      setMediaMetadata(null);
      return;
    }
    let disposed = false;
    const refresh = async () => {
      try {
        const value = await previewBridge?.automation.evaluate(runtimeTabId, {
          expression: PREVIEW_MEDIA_METADATA_EXPRESSION,
        });
        if (!disposed) setMediaMetadata(parsePreviewMediaMetadata(value, pageUrl, pageTitle));
      } catch {
        if (!disposed) setMediaMetadata(null);
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 3_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [desktopOverlay?.hasWebContents, granted, pageTitle, pageUrl, previewSupported, runtimeTabId]);

  const connectGrantedService = useCallback(
    (nextId: ListeningServiceId) => {
      setProviderId(nextId);
      setSearchQuery("");
      if (nextId === "apple-music") return;
      const next = listeningServiceById(nextId);
      if (previewSupported) {
        void navigateTo(next.homeUrl);
        return;
      }
      void readLocalApi()?.shell.openExternal(next.homeUrl);
    },
    [navigateTo, previewSupported, setProviderId],
  );

  const handleSelectService = useCallback(
    (nextId: ListeningServiceId) => {
      setProviderId(nextId);
      setSearchQuery("");
      if (!isListeningLibraryGranted(grantedServiceIds, nextId)) return;
      connectGrantedService(nextId);
    },
    [connectGrantedService, grantedServiceIds, setProviderId],
  );

  const handleAllowAccess = useCallback(async () => {
    setRequesting(true);
    try {
      const installed =
        libraries?.some((library) => library.id === providerId && library.installed) ?? false;
      const request = window.desktopBridge?.requestListeningLibraryAccess;
      if (request && installed) {
        const result = await request(providerId);
        if (!result.granted) return;
      }
      grantService(providerId);
      connectGrantedService(providerId);
    } finally {
      setRequesting(false);
    }
  }, [connectGrantedService, grantService, libraries, providerId]);

  const handleSearch = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!granted) return;
      const url = searchUrlForListeningService(service, searchQuery);
      if (previewSupported) {
        void navigateTo(url);
        return;
      }
      void readLocalApi()?.shell.openExternal(url);
    },
    [granted, navigateTo, previewSupported, searchQuery, service],
  );

  const openExternally = useCallback(() => {
    void readLocalApi()?.shell.openExternal(pageUrl ?? service.homeUrl);
  }, [pageUrl, service.homeUrl]);

  const nowPlaying = granted && !nativeLibrary ? mediaMetadata : null;
  const showPlayer = granted && !nativeLibrary && previewSupported && Boolean(runtimeTabId);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {granted ? (
        <div className="flex shrink-0 flex-col gap-2 border-b border-border/60 px-3 py-2.5">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {pickerServices.map((candidate) => {
              const selected = candidate.id === providerId;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => handleSelectService(candidate.id)}
                  className={cn(
                    "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors",
                    selected
                      ? "border-foreground/20 bg-foreground text-background"
                      : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: candidate.accent }}
                  />
                  {candidate.label}
                </button>
              );
            })}
          </div>
          {nativeLibrary ? null : (
            <div className="flex items-center gap-1.5">
              {previewSupported ? (
                <>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Back"
                    disabled={!canGoBack}
                    onClick={() => runtimeTabId && void previewBridge?.goBack(runtimeTabId)}
                  >
                    <ArrowLeftIcon />
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Forward"
                    disabled={!canGoForward}
                    onClick={() => runtimeTabId && void previewBridge?.goForward(runtimeTabId)}
                  >
                    <ArrowRightIcon />
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Home"
                    onClick={() => void navigateTo(service.homeUrl)}
                  >
                    <HouseIcon />
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Refresh"
                    disabled={!runtimeTabId}
                    onClick={() => runtimeTabId && void previewBridge?.refresh(runtimeTabId)}
                  >
                    <RotateCwIcon className={loading ? "animate-spin" : undefined} />
                  </Button>
                </>
              ) : null}
              <form onSubmit={handleSearch} className="min-w-0 flex-1">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.currentTarget.value)}
                    placeholder={`Search ${service.label}`}
                    aria-label={`Search ${service.label}`}
                    className="h-7 text-xs [&_[data-slot=input]]:ps-7"
                  />
                </div>
              </form>
            </div>
          )}
        </div>
      ) : null}

      {nativeLibrary ? (
        <MusicLibraryBrowser threadRef={threadRef} serviceId={providerId} />
      ) : showPlayer ? (
        <BrowserSurfaceSlot tabId={runtimeTabId!} visible className="min-h-0 flex-1" />
      ) : granted ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <LibraryMark service={service} />
          <div className="max-w-sm">
            <h2 className="text-base font-medium text-foreground">{service.label}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {previewSupported
                ? opening
                  ? `Opening ${service.label}…`
                  : `Sign in to ${service.label} here, then pick a playlist or song.`
                : `${service.label} plays inside Modesto in the desktop app. In the browser, this opens your library in a new window.`}
            </p>
          </div>
          {previewSupported ? null : (
            <Button type="button" size="sm" onClick={openExternally}>
              Open {service.label}
            </Button>
          )}
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => revokeService(providerId)}
          >
            Disconnect library
          </button>
        </div>
      ) : (
        <LibraryAccessScreen
          librariesReady={librariesReady}
          partitioned={partitioned}
          providerId={providerId}
          requesting={requesting}
          otherOpen={otherOpen}
          onToggleOther={() => setOtherOpen((open) => !open)}
          onSelect={handleSelectService}
          onAllow={() => void handleAllowAccess()}
        />
      )}

      {nowPlaying ? (
        <div className="flex shrink-0 items-center gap-3 border-t border-border/60 px-3 py-2.5">
          {nowPlaying.artworkUrl ? (
            <img
              src={nowPlaying.artworkUrl}
              alt=""
              className="size-10 shrink-0 rounded-md object-cover"
            />
          ) : (
            <span
              className="size-10 shrink-0 rounded-md"
              style={{ backgroundColor: `${service.accent}33` }}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{nowPlaying.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[nowPlaying.artist, nowPlaying.sourceLabel].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LibraryMark({ service }: { readonly service: ListeningService }) {
  return (
    <div
      className="flex size-16 items-center justify-center rounded-2xl"
      style={{ backgroundColor: `${service.accent}22` }}
    >
      <span className="size-5 rounded-full" style={{ backgroundColor: service.accent }} />
    </div>
  );
}

function LibraryAccessScreen({
  librariesReady,
  partitioned,
  providerId,
  requesting,
  otherOpen,
  onToggleOther,
  onSelect,
  onAllow,
}: {
  readonly librariesReady: boolean;
  readonly partitioned: ReturnType<typeof partitionListeningServices>;
  readonly providerId: ListeningServiceId;
  readonly requesting: boolean;
  readonly otherOpen: boolean;
  readonly onToggleOther: () => void;
  readonly onSelect: (id: ListeningServiceId) => void;
  readonly onAllow: () => void;
}) {
  const selected = listeningServiceById(providerId);
  const detected = partitioned.detected;
  const other = partitioned.other;
  const headline = partitioned.detectionAvailable
    ? detected.length > 0
      ? "Listening apps on this computer"
      : "No listening apps found"
    : "Connect a library";
  const copy = partitioned.detectionAvailable
    ? detected.length > 0
      ? "Modesto found these apps. Allow access to a library before Music can browse playlists or play songs."
      : "Install Apple Music, Spotify, or another listening app, then come back. You can still connect a web library below."
    : "The desktop app can see installed music apps and ask for their libraries. Here, pick a service and allow access to open it.";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <div>
          <h2 className="text-[15px] font-medium tracking-tight text-foreground">{headline}</h2>
          <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">{copy}</p>
        </div>

        {!librariesReady ? (
          <p className="text-[13px] text-muted-foreground">Looking for listening apps…</p>
        ) : null}

        {detected.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {detected.map((candidate) => (
              <LibraryAccessRow
                key={candidate.id}
                service={candidate}
                selected={candidate.id === providerId}
                presence="installed"
                onSelect={() => onSelect(candidate.id)}
              />
            ))}
          </ul>
        ) : partitioned.detectionAvailable ? null : (
          <ul className="flex flex-col gap-2">
            {LISTENING_SERVICES.map((candidate) => (
              <LibraryAccessRow
                key={candidate.id}
                service={candidate}
                selected={candidate.id === providerId}
                presence="unknown"
                onSelect={() => onSelect(candidate.id)}
              />
            ))}
          </ul>
        )}

        {partitioned.detectionAvailable && other.length > 0 ? (
          <div>
            <button
              type="button"
              onClick={onToggleOther}
              className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronRightIcon className={disclosureChevronClassName(otherOpen)} />
              Other services
            </button>
            <div className={disclosureShellClassName(otherOpen, "mt-2")}>
              <div className={DISCLOSURE_INNER_CLASS}>
                <div className={disclosureContentClassName(otherOpen)}>
                  <ul className="flex flex-col gap-2">
                    {other.map((candidate) => (
                      <LibraryAccessRow
                        key={candidate.id}
                        service={candidate}
                        selected={candidate.id === providerId}
                        presence="missing"
                        onSelect={() => onSelect(candidate.id)}
                      />
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
          <div className="flex items-center gap-3">
            <LibraryMark service={selected} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{selected.label}</p>
              <p className="text-[12px] leading-4 text-muted-foreground">
                {detected.some((candidate) => candidate.id === selected.id)
                  ? "Installed. Allow access to this library."
                  : "Allow access, then Modesto will open this library."}
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="mt-4 w-full"
            disabled={requesting || !librariesReady}
            onClick={onAllow}
          >
            {requesting ? "Asking…" : `Allow access to ${selected.label}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LibraryAccessRow({
  service,
  selected,
  presence,
  onSelect,
}: {
  readonly service: ListeningService;
  readonly selected: boolean;
  readonly presence: "installed" | "missing" | "unknown";
  readonly onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
          selected
            ? "border-foreground/20 bg-foreground/[0.06]"
            : "border-transparent bg-muted/40 hover:bg-muted/70",
        )}
      >
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: service.accent }}
        />
        <span className="min-w-0 flex-1 text-[13px] font-medium text-foreground">
          {service.label}
        </span>
        {presence === "unknown" ? null : (
          <span className="text-[11px] text-muted-foreground">
            {presence === "installed" ? "Installed" : "Not installed"}
          </span>
        )}
      </button>
    </li>
  );
}
