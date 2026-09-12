# Modesto 1.0.0-alpha.1 teasers

Silent films for the public alpha. Review them on
`/announcements/alpha-teasers/preview.html` — not on the marketing site nav.

## Billboard cuts

The 101-corridor idiom: one statement, read in two seconds. Type fills the
frame, one accent, nothing moves that doesn't need to. Shared type and frame
system lives in `billboard.css`.

| Style               | File              | Length | What it is                                                  |
| ------------------- | ----------------- | ------ | ----------------------------------------------------------- |
| Every agent.        | `bb-lineup.html`  | 16s    | The canonical line, with the full provider roster between.  |
| Switch models.      | `bb-thread.html`  | 15s    | Three models, one thread. The product surface, shown large. |
| Claude plans.       | `bb-handoff.html` | 16s    | Three statements, then the relay. Marks set at type size.   |
| No folder required. | `bb-folder.html`  | 14s    | A chat that starts before a project does.                   |

## Social 3D

| Style                | File           | Length | What it is                                                            |
| -------------------- | -------------- | ------ | --------------------------------------------------------------------- |
| The mark, in chrome. | `ig-mark.html` | 12s    | Vertical-first. The Handoff Mark as real geometry, in polished metal. |

## Original motion studies

| Style     | File             | Length | What it is                              |
| --------- | ---------------- | ------ | --------------------------------------- |
| Editorial | `editorial.html` | 16s    | Type-led. The version, said plainly.    |
| Handoff   | `handoff.html`   | 16s    | One brief. Three agents. Context stays. |
| Paper     | `paper.html`     | 14s    | Cream field. Lime as a fill.            |
| Workspace | `workspace.html` | 16s    | Chats without a project.                |
| Desktop   | `desktop.html`   | 16s    | Environments, usage clock, Grok.        |

## Signal cuts

The product, said the way the product talks. One state. One line. The same
flicker grids and labels as the transcript. Each cut is one HTML file; light
and dark are `?theme=light` / `?theme=dark` (preview Dark/Light toggle). Dark
is ink `#10120F` with paper type. Light is paper `#EFE7D6` with ink type.
Flicker cells use `currentColor` (on) and an 18% mix (off) — no lime glow.

Grids keep ticking for the full duration, driven from the film clock.

| Style                   | File                     | Length | What it is                              |
| ----------------------- | ------------------------ | ------ | --------------------------------------- |
| Thinking                | `working.html`           | 12s    | Choo-choo flicker + the word.           |
| Working for             | `signal-working.html`    | 12s    | Syncing flicker + the live timer.       |
| 2 Working               | `signal-busy.html`       | 12s    | Busy flicker + the composer pill.       |
| Reading                 | `signal-read.html`       | 12s    | Searching flicker + a real filename.    |
| Claude. Codex.          | `signal-switch.html`     | 12s    | Mid-thread handoff. Marks, then a name. |
| CHECKPOINT_184          | `signal-checkpoint.html` | 10s    | System Mono evidence.                   |
| Context carried forward | `signal-context.html`    | 10s    | Lime dot + the brand line.              |

Switch, checkpoint, and context have no grid — the product does not show one
on those states.

## Original close

| Style | File         | Length | What it is                   |
| ----- | ------------ | ------ | ---------------------------- |
| Rings | `rings.html` | 14s    | Handoff Mark + saturn rings. |

## Rendering cost

Everything except `ig-*.html` is CSS and GSAP driving transform/opacity only —
no per-frame JavaScript and no WebGL, so the live preview stays cheap on any
device. The 3D social films use WebGL (`three-stage.js`) and are intended to
be captured to MP4 once and distributed as video, not embedded live.

## Capture

`?ratio=16x9`, `?ratio=9x16`, and `?ratio=1x1` preserve composition.
`?theme=dark` or `?theme=light` bakes the Signal field. `&paused=1&t=4` opens
a still. Await `window.__ready`, then `window.__setTime(seconds)` for
deterministic frame capture — every film draws purely as a function of
timeline time, so the same `t` always yields the same frame. Reduced-motion
viewers start on a still and can play explicitly.

Download from the preview: **Download** encodes the current film, ratio, and
theme (light/dark on Signal cuts) to a silent MP4 via Playwright + ffmpeg.
Files land in `exports/` as `modesto-alpha-{slug}-{ratio}-{theme}.mp4`. The
button talks to `/__teaser-capture` on the marketing dev server, or the
sidecar at `http://127.0.0.1:4175/capture`:

```
bun apps/marketing/scripts/capture-alpha-teaser.mjs --serve
```

CLI for one file:

```
bun apps/marketing/scripts/capture-alpha-teaser.mjs \
  --file working.html --ratio 16x9 --theme dark --duration 12 \
  --filename modesto-alpha-thinking-16x9-dark.mp4
```
