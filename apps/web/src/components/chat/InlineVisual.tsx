import { useMemo, useState, type ReactNode } from "react";
import { RotateCcwIcon } from "lucide-react";
import { CanvasFrame } from "../studio/CanvasFrame";
import { Button } from "../ui/button";
import { inlineVisualDocument, inlineVisualKind } from "../../studio/inlineVisuals";

export function InlineVisual({
  source,
  language,
  title,
  isStreaming,
  children,
}: {
  readonly source: string;
  readonly language: string;
  readonly title?: string | null | undefined;
  readonly isStreaming: boolean;
  readonly children: ReactNode;
}) {
  const [view, setView] = useState<"preview" | "source">("preview");
  const [revision, setRevision] = useState(0);
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
          <CanvasFrame key={revision} source={document} title={label} />
        </div>
      )}
      {(isStreaming || view === "source") && <div>{children}</div>}
    </section>
  );
}
