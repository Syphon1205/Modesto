<div align="center">
  <img src="assets/modesto-icon.png" width="104" alt="Modesto app icon" />

  <h1>Modesto</h1>

  <p><strong>Your coding agents. One focused workspace.</strong></p>
  <p>
    Work with Codex, Claude, Cursor, Gemini, Grok, and more—without
    rebuilding your workflow every time you switch.
  </p>

  <p>
    <a href="https://github.com/Syphon1205/Modesto/releases/latest"><strong>Download v0.1.3</strong></a>
    &nbsp;·&nbsp;
    <a href="#whats-new">What's new</a>
    &nbsp;·&nbsp;
    <a href="https://github.com/Syphon1205/Modesto/releases">All releases</a>
  </p>

  <p>
    <img alt="Latest release" src="https://img.shields.io/badge/release-v0.1.2-6d5dfc?style=flat-square" />
    <img alt="Release channel: stable" src="https://img.shields.io/badge/channel-stable-22c55e?style=flat-square" />
    <img alt="Platforms: macOS and Windows" src="https://img.shields.io/badge/platforms-macOS%20%7C%20Windows-64748b?style=flat-square" />
  </p>
</div>

<br />

![Modesto workspace](assets/modesto-app.png)

## A calmer way to work with coding agents

Modesto brings your conversations, project files, terminal, browser, diffs, and
provider tools into one desktop app. Start with the agent that fits the task,
follow its work live, and review the result without losing context.

| Work your way | Stay in control |
| --- | --- |
| **Multiple providers** — choose the right agent or model for each task. | **Live changes** — inspect file edits and diffs as work happens. |
| **Connected workspace** — keep code, terminal, browser, and conversation together. | **Visible context** — track session activity and usage without leaving the task. |
| **Projects and automations** — organize ongoing and recurring work. | **Integrated tools** — install and use supported provider CLIs from the app. |

## Download

Choose the installer that matches your computer:

| Platform | Requirements | Installer |
| --- | --- | --- |
| **macOS · Apple Silicon** | macOS 12+ · M1 or newer | [Download DMG](https://github.com/Syphon1205/Modesto/releases/download/v0.1.2/Modesto-0.1.2-arm64.dmg) |
| **macOS · Intel** | macOS 12+ · Intel processor | [Download DMG](https://github.com/Syphon1205/Modesto/releases/download/v0.1.2/Modesto-0.1.2-x64.dmg) |
| **Windows · x64** | Windows 10 or 11 | [Download EXE](https://github.com/Syphon1205/Modesto/releases/download/v0.1.2/Modesto-0.1.2-x64.exe) |

macOS releases are Developer ID signed and notarized by Apple. Stable builds include
update metadata, allowing Modesto to find and install future releases from the app.

> Only download Modesto from this repository's
> [Releases](https://github.com/Syphon1205/Modesto/releases) page.

## What's new

### v0.1.2

- **WSL2 support** — use Linux-backed projects, commands, and provider CLIs from
  the Windows build.
- **Stable in-app updates** — release metadata now covers Windows, Apple Silicon,
  and Intel Mac.
- **A cleaner update experience** — clearer status messaging and a fix for the
  update-check error shown in earlier builds.
- **Desktop UX refinements** — improved provider setup, review tools, editor
  navigation, terminal appearance, and app information.

[Read the complete v0.1.2 release notes →](https://github.com/Syphon1205/Modesto/releases/tag/v0.1.2)

## Getting started

1. Download the installer for your platform.
2. Install and open Modesto.
3. Choose a provider and sign in to your own provider account when prompted.
4. Open a project and start a task.

Modesto prepares its bundled provider launchers in its private application data
directory on first launch. Later launches reuse that installation and refresh it
only when the bundled runtime changes.

<details>
<summary><strong>Windows SmartScreen</strong></summary>

Windows may ask you to confirm a newly downloaded app. Choose **More info**, verify
that the app name is Modesto, then choose **Run anyway**.

</details>

## About this repository

This repository distributes official Modesto desktop binaries and release notes.
Application source code is not published here.

---

<div align="center">
  <sub>
    Built by Tanner Davidson. Modesto is an independent desktop application.
    Provider names and trademarks belong to their respective owners.
  </sub>
</div>
