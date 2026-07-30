// FILE: whatsNew/entries.ts
// Purpose: Curated "What's new" changelog rendered in the post-update dialog
// and the settings Release history view.
// Layer: static data consumed by `useWhatsNew`, `WhatsNewDialog`, and
// `ChangelogAccordion`.
//
// Authoring guide
// ---------------
//   - Prepend new releases so the file reads newest-first (the UI sorts too,
//     but keeping the source tidy makes PRs easier to review).
//   - `version` must match the public release version exposed to the web build.
//     Four-part patch releases use a separate updater-safe package version.
//     The logic compares versions numerically and only opens the dialog when the
//     installed build has a curated entry here.
//   - `date` is rendered verbatim — pick whatever format you want (e.g.
//     `"Apr 18"`, `"2026-04-18"`), just be consistent release-to-release.
//   - Each feature takes an `id` (stable, unique per release), a short
//     `title`, a marketing `description`, and optionally an `image`
//     (absolute path from `apps/web/public`, e.g. `/whats-new/0.0.29/foo.png`)
//     plus `details` for the longer technical note shown under the image.
//
// Versioning starts fresh at 0.1.0 for Modesto's first public release.
// Add the next entry only when a real release actually ships (i.e. tagged
// and published to GitHub, where the update checker pulls from) — not for
// every local build.

import type { WhatsNewEntry } from "./logic";

