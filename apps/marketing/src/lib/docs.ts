export type DocsLink = {
  readonly label: string;
  readonly href: string;
  readonly summary: string;
  readonly external?: boolean;
};

export type DocsGroup = {
  readonly label: string;
  readonly links: ReadonlyArray<DocsLink>;
};

export const DOCS_NAV: ReadonlyArray<DocsGroup> = [
  {
    label: "Start here",
    links: [
      {
        label: "Overview",
        href: "/docs",
        summary: "What Modesto is, how work moves, and where to read next.",
      },
      {
        label: "Install",
        href: "/docs/install",
        summary: "Desktop, mobile, provider CLIs, and first launch.",
      },
      {
        label: "Quickstart",
        href: "/docs/get-started",
        summary: "Send a chat, then open a repository and complete the first agent run.",
      },
    ],
  },
  {
    label: "The workspace",
    links: [
      {
        label: "Providers",
        href: "/docs/providers",
        summary: "Discovery, login, Meta Muse Code, Copilot, instances, and switching mid-thread.",
      },
      {
        label: "Permission modes",
        href: "/docs/permissions",
        summary: "Supervised, auto-accept, auto, full access, and plan mode.",
      },
      {
        label: "Checkpoints & handoffs",
        href: "/docs/checkpoints",
        summary: "Durable seams so another agent can continue the work.",
      },
      {
        label: "Threads & tasks",
        href: "/docs/threads",
        summary: "Chats without a project, Code threads, and the Kanban board.",
      },
      {
        label: "Context Graph",
        href: "/docs/context-graph",
        summary: "How threads, PRs, and decisions stay connected.",
      },
    ],
  },
  {
    label: "Product",
    links: [
      {
        label: "Work",
        href: "/docs/work",
        summary: "Cowork sessions, Connections, Music, artifacts, and the browser.",
      },
      {
        label: "Desktop & environments",
        href: "/docs/desktop",
        summary: "This machine, WSL, SSH, usage clock, pop-out chat, and Music.",
      },
      {
        label: "Source control",
        href: "/docs/source-control",
        summary: "Branches, worktrees, diffs, commits, and pull requests.",
      },
      {
        label: "Automations",
        href: "/docs/automations",
        summary: "Schedules, heartbeats, signed webhooks, and review.",
      },
      {
        label: "Skills",
        href: "/docs/skills",
        summary: "Install the same SKILL.md pack for Codex and Claude.",
      },
      {
        label: "Code review",
        href: "/docs/code-review",
        summary: "Run review through a provider you already use.",
      },
      {
        label: "Teams",
        href: "/docs/teams",
        summary: "Assignment, evidence, approvals, and merge.",
      },
    ],
  },
  {
    label: "Reference",
    links: [
      {
        label: "Keyboard shortcuts",
        href: "/docs/keybindings",
        summary: "Defaults, when-clauses, and how to remap them.",
      },
      {
        label: "Remote access",
        href: "/docs/remote",
        summary: "Pair a phone or another browser to the local server.",
      },
      {
        label: "Updating",
        href: "/docs/updating",
        summary: "In-app updates, GitHub releases, and provider CLIs.",
      },
      {
        label: "Local development",
        href: "/docs/development",
        summary: "Run from source, package boundaries, and isolation.",
      },
    ],
  },
];

export const DOCS_PAGES = DOCS_NAV.flatMap((group) => group.links.filter((link) => !link.external));

export function docsNeighbors(pathname: string) {
  const index = DOCS_PAGES.findIndex((page) => page.href === pathname);
  return {
    previous: index > 0 ? DOCS_PAGES[index - 1] : null,
    next: index >= 0 && index < DOCS_PAGES.length - 1 ? DOCS_PAGES[index + 1] : null,
  };
}
