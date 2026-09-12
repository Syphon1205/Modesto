import type { PreviewSessionSnapshot } from "@modesto/contracts";

export interface EnvironmentOpenTab {
  readonly tabId: string;
  readonly title: string;
}

export interface EnvironmentDiffStats {
  readonly insertions: number;
  readonly deletions: number;
}

/** Folder name Cursor-style (`modesto-t3-migration`), falling back to the project title. */
export function environmentProjectLabel(input: {
  readonly title: string | null | undefined;
  readonly workspaceRoot: string | null | undefined;
}): string | null {
  if (input.workspaceRoot) {
    const parts = input.workspaceRoot.replaceAll("\\", "/").split("/").filter(Boolean);
    const last = parts.at(-1);
    if (last) return last;
  }
  const title = input.title?.trim();
  return title && title.length > 0 ? title : null;
}

export function environmentDiffStats(
  workingTree: {
    readonly insertions: number;
    readonly deletions: number;
  } | null,
): EnvironmentDiffStats | null {
  if (!workingTree) return null;
  return {
    insertions: workingTree.insertions,
    deletions: workingTree.deletions,
  };
}

export function previewSessionTitle(session: PreviewSessionSnapshot): string {
  if (session.navStatus._tag === "Idle") return "Browser";
  if (session.navStatus.title.trim().length > 0) return session.navStatus.title;
  try {
    return new URL(session.navStatus.url).host || "Browser";
  } catch {
    return "Browser";
  }
}

export function previewOpenTabs(
  sessions: Readonly<Record<string, PreviewSessionSnapshot>>,
): ReadonlyArray<EnvironmentOpenTab> {
  return Object.values(sessions).map((session) => ({
    tabId: session.tabId,
    title: previewSessionTitle(session),
  }));
}
