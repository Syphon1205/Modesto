import type { EnvironmentId, ScopedThreadRef } from "@modesto/contracts";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileCodeIcon,
  Maximize2Icon,
  Minimize2Icon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "~/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { downloadBlob, openGoogleWorkspace } from "~/lib/downloadBlob";
import { disclosureWidthClassName } from "~/lib/disclosureMotion";
import { cn } from "~/lib/utils";
import { CanvasFrame } from "~/components/studio/CanvasFrame";
import { htmlDocumentForSlide, looksLikeHtml, parseHtmlSlides } from "~/studio/canvasLanguages";
import {
  extractSlideDeckFrontMatter,
  markdownDeckToHtml,
  parseSlideDeck,
  rebuildSlideDeckMarkdown,
  replaceSlideMarkdown,
  serializeSlideMarkdown,
} from "~/slides/slideDeck";
import { buildSlideDeckPptx, suggestPptxFilename } from "~/slides/slidePptx";
import {
  parseSlideTransition,
  setSlideTransitionFrontMatter,
  slideTransitionStyle,
  type SlideTransition,
} from "~/slides/slideTransition";
import { selectThreadSlideDeck, useSlidesStore } from "~/slides/slidesStore";

import "./slidesMotion.css";

type SourceScope = "slide" | "deck";

