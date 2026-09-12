import type { EnvironmentId } from "@modesto/contracts";

import { cn } from "~/lib/utils";

import { SlideMarkdown } from "./SlideMarkdown";

const STAGE_MARKDOWN_CLASS =
  "slides-markdown max-h-full overflow-y-auto text-foreground " +
  "[&_h1]:text-[clamp(1.55rem,3.4vw,2.25rem)] [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:leading-[1.15] " +
  "[&_h2]:mt-3 [&_h2]:text-[clamp(1.15rem,2.4vw,1.45rem)] [&_h2]:font-semibold [&_h2]:tracking-tight " +
  "[&_h3]:mt-2 [&_h3]:text-[1.05rem] [&_h3]:font-medium " +
  "[&_p]:mt-3 [&_p]:max-w-[36rem] [&_p]:text-[clamp(1rem,1.7vw,1.2rem)] [&_p]:leading-7 [&_p]:text-muted-foreground " +
  "[&_ul]:mt-5 [&_ul]:list-none [&_ul]:space-y-2.5 [&_ul]:pl-0 " +
  "[&_ol]:mt-5 [&_ol]:list-decimal [&_ol]:space-y-2.5 [&_ol]:pl-6 " +
  "[&_li]:text-[clamp(1rem,1.7vw,1.15rem)] [&_li]:leading-7 " +
  "[&_ul>li]:relative [&_ul>li]:pl-5 [&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:top-[0.7em] [&_ul>li]:before:size-1.5 [&_ul>li]:before:rounded-full [&_ul>li]:before:bg-foreground/55 " +
  "[&_img]:mb-5 [&_img]:max-h-16 [&_img]:max-w-full [&_img]:object-contain " +
  "[&_pre]:mt-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted/70 [&_pre]:px-3 [&_pre]:py-2 " +
  "[&_code]:font-mono [&_code]:text-[0.85em] " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground";

const THUMB_MARKDOWN_CLASS =
  "slides-markdown pointer-events-none select-none text-foreground " +
  "[&_h1]:text-[11px] [&_h1]:font-semibold [&_h1]:leading-tight [&_h1]:tracking-tight " +
  "[&_h2]:mt-0.5 [&_h2]:text-[9px] [&_h2]:font-semibold [&_h2]:leading-tight " +
  "[&_p]:mt-1 [&_p]:text-[8px] [&_p]:leading-3 [&_p]:text-muted-foreground " +
  "[&_ul]:mt-1 [&_ul]:list-disc [&_ul]:pl-3 [&_ol]:mt-1 [&_ol]:list-decimal [&_ol]:pl-3 " +
  "[&_li]:text-[8px] [&_li]:leading-3 " +
  "[&_img]:mb-1 [&_img]:max-h-6 [&_img]:max-w-full " +
  "[&_pre]:hidden [&_blockquote]:hidden";

export function SlideStage({
  markdown,
  environmentId,
  cwd,
  deckSourcePath,
  compact = false,
}: {
  readonly markdown: string;
  readonly environmentId: EnvironmentId | null | undefined;
  readonly cwd: string | null | undefined;
  readonly deckSourcePath: string | null;
  readonly compact?: boolean;
}) {
  return (
    <div className={cn(compact ? THUMB_MARKDOWN_CLASS : STAGE_MARKDOWN_CLASS)}>
      <SlideMarkdown
        markdown={markdown}
        environmentId={environmentId}
        cwd={cwd}
        deckSourcePath={deckSourcePath}
      />
    </div>
  );
}
