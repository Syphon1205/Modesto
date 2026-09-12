# Third-party notices

Modesto includes and depends on third-party open-source software. The authoritative dependency inventory is the workspace `package.json` files and `bun.lock`; each dependency remains subject to its own license and copyright notices.

## Repository foundation

Modesto’s original product source is proprietary (see `LICENSE`). Third-party
open-source dependencies keep their own copyright notices and licenses. Do not
remove notices required by those dependencies.

## Major runtime dependencies

- React and React DOM — MIT
- Electron — MIT
- Vite — MIT
- TanStack Router, Query, Virtual, and Pacer — MIT
- Effect and Effect platform packages — MIT
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

## Connection and web-app brand marks

The Connections gallery, composer `@` mentions, slash-command chips, and native
Adobe picker show third-party product marks so a user can recognise an app they
already use. Those marks are not Modesto’s, and displaying them is not a claim
of affiliation, sponsorship, or endorsement.

### Simple Icons (CC0)

Project: https://github.com/simple-icons/simple-icons
License: CC0 1.0 Universal
(https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md)

Most SVG path data for those product marks is taken from Simple Icons and
filled with the corresponding brand colour. Simple Icons dedicates that path
data to the public domain under CC0; the underlying trademarks remain with
each brand owner.

### Official product geometry

Where a mark is only recognisable in its official colours or construction
(Google Drive’s triangle, Slack’s four-colour hash, Figma’s five blobs,
Salesforce’s cloud, Higgsfield’s lime well and ribbon), the geometry is taken
from the brand’s published icon rather than approximated.

Higgsfield specifically: the ribbon glyph from the Higgsfield site header
(`https://higgsfield.ai`, `hf-logo__glyph`) drawn on a `#D1FE17` rounded square
to match the published app icon at `https://higgsfield.ai/icon.png`.

Higgsfield, Google, Slack, Figma, Salesforce, Discord, Zoom, Canva, Supabase,
Cloudflare, Neon, PostHog, ClickUp, and the other named products remain
trademarks of their respective owners.

## Adding third-party material

For any directly copied or adapted code, documentation, icon, image, or other asset, record:

1. Project and source URL
2. Upstream copyright holder
3. License and required notice text
4. Files incorporated or adapted
5. Local modifications

Do not remove notices required by MIT, Apache-2.0, GPL, or any other applicable license.
