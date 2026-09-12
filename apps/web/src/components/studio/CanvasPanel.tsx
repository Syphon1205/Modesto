import type { EnvironmentId, ScopedThreadRef } from "@modesto/contracts";
import { scopedThreadKey } from "@modesto/client-runtime/environment";
import { FileTextIcon, LayoutDashboardIcon, PresentationIcon, Table2Icon } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "~/components/ui/button";
import { SlidesPanel } from "~/components/slides/SlidesPanel";
import { type CanvasMode } from "~/studio/canvasCommand";
import { shouldShowCanvasLanding } from "~/studio/canvasLanding";
import { useCanvasStore } from "~/studio/canvasStore";
import { selectStudioDocument, useStudioDocumentStore } from "~/studio/documentStore";
import { selectThreadSlideDeck, useSlidesStore } from "~/slides/slidesStore";

import { CanvasEmptyState } from "./CanvasEmptyState";
import { DashboardPanel } from "./DashboardPanel";
import { DocsPanel } from "./DocsPanel";
import { SpreadsheetsPanel } from "./SpreadsheetsPanel";

const MODES: ReadonlyArray<{
  readonly id: CanvasMode;
  readonly label: string;
  readonly icon: typeof PresentationIcon;
}> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { id: "slides", label: "Slides", icon: PresentationIcon },
  { id: "docs", label: "Docs", icon: FileTextIcon },
  { id: "spreadsheets", label: "Spreadsheets", icon: Table2Icon },
];

export function CanvasPanel({
  threadRef,
  environmentId,
  cwd,
}: {
  readonly threadRef: ScopedThreadRef | null;
  readonly environmentId?: EnvironmentId | null | undefined;
  readonly cwd?: string | null | undefined;
}) {
  const mode = useCanvasStore((state) =>
    threadRef ? (state.modeByThreadKey[scopedThreadKey(threadRef)] ?? "dashboard") : "dashboard",
  );
  const started = useCanvasStore((state) =>
    threadRef ? state.startedByThreadKey[scopedThreadKey(threadRef)] === true : false,
  );
  const setMode = useCanvasStore((state) => state.setMode);
  const start = useCanvasStore((state) => state.start);
  const starters = useStudioDocumentStore(
    useShallow((state) => ({
      dashboard: selectStudioDocument(state, "dashboard", threadRef).isStarter,
      docs: selectStudioDocument(state, "docs", threadRef).isStarter,
      sheets: selectStudioDocument(state, "sheets", threadRef).isStarter,
    })),
  );
  const slidesIsStarter = useSlidesStore(
    (state) => selectThreadSlideDeck(state, threadRef).isStarter,
  );
  const showLanding = shouldShowCanvasLanding({
    started,
    dashboardIsStarter: starters.dashboard,
    docsIsStarter: starters.docs,
    sheetsIsStarter: starters.sheets,
    slidesIsStarter,
  });

  if (showLanding) {
    return (
      <CanvasEmptyState
        onNewCanvas={() => {
          if (threadRef) start(threadRef, "dashboard");
        }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-2 py-1.5">
        {MODES.map((entry) => {
          const Icon = entry.icon;
          return (
            <Button
              key={entry.id}
              type="button"
              size="micro"
              variant={mode === entry.id ? "secondary" : "ghost"}
              onClick={() => {
                if (threadRef) setMode(threadRef, entry.id);
              }}
            >
              <Icon />
              {entry.label}
            </Button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1">
        {mode === "slides" ? (
          <SlidesPanel threadRef={threadRef} environmentId={environmentId} cwd={cwd} />
        ) : mode === "docs" ? (
          <DocsPanel threadRef={threadRef} environmentId={environmentId} cwd={cwd} />
        ) : mode === "spreadsheets" ? (
          <SpreadsheetsPanel threadRef={threadRef} environmentId={environmentId} cwd={cwd} />
        ) : (
          <DashboardPanel threadRef={threadRef} environmentId={environmentId} cwd={cwd} />
        )}
      </div>
    </div>
  );
}
