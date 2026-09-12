# Third-party notices

Modesto includes and depends on third-party open-source software. The authoritative dependency inventory is the workspace `package.json` files and `bun.lock`; each dependency remains subject to its own license and copyright notices.

## Repository foundation

Modesto’s original product source is licensed under AGPL-3.0-only (see
`LICENSE`), a consequence of bundling the Bible Strong avatar engine — the
notice below records that decision. Third-party open-source dependencies keep
their own copyright notices and licenses. Do not remove notices required by
those dependencies.

## Major runtime dependencies

- React and React DOM — MIT
- Electron — MIT
- Vite — MIT
- TanStack Router, Query, Virtual, and Pacer — MIT
- Effect and Effect platform packages — MIT
- `@bible-strong/avatar-core` and `@bible-strong/avatar-react` — AGPL-3.0-only
- Tailwind CSS — MIT
- Base UI — MIT
- xterm.js packages — MIT
- Vitest — MIT
- Astro — MIT

This list is a convenience summary, not a substitute for the complete lockfile inventory or the license texts distributed by each project.

## Coding-agent integrations and references

Modesto integrates with locally installed provider tools through their supported CLIs, SDKs, or protocols. Provider names and trademarks belong to their respective owners. OpenAI Codex, OpenCode, Cline, Continue, T3 Code, and Codex Monitor are also acknowledged as ecosystem references; no claim of copied code is made merely by listing a reference.

## Windows Subsystem for Linux logo

The WSL logo used in the Modesto v0.1.2 release artwork is Copyright © Microsoft
Corporation and was vectorized by Wikimedia Commons contributor
PantheraLeo1359531. It is distributed under the Expat/MIT License.

Source:
https://commons.wikimedia.org/wiki/File:Logo_WSL_Square44x44Logo.altform-lightunplated_targetsize-256.svg

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## OpenWork artifact detection (adapted)

Project: https://github.com/different-ai/openwork
License: MIT (outside `/ee`).

`apps/web/src/cowork/artifactTargets.ts` adapts the idea and the
extension-to-preview classification table from
`apps/app/src/react-app/domains/session/artifacts/open-target.ts`: scan an
assistant message for file references, classify how each should be shown, and
score it by how deliberately the text presented it.

The matching, the scoring, the confidence threshold, and the `file.ts:212`
citation handling are written against Modesto's message shape and are not
upstream's code.

## Rakazo (architecture reference)

Project: https://github.com/elie222/rakazo
Authors: Elie Steinbock and the Rakazo contributors.
License: Apache License 2.0.

Rakazo is the open-source AI-teammate / Grokbot-style roster Elie Steinbock
published: persistent named agents rather than a saved prompt. Modesto's
Agents surface (`apps/web/src/agents/`) follows that core product idea — a
name, a face, a persona, a home project, and a model that outlive any
individual thread. The roster-over-chat-list framing, the single rolled-up
activity per bot, and the rule that a bot's work lands in a real thread the
user can inspect and steer all come from reading Rakazo's `VISION.md`.

No Rakazo code is copied. Modesto's implementation is written against its own
contracts, thread model, and provider dispatch; Rakazo is a TypeScript/Prisma/
oRPC stack with server-side bot persistence, and Modesto's roster is
client-side and routes through the existing orchestration thread path.

## Bible Strong Avatar Lab (avatar engine — bundled)

Project: https://github.com/smontlouis/bible-strong-avatar-lab
Author: Stéphane Montlouis-Calixte.
License: AGPL-3.0-only.
Website: https://avatars.bible-strong.app

Modesto's agent avatars **are** this project's engine. Modesto depends on the
published packages `@bible-strong/avatar-core` and `@bible-strong/avatar-react`
(both AGPL-3.0-only), and every avatar in the Agents tab, the welcome tour and
the presence overlay is drawn, animated and blended by them:

- `apps/web/src/agents/AgentAvatar.tsx` renders through `<Avatar>`.
- `apps/web/src/agents/AvatarLab.tsx` is a customisation UI over the engine's
  own model — eight 3-D solids, attached body nodes, per-eye geometry.
- `apps/web/src/agents/avatar/agentAvatarDefinition.ts` composes a per-bot
  `AvatarDefinition` and reproduces the studio's relative-expression rule, so a
  bot's eyes carry across every expression.

`apps/web/src/agents/avatar/baseBehavior.avatar.json` is the project's own
`strobi.avatar.json` example definition (28 expressions, 23 named animations),
redistributed here under the AGPL as the shared behaviour library every
Modesto agent animates from. Only the `name` field was removed; the geometry,
expressions and animations are the author's work, not Modesto's.

**Because this engine is AGPL-3.0-only, Modesto as a whole is now
AGPL-3.0-only** (see `LICENSE`). Modesto was MIT through v0.3.x. Anyone who
runs a modified Modesto over a network must offer that modified source to its
users. Removing these packages is the only way back to a permissive licence,
and it would mean rewriting the avatar engine from scratch.

