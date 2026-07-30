<div align="center">
  <img src="assets/modesto-icon.png" width="104" alt="Modesto app icon" />

  <h1>Modesto</h1>

  <p><strong>One focused workspace for your coding agents.</strong></p>
  <p>
    Plan, execute, review, and hand off work across Codex, Claude, Cursor,
    Gemini, Grok, and more—without losing the thread.
  </p>

  <p>
    <a href="https://github.com/Syphon1205/Modesto/releases/latest"><strong>Download v0.1.8</strong></a>
    &nbsp;·&nbsp;
    <a href="#shared-context--v018">What’s new</a>
    &nbsp;·&nbsp;
    <a href="https://github.com/Syphon1205/Modesto/releases">All releases</a>
  </p>

  <p>
    <img alt="Latest release: v0.1.8" src="https://img.shields.io/badge/release-v0.1.8-7c8cff?style=flat-square" />
    <img alt="Release channel: stable" src="https://img.shields.io/badge/channel-stable-2dd4bf?style=flat-square" />
    <img alt="Platforms: macOS, Windows, and Linux" src="https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux-64748b?style=flat-square" />
  </p>
</div>

<p align="center">
  <img src="assets/modesto-app.png" alt="Modesto workspace with chat, project files, terminal, browser, and diffs" width="100%" />
</p>

## One place for the whole task

Modesto brings the conversation, project files, terminal, browser, diffs,
screenshots, and provider tools into one desktop workspace. Pick the right
agent for the job, follow its work live, and review the outcome with the context
that produced it.

| Plan with intent | Execute with confidence | Review in context |
| --- | --- | --- |
| Choose Agent or Plan for the next turn. | Work with multiple providers from one task. | Keep diffs, browser previews, app shots, and output beside the conversation. |

## Download Modesto

| Platform | Requirements | Download |
| --- | --- | --- |
| **macOS · Apple Silicon** | macOS 12+ · M1 or newer | [Download ZIP](https://github.com/Syphon1205/Modesto/releases/download/v0.1.8/Modesto-0.1.8-arm64.zip) |
| **macOS · Intel** | macOS 12+ · Intel processor | [Download ZIP](https://github.com/Syphon1205/Modesto/releases/download/v0.1.8/Modesto-0.1.8-x64.zip) |
| **Windows · x64** | Windows 10 or 11 | [Download EXE](https://github.com/Syphon1205/Modesto/releases/download/v0.1.8/Modesto-0.1.8-x64.exe) |
| **Linux · x64** | Ubuntu 22.04+ or equivalent | [Download AppImage](https://github.com/Syphon1205/Modesto/releases/download/v0.1.8/Modesto-0.1.8-x64.AppImage) |

Every stable release also includes updater metadata, so Modesto can discover
future updates from inside the app. Verify downloads with
[SHA-256 checksums](https://github.com/Syphon1205/Modesto/releases/download/v0.1.8/SHA256SUMS.txt).

> Download Modesto only from this repository’s
> [Releases](https://github.com/Syphon1205/Modesto/releases) page.

## Shared Context · v0.1.8

Shared Context helps one agent pick up where another left off—without rebuilding
the story from chat alone.

- **Shared context bundles** connect files, sessions, checkpoints, Git changes,
  sources, terminal activity, and unfinished tasks into one portable brief.
- **Checkpoints resume and compare.** Restore a seam, compare any two refs, or
  hand a checkpoint to another provider with the important context attached.
- **Workspace timeline** records agent starts, edits, searches, tests,
  checkpoints, handoffs, and commits across the project.
- **Teams shows coordinated work.** Assignments, reviews, shared runs, and
  agent activity replace a generic chat room.

[Read the complete Shared Context release notes →](https://github.com/Syphon1205/Modesto/releases/tag/v0.1.8)

## Get started

1. Download the installer for your computer.
2. Install and open Modesto.
3. Choose a provider and sign in to your own account when prompted.
4. Open a project and start a task.

Modesto prepares bundled provider launchers in its private application data on
first launch. Later launches reuse that installation and refresh it only when
the bundled runtime changes.

<details>
<summary><strong>First-launch security notices</strong></summary>

The current macOS builds use hardened-runtime ad-hoc signatures and are not
Apple notarized. Gatekeeper may require **System Settings → Privacy & Security
→ Open Anyway** on first launch.

The current Windows installer is unsigned, so SmartScreen may require **More
info → Run anyway**. Confirm the download came from this repository’s Releases
page before continuing.

</details>

## About this repository

This is the official public distribution home for Modesto desktop binaries,
release notes, and issue tracking. Application source code is not published
here.

For security reports, see the [Security policy](SECURITY.md). For bugs and
focused feedback, see [Contributing](CONTRIBUTING.md).

---

<div align="center">
  <sub>
    Built by Tanner Davidson. Modesto is an independent desktop application.
    Provider names and trademarks belong to their respective owners.
  </sub>
</div>
