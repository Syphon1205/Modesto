# Porting Cowork (Automations, Connections, Artifacts)

Status: **the Work shell is gone; its pieces are separate surfaces now.** This
file is the map, and is referenced from those surfaces so an unfinished one
says where to look.

## The Work shell was retired (2026-09-02)

`/cowork` wrapped Tasks, Artifacts, Automations, and Connections behind one
"Work" nav item. That container is deleted, because it was a container rather
than a destination — nobody could guess what was inside it, and each piece
belonged somewhere more specific:

| Was                | Is now                                                            |
| ------------------ | ----------------------------------------------------------------- |
| Work → Tasks       | Retired; the Tasks/kanban surface already does this               |
| Work → Artifacts   | A right-panel surface (`components/artifacts/ArtifactsPanel.tsx`) |
| Work → Automations | `/automations` (`automations/AutomationsPage.tsx`)                |
| Work → Connections | `/connections` (`connections/ConnectionsPage.tsx`)                |

Deleted with it: `WorkApp.tsx`, `workSection.ts`, `workSearch.ts`,
`coworkThreads.ts`, `coworkThreadsStore.ts`, and the `_chat.cowork` route. The
"a Work task is a marked thread" mechanic went with them — Tasks is the kanban
surface, and a thread there is already an ordinary thread.

## What Cowork is

A second workspace mode alongside Code, for non-code tasks. In the old tree it
is `apps/web/src/cowork/` (~7,800 lines) plus server pieces. It is _not_ a
parallel agent stack: a Work task is an ordinary thread carrying a client-side
mark, so sessions, transcripts, providers, and the composer are all reused. The
mark only decides which surface a thread appears on and that Work renders a
simplified, permissions-free composer for it.

That reuse is the single most important thing to preserve. Anything that starts
duplicating thread machinery for Work has gone wrong.

## What landed here (before the shell was retired)

| Piece         | File                                        | Notes                                                                                                  |
| ------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Section model | `apps/web/src/cowork/workSection.ts`        | Shared by the route and the sidebar's active check; a mismatch is how a nav item goes permanently dim. |
| Search params | `apps/web/src/cowork/workSearch.ts`         | A builder because `exactOptionalPropertyTypes` forbids `{ threadId: undefined }`.                      |
| Task marking  | `apps/web/src/cowork/coworkThreads.ts`      | Pure, capped at 500, sanitized on read.                                                                |
| Store         | `apps/web/src/cowork/coworkThreadsStore.ts` | Debounced localStorage, same shape as `chatTabsStore`.                                                 |
| Route         | `apps/web/src/routes/_chat.cowork.tsx`      | `/cowork?section=…`; unknown sections fall back rather than erroring.                                  |
| Shell         | `apps/web/src/cowork/WorkApp.tsx`           | Section nav + working Tasks list.                                                                      |

Also fixed on the way in: the sidebar's **Automations** button navigated to
`/automations`, a route that has never existed in this tree. The button was
dead and the type error it raised was the only one in the web app. It now
points at `/cowork?section=automations`.

## What is left, roughly in dependency order

### 1. Automations — the engine is here; the runner and the UI are not

Correcting an earlier claim in this file that this tree had none of it. What
already exists:

- `packages/openwork-automations/` (~1,800 lines): the vendored OpenWork
  engine — schedule, state, tick, ports, contracts, with its own tests.
- `apps/server/src/automation/SqliteAutomationRepository.ts` (535 lines) plus
  migration `042_Automations.ts`: durable storage implementing the engine's
  `AutomationRepository` port, append-only revisions, claims won by a UNIQUE
  index rather than by application code.

The loop between engine and user now exists as
`apps/server/src/automation/AutomationRunner.ts`: it recovers expired leases,
selects what is due, claims it (the database decides the winner, so a second
runner sees `duplicate`/`overlap` and skips), renews the lease on its own fiber
for as long as the run lasts, and records how the run ended. It is tested
against the real SQLite repository rather than a fake.

What is still missing:

`AutomationTurnDispatcher.ts` runs a claimed automation as a real turn, and
`AutomationScheduler.ts` starts the loop with the server (parked behind
activation, lease owner generated per boot). Two decisions were settled while
building them:

- **Where an automation runs:** one managed folder, `<baseDir>/automations`,
  owned by a project Modesto creates on demand. The engine's schema has no
  project at all, an automation fires while nobody is watching (so running it
  inside a working checkout could mutate a repo mid-edit), and a scheduled
  digest rarely wants a repo. A per-automation project override is a later
  addition — it needs a Modesto-side column the engine's tables do not have.
