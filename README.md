<div align="center">
  <img src="assets/modesto-icon.png" width="112" alt="Modesto app icon" />

  <h1>Modesto</h1>

  <p><strong>Your agents. Your machine. One workspace.</strong></p>
  <p>
    The open alternative to locking your work inside one model, one CLI, or one IDE.<br />
    Run Codex, Claude Code, Cursor, Gemini, OpenCode, and more from a single desktop.
  </p>

  <p>
    <a href="https://github.com/Syphon1205/Modesto/releases/latest"><strong>Download Modesto</strong></a>
    &nbsp;·&nbsp;
    <a href="#why-modesto">See what it does</a>
    &nbsp;·&nbsp;
    <a href="#command-line-interface">Install the CLI</a>
  </p>

  <p>
    <img alt="Latest release: v0.3.0" src="https://img.shields.io/badge/release-v0.3.0-7c8cff?style=flat-square" />
    <img alt="Release channel: stable" src="https://img.shields.io/badge/channel-stable-2dd4bf?style=flat-square" />
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
| **Work beyond the prompt box** | Keep project files, research, browser work, generated artifacts, and the conversation that produced them together. |
| **Automate the boring parts** | Schedule recurring prompts and come back to their results without babysitting every run. |

## One desktop for the whole task

| Plan | Build | Review |
| --- | --- | --- |
| Choose Agent, Plan, Ask, or Debug for the next turn. | Work with Codex, Claude Code, Cursor, Gemini, OpenCode, and more. | Keep diffs, browser previews, screenshots, approvals, and output beside the conversation. |

Modesto brings together the surfaces real agent work needs:

- Persistent conversations and project context
- Integrated files, terminal, browser, and diffs
- Native code review and Git actions
- Parallel agent tasks
- Plan, Ask, and Debug interaction modes
- Scheduled automations
- Provider installation and health checks
- Local and hosted OpenAI-compatible model routers
- Desktop and full-screen terminal interfaces

## Bring every agent

Use the provider CLIs and subscriptions already on your machine, install supported agents from Provider Tools, or connect an OpenAI-compatible endpoint.

**Codex** · **Claude Code** · **Cursor Agent** · **Gemini CLI** · **OpenCode** · **Grok** · **Factory Droid** · **Kilo Code** · **Poolside** · **Kimi** · **Qwen** · **GitHub Copilot** · **Pi** · **local and hosted model routers**

Your provider credentials stay local. Your choice of agent stays yours.

## Download Modesto

**v0.3.0 — Cowork** is the current stable release.

| Platform | Requirements | Installer |
| --- | --- | --- |
| **macOS · Apple Silicon** | macOS 12+ · M1 or newer | [Download `.dmg`](https://github.com/Syphon1205/Modesto/releases/download/v0.3.0/Modesto-0.3.0-arm64.dmg) |
| **macOS · Intel** | macOS 12+ · Intel processor | [Download `.dmg`](https://github.com/Syphon1205/Modesto/releases/download/v0.3.0/Modesto-0.3.0-x64.dmg) |
| **Windows · x64** | Windows 10 or 11 | [Download `.exe`](https://github.com/Syphon1205/Modesto/releases/download/v0.3.0/Modesto-0.3.0-x64.exe) |
| **Linux · x64** | Ubuntu 22.04+ or equivalent | [Download `.AppImage`](https://github.com/Syphon1205/Modesto/releases/download/v0.3.0/Modesto-0.3.0-x86_64.AppImage) |

macOS builds are Developer ID signed and notarized by Apple. Installed copies update through Modesto's built-in updater. The [latest release](https://github.com/Syphon1205/Modesto/releases/latest) always has the complete artifact list and release notes.

## What's new in v0.3.0

- **Cowork workspace** for research, local tasks, connected tools, and multi-session agent work alongside Code.
- **Connected apps and tools** with separate Cowork MCP storage, real OAuth, provider-aware discovery, and connections shared with Codex, Claude, Gemini, and ACP providers.
- **Better live control** with Stop, Steer, and Queue actions while an agent is running, plus clearer transcript navigation and keyboard controls.
- **Session tabs, groups, and an integrated terminal** for keeping parallel work organized without leaving the workspace.
- **Stronger artifacts and reliability** with destination controls, file-size context, lazy editor loading, better recovery, and fixes for hung sends, blank reloads, stale turn state, and hidden older chats.

Read the [complete v0.3.0 release notes](https://github.com/Syphon1205/Modesto/releases/tag/v0.3.0).

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
4. Open a project and start a task.

## About this repository

This is the official public distribution home for Modesto desktop binaries, release notes, and issue tracking. Application source code is not published here, and Modesto is currently proprietary software rather than open-source software. See [LICENSE](LICENSE).

For security reports, see the [security policy](SECURITY.md). For bugs and focused feedback, see [contributing](CONTRIBUTING.md).

---

<div align="center">
  <strong>Stop choosing one agent. Give all of them a better workspace.</strong><br />
  <sub>
    Built by Tanner Davidson. Modesto is an independent desktop application.<br />
    Provider names and trademarks belong to their respective owners.
  </sub>
</div>
