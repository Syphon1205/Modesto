// FILE: ComposerLiveChangesHeader.tsx
// Purpose: Live file-changes strip stacked flush onto the top of the composer
// while a turn is running, mirroring the queued follow-up header. The caller
// supplies turn-scoped diff totals (or a null count before they land) and the
// Review action target.
// Layer: Chat composer UI
// Exports: ComposerLiveChangesHeader

import { pluralize } from "@modesto/shared/text";
import { memo } from "react";

import { ChangesIcon } from "~/lib/icons";
import { basenameOfPath } from "~/file-icons";
import { FileEntryIcon } from "./FileEntryIcon";
import { useTheme } from "~/hooks/useTheme";
import {
  ComposerStackedPanelRow,
  ComposerStackedPanelRowLabel,
  ComposerStackedPanelRowMain,
} from "./ComposerStackedPanelContent";
import { ComposerStackedPanel } from "./ComposerStackedPanel";
import { COMPOSER_STACKED_PANEL_ICON_CLASS_NAME } from "./composerStackedPanelStyles";
import { DiffStatLabel } from "./DiffStatLabel";
import { ReviewChangesButton } from "./ReviewChangesButton";

interface ComposerLiveChangesHeaderProps {
  fileCount: number | null;
  additions: number;
  deletions: number;
  files: ReadonlyArray<{ path: string; additions: number; deletions: number }>;
  // Explicit `| undefined` (not just `?`) so callers can pass a conditionally-absent
  // handler under exactOptionalPropertyTypes; the Review button is hidden when omitted.
  onReview?: (() => void) | undefined;
  attachedToPrevious?: boolean;
}

export const ComposerLiveChangesHeader = memo(function ComposerLiveChangesHeader({
  fileCount,
  additions,
  deletions,
  files,
  onReview,
  attachedToPrevious = false,
}: ComposerLiveChangesHeaderProps) {
  const { resolvedTheme } = useTheme();
  if (fileCount === 0) {
    return null;
  }
  const label =
    fileCount === null
      ? "Editing files"
      : fileCount === 1 && files[0]
        ? `Editing ${basenameOfPath(files[0].path)}`
        : `Editing ${fileCount} ${pluralize(fileCount, "file")}`;
  const visibleFiles = files.slice(-3);
  const hiddenFileCount = Math.max(0, files.length - visibleFiles.length);

  return (
    <ComposerStackedPanel attachedToPrevious={attachedToPrevious}>
      <ComposerStackedPanelRow>
        <ComposerStackedPanelRowMain>
          <span className="relative flex size-4 shrink-0 items-center justify-center">
            <span className="absolute size-3 rounded-full bg-[var(--info-foreground)]/18 motion-safe:animate-ping" />
            <ChangesIcon
              className={`${COMPOSER_STACKED_PANEL_ICON_CLASS_NAME} relative text-[var(--info-foreground)]`}
            />
          </span>
          <ComposerStackedPanelRowLabel>{label}</ComposerStackedPanelRowLabel>
          {additions + deletions > 0 ? (
            <span className="shrink-0 tabular-nums">
              <DiffStatLabel additions={additions} deletions={deletions} />
            </span>
          ) : null}
        </ComposerStackedPanelRowMain>
        {onReview ? <ReviewChangesButton onClick={onReview} /> : null}
      </ComposerStackedPanelRow>
      {visibleFiles.length > 0 ? (
        <div
          className="border-t border-[color:var(--color-border-light)] px-3 py-1.5"
          data-live-edit-files="true"
        >
          {visibleFiles.map((file, index) => (
            <div
              key={file.path}
              className="flex min-w-0 items-center gap-2 py-1 text-[12px]"
              title={file.path}
            >
              <FileEntryIcon
                pathValue={file.path}
                kind="file"
                theme={resolvedTheme}
                className="size-3.5"
              />
              <span className="min-w-0 flex-1 truncate font-medium text-[var(--info-foreground)]">
                {basenameOfPath(file.path)}
              </span>
              {file.additions + file.deletions > 0 ? (
                <span className="shrink-0 tabular-nums">
                  <DiffStatLabel additions={file.additions} deletions={file.deletions} />
                </span>
              ) : index === visibleFiles.length - 1 ? (
                <span className="shimmer shrink-0 text-[11px] text-muted-foreground/75">
                  editing…
                </span>
              ) : null}
            </div>
          ))}
          {hiddenFileCount > 0 ? (
            <div className="py-1 pl-[1.375rem] text-[11px] text-muted-foreground/70">
              +{hiddenFileCount} more
            </div>
          ) : null}
        </div>
      ) : null}
    </ComposerStackedPanel>
  );
});
