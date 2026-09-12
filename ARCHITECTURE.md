# Modesto architecture

Modesto is a desktop workspace for coding agents, built on a stable runtime foundation.

## Runtime boundaries

`apps/server` owns provider discovery and adapters, process lifecycle, sessions, orchestration, persistence, projects, worktrees, Git, terminals, approvals, dev servers, and authenticated HTTP/WebSocket APIs.

`apps/web` owns workspace navigation, conversation and tool rendering, file and diff surfaces, terminals, browser previews, settings, and client-side state. Code, Teams, and Research are routes nested under the same chat layout, so all three share one sidebar, one thread view, and one composer — only the landing surface differs per workspace.

`apps/desktop` owns the Electron application lifecycle, windows, menus, notifications, file dialogs, native browser integration, system appearance, updater, and backend process. It does not duplicate the main React workspace.

`packages/contracts` is schema-only. `packages/shared` contains reusable runtime utilities behind explicit subpath exports.

## Data flow

The desktop shell starts Modesto Server. The server brokers provider processes and projects provider runtime activity into orchestration domain events. The web application hydrates a shell snapshot and consumes subsequent events over `orchestration.domainEvent`, requesting detail through authenticated WebSocket RPC.

Correctness during restarts and partial streams comes from persisted orchestration events and projections, command receipts, explicit session runtime state, startup reconciliation, bounded buffering, and snapshot rehydration.

## Workspace model

Workspace identity is a small route-driven layer:

- `/` and existing Code routes resolve to `code`
- `/teams` resolves to `teams`
- `/research` resolves to `research`

The selected identity is also written to `modesto.workspace.v1`. Routes remain authoritative so deep links and browser navigation are deterministic.

## Native macOS direction

Selective SwiftUI/AppKit work may own native settings, title-bar commands, file/folder pickers, notifications, Dock behavior, window restoration, multiple windows, Finder/Terminal/editor actions, Quick Look, drag and drop, shortcuts, deep links, and a future updater integration.

Conversation timelines, tool rendering, terminals, diffs, file browsing, browser previews, provider UX, worktrees, Git review, and agent handoffs stay in React.

## Compatibility policy

User-facing identity is Modesto. Internal `@modesto/*` package names, `modesto://app`, existing storage keys, database service tags, and selected environment aliases remain until they can be migrated without data loss or ecosystem breakage.
