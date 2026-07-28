# Contributing to Modesto

Thank you for helping build Modesto, the open agent workspace.

## Principles

Prioritize performance, reliability, predictable recovery, and long-term maintainability. Modesto is an evolution of a working application: preserve provider sessions, orchestration, persistence, worktrees, terminals, Git behavior, and WebSocket contracts unless a measured problem requires change.

Keep user-facing work calm, compact, and desktop-oriented. Avoid generic dashboards, oversized cards, fake metrics, excessive glass, or UI that implies a feature exists before it does.

## Setup

```sh
bun install
bun run dev
```

Use an isolated state directory and non-default ports when another instance is running. Dry-run the selected ports first as described in `AGENTS.md`.

### Windows Subsystem for Linux (WSL2)

Modesto supports contributor workflows in WSL2. Use a current Ubuntu distribution,
keep the checkout in the Linux filesystem (for example `~/src/Modesto`, not
`/mnt/c/...`), and enable `systemd` through `/etc/wsl.conf`.

From PowerShell:

```powershell
wsl --install -d Ubuntu
wsl --update
wsl --shutdown
```

Then, inside WSL:

```sh
sudo apt update
sudo apt install -y build-essential git python3 pkg-config libsecret-1-dev
git clone https://github.com/Syphon1205/Modesto.git
cd Modesto
bun install
bun run dev
```

The dev runner detects WSL2 and uses IPv4 loopback for the server and browser
WebSocket, so Windows localhost forwarding works without custom host flags. WSLg
can run the Electron development window; `bun run dev:server` and
`bun run dev:web` are available when you prefer a browser-based workflow.

Provider CLIs must be installed inside the WSL distribution so Modesto sees the
same Linux executable, credentials, and project paths as the terminal. Avoid
mixing native Windows and WSL copies of a provider in one session.

Run normal Linux builds and verification inside WSL:

```sh
bun run build
bun run build:desktop
bun run test
```

Windows installers still require native Windows because Electron packaging,
code signing, and installer integration target the Windows host. Run
`bun run dist:desktop:win` from PowerShell or Command Prompt, not WSL.

## Changes

- Put shared schemas in `packages/contracts`; do not add runtime logic there.
- Put cross-server/web runtime helpers in an explicit `@modesto/shared/*` subpath. The package namespace is a documented compatibility identifier for now.
- Reuse `apps/web/src/lib/disclosureMotion.ts` for every open/close animation.
- Preserve runtime provider discovery instead of hardcoding installed providers.
- Add focused tests for scrolling, timeline measurement, reconnect, migration, or persistence changes.
- Never remove legacy data during a migration. Copy or import it, validate the result, and keep rollback possible.

## Verification

Use `bun run test`, never `bun test`. Before opening a change for review, run the smallest relevant tests during iteration and one final workspace verification pass appropriate to the change. Build affected web/desktop packages when changing routes, packaging, native integration, or release metadata.

## Pull requests

Explain the user outcome, compatibility impact, verification performed, and remaining risk. Call out changes to persistence paths, environment variables, protocols, bundle identifiers, release artifacts, or updater behavior explicitly.

## Attribution

Do not remove original copyright or license notices for third-party code. If code is adapted from another project, record the project, source location, license, and nature of the adaptation in `THIRD_PARTY_NOTICES.md`. Architectural or design inspiration belongs in `ACKNOWLEDGEMENTS.md` and must not be described as copied code without evidence.

Modesto’s own source is proprietary (see `LICENSE`). Contributions you submit are owned by Tanner Davidson and may be used under that proprietary license unless a separate written agreement says otherwise.
