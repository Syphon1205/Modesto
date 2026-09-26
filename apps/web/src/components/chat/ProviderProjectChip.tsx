import type { ScopedProjectRef } from "@modesto/contracts";
import { ChevronDownIcon, FolderIcon } from "lucide-react";

import type { ProviderLayout } from "~/providerLayouts";
import { DraftProjectMenu, useDraftProjectPicker } from "./DraftProjectPicker";

const EMPTY_LABEL: Record<ProviderLayout, string> = {
  claude: "Select folder…",
  codex: "Choose project",
  cursor: "Select repository",
};

/**
 * The project control at the head of the composer context row: Claude's
 * folder chip, the project dropdown in Codex's composer tray, and the
 * repository selector above Cursor's prompt.
 */
export function ProviderProjectChip({
  layout,
  activeProjectRef,
  activeProjectTitle,
}: {
  layout: ProviderLayout;
  activeProjectRef: ScopedProjectRef | null;
  activeProjectTitle: string | null;
}) {
  const picker = useDraftProjectPicker(activeProjectRef, activeProjectTitle);
  const label = picker.activeDisplayName ?? EMPTY_LABEL[layout];
  const content = (
    <>
      {layout === "cursor" ? null : <FolderIcon className="size-3.5 shrink-0" />}
      <span className="min-w-0 truncate">{label}</span>
      {layout === "claude" ? null : <ChevronDownIcon className="size-3 shrink-0 opacity-70" />}
    </>
  );
  const className =
    "pointer-events-auto inline-flex h-6 min-w-0 max-w-56 items-center gap-1.5 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

  if (!picker.canChoose) {
    return (
      <button
        type="button"
        data-provider-project-chip={layout}
        onClick={picker.openAddProject}
        className={className}
      >
        {content}
      </button>
    );
  }
  return (
    <DraftProjectMenu
      picker={picker}
      align="start"
      trigger={<button type="button" data-provider-project-chip={layout} className={className} />}
    >
      {content}
    </DraftProjectMenu>
  );
}
