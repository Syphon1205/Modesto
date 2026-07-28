# Changelog

All notable changes to Modesto are documented here, newest first.

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
