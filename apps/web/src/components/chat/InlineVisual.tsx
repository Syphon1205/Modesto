import { useMemo, useState, type ReactNode } from "react";
import {
  ExternalLinkIcon,
  PanelRightOpenIcon,
  RotateCcwIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { CanvasFrame } from "../studio/CanvasFrame";
import { Button } from "../ui/button";
import { inlineVisualDocument, inlineVisualKind } from "../../studio/inlineVisuals";

export function InlineVisual({
  source,
  language,
  title,
  isStreaming,
  children,
  onOpenInPanel,
}: {
  readonly source: string;
  readonly language: string;
  readonly title?: string | null | undefined;
  readonly isStreaming: boolean;
  readonly children: ReactNode;
  readonly onOpenInPanel?:
    | ((visual: { readonly title: string; readonly document: string }) => void)
    | undefined;
}) {
  const [view, setView] = useState<"preview" | "source">("preview");
  const [revision, setRevision] = useState(0);
  const [zoom, setZoom] = useState(1);
  // Never execute incomplete model output or rebuild a frame for every streamed token.
  const document = useMemo(
    () => (isStreaming ? null : inlineVisualDocument(language, source)),
    [isStreaming, language, source],
  );
  const label =
    title ||
    (inlineVisualKind(language) === "diagram"
      ? "Diagram"
      : inlineVisualKind(language) === "graphic"
        ? "Graphic"
        : "Interactive preview");
  return (
    <section
      className="chat-inline-visual my-4 overflow-hidden rounded-xl border border-border/70 bg-card"
      aria-label={label}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2 text-xs">
        <span className="mr-auto truncate font-medium text-foreground">{label}</span>
        {isStreaming ? (
          <span role="status" className="text-muted-foreground">
            Preparing preview…
          </span>
        ) : (
          <>
            <div role="group" aria-label="Visual view" className="flex gap-1">
              <Button
                size="xs"
                variant="ghost"
                aria-pressed={view === "preview"}
                onClick={() => setView("preview")}
              >
                Preview
              </Button>
              <Button
                size="xs"
                variant="ghost"
                aria-pressed={view === "source"}
                onClick={() => setView("source")}
              >
                Source
              </Button>
            </div>
            {document && view === "preview" ? (
              <VisualZoomControls zoom={zoom} onZoomChange={setZoom} />
            ) : null}
            {document && onOpenInPanel ? (
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="Open visual beside conversation"
                title="Open beside conversation"
                onClick={() => onOpenInPanel({ title: label, document })}
              >
                <PanelRightOpenIcon className="size-3.5" />
              </Button>
            ) : null}
            {document ? (
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="Open visual in browser"
                title="Open in browser"
                onClick={() => openInlineVisualInNewTab(document, label)}
              >
                <ExternalLinkIcon className="size-3.5" />
              </Button>
            ) : null}
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Restart preview"
              title="Restart preview"
              onClick={() => setRevision((value) => value + 1)}
            >
              <RotateCcwIcon className="size-3.5" />
            </Button>
          </>
        )}
      </div>
      {document && (
        <div
          hidden={view !== "preview"}
          className="h-96 min-h-48 max-h-[80vh] resize-y overflow-auto"
        >
          <CanvasFrame
            key={revision}
            source={document}
            title={label}
            zoom={zoom}
            onZoomChange={setZoom}
          />
        </div>
      )}
      {(isStreaming || view === "source") && <div>{children}</div>}
    </section>
  );
}

export const MIN_VISUAL_ZOOM = 0.5;
export const MAX_VISUAL_ZOOM = 2;
export const VISUAL_ZOOM_STEP = 0.25;

export function VisualZoomControls({
  zoom,
  onZoomChange,
}: {
  readonly zoom: number;
  readonly onZoomChange: (zoom: number) => void;
}) {
  const setClampedZoom = (next: number) =>
    onZoomChange(Math.min(MAX_VISUAL_ZOOM, Math.max(MIN_VISUAL_ZOOM, next)));
  return (
    <div role="group" aria-label="Visual zoom" className="flex items-center gap-0.5">
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Zoom out"
        disabled={zoom <= MIN_VISUAL_ZOOM}
        onClick={() => setClampedZoom(zoom - VISUAL_ZOOM_STEP)}
      >
        <ZoomOutIcon className="size-3.5" />
      </Button>
      <Button
        size="xs"
        variant="ghost"
        aria-label="Reset zoom"
        title="⌘/Ctrl + wheel or pinch to zoom · Space + drag to pan · Click to reset"
        className="min-w-11 px-1 font-mono text-[10px] tabular-nums"
        onClick={() => setClampedZoom(1)}
      >
        {Math.round(zoom * 100)}%
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Zoom in"
        disabled={zoom >= MAX_VISUAL_ZOOM}
        onClick={() => setClampedZoom(zoom + VISUAL_ZOOM_STEP)}
      >
        <ZoomInIcon className="size-3.5" />
      </Button>
    </div>
  );
}

export function openInlineVisualInNewTab(document: string, title: string): boolean {
  if (typeof window === "undefined" || typeof URL.createObjectURL !== "function") return false;
  const titledDocument = document.replace(
    /<head([\s>])/i,
    `<head$1<title>${escapeDocumentTitle(title)}</title>`,
  );
  const blobUrl = URL.createObjectURL(
    new Blob([titledDocument], { type: "text/html;charset=utf-8" }),
  );
  const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");
  // The new tab owns the loaded bytes after navigation. A delay avoids
  // revoking before slower browsers have consumed the object URL.
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  return opened !== null;
}

function escapeDocumentTitle(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