## DM Sans (boot lockup wordmark)

Project: https://github.com/googlefonts/dm-fonts
Copyright 2014 The DM Sans Project Authors.
License: SIL Open Font License, Version 1.1.

`apps/web/public/fonts/dm-sans-latin-700-normal.woff2`, taken from the
`@fontsource/dm-sans` package. Self-hosted rather than fetched from Google
Fonts so the boot screen renders in the packaged desktop app and offline,
where there is no origin to reach. Only the latin 700 subset ships.

## OpenWork connections catalog (adapted)

Project: https://github.com/different-ai/openwork
License: MIT (outside `/ee`).

`apps/web/src/connections/connectionsCatalog.ts` carries the MCP quick-connect
entries adapted from OpenWork's `apps/app/src/app/constants.ts`
(`MCP_QUICK_CONNECT`), by way of Modesto's own Work marketplace so the entries
stay in one vocabulary rather than being retyped per surface.

Data only: an entry describes what to install, and Modesto's own code decides
where it is written.

## OpenWork automations engine (vendored source)

Project: https://github.com/different-ai/openwork
Upstream copyright: Copyright (c) 2026-present Different AI, Inc.
License: MIT for repository content outside `/ee` (Fair Source under `/ee` is not used).

Unlike the Work surface material below, this is **vendored source**, kept close
to upstream so upstream fixes stay pullable.

Vendored from `packages/automations/src/` and `packages/types/src/automations.ts`:

- `packages/openwork-automations/src/{index,ports,engine,schedule,state,tick,contracts,testing,engine-testing}.ts`
- `packages/openwork-automations/src/types.ts` (from `packages/types/src/automations.ts`)
- `packages/openwork-automations/src/{core,engine}.test.ts`

Modifications, limited to what this repo's build requires:

- `@openwork/types/automations` inlined as `./types.ts`; the rest of
  `@openwork/types` is not vendored.
- `.js` import specifiers rewritten to `.ts`.
- `bun:test` imports rewritten to `vitest`.
- One test fixture in `core.test.ts` gained `executionTarget: "desktop"`, which
  upstream's revision schema requires and that fixture predated.

No Modesto behavior is added here; adapters implementing `ports.ts` and the
engine contract live outside this package.

## OpenWork (Work surface UX + catalog + assets)

Project: https://github.com/different-ai/openwork
Upstream copyright: Copyright (c) 2026-present Different AI, Inc.
License: MIT for repository content outside `/ee` (Fair Source under `/ee` is not used).

Adapted / incorporated material:

- MCP quick-connect catalog entries from `apps/app/src/app/constants.ts` (`MCP_QUICK_CONNECT`)
- Extensions Marketplace tab/filter UX patterns (local installables only)
- Empty-hero copy and layout patterns from `apps/app/src/react-app/domains/session/chat/session-empty-hero.tsx`
- Descriptive button primitives from `apps/app/src/components/descriptive-button.tsx`
- Extension card presentation from `apps/app/src/react-app/design-system/extension-card.tsx`
- Brand extension icons from `apps/app/public/ext-*.svg` and `openwork-mark.svg`

Local files:

- `apps/web/src/components/work/marketplace/marketplaceCatalog.ts`
- `apps/web/src/components/work/marketplace/WorkMarketplacePanel.tsx`
- `apps/web/src/components/work/marketplace/taxonomy.ts`
- `apps/web/src/lib/workConnectionsCatalog.ts` (compat wrapper over marketplace catalog)
- `apps/web/src/components/WorkConnectionsPanel.tsx` (re-exports marketplace panel)
- `apps/web/src/components/work/WorkEmptyHero.tsx`
- `apps/web/src/components/work/WorkExtensionCard.tsx`
- `apps/web/src/components/work/WorkSessionRail.tsx`
- `apps/web/src/components/work/workArtifacts.ts`
- `apps/web/src/components/work/descriptive-button.tsx`
- `apps/web/src/routes/_chat.work.tsx`
- `apps/web/public/work/ext-*.svg`
- `apps/web/public/work/openwork-mark.svg`

Local modifications:

- Reimplemented as Modesto Work mode only (`/work`), wired to Modesto threads, Codex MCP `config.toml`, Settings Provider Tools, Skills, and Plugin Library.
- OpenWork Cloud / Den MCP entries, `/ee` Fair Source org marketplace APIs, OpenCode session sync, and Den auth are not used.
- Added Gmail/Google Calendar/Playwright local MCP entries, Anthropic skills GitHub shelves, and Modesto provider/plugin deep links.
- Restyled onto Modesto design tokens (no OpenWork Radix color scales / Den chrome).
- Expanded Modesto's artifact taxonomy from OpenWork's `apps/app/src/lib/artifacts.ts`,
  then wired supported formats into Modesto's existing permission-gated local file preview.

## Anthropic skills / Claude plugins (external shelves)

Referenced from Work Marketplace as outbound links only (not vendored):

