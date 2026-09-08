<div align="center">
  <img src="assets/modesto-icon.png" width="112" alt="Modesto app icon" />

  <h1>Modesto</h1>

  <p><strong>Your agents. Your machine. One workspace.</strong></p>
  <p>
    The open-source control plane for coding agents — now on the 1.0 alpha line.<br />
    Run Codex, Claude Code, Cursor, Gemini, Grok, Meta, OpenCode, and more from a single local-first desktop.
  </p>

  <p>
    <a href="https://github.com/Syphon1205/Modesto/releases/latest"><strong>Download Modesto</strong></a>
    &nbsp;·&nbsp;
    <a href="#why-modesto">See what it does</a>
    &nbsp;·&nbsp;
    <a href="#command-line-interface">Install the CLI</a>
  </p>

  <p>
    <img alt="Latest release: v1.0.0-alpha.1" src="https://img.shields.io/badge/release-v1.0.0--alpha.1-7c8cff?style=flat-square" />
    <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-2dd4bf?style=flat-square" />
    <img alt="Platforms: macOS, Windows, and Linux" src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-111111?style=flat-square" />
    <a href="https://www.npmjs.com/package/@modestocode/cli"><img alt="npm: @modestocode/cli" src="https://img.shields.io/npm/v/%40modestocode%2Fcli?style=flat-square&label=cli&color=f5a524" /></a>
  </p>
</div>

<p align="center">
  <img src="assets/modesto-app.png" alt="Modesto desktop workspace with projects, coding agent controls, and a task composer" width="100%" />
</p>

<p align="center">
  <em>Think Cursor for every agent—with your conversations, files, terminal, browser, and diffs in one place.</em>
</p>

## Why Modesto

Coding agents are powerful. Using several of them is a mess: separate terminals, separate histories, repeated setup, and context that disappears every time you switch.

Modesto gives them one home.

| | |
| --- | --- |
| **Use the agents you already pay for** | Keep your existing CLIs, accounts, models, permissions, and billing. Modesto adds the workspace around them. |
| **Switch agents, not projects** | Move a task between available providers without rebuilding your project context from scratch. |
| **Run more than one thing at once** | Give parallel tasks their own projects, conversations, terminals, and timelines. |
| **See the work, not a log dump** | Review streamed activity, tool calls, changed files, diffs, screenshots, browser previews, and Git actions inline. |
| **Code + Work together** | Ship software and run local cowork tasks in one platform—sessions, connections, browser, and artifacts stay with the conversation. |
| **Automate the boring parts** | Schedule recurring prompts and come back to their results without babysitting every run. |

## One desktop for the whole task

| Plan | Build | Review |
| --- | --- | --- |
| Choose Agent, Plan, Ask, or Debug for the next turn. | Work with Codex, Claude Code, Cursor, Gemini, Grok, Meta, OpenCode, and more. | Keep diffs, browser previews, screenshots, approvals, and output beside the conversation. |

Modesto brings together the surfaces real agent work needs:

- Persistent conversations — start a Code chat without opening a project
- Integrated files, terminal, browser, and diffs
- Native code review and Git actions
- Parallel agent tasks
- Desktop environments and a header usage clock
- Plan, Ask, and Debug interaction modes
- Scheduled automations
- Connections for tools and web apps
- Provider installation and health checks
- Local and hosted OpenAI-compatible model routers
- Desktop and full-screen terminal interfaces

## Bring every agent

Use the provider CLIs and subscriptions already on your machine, install supported agents from Provider Tools, or connect an OpenAI-compatible endpoint.

**Codex** · **Claude Code** · **Cursor Agent** · **Gemini CLI** · **Grok** · **Meta (Muse Code)** · **OpenCode** · **Factory Droid** · **Kilo Code** · **Poolside** · **Kimi** · **Qwen** · **Devin** · **Pi** · **local and hosted model routers**

Your provider credentials stay local. Zero telemetry. Complete ownership.

## Download Modesto

**v1.0.0-alpha.1 — public 1.0 alpha** is the current public line. Existing 0.3 and 0.4 desktop installs update to it in-app. This is still an alpha, not a finished 1.0 product.

| Platform | Requirements | Installer |
| --- | --- | --- |
| **macOS · Apple Silicon** | macOS 12+ · M1 or newer | [Download `.dmg`](https://github.com/Syphon1205/Modesto/releases/download/v1.0.0-alpha.1/Modesto-1.0.0-alpha.1-arm64.dmg) |
| **macOS · Intel** | macOS 12+ · Intel processor | [Download `.dmg`](https://github.com/Syphon1205/Modesto/releases/download/v1.0.0-alpha.1/Modesto-1.0.0-alpha.1-x64.dmg) |
| **Windows · x64** | Windows 10 or 11 | [Download `.exe`](https://github.com/Syphon1205/Modesto/releases/download/v1.0.0-alpha.1/Modesto-1.0.0-alpha.1-x64.exe) |
| **Linux · x64** | Ubuntu 22.04+ or equivalent | [Download `.AppImage`](https://github.com/Syphon1205/Modesto/releases/download/v1.0.0-alpha.1/Modesto-1.0.0-alpha.1-x86_64.AppImage) |

macOS builds are Developer ID signed and notarized by Apple. Installed copies update through Modesto's built-in updater. The [latest release](https://github.com/Syphon1205/Modesto/releases/latest) always has the complete artifact list and release notes.

## What's new in v1.0.0-alpha.1

- **Public 1.0 alpha** — the hop from Early Modesto / New Foundation onto the 1.0 line. Still an alpha, not a claim that every surface is finished.
- **In-app update from 0.3 and 0.4** — this release is GitHub Latest with `latest` and `modesto` updater manifests and the production desktop identity, so existing GitHub installs pick it up without a manual re-download.
- **Chats without a project** — start and send a Code chat without opening a folder; Work still needs a project.
- **Desktop environments** — Cursor-style right-panel list, header usage clock, and Grok as a first-class provider.

Read the [complete v1.0.0-alpha.1 release notes](https://github.com/Syphon1205/Modesto/releases/tag/v1.0.0-alpha.1).

## Command-line interface

Prefer a terminal over a desktop window? `modesto` is the same workspace as a CLI—same providers, projects, and conversations, rendered as text.

```sh
npm install -g @modestocode/cli
modesto
```

| Command | What it does |
| --- | --- |
| `modesto` | Launch the full-screen terminal UI |
| `modesto chat` | Open the lighter, single-pane chat client |
| `modesto serve` | Run the local HTTP/WebSocket server used by the desktop app |

The CLI shares its projects, threads, and provider connections with the desktop app. Start a task in one and pick it back up in the other.

## Get started

1. Download the installer for your computer or install the CLI.
2. Open Modesto and choose a provider.
3. Sign in to your own provider account when prompted.
4. Start a chat. Opening a project is optional for Code and required for Work.

## About this repository

Modesto is open source under the [MIT License](LICENSE). This repository is the public home for desktop binaries, release notes, issue tracking, and the published source snapshot.

Started as a solo project. Now built with an open-source community — contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [security policy](SECURITY.md).

---

<div align="center">
  <strong>Stop choosing one agent. Give all of them a better workspace.</strong><br />
  <sub>
    Built by Tanner Davidson and contributors. Modesto is an independent desktop application.<br />
    Provider names and trademarks belong to their respective owners.
  </sub>
</div>
