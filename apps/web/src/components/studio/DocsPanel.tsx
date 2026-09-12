import type { EnvironmentId, ScopedThreadRef } from "@modesto/contracts";
import { DownloadIcon, FileCodeIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "~/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { downloadBlob, openGoogleWorkspace } from "~/lib/downloadBlob";
import { disclosureWidthClassName } from "~/lib/disclosureMotion";
import { documentPreviewHtml, sourceLanguageLabel } from "~/studio/canvasLanguages";
import { selectStudioDocument, useStudioDocumentStore } from "~/studio/documentStore";
import { buildDocx, suggestStudioDownloadName } from "~/studio/officeExport";

import { CanvasFrame } from "./CanvasFrame";

export function DocsPanel({
  threadRef,
}: {
  readonly threadRef: ScopedThreadRef | null;
  readonly environmentId?: EnvironmentId | null | undefined;
  readonly cwd?: string | null | undefined;
}) {
  const applyUser = useStudioDocumentStore((state) => state.applyUser);
  const snapshot = useStudioDocumentStore(
    useShallow((state) => selectStudioDocument(state, "docs", threadRef)),
  );
  const [sourceOpen, setSourceOpen] = useState(true);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(snapshot.text);

  useEffect(() => {
    if (focused && snapshot.dirty) return;
    setDraft(snapshot.text);
  }, [focused, snapshot.dirty, snapshot.text]);

  const liveText = focused ? draft : snapshot.text;
  const preview = useMemo(() => documentPreviewHtml(liveText), [liveText]);

  if (!threadRef) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Open a thread, then type /docs to write a document.
      </div>
    );
  }

  const title = snapshot.sourcePath ?? (snapshot.isStarter ? "Untitled document" : "Document");

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
          {snapshot.generating && snapshot.isStarter ? "Writing…" : title}
        </p>
        <Button
          type="button"
          size="xs"
          variant={sourceOpen ? "secondary" : "ghost"}
          onClick={() => setSourceOpen((open) => !open)}
        >
          <FileCodeIcon />
          {sourceLanguageLabel(liveText) === "Markdown" ? "HTML" : sourceLanguageLabel(liveText)}
        </Button>
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
                  suggestStudioDownloadName("docs", liveText, "html"),
                  new Blob([preview], { type: "text/html" }),
                );
              }}
            >
              HTML
            </MenuItem>
            <MenuItem
              onClick={() => {
                void buildDocx(liveText).then((bytes) => {
                  downloadBlob(
                    suggestStudioDownloadName("docs", liveText, "docx"),
                    new Blob([new Uint8Array(bytes)], {
                      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    }),
                  );
                });
              }}
            >
              Word (.docx)
            </MenuItem>
            <MenuItem
              onClick={() => {
                void buildDocx(liveText).then((bytes) => {
                  downloadBlob(
                    suggestStudioDownloadName("docs", liveText, "docx"),
                    new Blob([new Uint8Array(bytes)], {
                      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    }),
                  );
                  openGoogleWorkspace("docs");
                });
              }}
            >
              Google Docs
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <CanvasFrame source={preview} title="Document preview" />
        </div>
        <div className={disclosureWidthClassName(sourceOpen, "w-[min(22rem,40%)]")}>
          <div className="flex h-full min-h-0 flex-col border-l border-border/60">
            <p className="shrink-0 border-b border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
              {snapshot.dirty ? "Saving…" : snapshot.sourcePath ? "Saved" : "In memory"}
              <span className="ml-2">HTML · CSS · JS</span>
            </p>
            <textarea
              value={draft}
              onChange={(event) => {
                const next = event.currentTarget.value;
                setDraft(next);
                applyUser("docs", threadRef, next, snapshot.sourcePath);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="min-h-0 flex-1 resize-none bg-transparent px-3 py-2 font-mono text-[12px] leading-5 outline-none"
              spellCheck={false}
              aria-label="Document HTML"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