export const WHATS_NEW_ENTRIES: readonly WhatsNewEntry[] = [
  {
    version: "0.1.8",
    date: "Jul 30",
    features: [
      {
        id: "shared-context-coordination",
        title: "Shared context across agent work",
        description:
          "Portable context bundles keep checkpoints, files, plans, sources, and unfinished work attached across provider handoffs.",
      },
      {
        id: "workspace-timeline-teams",
        title: "A Teams space for coordination",
        description:
          "Teams now collects assignments, reviews, shared runs, subagents, and a workspace timeline for edits, searches, tests, checkpoints, handoffs, and commits.",
      },
    ],
  },
  {
    version: "0.1.7.2",
    date: "Jul 29",
    features: [
      {
        id: "reliability-recoverable-sessions",
        title: "Recoverable sessions",
        description:
          "Runtime errors clear stuck Working states, Recover session rebuilds projections and stops stale agents, and provider starts time out cleanly instead of hanging.",
      },
      {
        id: "codex-plugins-complete",
        title: "Codex plugins that finish the job",
        description:
          "Install and remove plugins with staged progress, verified availability, refresh support, and an explicit Restart agent action when a live session needs the update.",
      },
      {
        id: "web-sources-panel",
        title: "Sources on web-enabled answers",
        description:
          "When an agent searches the web, a compact Sources panel attaches to the response with deduplicated titles, domains, and favicons you can expand.",
      },
      {
        id: "poolside-installable",
        title: "Poolside as an installable provider",
        description:
          "Detect, install, and log in to Poolside from Provider tools, launch over ACP in the active repo, and pick models dynamically from your deployment.",
      },
      {
        id: "teams-cowork-editor-space",
        title: "Teams cowork room and roomier editor",
        description:
          "Teams keeps its name while reading as a people-and-agents workspace, and the editor gives the center more room with resizable, collapsible side panels.",
      },
    ],
  },
  {
    version: "0.1.7.1",
    date: "Jul 29",
    features: [
      {
        id: "palo-alto-patch-poolside",
        title: "Poolside, natively",
        description:
          "Connect Modesto to Poolside Agent CLI over ACP, resume sessions, honor permissions, and choose the models exposed by your deployment.",
        image: "/whats-new/0.1.7.1/poolside-provider.svg",
        imageAlt: "Modesto connected to Poolside over ACP with deployment-provided model choices.",
        details:
          "Run Poolside in the active repository without downloading model weights into Modesto. Laguna M.1, Laguna XS.2, Malibu, and future models arrive dynamically from Poolside.",
      },
      {
        id: "palo-alto-patch-teams",
        title: "A more useful Teams room",
        description:
          "Project spaces now surface shared runs, people and agents, attention states, and one filterable timeline for checkpoints, handoffs, reviews, and diffs.",
        image: "/whats-new/0.1.7.1/palo-alto-patch.svg",
        imageAlt:
          "Modesto Teams project space showing shared agent runs, checkpoint timeline, and a connected LangGraph assistant.",
        details:
          "Open a run directly from Teams to watch it, steer it, recover it, or review its work without losing the project-wide context.",
      },
      {
        id: "palo-alto-patch-composer",
        title: "Simpler, safer chat controls",
        description:
          "The agent-selection controls that could crash the composer are gone. Existing agent activity remains readable in conversation history.",
      },
      {
        id: "palo-alto-patch-workbench",
        title: "A clearer agent workbench",
        description:
          "The browser and desktop layouts now share a focused project-first start screen, compact workspace hierarchy, and branded Swift, Go, and Ruby file icons.",
        details:
          "The refreshed first-run path makes the next action obvious instead of leaving a new workspace empty, while preserving Modesto’s existing chats, Git review, Teams, and Automations workflows.",
      },
      {
        id: "palo-alto-patch-releases",
        title: "Patch releases without version churn",
        description:
          "Palo Alto patches now use four-part versions such as 0.1.7.1, with updater-safe ordering behind the scenes.",
      },
      {
        id: "palo-alto-patch-langgraph",
        title: "Working LangGraph integration",
        description:
          "Connect an Agent Server, securely save its API key, discover assistants, test the connection, and invoke a graph from Automations.",
      },
    ],
  },
  {
    version: "0.1.7",
    date: "Jul 29",
    features: [
      {
        id: "palo-alto-checkpoints",
        title: "First-class checkpoints and handoffs",
        description:
          "Declare a clean seam with the Git diff, checks not run, incomplete work, and the next step. Unchanged declarations reuse the existing checkpoint.",
        details:
          "Palo Alto carries the project, branch, live Git state, latest declared checkpoint, and next action across Claude, Codex, Cursor, and OpenCode sessions.",
      },
      {
        id: "palo-alto-active-window",
        title: "Active window context",
        description:
          "Attach the active window screenshot, app, title, and accessibility text available from the operating system.",
      },
      {
        id: "palo-alto-teams",
        title: "Teams project spaces",
        description:
          "Teams now groups human and agent participants around project spaces with a shared timeline for runs, checkpoints, handoffs, diffs, and reviews.",
        details:
          "LangGraph Agent Server connections now live under Automations rather than the Teams participant model.",
      },
    ],
  },
  {
    version: "0.1.4",
    date: "Jul 27",
    features: [
      {
        id: "san-leandro-composer-chrome",
        title: "San Leandro composer chrome",
        description:
          "Cursor-style bubbles above the chat for Changes, Commit, Working, tasks, Plan mode, and Multi-agent — only when they matter.",
        image: "/whats-new/0.1.4/san-leandro.svg",
        imageAlt: "Compact status bubbles stacked above the Modesto composer.",
        details:
          "v0.1.4 — San Leandro — The tall live-changes strip and full-width task card are gone. Dirty trees get Changes +N/−M and Commit & Push pills; live turns show N Working; todos stay as a compact N/M tasks bubble that opens the plan sidebar. Plan mode and Multi-agent are always one click away.",
      },
      {
        id: "durable-agent-checkpoints",
        title: "Durable agent checkpoints",
        description:
          "Provider handoffs now capture a hidden working-tree checkpoint you can inspect or roll back to from the seam card.",
        details:
          "On handoff.create, Modesto pins HEAD and snapshots the tree under refs/modesto/agent-checkpoints/…. The destination seam exposes Inspect seam and Rollback to seam, and bootstrap text calls out the durable checkpoint when one was captured.",
      },
      {
        id: "agents-and-cloud-gating",
        title: "Agents & Cloud Agents that match reality",
        description:
          "Claude agent pickers and launch args work end-to-end, and OpenClaw Cloud Agents only list providers you have enabled.",
        details:
          "Claude model options preserve the selected agent through drafts and dispatch; TraitsPicker treats Claude like Kilo/OpenCode when runtime agents exist. Cloud Agent allowlists filter against server provider enablement so disabled providers stop showing up as options.",
      },
    ],
  },
  {
    version: "0.1.3",
    date: "Jul 27",
    features: [
      {
        id: "fremont-continuity",
        title: "Fremont continuity",
        description:
          "Hand off threads as a declared seam: Claude → Codex style notes, incomplete work, next steps, repo state, and a clearer continue / return flow.",
        details:
          "v0.1.3 — Fremont — Provider handoffs now open with a structured seam card (what landed, incomplete, next). Defaults prefer the latest assistant summary, destination bootstrap treats the note and live repo as authoritative, and return payloads land back on the source thread with provenance.",
      },
      {
        id: "cursor-parity-settings",
        title: "Cursor-style settings",
        description:
          "Settings now mirror Cursor’s layout with working Agents, Cloud Agents, Plugins, Rules/Skills, Tools & MCPs, Hooks, Browser & Network, Tab, and Indexing panels.",
        details:
          "MCP servers and Codex hooks are managed against your local Codex config, provider enable flags sync to the server, and OpenClaw/plugin controls live in Settings alongside Usage and Git & PRs.",
      },
    ],
  },
  {
    version: "0.1.2",
    date: "Jul 26",
    features: [
      {
        id: "wsl2-support",
        title: "Built for WSL2",
        description:
          "Windows contributors can now develop, build, test, and run provider CLIs from a consistent Linux workspace with reliable Windows localhost forwarding.",
        image: "/whats-new/0.1.2/wsl-support.svg",
        imageAlt:
          "The Modesto and Windows Subsystem for Linux logos connected in one development workspace.",
        details:
          "Modesto now detects WSL2 and selects an IPv4 loopback path for its server and browser WebSocket. The contributor guide covers WSL setup, Linux-native project paths and provider CLIs, WSLg, verification, and the native Windows packaging boundary.",
      },
    ],
  },
  {
    version: "0.1.1",
    date: "Jul 25",
    features: [
      {
        id: "milpitas",
        title: "Milpitas",
        description:
          "Code review now has a dedicated Cursor-inspired workspace, with Modesto Review and CodeRabbit ready for local review workflows and Greptile represented for connected pull requests.",
        image: "/whats-new/0.1.1/code-review.svg",
        imageAlt:
          "Modesto, CodeRabbit, and Greptile logos with the message Modesto supports code review.",
        details:
          "v0.1.1 - Milpitas — Review is now its own editor activity instead of being mixed into Changes. The release also includes cleaner sign-in, VS Code-inspired editor and terminal options, in-app CLI setup, and workspace reliability fixes.",
      },
      {
        id: "connected-conversations",
        title: "Connected conversations",
        description:
          "Bring your existing agent conversations into Modesto and continue working with Codex, Claude, Cursor, Gemini, Grok, OpenCode, and more from one focused workspace.",
        image: "/whats-new/0.1.1/provider-sync.svg",
        imageAlt:
          "Codex, Claude, Cursor, Gemini, Grok, and OpenCode conversations flowing into Modesto.",
        details:
          "Import locally persisted conversations by session ID, then keep the provider context and project workflow together inside Modesto.",
      },
    ],
  },
  {
    version: "0.1.0",
    date: "Jul 15",
    features: [
      {
        id: "initial-release",
        title: "Welcome to Modesto",
        description:
          "Modesto is a multi-provider workspace for coding agents — Codex, Claude, Cursor, Gemini, Grok, Factory Droid, Kilo, OpenCode, and Pi, all in one place.",
        details:
          "This is the first release. Expect frequent updates as the app grows — each one will land here with what changed.",
      },
    ],
  },
];