- **How completion is observed:** `thread.session-set` events on the run's
  thread, subscribed _before_ the turn is dispatched, treating "no active turn
  after having had one" as settled. A short turn can finish before a later
  subscription would see anything, and a missed completion leaves the run
  "running" until its lease expires.

What is still missing:

- **RPC methods and push events** so the web app can create, list, and watch
  runs. This is now the only thing between the engine and a working feature.
- **The UI behind `/automations`**, which today explains that a due automation
  would run but nothing can create one yet.

`apps/server/src/mcp/PreviewAutomationBroker.ts` is browser-preview automation
and unrelated — do not build on it by mistake.

### 2. Connections — two models, and this tree is switching to the second

The MCP model (below) installs a server and runs an OAuth flow per service.
The direction now is **browser-session connections**: you sign in to the app in
Modesto's own browser, the session lives in that browser's partition, and
"connected" is an observable fact about that session rather than a stored
token. `connections/webApps.ts` carries the catalog for that model, including
the `sessionCookieNames` a probe checks. What it still needs:

- a desktop-bridge call to read the browser partition's cookie jar, so a row
  can say signed in / signed out instead of "not detected yet";
- `@gmail`-style composer mentions resolving through `resolveWebAppMention`,
  with the icons in `components/WebAppIcons.tsx`;
- opening the mentioned app in the thread's side browser, so the agent works
  in it through the existing `preview_*` toolkit.

The MCP model below is still what `connectionsCatalog.ts` implements, and is
kept for services with no usable web UI.

#### The older MCP model — needs Cowork's own Codex home

- `apps/server/src/provider/coworkCodexHome.ts` (92 lines) and the
  `CoworkMcpServers` service/layer/migration (~214 lines).
- **The invariant:** Cowork gets a genuinely separate Codex home
  (`~/.modesto/runtime/cowork-codex-home`), never seeded from `~/.codex` and
  deliberately _not_ built on Modesto's shared overlay, because that overlay
  symlinks Code's own `auth.json`. Getting this wrong means a Work MCP OAuth
  login writes into the user's real Codex auth. Port this before anything can
  actually run a Work MCP session.

### 3. Artifacts — detection landed, the viewers did not

- Detection and the list are in `components/artifacts/`, now a right-panel
  surface beside Browser/Diff/Files rather than a page.
- Still to port from the old tree's `WorkArtifact*.tsx` + `workArtifacts.ts`
  (~3,200 lines): the editor, the binary viewers, and the spreadsheet view —
  plus CSV/document export to Sheets, Docs, Drive, and Office formats.
- Depends on nothing above, so it can be done in parallel.

### 4. Marketplace / extensions

- `apps/web/src/cowork/marketplace/` (~1,700 lines) incl. Claude plugin import.
- Overlaps this tree's existing `/plugins` route — check for duplication before
  porting rather than landing a second plugin surface.

### 5. Work chrome

- `WorkSidebar*`, `WorkCommandPalette`, `WorkEmptyHero`, transcript find/scroll
  overlays. Mostly presentational; lowest risk, lowest value until the sections
  above exist.

## OpenWork as a source

`openwork-dev/` is a reference checkout of OpenWork, the open-source Claude
Cowork alternative that the old tree's Work surface was already modelled on.

**Licensing — the one hard boundary.** Repository content is MIT _except_
everything under `/ee`, which is Fair Source (FSL-1.1-MIT). `ee/packages/den-db`,
`ee/packages/den-admin-mcp`, and `ee/packages/utils` must not be copied. The old
tree's `THIRD_PARTY_NOTICES.md` already carries an OpenWork section and states
that `/ee` is not used; any port needs the same treatment, listing the files
taken and the modifications made.

The old tree adapted OpenWork's _UX patterns_ (empty hero, extension cards,
marketplace catalog, descriptive buttons) rather than vendoring components, and
restyled them onto Modesto tokens. Worth repeating: OpenWork ships Radix colour
scales and Den chrome that would fight this tree's design system.

**The friction:** OpenWork is zod-based and this tree has no zod at all — it
standardizes on Effect Schema. zod is concentrated in
`packages/types/src/automations.ts` (383 lines, 131 uses) with ~60 more in
`engine.ts`; the schedule, state, tick, ports, and contracts modules are
essentially zod-free. So the conversion surface is bounded but real, and it is a
fork in the road: vendor near-verbatim with zod added as a dependency and keep
the ability to pull upstream fixes, or convert the schemas to Effect Schema and
own the fork.

## Things to carry over deliberately

- **A Work task is a marked thread.** Resist a `WorkThread` type.
- **Cowork's Codex home is separate.** See the invariant above.
- **Sections that are not implemented should say so**, not render an empty
  state — an empty list claims the feature works and has no data, which is a
  different and untrue statement.
