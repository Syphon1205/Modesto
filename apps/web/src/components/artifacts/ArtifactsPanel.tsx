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
} from "lucide-react";
import { useMemo } from "react";

import { useThreadMessages } from "~/state/entities";
import { type ArtifactPreviewKind, collectThreadArtifacts } from "./artifactTargets";

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
}: {
  readonly threadRef: ScopedThreadRef | null;
  /** Opens an artifact; the caller owns how (right panel, editor, external). */
  readonly onOpen: ((path: string) => void) | undefined;
}) {
  const messages = useThreadMessages(threadRef);
  const artifacts = useMemo(() => collectThreadArtifacts(messages), [messages]);

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

  if (artifacts.length === 0) {
    return (
      <div className="w-full p-6">
        <h2 className="text-base font-medium text-foreground">No artifacts yet</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Files the agent writes or links to appear here, ready to open. Paths only mentioned in
          passing are deliberately left out.
        </p>
      </div>
    );
  }

  return (
    <ul className="w-full space-y-1 p-3">
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
                <span className="block truncate text-sm text-foreground">{artifact.name}</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {artifact.path}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
