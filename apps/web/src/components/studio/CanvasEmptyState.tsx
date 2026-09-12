import { PaintbrushIcon } from "lucide-react";

import { Button } from "~/components/ui/button";

export function CanvasEmptyState({ onNewCanvas }: { readonly onNewCanvas: () => void }) {
  return (
    <div className="relative flex h-full min-h-0 items-center justify-center overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_28%_18%,color-mix(in_srgb,var(--foreground)_9%,transparent),transparent_46%),radial-gradient(ellipse_at_78%_82%,color-mix(in_srgb,var(--foreground)_6%,transparent),transparent_50%)]"
      />
      <div className="relative flex max-w-[20rem] flex-col items-center px-6 text-center">
        <div className="mb-5 flex size-11 items-center justify-center rounded-[0.85rem] border border-foreground/15 bg-background/40 text-foreground">
          <PaintbrushIcon className="size-5" strokeWidth={1.6} />
        </div>
        <h2 className="text-[1.35rem] font-semibold tracking-tight text-foreground">
          Create a New Canvas
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
          Build a dashboard, document, or other artifact
        </p>
        <Button
          type="button"
          className="mt-6 h-9 min-w-[8.5rem] rounded-md border-transparent bg-foreground px-4 text-background hover:bg-foreground/90"
          onClick={onNewCanvas}
        >
          New Canvas
        </Button>
      </div>
    </div>
  );
}
