# Changelog

All notable changes to Modesto are documented here, newest first.

## 1.0.0-alpha.1 — Release Candidate (2026-09-12)

**Classification: Release Candidate.** Semver `1.0.0-alpha.1`. First public 1.0-line build with Chat and Work as shipped composer modes.

### Product

- Composer **Chat / Work**: Chat can send with no project; Work is repo-scoped (worktree, diffs, PRs).
- Sidebar: Pull Requests, Agents, Tasks (Draft / In Progress / Done), Automations, Connections, Skills & plugins.
- Right panel: Browser, Mobile Simulator, Terminal, Files, Changes, Music, Canvas, Artifacts.
- Desktop: local / WSL / SSH, pop-out chat, usage clock, Appshots.
- Providers on by default: Codex, Claude, Cursor, Gemini, Grok, Meta Muse Code, Kilo.

### Known issues

- Some Work cowork flows still landing (including Kanban drag-to-run).
- Reconnects and partial streams still being hardened.
- Signed GitHub Latest installers not published yet.

See [docs/releases/v1.0.0-alpha.1.md](docs/releases/v1.0.0-alpha.1.md).

## 0.4.0 - 2026-09-03

### Open source

- Relicensed Modesto under MIT and prepared the public GitHub page for community contributions.
- Positioned 0.4.0 as a local-first open-source foundation release: zero telemetry, complete ownership, Code + Work in one workspace.

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

See [docs/releases/v0.4.0.md](docs/releases/v0.4.0.md) for the full migration notes.

## 0.1.9 - 2026-07-30

### Provider Install

- Added real Poolside, Kimi, and Qwen CLI support in Provider Tools: install, detect, verify, authenticate, repair, update, and remove.
- Install only counts as success after Modesto finds the executable and a version/health probe succeeds.
- Composer picker membership comes from validated CLIs only — ready first, needs-login second, then Add provider; uninstalled providers stay in Provider Tools.
- Removed the manual provider visibility list as the picker source of truth.

See [docs/releases/v0.1.9.md](docs/releases/v0.1.9.md).

## 0.1.8.1 - 2026-07-30

### Provider Tools & Teams rooms

- Replaced manual provider picker visibility/ordering with CLI detection as the composer source of truth.
- Added explicit Provider Tools lifecycle states, install stage machine, repair/retry/remove/copy-logs actions, and structured Hugging Face / Qwen / Kimi integrations (unsupported until E2E works).
- Redesigned Teams into searchable/archivable rooms with a main workspace and collapsible context drawer; preserved existing project/thread data.

See [docs/releases/v0.1.8.1.md](docs/releases/v0.1.8.1.md).

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

---

Development history before the 0.1.0 public release lives in [docs/CHANGELOG-pre-release.md](docs/CHANGELOG-pre-release.md).
