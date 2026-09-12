// FILE: MonaEmptyStateMark.tsx
// Purpose: The one thing every empty and failed surface in the pull request tab
//          renders: GitHub's recommended Copilot mark (Mona's pair-programmer
//          counterpart), drawn flat.
// Layer: Pull request UI
//
// Callers still name the state. The drawing itself is one official mark so the
// tab does not invent a 3D Octocat or a custom body for each empty page.

import { GithubCopilotIcon } from "../Icons";

/** Every place in the tab that has nothing to show, or could not find out. */
export type PullRequestEmptyKind =
  /** The workspace holds no project to read pull requests from. */
  | "no-projects"
  /** A search returned nothing. */
  | "no-search-results"
  /** The filters exclude everything. */
  | "no-filter-results"
  /** There are genuinely no pull requests. */
  | "no-pull-requests"
  /** Everything in the inbox is handled. */
  | "inbox-clear"
  /** A pull request has no activity or comments yet. */
  | "no-activity"
  /** The hosts could not be read. */
  | "load-failed";

/**
 * Official Copilot / Mona mark at empty-state size, muted to the weight of the
 * copy beneath it. Flat on purpose: the previous extrusion turned on every
 * page and read as decoration rather than a product mark.
 */
export function MonaEmptyStateMark({ kind }: { readonly kind: PullRequestEmptyKind }) {
  return (
    <GithubCopilotIcon
      aria-hidden
      data-empty-kind={kind}
      className="size-14 fill-current text-muted-foreground/55"
    />
  );
}