export function SlidesPanel({
  threadRef,
  environmentId,
  cwd,
}: {
  readonly threadRef: ScopedThreadRef | null;
  readonly environmentId?: EnvironmentId | null | undefined;
  readonly cwd?: string | null | undefined;
}) {
  const applyUserDeck = useSlidesStore((state) => state.applyUserDeck);
  const setIndex = useSlidesStore((state) => state.setIndex);
  const snapshot = useSlidesStore(
    useShallow((state) => {
      const selected = selectThreadSlideDeck(state, threadRef);
      return {
        markdown: selected.markdown,
        sourcePath: selected.sourcePath,
        index: selected.index,
        generating: selected.generating,
        isStarter: selected.isStarter,
        dirty: selected.dirty,
      };
    }),
  );
  const [sourceOpen, setSourceOpen] = useState(true);
  const [sourceScope, setSourceScope] = useState<SourceScope>("slide");
  const [presenting, setPresenting] = useState(false);
  const [sourceFocused, setSourceFocused] = useState(false);
  const htmlDeck = looksLikeHtml(snapshot.markdown);
  const storedDeck = useMemo(() => parseSlideDeck(snapshot.markdown), [snapshot.markdown]);
  const storedCurrent = storedDeck.slides[snapshot.index] ?? storedDeck.slides[0];
  const currentSource =
    htmlDeck || sourceScope === "deck"
      ? snapshot.markdown
      : storedCurrent
        ? serializeSlideMarkdown(storedCurrent)
        : "";
  const [draft, setDraft] = useState(currentSource);

  useEffect(() => {
    if (sourceFocused && snapshot.dirty) return;
    setDraft(currentSource);
  }, [currentSource, snapshot.dirty, sourceFocused]);

  const liveMarkdown = useMemo(() => {
    if (!sourceOpen) return snapshot.markdown;
    if (htmlDeck || sourceScope === "deck") return draft;
    return replaceSlideMarkdown(snapshot.markdown, snapshot.index, draft);
  }, [draft, htmlDeck, snapshot.index, snapshot.markdown, sourceOpen, sourceScope]);
  const previewHtml = useMemo(
    () => (looksLikeHtml(liveMarkdown) ? liveMarkdown : markdownDeckToHtml(liveMarkdown)),
    [liveMarkdown],
  );
  const deck = useMemo(() => parseSlideDeck(liveMarkdown), [liveMarkdown]);
  const liveHtmlSlides = useMemo(() => parseHtmlSlides(previewHtml), [previewHtml]);
  const current = deck.slides[snapshot.index] ?? deck.slides[0];
  const currentHtml = liveHtmlSlides[snapshot.index] ?? liveHtmlSlides[0];
  const { frontMatter } = extractSlideDeckFrontMatter(liveMarkdown);
  const transition = parseSlideTransition(frontMatter);

  const go = useCallback(
    (next: number) => {
      if (!threadRef) return;
      setIndex(threadRef, next);
    },
    [setIndex, threadRef],
  );

  const applyDraft = useCallback(
    (nextDraft: string) => {
      if (!threadRef) return;
      setDraft(nextDraft);
      const nextMarkdown =
        htmlDeck || sourceScope === "deck"
          ? nextDraft
          : replaceSlideMarkdown(snapshot.markdown, snapshot.index, nextDraft);
      if (nextMarkdown === snapshot.markdown) return;
      applyUserDeck(threadRef, nextMarkdown, snapshot.sourcePath);
    },
    [
      applyUserDeck,
      htmlDeck,
      snapshot.index,
      snapshot.markdown,
      snapshot.sourcePath,
      sourceScope,
      threadRef,
    ],
  );

  const applyTransition = (next: SlideTransition) => {
    if (!threadRef) return;
    const nextMarkdown = rebuildSlideDeckMarkdown({
      frontMatter: setSlideTransitionFrontMatter(frontMatter, next),
      slides: deck.slides,
    });
    applyUserDeck(threadRef, nextMarkdown, snapshot.sourcePath);
  };

  const downloadPptx = async (openGoogle: boolean) => {
    const bytes = await buildSlideDeckPptx(liveMarkdown);
    downloadBlob(
      suggestPptxFilename(liveMarkdown),
      new Blob([new Uint8Array(bytes)], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }),
    );
    if (openGoogle) openGoogleWorkspace("slides");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable) return;
      }
      if (event.key === "Escape" && presenting) {
        event.preventDefault();
        setPresenting(false);
        return;
      }
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        go(snapshot.index + 1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        go(snapshot.index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, presenting, snapshot.index]);

  if (!threadRef) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Open a thread, then type /slides to build a deck.
      </div>
    );
  }

  const slides = liveHtmlSlides.length > 0 ? liveHtmlSlides : deck.slides;
  const lastIndex = Math.max(0, slides.length - 1);
  const title = snapshot.sourcePath ?? (snapshot.isStarter ? "Starter deck" : "Untitled deck");

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background">
      {presenting ? null : (
        <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
            {snapshot.generating ? "Building…" : title}
          </p>
          <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {snapshot.index + 1} / {slides.length}
          </p>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Previous slide"
            disabled={snapshot.index <= 0}
            onClick={() => go(snapshot.index - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Next slide"
            disabled={snapshot.index >= lastIndex}
            onClick={() => go(snapshot.index + 1)}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            type="button"
            size="xs"
            variant={sourceOpen ? "secondary" : "ghost"}
            onClick={() => setSourceOpen((open) => !open)}
          >
            <FileCodeIcon />
            HTML
          </Button>
          <Menu>
            <MenuTrigger
              render={
                <Button type="button" size="xs" variant="ghost">
                  Motion
                </Button>
              }
            />
            <MenuPopup align="end">
              {(
                [
                  ["fade", "Fade"],
                  ["slide", "Slide"],
                  ["none", "None"],
                ] as const
              ).map(([value, label]) => (
                <MenuItem key={value} onClick={() => applyTransition(value)}>
                  {label}
                  {transition === value ? " ·" : ""}
                </MenuItem>
              ))}
            </MenuPopup>
          </Menu>
          <Menu>
            <MenuTrigger
              render={
                <Button type="button" size="xs" variant="ghost">
                  <DownloadIcon />
                  Download
                </Button>
              }
            />
            <MenuPopup align="end">
              <MenuItem
                onClick={() => {
                  downloadBlob(
                    suggestPptxFilename(previewHtml).replace(/\.pptx$/, ".html"),
                    new Blob([previewHtml], { type: "text/html" }),
                  );
                }}
              >
                HTML
              </MenuItem>
              <MenuItem onClick={() => void downloadPptx(false)}>PowerPoint (.pptx)</MenuItem>
              <MenuItem onClick={() => void downloadPptx(true)}>Google Slides</MenuItem>
            </MenuPopup>
          </Menu>
          <Button type="button" size="xs" variant="ghost" onClick={() => setPresenting(true)}>
            <Maximize2Icon />
            Present
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {presenting ? null : (
          <nav
            aria-label="Slides"
            className="flex w-[132px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-border/60 p-2"
          >
            {slides.map((slide, index) => {
              const selected = index === snapshot.index;
              return (
                <button
                  key={`${slide.title}:${index}`}
                  type="button"
                  aria-label={`Slide ${index + 1}: ${slide.title}`}
                  aria-current={selected}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg p-1 text-left transition-colors",
                    selected ? "bg-accent ring-1 ring-foreground/20" : "hover:bg-accent/70",
                  )}
                  onClick={() => go(index)}
                >
                  <div className="overflow-hidden rounded-md border border-border/70 bg-card">
                    <div className="aspect-video overflow-hidden p-1.5">
                      <CanvasFrame
                        source={htmlDocumentForSlide(previewHtml, index)}
                        title={`Slide ${index + 1}`}
                      />
                    </div>
                  </div>
                  <span className="truncate px-0.5 text-[10px] text-muted-foreground">
                    {index + 1}. {slide.title}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            className={cn(
              "flex min-h-0 flex-1 items-center justify-center",
              presenting ? "bg-black p-3" : "p-4",
            )}
          >
            <div
              className={cn(
                "studio-slide-motion relative flex aspect-video w-full max-w-[960px] flex-col justify-center overflow-hidden rounded-2xl border px-8 py-8 shadow-sm",
                presenting
                  ? "max-h-full border-white/10 bg-neutral-950 text-white [&_p]:text-white/70"
                  : "border-border/70 bg-card",
              )}
              key={`${snapshot.index}:${current?.markdown ?? ""}`}
              style={{ animation: presenting ? slideTransitionStyle(transition) : undefined }}
            >
              {currentHtml || current ? (
                <CanvasFrame
                  source={htmlDocumentForSlide(previewHtml, snapshot.index)}
                  title={currentHtml?.title ?? current?.title ?? "Slide"}
                />
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  Send /slides to build a presentation.
                </p>
              )}
            </div>
          </div>
          {presenting || !current?.notes ? null : (
            <p className="shrink-0 border-t border-border/50 px-4 py-2 text-[11px] text-muted-foreground">
              Notes: {current.notes}
            </p>
          )}
          {presenting ? (
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <p className="text-[11px] tabular-nums text-white/70">
                {snapshot.index + 1} / {slides.length}
              </p>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Exit present"
                className="text-white hover:bg-white/10"
                onClick={() => setPresenting(false)}
              >
                <Minimize2Icon />
              </Button>
            </div>
          ) : null}
        </div>

        <div className={disclosureWidthClassName(sourceOpen && !presenting, "w-[min(22rem,38%)]")}>
          <div className="flex h-full min-h-0 w-full flex-col border-l border-border/60">
            <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-2 py-1.5">
              {htmlDeck ? (
                <span className="px-1 text-[10px] text-muted-foreground">HTML · CSS · JS</span>
              ) : (
                <>
                  <Button
                    type="button"
                    size="micro"
                    variant={sourceScope === "slide" ? "secondary" : "ghost"}
                    onClick={() => setSourceScope("slide")}
                  >
                    Slide
                  </Button>
                  <Button
                    type="button"
                    size="micro"
                    variant={sourceScope === "deck" ? "secondary" : "ghost"}
                    onClick={() => setSourceScope("deck")}
                  >
                    Deck
                  </Button>
                </>
              )}
              <span className="ml-auto text-[10px] text-muted-foreground">
                {snapshot.dirty ? "Saving…" : snapshot.sourcePath ? "Saved" : "In memory"}
              </span>
            </div>
            <textarea
              value={draft}
              onChange={(event) => applyDraft(event.currentTarget.value)}
              onFocus={() => setSourceFocused(true)}
              onBlur={() => setSourceFocused(false)}
              className="min-h-0 flex-1 resize-none bg-transparent px-3 py-2 font-mono text-[12px] leading-5 text-foreground outline-none"
              spellCheck={false}
              aria-label={
                htmlDeck ? "Deck HTML" : sourceScope === "deck" ? "Deck markdown" : "Slide markdown"
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