- https://github.com/anthropics/skills (Apache-2.0 examples)
- https://github.com/anthropics/claude-plugins-official
- https://github.com/jeremylongshore/claude-code-plugins

Those repositories remain under their own licenses; Modesto does not redistribute their contents.

MIT notice from OpenWork:

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Device pane 3D handset models

The device pane can render a real handset model behind the live simulator
stream. `apps/web/public/devices/` is empty in this repository: no model is
committed, and the pane falls back to the procedurally drawn chassis in
`apps/web/src/components/device/deviceChassis.ts`, which is Modesto's own work
and depicts no specific product.

Any model added to that directory must record its title, author, license, and
source URL in `DEVICE_MODELS`
(`apps/web/src/components/device/deviceModelRegistry.ts`) and be listed in this
file under a heading of its own.

Note that a Creative Commons license on such a model covers the uploader's
modelling work only. It conveys no rights in the trademarks or the product
industrial design the model depicts, which remain with Apple, Google, Samsung,
or the respective manufacturer. Evaluate the intended use accordingly before
adding one.

## Connection and web-app brand marks

The Connections gallery, composer `@` mentions, slash-command chips, and native
Adobe picker show third-party product marks so a user can recognise an app they
already use. Those marks are not Modesto’s, and displaying them is not a claim
of affiliation, sponsorship, or endorsement.

### Simple Icons (CC0)

Project: https://github.com/simple-icons/simple-icons
License: CC0 1.0 Universal
(https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md)

Most SVG path data in `apps/web/src/components/WebAppIcons.tsx` and
`apps/web/src/components/NativeAppIcons.tsx` (and the Figma chip in
`apps/web/src/components/chat/slashCommandMenuIcon.tsx`) is taken from Simple
Icons and filled with the corresponding brand colour. Simple Icons dedicates
that path data to the public domain under CC0; the underlying trademarks remain
with each brand owner.

### Official product geometry

Where a mark is only recognisable in its official colours or construction
(Google Drive’s triangle, Slack’s four-colour hash, Figma’s five blobs,
Salesforce’s cloud, Higgsfield’s lime well and ribbon), the geometry is taken
from the brand’s published icon rather than approximated.

Higgsfield specifically:

- Glyph path from the Higgsfield site header (`https://higgsfield.ai`,
  `hf-logo__glyph`, viewBox 20×20), drawn on a `#D1FE17` rounded square to
  match the published app icon.
- Raster reference: `apps/web/public/work/ext-higgsfield.png`, copied from
  `https://higgsfield.ai/icon.png` (Higgsfield’s stated organization logo).

Higgsfield, Google, Slack, Figma, Salesforce, Discord, Zoom, Canva, Supabase,
Cloudflare, Neon, PostHog, ClickUp, and the other named products remain
trademarks of their respective owners.

Local files:

- `apps/web/src/components/WebAppIcons.tsx`
- `apps/web/src/components/NativeAppIcons.tsx`
- `apps/web/src/components/chat/slashCommandMenuIcon.tsx`
- `apps/web/public/work/ext-higgsfield.png`

## vscode-icons

The custom file icon symbols in `apps/web/src/pierre-icons.ts` are adapted from
https://github.com/vscode-icons/vscode-icons

Copyright (c) 2016 Roberto Huertas

Licensed under the MIT License. The full license text is available in the
upstream repository: https://github.com/vscode-icons/vscode-icons/blob/master/LICENSE

## Octicons

The Copilot marks in `apps/web/src/components/pullRequest/CopilotMark.tsx` are
the `copilot`, `copilot-error`, and `copilot-warning` icons from
https://github.com/primer/octicons, used verbatim.

Copyright (c) GitHub Inc.

Licensed under the MIT License. The full license text is available in the
upstream repository: https://github.com/primer/octicons/blob/main/LICENSE

## React Bits CRT Warp

The themed sign-in artwork in `apps/web/src/components/auth/signInCrtWarp.ts` is
adapted from the CRTWarp component in https://github.com/DavidHDev/react-bits
(https://reactbits.dev/backgrounds/crt-warp).

Copyright (c) 2026 David Haz.

Licensed under the React Bits repository's MIT license with Commons Clause.
The full license text is available in the upstream repository:
https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md

The local adaptation removes the Three.js dependency, binds the phosphor and
background colors to Modesto's active theme, caps rendering work, and respects
the user's reduced-motion preference.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software as part of an
application, website, or product, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

Commons Clause restriction: You may use this Software, including for any
commercial purpose, so long as you do not sell, sublicense, or redistribute the
components themselves—whether alone, in a bundle, or as a ported version.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Adding third-party material

For any directly copied or adapted code, documentation, icon, image, or other asset, record:

1. Project and source URL
2. Upstream copyright holder
3. License and required notice text
4. Files incorporated or adapted
5. Local modifications

Do not remove notices required by MIT, Apache-2.0, GPL, or any other applicable license.
