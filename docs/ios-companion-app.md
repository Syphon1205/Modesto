# Modesto iOS companion app

A native SwiftUI iOS target scaffolded inside this repo at `apps/ios`, alongside `apps/web`, `apps/server`, and `apps/desktop`. It is a companion to Modesto Desktop, not a port of it — no desktop IDE squeezed onto a phone. This document covers what was built, the architectural decisions behind it, and what's still open.

## Why a new `apps/ios` package

Modesto's platform story (see [README.md](../README.md#platform-support)) is a Bun/TypeScript server plus a React web workspace, with Electron as the desktop shell. iOS needs a genuinely native UI — SwiftUI, not a wrapped web view — so it lives as its own package with its own toolchain, matching the monorepo's existing pattern of one app per platform surface.

## Project setup

- `apps/ios/project.yml` is an [XcodeGen](https://github.com/yonaskolb/XcodeGen) spec. Run `xcodegen generate` from `apps/ios` to produce `Modesto.xcodeproj` (gitignored-worthy — it's fully derived from `project.yml`, so regenerate rather than hand-edit the `.xcodeproj`).
- Target: iOS 17+, universal (iPhone + iPad), Swift 5 language mode on the Xcode 26 toolchain.
- No physical `Info.plist` — uses `GENERATE_INFOPLIST_FILE` with `INFOPLIST_KEY_*` build settings (the modern Xcode 15+ convention). The app follows the system light/dark setting by default (see Design system below) — nothing forces an appearance at the Info.plist level.
- `AppIcon.appiconset` uses the real Modesto icon (`assets/prod/black-ios-1024.png`, already iOS-shaped — RGB, no alpha, correct 1024×1024). `AccentColor.colorset` matches `ModestoColor.accent`.
- Verified: `xcodegen generate` + `xcodebuild build` for iOS Simulator both succeed cleanly, including compiling every `#Preview` provider (Xcode canvas previews work, not just simulator runs).

To open in Xcode: `cd apps/ios && xcodegen generate && open Modesto.xcodeproj`.

## Structure

```
apps/ios/Modesto/
  App/            Entry point, root tab navigation, route enum
  DesignSystem/    Color/type/spacing tokens + reusable components
  Models/          Domain types shared by every screen
  Services/        Protocols + mock implementations + DI container
  Features/        One folder per screen area
  Resources/       Asset catalog
```

## Product redesign: projects first, not runtimes

A later pass restructured the information architecture around a single principle: **every action starts from a project**, not from a runtime. Concretely:

- **Four tabs, not the original Home/Activity/Inbox/Settings**: **Work** (triage — what needs you, what's running, what's paused), **Projects** (a searchable directory — the project _is_ the primary object), **Inbox** (the Approval Center), **Activity** (the filterable operations timeline). Settings moved out of the tab bar entirely, into a sheet reached from a toolbar gear icon on Work — freeing a tab slot for Projects without crowding the bar.
- **Runtimes are never the primary object.** `RuntimeConnection`s (agent provider CLIs, GitHub, Vercel) are grouped under the `RuntimeHost` (physical machine) they run on via `HostGroupCard`, and that grouped view is a supporting section at the bottom of Work — not a first-class list of its own.
- **Structured progress over raw output.** `AgentSession.progress: SessionProgress?` (current step, completed/pending steps, changed file count, test status) is rendered as a real progress card on Session detail and folded into `SessionRow` everywhere else, so "what is this agent actually doing" never requires opening the terminal. The terminal is still there (Project detail's Terminal tab) but is one tab among several, not the default.
- **Approval Center, not a bare list.** Inbox unifies pending `Approval`s and sessions `waitingForInput` into one `InboxItem` feed, rendered as native action cards (`ApprovalActionCard`, `QuestionActionCard`) with visible Approve/Decline buttons and an inline answer field — plus swipe as an accelerator, never the only path. File-change approvals expand inline to a real diff (`DiffHunksView`, shared with Project detail's Files/Changes view) so you can review without leaving the card.
- **Activity is a filterable timeline**, not a flat feed: `ActivityEntry` normalizes session events _and_ deployments into one sorted list, filterable by Running / Completed / Failed / Deployments / Reviews via `FilterChip`.
- **Density and native feel.** `GroupedCard`/`GroupedRow`/`GroupedDivider` give Settings- and Machines-style "several related rows in one inset card" grouping instead of every row being its own floating bordered card. Every screen supports Dynamic Type, including accessibility sizes (components read `@Environment(\.dynamicTypeSize)` and reflow from horizontal to vertical layouts above the accessibility threshold — see `SessionRow`, `HostGroupCard`, `ChangedFileRow`, `ProjectOverviewTab` for the pattern). Fonts in `Theme.swift` are Dynamic-Type-relative (`Font.system(.body, design:, weight:)`), not fixed pixel sizes.
- **Project detail** is Overview / Agents / Changes / Preview / Terminal — "Changes" merges what were separate Files and Git tabs (branch, PR, and the changed-file list with diff navigation together), since they're one mental model ("what's different right now"), while Agents stays its own tab because a project can have several concurrent sessions worth browsing on their own.

None of this added new capability beyond what was already described below — it's a structural and visual pass, not a feature pass, matching the "don't add features yet, fix the architecture and UX" brief it came from.

### Design system (`DesignSystem/`)

`Theme.swift` holds every color, font, spacing, and radius token as static values — no hardcoded hex or magic numbers in feature code. Every `ModestoColor` is a light/dark pair via `Color(light:dark:)`, a small `UIColor { traits in … }`-backed initializer that resolves from the active trait collection, so the whole app follows the system appearance (or an explicit override — see Appearance below) automatically. The palette is near-black/off-white with raised surfaces, muted borders, and a single indigo accent (`#5B8DEF` dark / `#3D6FD9` light), matching Cursor's minimal/technical feel in both modes rather than iOS's usual glassy chrome. `ModestoIconSize` (`xs`/`sm`/`md`/`lg`/`xl` = 14/18/22/28/44) is the single sizing scale every icon and brand mark in the app draws from, so nothing is sized ad hoc per call site.

`Components/` holds the reusable primitives every screen composes from: `SurfaceCard` (a standalone card), `GroupedCard`/`GroupedRow`/`GroupedDivider` (an inset-grouped card of related rows, the native Settings.app pattern), `StatusDot`, `ProviderBadge`, `SectionHeader`, `FilterChip` (the pill used by both Activity's category filter and Project detail's tab picker), `PillButtonStyle`, `EmptyStateView`, `RowIconBadge` (the tinted rounded-square leading glyph every list row uses), `EventKindIcon` (the circled glyph shared by the session timeline and the Activity feed), and the list rows (`ProjectRow`, `SessionRow`, `ApprovalRow`, `ChangedFileRow`, `HostGroupCard`) that Work, Projects, Inbox, and Project detail all share instead of each screen rolling its own. `FadingEdges.swift` adds a `.fadingHorizontalEdges()` modifier used on horizontally-scrolling strips (Project detail's tab picker) so a partially visible next item reads as a scroll affordance, not a clipped layout.

### Appearance

Settings → Appearance has a real System/Dark/Light segmented picker, persisted via `@AppStorage("modesto.appearance")` and applied once at the root in `ModestoApp.swift` via `.preferredColorScheme`. `AppearanceMode` (`App/AppearanceMode.swift`) is the three-case enum behind it; `.system` maps to `nil` so SwiftUI just follows the device setting. Every screen was built against `ModestoColor` tokens only, so this required no per-screen changes — verified by screenshotting Home in both an explicit light and an explicit dark simulator appearance.

`ModestoMark` (`DesignSystem/Components/ModestoMark.swift`) draws Modesto's real "convergence mark" logo — ported stroke-for-stroke from `apps/web/src/assets/modestoLogoPath.ts` into a `Canvas`-based `Path`, not a raster image, so it's crisp at any size and tintable like the original `currentColor` SVG. Used in the onboarding header/hero and Settings' About row.

`ProviderMark` and `RuntimeMark` (`DesignSystem/Components/BrandMarks.swift`) render each provider/runtime's **real** brand mark rather than a generic SF Symbol — see Branding below.

### Branding

The app icon and every provider mark are the **real** brand assets Modesto already ships elsewhere in the monorepo — not new artwork, and not generic SF Symbols standing in for logos:

- **App icon**: `assets/prod/black-ios-1024.png`, copied as-is into `AppIcon.appiconset`. It was already prepared for exactly this (RGB, no alpha, 1024×1024).
- **Modesto's own mark**: the exact SVG path data from `apps/web/src/assets/modestoLogoPath.ts`, hand-ported into `ModestoMark.swift` as a `Canvas` `Path` (see above).
- **Provider marks** (Codex, Claude, Cursor, Gemini, Grok, Droid, Kilo, OpenCode, Pi) and **GitHub**: the exact same brand SVGs `apps/web/src/components/Icons.tsx` uses for the desktop web app. Since Xcode's asset-catalog SVG importer can't reliably handle some of these (masks, filters, arc commands), each was rendered once with `rsvg-convert` (via `brew install librsvg`) into a trimmed, transparent PNG and imported as a single-scale image set — see `ProviderCodex.imageset`, `ProviderClaude.imageset`, etc. under `Resources/Assets.xcassets/`. Monochrome marks (Codex, Cursor, Grok, Droid, Kilo, Pi, GitHub) are flagged `template-rendering-intent: template` in their `Contents.json` so `ProviderMark`/`RuntimeMark` can tint them; marks with real brand color (Claude's orange, Gemini's blue, OpenCode's duotone gray) render as-is. This exactly mirrors how the desktop web app treats the same providers (`ProviderIcon.tsx`: `currentColor` for most, Claude hardcoded to `#D97757`).
- **Vercel** keeps its SF Symbol (`triangle`) — that symbol already **is** an accurate rendering of Vercel's actual mark, so no asset was needed.

Regenerating an icon from source: the original SVGs are not checked into `apps/ios` (only the rendered PNGs are, since that's what ships); if a mark needs to change, re-render from the source in `apps/web/src/components/Icons.tsx` / `apps/web/src/assets/modestoLogoPath.ts` with `rsvg-convert -w 256 -h 256 input.svg -o output.png` and re-trim.

### Domain models (`Models/`)

Each model is a plain `Codable, Sendable, Hashable` struct, one file per concept, deliberately mirroring the shape of Modesto's real contracts (`packages/contracts/src/orchestration.ts`, `project.ts`, `git.ts`, `terminal.ts`, `automation.ts`) so a future networking layer maps onto them without a redesign:

| Model                                                             | Mirrors                                                                                  |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `RuntimeConnection` / `RuntimeKind`                               | A reachable runtime: Modesto Desktop, an agent provider CLI, an SSH host, GitHub, Vercel |
| `Project`                                                         | `OrchestrationProject`                                                                   |
| `AgentSession` / `AgentSessionStatus`                             | `OrchestrationSession` + `OrchestrationLatestTurn.state`                                 |
| `SessionEvent` / `SessionEventKind`                               | Orchestration domain events, projected for a mobile timeline                             |
| `Approval` / `ApprovalKind` / `ApprovalDecision`                  | `ProviderRequestKind` + `ProviderApprovalDecision`                                       |
| `TerminalStream` / `TerminalLine`                                 | `TerminalSessionSnapshot`                                                                |
| `ChangedFile` / `FileDiff` / `DiffHunk` / `DiffLine`              | Working-tree entries + diffs from `GitStatusResult`                                      |
| `GitStatusSummary` / `GitBranchSummary` / `GitPullRequestSummary` | `GitStatusResult`                                                                        |
| `Deployment`                                                      | Vercel-style preview/production deployments (no Modesto contract equivalent yet — new)   |
| `ProviderKind`                                                    | The 9-provider enum from `packages/contracts/src/orchestration.ts`                       |

### Services (`Services/`)

`Services/Protocols/` defines one protocol per domain (`RuntimeConnectionService`, `ProjectService`, `AgentSessionService`, `ApprovalService`, `TerminalService`, `GitService`, `DeploymentService`). Every method is `async throws`; anything that should update live returns an `AsyncStream`.

`Services/Mock/` is the **only** implementation today. `MockData.swift` is the static fixture set (3 projects, 5 sessions across various states, 2 pending approvals, terminal transcript, diffs, git status with an open PR, Vercel deployments); `MockStore.swift` is an `actor` that owns the _mutable_ copy of that data (sessions, approvals, events, terminals) and every `Mock*Service` in `MockServices.swift` holds a reference to the same shared instance (constructed once in `AppEnvironment.mock`). This is what makes actions consistent across screens instead of each service quietly drifting from its own copy:

- Resolving an approval (`MockStore.resolveApproval`) also flips the linked session out of `.waitingForApproval` and drops a timeline event, so Home's session badge, the Inbox count, and the session detail header all agree afterward.
- Sending a message (`MockStore.appendUserMessage` / `appendCannedReply`) appends the user's event immediately and a canned assistant reply ~1.4s later, so replying feels like a real round trip.
- Starting a terminal and writing to it (`MockStore.startTerminal` / `appendTerminalLine` / `appendCannedTerminalOutput`) behaves the same way — one shared transcript per session, not a fresh one per fetch.

`MockData`/`MockStore` being separate is deliberate: fixtures stay static and easy to reason about, state mutation is isolated to one actor.

`AppEnvironment` (`Services/AppEnvironment.swift`) is the single DI container — a `@MainActor ObservableObject` holding all seven services, injected once via `.environmentObject` at the app root and threaded explicitly into each screen's `@StateObject` view model (`HomeView(environment:path:)`, `ProjectDetailView(projectId:environment:)`, etc.). **This is the seam for real networking**: a `Live*Service` set backed by the same WebSocket RPC contract the desktop web app already uses (`packages/contracts/src/ws.ts`, `WS_METHODS`, `WsPush*` channels) can be added under `Services/Live/` and swapped in via a new `AppEnvironment.live` factory, without touching any protocol, model, or view.

### Navigation (`App/`)

`RootTabView` is a `TabView` with four tabs — Home, Activity, Inbox, Settings — each owning its own `NavigationStack` and `NavigationPath`, so switching tabs never loses a pushed screen. `AppRoute` is a single `Hashable` enum (`.project(id:)`, `.session(id:)`) registered once per stack via `.navigationDestination(for: AppRoute.self)`; screens push into it either via the tab's `path` binding or via `NavigationLink(value:)`, which resolves against the nearest ancestor's destination handler regardless of nesting depth (used inside `ProjectDetailView`'s tabs, which don't carry their own path binding).

### Screens (`Features/`)

- **Onboarding** (`Features/Onboarding/`) — a four-step first-run flow (welcome → providers → approvals preview → ready), shown once before `RootTabView` and gated by `@AppStorage("modesto.onboarding.completed")` in `ModestoApp.swift`. The providers step doubles as a showcase for the real provider marks; the approvals step reuses the real `ApprovalRow` component with sample data. Settings has a "Replay onboarding" button that resets the flag for easy re-testing.
- **Work** (the first tab; `HomeView`/`HomeViewModel`, title "Work") — pure triage: sessions grouped into "Needs you" (waiting for approval or input), "Running", and "Paused", each row a `SessionRow` showing structured progress. Below that, `HostGroupCard`s summarize connected machines. `ModestoMark` sits in the toolbar's leading position; "New Task" and "Settings" (which opens as a sheet, not a tab) are trailing toolbar buttons.
- **Projects** (`ProjectsView`) — a searchable, flat directory of every project (`.searchable`, filters by name/path/branch), each row a `ProjectRow` pushing to Project detail. This is the "projects are the primary object" tab — browsing starts here, not from a runtime or a session.
- **Inbox** — the Approval Center. A `List` (for native swipe actions: swipe right to Accept, swipe left to Decline) of `ApprovalActionCard`/`QuestionActionCard`s — see the Product redesign section above.
- **Activity** — the filterable operations timeline (Running/Completed/Failed/Deployments/Reviews) — see the Product redesign section above.
- **Settings** — reached via a sheet from Work's toolbar, not a tab. Machines list, integrations, notification toggles (now `@AppStorage`-persisted), the System/Dark/Light appearance picker, About row, and "Replay onboarding".
- **Project detail** — one screen, five tabs: Overview, Agents, Changes, Preview, Terminal. Changes merges branch/PR summary and the changed-file list (with diff navigation) that used to be two separate tabs. **Terminal is fully interactive**: a "Start Terminal" button calls `TerminalService.startTerminal`; once running, a real `TextField` + send button calls `TerminalService.write`, which appends the command and a canned response (`git status`, `ls`, `pwd` get specific canned output) — verified end to end on-device.
- **Session detail** — a progress card (current step, completed/pending steps, changed files, tests, branch) leads the screen; the raw event timeline is collapsed to the last two entries by default with a "Show all" toggle. A **reply composer pinned to the bottom of the screen** (`.safeAreaInset(edge: .bottom)`, tab bar hidden while viewing a session) lets you talk back to a session, not just approve/decline it — the single biggest gap competitor research surfaced (Codex's and Claude's mobile apps let you reply from the phone).

## Competitor research

Before adding features, looked at what comparable mobile companion apps actually do (via web search — see chat history for sources):

- **GitHub Mobile** shipped Live Activities in Feb 2026 specifically for tracking Copilot/third-party coding-agent sessions in real time, plus push notifications for review activity. This is the strongest signal that live agent-session tracking (not just polling on app open) is now table stakes for this category — see Next steps.
- **Linear Mobile**'s inbox uses swipe-to-triage (swipe to act, tap for more) — directly copied for Modesto's Inbox.
- **ChatGPT's Codex mobile integration** is the closest direct analog to this app: phone sends approvals/new prompts/model changes, receives terminal results/diffs/screenshots; "the phone is the review and approval interface only, all execution runs on the host" (exactly this app's mock-service architecture). Its clearest capability gap versus what existed here before this session: **you could approve a Codex session from your phone, but you couldn't talk back to it.** That gap is now closed (see Session detail's reply composer above).
- **Termius** (SSH client) uses raw-PTY touch gestures (hold-space-for-arrow-keys, etc.) — considered and deliberately _not_ copied, because Modesto's terminal here is a queued-command model ("phone sends a command, host runs it, response comes back"), not a raw character stream; PTY-style touch gestures would only make sense once there's a genuinely live terminal socket.
- **Working Copy** (git client) has a commit graph and repo-wide fuzzy code search — noted as a good future addition to the Git/Files tabs, not attempted this session (out of scope for a mock-data pass).

## Verification performed

- `xcodegen generate` + `xcodebuild build` for iOS Simulator — **BUILD SUCCEEDED** repeatedly across the whole session, after every major change (light/dark mode, the `MockStore` refactor, terminal interactivity, the reply composer, Inbox swipe actions).
- Screenshotted Home in both an explicit light and an explicit dark simulator appearance (`xcrun simctl ui … appearance light|dark`) — confirmed the adaptive color system works correctly in both, including all real provider/runtime logos.
- Got computer-use access to the Simulator this time and drove the app directly (not just screenshots):
  - Tapped through Home → Project detail → Terminal tab → **Start Terminal** → typed `ls` → sent → got the real canned file listing back in the transcript.
  - Tapped into a session → typed "Hi" into the reply composer → sent → message appeared instantly → canned assistant reply appeared automatically ~2s later.
  - Swiped an Inbox row to Accept — confirmed (via the session's timeline showing "Approved: Edit AGENTS.md" and its status flipping to Running) that the shared `MockStore` keeps Home, Inbox, and Session detail consistent after the action.
- Note: the simulator's synthetic multi-character `type` action was unreliable in this environment (dropped characters, triggered a stuck accent-picker popup) — worked around by sending individual `key` presses instead, which landed cleanly every time. This is a simulator/tooling quirk, not an app bug — real device typing goes through the standard `TextField`/keyboard responder chain untouched.

## What's deliberately not here yet

Per the brief — foundation first, backend later:

- **No real networking.** No WebSocket client, no auth, no reconnect/retry logic. `AppEnvironment.mock` is the only environment.
- **No push notifications or Live Activities**, despite Settings having toggles for them — this is the top next step per competitor research (GitHub Mobile's Feb 2026 launch specifically).
- **No "start task" dispatch** — `NewTaskSheet` collects real input but the Start button just dismisses.
- **No test target** — kept out to avoid overbuilding before the architecture settles; add one once `Services/Live` exists and there's real logic worth covering.
- **No pairing/connection flow** — onboarding's "ready" step and Settings' "Add runtime" button both gesture at connecting to a real Modesto Desktop instance, but neither does anything yet.
- **No raw-PTY terminal** (Termius-style touch gestures, live character streaming) — today's terminal is a queued command/response model, appropriate for the current mock architecture but not a live shell.
- **No commit graph or repo-wide code search** in Git/Files, unlike Working Copy.

## Suggested next steps, in order

1. **Design the server-side mobile RPC surface.** The desktop web app's WebSocket protocol (`packages/contracts/src/ws.ts`) is session-oriented and assumes a persistent desktop connection; decide whether iOS reuses it directly, gets a trimmed subset of `WS_METHODS`/`WS_CHANNELS`, or gets its own mobile-facing contract (likely in a new `packages/contracts/src/mobile.ts` alongside the existing schema-only files).
2. **Implement `Services/Live/*`** conforming to the same seven protocols, backed by that RPC surface, and add `AppEnvironment.live`. Every model, protocol, and view is already shaped for this — no UI changes should be required.
3. **Push notifications + Live Activities** for approvals, session completion, and in-progress session status — the single most-validated missing feature per competitor research.
4. **Pairing/connection flow** — Settings' "Add runtime" button is currently a no-op; this is where discovering and authenticating against a Modesto Desktop instance (or a remote server) would land.
5. **Live terminal streaming** once there's a real socket — replace the queued command/response model with genuinely live `AsyncStream`s, and reconsider Termius-style touch gestures at that point.
6. **Model picker on Session detail** — Codex's mobile app lets you change models mid-task from the phone; not attempted here since there's no `ModelSelection` model in this app yet.
7. **Commit graph / repo-wide fuzzy search**, inspired by Working Copy.
