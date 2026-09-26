import { useEffect, useMemo, useRef } from "react";

import { composeHtmlDocument, looksLikeHtml } from "~/studio/canvasLanguages";

export function CanvasFrame({
  source,
  title,
  zoom = 1,
  onZoomChange,
}: {
  readonly source: string;
  readonly title: string;
  readonly zoom?: number;
  /** Receives Ctrl/⌘-wheel, pinch, and Ctrl/⌘-0 gestures from the artifact. */
  readonly onZoomChange?: ((zoom: number) => void) | undefined;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const srcDoc = useMemo(() => {
    if (!looksLikeHtml(source)) return null;
    const document =
      /^<!doctype html/i.test(source.trim()) || /^<html[\s>]/i.test(source.trim())
        ? source
        : composeHtmlDocument({ html: source });
    return installCanvasNavigationBridge(document);
  }, [source]);

  if (!srcDoc) return null;

  const safeZoom = Math.min(2, Math.max(0.5, zoom));
  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (!isCanvasFrameMessage(event.data)) return;
      if (event.data.type === "zoom") {
        const next = Math.min(2, Math.max(0.5, safeZoom + (event.data.deltaY < 0 ? 0.1 : -0.1)));
        onZoomChange?.(Math.round(next * 100) / 100);
        return;
      }
      if (event.data.type === "reset-zoom") {
        onZoomChange?.(1);
        return;
      }
      // Space-drag pans the canvas only. Regular pointer input stays inside
      // the artifact so charts, buttons, text fields, and games remain live.
      viewportRef.current?.scrollBy({ left: -event.data.dx, top: -event.data.dy });
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onZoomChange, safeZoom]);
  return (
    <div
      ref={viewportRef}
      className="h-full w-full overflow-auto overscroll-contain bg-background"
      aria-label={`${title} canvas`}
    >
      <div
        style={{ width: `${safeZoom * 100}%`, height: `${safeZoom * 100}%` }}
        className="relative min-h-full min-w-full"
      >
        <iframe
          ref={frameRef}
          title={title}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          srcDoc={srcDoc}
          style={{
            width: `${100 / safeZoom}%`,
            height: `${100 / safeZoom}%`,
            transform: `scale(${safeZoom})`,
            transformOrigin: "top left",
          }}
          className="absolute inset-0 border-0 bg-background"
        />
      </div>
    </div>
  );
}

type CanvasFrameMessage =
  | { readonly source: "modesto-canvas"; readonly type: "zoom"; readonly deltaY: number }
  | { readonly source: "modesto-canvas"; readonly type: "reset-zoom" }
  | {
      readonly source: "modesto-canvas";
      readonly type: "pan";
      readonly dx: number;
      readonly dy: number;
    };

function isCanvasFrameMessage(value: unknown): value is CanvasFrameMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  if (message.source !== "modesto-canvas") return false;
  if (message.type === "reset-zoom") return true;
  if (message.type === "zoom") return typeof message.deltaY === "number";
  return message.type === "pan" && typeof message.dx === "number" && typeof message.dy === "number";
}

/**
 * The artifact lives in an opaque sandbox, so wheel and pointer events do not
 * bubble into the surrounding React canvas. This tiny bridge preserves normal
 * artifact interaction and forwards only deliberate navigation gestures.
 */
function installCanvasNavigationBridge(document: string): string {
  const bridge = `<script>
(() => {
  let spaceDown = false;
  let dragging = false;
  let previousX = 0;
  let previousY = 0;
  const send = (message) => parent.postMessage({ source: "modesto-canvas", ...message }, "*");
  const isInteractiveTarget = (target) => target instanceof Element && Boolean(target.closest(
    "input, textarea, select, button, a, [contenteditable], [role=button], [role=link]"
  ));
  addEventListener("keydown", (event) => {
    if (event.code === "Space" && !event.repeat && !isInteractiveTarget(event.target)) {
      spaceDown = true;
      document.documentElement.style.cursor = "grab";
      event.preventDefault();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "0") {
      send({ type: "reset-zoom" });
      event.preventDefault();
    }
  }, true);
  addEventListener("keyup", (event) => {
    if (event.code === "Space") {
      spaceDown = false;
      dragging = false;
      document.documentElement.style.cursor = "";
    }
  }, true);
  addEventListener("wheel", (event) => {
    if (event.metaKey || event.ctrlKey) {
      send({ type: "zoom", deltaY: event.deltaY });
      event.preventDefault();
    }
  }, { capture: true, passive: false });
  addEventListener("pointerdown", (event) => {
    if (!spaceDown || event.button !== 0) return;
    dragging = true;
    previousX = event.clientX;
    previousY = event.clientY;
    document.documentElement.style.cursor = "grabbing";
    event.preventDefault();
  }, true);
  addEventListener("pointermove", (event) => {
    if (!dragging) return;
    send({ type: "pan", dx: event.clientX - previousX, dy: event.clientY - previousY });
    previousX = event.clientX;
    previousY = event.clientY;
    event.preventDefault();
  }, true);
  addEventListener("pointerup", () => {
    if (!dragging) return;
    dragging = false;
    document.documentElement.style.cursor = spaceDown ? "grab" : "";
  }, true);
})();
</script>`;
  return /<\/body\s*>/i.test(document)
    ? document.replace(/<\/body\s*>/i, `${bridge}</body>`)
    : `${document}${bridge}`;
}
