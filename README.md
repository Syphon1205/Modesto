<div align="center">
  <img src="assets/modesto-icon.png" width="112" alt="Modesto icon" />
  <h1>Modesto</h1>
  <p><strong>One native workspace for the coding agents you already use.</strong></p>
  <p><strong>Current stable release: v0.1.2</strong></p>
  <p>
    <a href="https://github.com/Syphon1205/Modesto/releases/latest"><strong>Download Modesto</strong></a>
    ·
    <a href="https://github.com/Syphon1205/Modesto/releases">Release history</a>
  </p>
</div>

![Modesto workspace](assets/modesto-app.png)

## Meet Modesto

Modesto brings Codex, Claude, Cursor, Gemini, Grok, Factory Droid, Kilo, OpenCode, and Pi into one focused desktop workspace. Start a task with the right model, watch edits happen live, review every file change, and keep the browser, terminal, project files, and context usage beside the conversation.

### Built for real coding work

- **All your agents, one interface** — switch providers and models without rebuilding your workflow.
- **Live code changes** — follow files as they are edited, then inspect additions and deletions in the Changes panel.
- **Context that stays visible** — see token usage and session context without leaving the task.
- **Integrated tools** — open files, terminals, browser tabs, and diffs in the workspace sidebar.
- **Projects and automations** — organize long-running work and recurring tasks in the same app.
- **Fast first launch** — supported provider CLIs are bundled and configured once by Modesto.

## Download

| Platform | Installer |
| --- | --- |
| macOS 12+ · Apple Silicon | [Download DMG](https://github.com/Syphon1205/Modesto/releases/download/v0.1.2/Modesto-0.1.2-arm64.dmg) |
| macOS 12+ · Intel | [Download DMG](https://github.com/Syphon1205/Modesto/releases/download/v0.1.2/Modesto-0.1.2-x64.dmg) |
| Windows 10/11 · x64 | [Download EXE](https://github.com/Syphon1205/Modesto/releases/download/v0.1.2/Modesto-0.1.2-x64.exe) |

The macOS builds are Developer ID signed and notarized by Apple. Release builds
include update metadata, so existing Modesto installations can discover and install
v0.1.2 through the in-app updater.

This repository distributes official Modesto desktop binaries and release notes. Application source code is not published here.

## What's new in v0.1.2

- **WSL2 support on Windows** for Linux-backed projects, commands, provider CLIs,
  development, and testing.
- **Stable release updates** for Windows, Apple Silicon, and Intel Mac builds.
- **Clearer update status** and a fix for the update-check error that could show
  `Cannot read properties of undefined`.
- **A cleaner desktop experience** across providers, review tools, editor
  navigation, terminal appearance, and app information.

See the [v0.1.2 release](https://github.com/Syphon1205/Modesto/releases/tag/v0.1.2)
for release notes and every available artifact.

## First launch

Modesto installs its bundled provider launchers into its private application data directory the first time it opens. Later launches reuse that installation; it refreshes only when the bundled runtime changes.

Some providers still require you to sign in to your own account before their models become available.

### Security prompts

macOS Gatekeeper or Windows SmartScreen may ask you to confirm that you want to open the app.

- **macOS:** Control-click Modesto, choose **Open**, then confirm.
- **Windows:** Choose **More info**, verify the app name is Modesto, then choose **Run anyway**.

Only download Modesto from this repository's Releases page.

## Current release

`v0.1.2` is the latest stable public release.

---

<div align="center">
  <sub>Built by Tanner Davidson. Modesto is an independent desktop application. Provider names and trademarks belong to their respective owners.</sub>
</div>
