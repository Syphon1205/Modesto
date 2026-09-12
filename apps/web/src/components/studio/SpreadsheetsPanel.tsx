import type { EnvironmentId, ScopedThreadRef } from "@modesto/contracts";
import { DownloadIcon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "~/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { downloadBlob, openGoogleWorkspace } from "~/lib/downloadBlob";
import { cn } from "~/lib/utils";
import { selectStudioDocument, useStudioDocumentStore } from "~/studio/documentStore";
import { buildXlsx, suggestStudioDownloadName } from "~/studio/officeExport";
import { parseSpreadsheetDocument, serializeSpreadsheetDocument } from "~/studio/sheetTable";
import {
  cellAddress,
  displaySpreadsheetCell,
  inferSpreadsheetFill,
  spreadsheetFillClassName,
  SPREADSHEET_FILLS,
  understandSpreadsheetInput,
  type SpreadsheetFill,
} from "~/studio/spreadsheetUnderstand";

export function SpreadsheetsPanel({
  threadRef,
}: {
  readonly threadRef: ScopedThreadRef | null;
  readonly environmentId?: EnvironmentId | null | undefined;
  readonly cwd?: string | null | undefined;
}) {
  const applyUser = useStudioDocumentStore((state) => state.applyUser);
  const snapshot = useStudioDocumentStore(
    useShallow((state) => selectStudioDocument(state, "sheets", threadRef)),
  );
  const [draft, setDraft] = useState(snapshot.text);
  const [selected, setSelected] = useState<{ column: number; row: number }>({ column: 0, row: 0 });
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (snapshot.dirty) return;
    setDraft(snapshot.text);
  }, [snapshot.dirty, snapshot.text]);

  const document = useMemo(() => parseSpreadsheetDocument(draft), [draft]);
  const { rows, fills } = document;
  const selectedRaw = rows[selected.row]?.[selected.column] ?? "";

  const commit = (nextRows: string[][], nextFills = fills) => {
    if (!threadRef) return;
    const next = serializeSpreadsheetDocument(nextRows, nextFills);
    setDraft(next);
    applyUser("sheets", threadRef, next, snapshot.sourcePath);
  };

  const commitCell = (column: number, row: number, raw: string, interpret: boolean) => {
    const stored = interpret ? understandSpreadsheetInput(raw).stored : raw;
    const nextRows = rows.map((entry, index) =>
      index === row
        ? entry.map((value, cellIndex) => (cellIndex === column ? stored : value))
        : entry,
    );
    commit(nextRows);
  };

  const setFill = (fill: SpreadsheetFill) => {
    const key = `${selected.column}:${selected.row}`;
    const nextFills = { ...fills };
    if (fill === "none") delete nextFills[key];
    else nextFills[key] = fill;
    commit(rows, nextFills);
  };

  if (!threadRef) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Open a thread, then type /spreadsheets to build a spreadsheet.
      </div>
    );
  }

  const title =
    snapshot.sourcePath ?? (snapshot.isStarter ? "Untitled spreadsheet" : "Spreadsheet");
  const width = rows[0]?.length ?? 0;
  const selectedFill =
    fills[`${selected.column}:${selected.row}`] ?? inferSpreadsheetFill(selectedRaw);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
          {snapshot.generating && snapshot.isStarter ? "Filling spreadsheet…" : title}
        </p>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => commit(rows.map((row) => [...row, ""]))}
        >
          <PlusIcon />
          Column
        </Button>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => commit([...rows, rows[0]?.map(() => "") ?? [""]])}
        >
          <PlusIcon />
          Row
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
                  suggestStudioDownloadName("sheets", draft, "csv"),
                  new Blob([serializeSpreadsheetDocument(rows, {})], { type: "text/csv" }),
                );
              }}
            >
              CSV
            </MenuItem>
            <MenuItem
              onClick={() => {
                void buildXlsx(serializeSpreadsheetDocument(rows, {})).then((bytes) => {
                  downloadBlob(
                    suggestStudioDownloadName("sheets", draft, "xlsx"),
                    new Blob([new Uint8Array(bytes)], {
                      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    }),
                  );
                });
              }}
            >
              Excel (.xlsx)
            </MenuItem>
            <MenuItem
              onClick={() => {
                void buildXlsx(serializeSpreadsheetDocument(rows, {})).then((bytes) => {
                  downloadBlob(
                    suggestStudioDownloadName("sheets", draft, "xlsx"),
                    new Blob([new Uint8Array(bytes)], {
                      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    }),
                  );
                  openGoogleWorkspace("sheets");
                });
              }}
            >
              Google Sheets
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-1.5">
        <span className="w-10 shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {cellAddress(selected.column, selected.row)}
        </span>
        <input
          value={editing ? editValue : selectedRaw}
          aria-label="Cell input"
          placeholder="Type a value, status, or =SUM(C2:C4)"
          className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-2 text-[12px] outline-none ring-1 ring-border/70 focus:ring-foreground/30"
          onFocus={() => {
            setEditing(true);
            setEditValue(selectedRaw);
          }}
          onChange={(event) => setEditValue(event.currentTarget.value)}
          onBlur={() => {
            if (editing) commitCell(selected.column, selected.row, editValue, true);
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
        />
        <div className="flex items-center gap-1" role="group" aria-label="Cell color">
          {SPREADSHEET_FILLS.map((fill) => (
            <button
              key={fill}
              type="button"
              aria-label={`Color ${fill}`}
              aria-pressed={selectedFill === fill}
              className={cn(
                "size-4 rounded-full ring-1 ring-foreground/15",
                fill === "none" ? "bg-background" : spreadsheetFillClassName(fill),
                selectedFill === fill && "ring-2 ring-foreground/50",
              )}
              onClick={() => setFill(fill)}
            />
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 w-8 border-b border-r border-border/60 bg-muted/70 px-1 py-1 text-[10px] font-medium text-muted-foreground" />
              {Array.from({ length: width }, (_, index) => (
                <th
                  key={cellAddress(index, 0)}
                  className="sticky top-0 z-10 min-w-[7rem] border-b border-r border-border/60 bg-muted/70 px-2 py-1 text-left text-[10px] font-medium text-muted-foreground"
                >
                  {cellAddress(index, 0).replace(/\d+$/, "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`r${rowIndex}`}>
                <th className="w-8 border-b border-r border-border/50 bg-muted/40 px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {rowIndex + 1}
                </th>
                {row.map((cell, colIndex) => {
                  const fill = fills[`${colIndex}:${rowIndex}`] ?? inferSpreadsheetFill(cell);
                  const active = selected.column === colIndex && selected.row === rowIndex;
                  const display = displaySpreadsheetCell(cell, rows, colIndex, rowIndex);
                  return (
                    <td
                      key={`${rowIndex}:${colIndex}`}
                      className={cn(
                        "border-b border-r border-border/40 p-0",
                        spreadsheetFillClassName(fill),
                        active && "ring-2 ring-inset ring-foreground/40",
                      )}
                    >
                      <button
                        type="button"
                        aria-label={cellAddress(colIndex, rowIndex)}
                        className="flex h-8 w-full items-center px-2 text-left"
                        onClick={() => {
                          setSelected({ column: colIndex, row: rowIndex });
                          setEditing(false);
                        }}
                        onDoubleClick={() => {
                          setSelected({ column: colIndex, row: rowIndex });
                          setEditValue(cell);
                          setEditing(true);
                        }}
                      >
                        <span className={cn("truncate", cell.startsWith("=") && "tabular-nums")}>
                          {display}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { SpreadsheetsPanel as SheetsPanel };
