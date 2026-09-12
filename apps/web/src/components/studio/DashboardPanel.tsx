import type { EnvironmentId, ScopedThreadRef } from "@modesto/contracts";
import { FileCodeIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "~/components/ui/button";
import { disclosureWidthClassName } from "~/lib/disclosureMotion";
import { selectStudioDocument, useStudioDocumentStore } from "~/studio/documentStore";
import { looksLikeHtml, sourceLanguageLabel } from "~/studio/canvasLanguages";
import { dashboardSpecFromSpreadsheet, parseDashboardSpec } from "~/studio/dashboardSpec";
import { parseSpreadsheetDocument } from "~/studio/sheetTable";

import { CanvasFrame } from "./CanvasFrame";

export function DashboardPanel({
  threadRef,
}: {
  readonly threadRef: ScopedThreadRef | null;
  readonly environmentId?: EnvironmentId | null | undefined;
  readonly cwd?: string | null | undefined;
}) {
  const applyUser = useStudioDocumentStore((state) => state.applyUser);
  const snapshot = useStudioDocumentStore(
    useShallow((state) => selectStudioDocument(state, "dashboard", threadRef)),
  );
  const sheetText = useStudioDocumentStore((state) =>
    threadRef ? selectStudioDocument(state, "sheets", threadRef).text : "",
  );
  const [sourceOpen, setSourceOpen] = useState(true);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(snapshot.text);

  useEffect(() => {
    if (focused && snapshot.dirty) return;
    setDraft(snapshot.text);
  }, [focused, snapshot.dirty, snapshot.text]);

  const live = focused ? draft : snapshot.text;
  const htmlPreview = looksLikeHtml(live);
  const spec = useMemo(() => {
    if (htmlPreview) return { title: "Canvas", metrics: [], chart: null };
    const parsed = parseDashboardSpec(live);
    if (parsed.metrics.length > 0 || parsed.chart) return parsed;
    return dashboardSpecFromSpreadsheet(parseSpreadsheetDocument(sheetText).rows) ?? parsed;
  }, [htmlPreview, live, sheetText]);
  const max = spec.chart ? Math.max(...spec.chart.points.map((point) => point.value), 1) : 1;

  if (!threadRef) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Open a thread, then type /canvas to build a dashboard.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
          {snapshot.generating && snapshot.isStarter
            ? "Building canvas…"
            : htmlPreview
              ? (snapshot.sourcePath ?? "Canvas")
              : spec.title}
        </p>
        <Button
          type="button"
          size="xs"
          variant={sourceOpen ? "secondary" : "ghost"}
          onClick={() => setSourceOpen((open) => !open)}
        >
          <FileCodeIcon />
          {sourceLanguageLabel(live)}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {htmlPreview ? (
            <CanvasFrame source={live} title="Canvas preview" />
          ) : (
            <div className="h-full overflow-y-auto px-6 py-5">
              <div className="mx-auto flex max-w-[40rem] flex-col gap-6">
                {spec.metrics.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {spec.metrics.map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-lg border border-border/60 px-3 py-2.5"
                      >
                        <p className="text-[11px] text-muted-foreground">{metric.label}</p>
                        <p className="mt-1 text-[18px] font-semibold tabular-nums tracking-tight">
                          {metric.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {spec.chart ? (
                  <div>
                    <p className="mb-3 text-[12px] font-medium">{spec.chart.title}</p>
                    <div className="flex flex-col gap-2">
                      {spec.chart.points.map((point) => (
                        <div
                          key={point.label}
                          className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2"
                        >
                          <p className="truncate text-[11px] text-muted-foreground">
                            {point.label}
                          </p>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-foreground/70"
                              style={{ width: `${Math.max(4, (point.value / max) * 100)}%` }}
                            />
                          </div>
                          <p className="text-right text-[11px] tabular-nums text-muted-foreground">
                            {point.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
        <div className={disclosureWidthClassName(sourceOpen, "w-[min(22rem,40%)]")}>
          <div className="flex h-full min-h-0 flex-col border-l border-border/60">
            <p className="shrink-0 border-b border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
              {snapshot.dirty ? "Saving…" : snapshot.sourcePath ? "Saved" : "In memory"}
            </p>
            <textarea
              value={draft}
              onChange={(event) => {
                const next = event.currentTarget.value;
                setDraft(next);
                applyUser("dashboard", threadRef, next, snapshot.sourcePath);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="min-h-0 flex-1 resize-none bg-transparent px-3 py-2 font-mono text-[12px] leading-5 outline-none"
              spellCheck={false}
              aria-label="Dashboard source"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
