# Changelog

All notable changes to Modesto are documented here, newest first.

## 0.4.0 Berkeley (2026-09-25)

Nickname **Berkeley**, version `0.4.0`. This is the redesign release from the latest development pass.

### Redesign

- Rebuilt the sidebar, chat landing page, composer, tabs, model picker, approvals, timeline, menus, icons, and navigation.
- Rebuilt Settings with new navigation, breadcrumbs, search, restore controls, terminal appearance, and file-icon preferences.
- Added OpenCode and VS Code theme catalogs, richer previews, editor synchronization, and a full notification-sound library.
- Added dedicated Copilot customization, preferences, palettes, skills, and session-tree surfaces.
- Added Claude, Codex, and Cursor interface styles with provider-matched layouts and default palettes.
- Simplified expensive 3D/animated surfaces and standardized disclosure motion.

### Tools and reliability

- Improved artifacts, inline visuals, Canvas, Markdown, Monaco, Files, and right-panel state.
- Redesigned provider/model selection and expanded custom endpoint and model-router support.
- Improved Codex and Gemini session handling, approvals, handoffs, orchestration projections, and reconnect behavior.
- Added native system-sound IPC and a Modesto-owned update feed with legacy-client manifest compatibility.

### Downloads

- Native DMGs for Apple Silicon and Intel Macs, an x64 Windows installer, and an x64 Linux AppImage.
- Automatic-update archives, blockmaps, and manifests for existing Modesto installations.

See [docs/releases/v0.4.0.md](docs/releases/v0.4.0.md).

## 0.3.0 - 2026-09-03

### Open source

- Relicensed Modesto under MIT and prepared the public GitHub page for community contributions.
- Positioned 0.3.0 as a local-first open-source foundation release: zero telemetry, complete ownership, Code + Work in one workspace.

### Foundation

- Rebuilt Modesto on the T3 Code foundation for a more stable client-server core (typed RPC layer, Effect-TS services throughout), replacing the previous apps/packages tree.
- Ported GitHub sign-in onto the new RPC layer, working end to end against the real `gh` CLI session.
- Re-shipped Kilo as a fully working provider (driver, settings, model picker, and provider icon), reusing the OpenCode-compatible adapter.
- Added cross-provider mid-thread handoff: switching providers mid-conversation starts a fresh session on the new provider and replays prior context, instead of being blocked.

### Sidebar & Chat

- Ported the Tasks/Kanban board, project open/close disclosure rows, and a Codex-style "every project's threads at once" sidebar layout.
- Ported the dot-matrix flicker loading animation from the previous UI into every "Working"/"Thinking" indicator.
- Rebuilt Claude Code plugin installs natively against this tree's own conventions (skills/commands/agents from a GitHub repo into the real `~/.claude`).
- New chat landing screen with animated starter cards.

See [docs/releases/v0.3.0.md](docs/releases/v0.3.0.md) for the full migration notes.

## 0.1.9 - 2026-07-30

### Provider Install

- Added real Poolside, Kimi, and Qwen CLI support in Provider Tools: install, detect, verify, authenticate, repair, update, and remove.
- Install only counts as success after Modesto finds the executable and a version/health probe succeeds.
- Composer picker membership comes from validated CLIs only — ready first, needs-login second, then Add provider; uninstalled providers stay in Provider Tools.
- Removed the manual provider visibility list as the picker source of truth.

## 0.1.8.1 - 2026-07-30

### Provider Tools & Teams rooms

- Replaced manual provider picker visibility/ordering with CLI detection as the composer source of truth.
- Added explicit Provider Tools lifecycle states, install stage machine, repair/retry/remove/copy-logs actions, and structured Hugging Face / Qwen / Kimi integrations (unsupported until E2E works).
- Redesigned Teams into searchable/archivable rooms with a main workspace and collapsible context drawer; preserved existing project/thread data.

## 0.1.1 - 2026-07-25

### Native code review

- Replaced the third-party review agent with Modesto's own review pipeline, so reviews run on whichever provider you already use.
- Grouped review findings by file and severity, and added a progress rail that streams the review as it runs.
- Persisted review run metadata so past reviews can be reopened instead of re-run.
- Reworked the code review settings panel around the native review options.

## 0.1.0 - 2026-07-15

### Initial public release

- Unified Codex, Claude, Cursor, Gemini, Grok, Factory Droid, Kilo, OpenCode, and Pi in one native coding workspace.
- Added live conversations, file changes and review, integrated terminal and browser panels, project context, token usage, automations, and multi-provider model controls.
- Bundled supported provider CLIs with a one-time first-launch setup so users can get started without installing each tool manually.
- Published binary-only macOS and Windows installers under the clean Modesto product identity.
