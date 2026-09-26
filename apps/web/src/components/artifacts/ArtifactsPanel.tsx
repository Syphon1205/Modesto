// FILE: ArtifactsPanel.tsx
// Purpose: Everything the agents produced in this thread, as things you can
//          open - a right-panel surface alongside Browser, Diff, and Files.
// Layer: Chat right panel
//
// This is the Cowork mechanic Modesto was missing. Modesto already surfaces
// *edited* files through diffs, but a file the agent produced or pointed at -
// a report, a CSV, an exported chart - only ever existed as text in the
// transcript. Here they are collected and openable.
//
// It lives in the right panel rather than on its own page because artifacts
// are per thread: they belong beside the conversation that produced them, in
// the same place the file that gets opened will be shown.
//
// Detection lives in `artifactTargets.ts` and is deliberately conservative:
// a false positive puts a broken row in front of the user, which costs more
// trust than a missed file costs convenience.

import type { ScopedThreadRef } from "@modesto/contracts";
import {
  FileCodeIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  LayoutTemplateIcon,
  PresentationIcon,
  SheetIcon,
  WorkflowIcon,
} from "lucide-react";
import { useMemo } from "react";

import { useThreadMessages } from "~/state/entities";
import {
  type ArtifactPreviewKind,
  collectThreadArtifacts,
  collectThreadVisualArtifacts,
} from "./artifactTargets";

const ICON_BY_PREVIEW: Readonly<Record<ArtifactPreviewKind, typeof FileIcon>> = {
  markdown: FileTextIcon,
  sheet: SheetIcon,
  image: ImageIcon,
  pdf: FileTextIcon,
  html: LayoutTemplateIcon,
  document: FileTextIcon,
  slides: PresentationIcon,
  text: FileCodeIcon,
  other: FileIcon,
};

export function ArtifactsPanel({
  threadRef,
  onOpen,
  onOpenVisual,
}: {
  readonly threadRef: ScopedThreadRef | null;
  /** Opens an artifact; the caller owns how (right panel, editor, external). */
  readonly onOpen: ((path: string) => void) | undefined;
  readonly onOpenVisual?:
    | ((visual: { readonly id: string; readonly title: string; readonly document: string }) => void)
    | undefined;
}) {
  const messages = useThreadMessages(threadRef);
  const artifacts = useMemo(() => collectThreadArtifacts(messages), [messages]);
  const visuals = useMemo(() => collectThreadVisualArtifacts(messages), [messages]);

  if (threadRef === null) {
    return (
      <div className="w-full p-6">
        <h2 className="text-base font-medium text-foreground">No thread selected</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Artifacts are collected per thread. Open a task to see what its agent produced.
        </p>
      </div>
    );
  }

  if (artifacts.length === 0 && visuals.length === 0) {
    return (
      <div className="w-full p-6">
        <h2 className="text-base font-medium text-foreground">No artifacts yet</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Files, diagrams, and interactive previews the agent creates appear here, ready to open.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 p-3">
      {visuals.length > 0 ? (
        <section>
          <h3 className="px-1 pb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Generated visuals
          </h3>
          <ul className="space-y-1">
            {visuals.map((visual) => (
              <li key={visual.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 text-left hover:bg-sidebar-row-hover"
                  onClick={() => onOpenVisual?.(visual)}
                >
                  <WorkflowIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{visual.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] capitalize text-muted-foreground">
                      {visual.language} visual
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {artifacts.length > 0 ? (
        <section>
          <h3 className="px-1 pb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Files
          </h3>
          <ul className="space-y-1">
            {artifacts.map((artifact) => {
              const Icon = ICON_BY_PREVIEW[artifact.preview];
              return (
                <li key={artifact.path}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 text-left hover:bg-sidebar-row-hover disabled:cursor-default disabled:opacity-60"
                    disabled={onOpen === undefined}
                    title={artifact.path}
                    onClick={() => onOpen?.(artifact.path)}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">
                        {artifact.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {artifact.path}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
