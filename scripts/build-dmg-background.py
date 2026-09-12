#!/usr/bin/env python3
"""Generate the macOS DMG background art.

The DMG window is the first thing anyone sees of Modesto, and Finder gives it
no chrome of its own: whatever this draws *is* the installer. So it follows the
brand system in `apps/marketing/src/styles/brand-tokens.css` — a near-black
field with a faint green cast, exactly one signal colour, Manrope set large and
calm, micro-labels all-caps and letter-spaced.

Two things this has to get right that a hand-authored SVG kept getting wrong:

1.  **Size.** `dmg-builder` spreads the explicit `window` option *after* the
    size it measures from the background image, so the window wins and a
    larger image is cropped to its top-left corner rather than scaled. The art
    must therefore be authored at exactly the window size in
    `desktop-platform-build-config.ts` (660x420 points), and emitted at 2x for
    retina. The SVG declares 1320x840 so `sips` rasterizes it crisply at 2x;
    the build downsamples that for the 1x companion.

2.  **Fonts.** The build rasterizes with `sips`, whose SVG support will not
    load a webfont, so every glyph here is emitted as a path. Manrope is OFL
    and already vendored for the brand site, which is what makes embedding its
    outlines fine.

Manrope carries the micro-labels too, all-caps and letter-spaced, rather than
the mono face the brand system names — vendoring a second font to set two
eleven-character labels is not worth it, and the treatment is what reads.

Run after editing the layout or copy; commit the SVGs it writes:

    python3 scripts/build-dmg-background.py
"""

from __future__ import annotations

import argparse
import math
import pathlib
import re
from dataclasses import dataclass

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

REPO = pathlib.Path(__file__).resolve().parent.parent
FONT = REPO / "apps/marketing/public/announcements/modesto-saas-assets/vendor/manrope.ttf"
OUT_DIR = REPO / "apps/desktop/resources/dmg"

# Window size from `desktop-platform-build-config.ts`. These must stay in step:
# see the module docstring for what happens when they do not.
W, H = 700, 500
SCALE = 2  # Retina; the build downsamples for the 1x companion.

# Icon centres and size, also from the build config. Everything else is placed
# relative to these so the art can never drift away from where Finder actually
# puts the two icons.
APP_ICON = (210, 230)
APPLICATIONS_ICON = (490, 230)
ICON_SIZE = 112

# The ring: a tilted orbit carrying every agent Modesto supports, ported from
# the site's WebGL signature in `apps/marketing/public/brand/modesto-3d.js`.
#
# Its whole point there is that it frames a protected opening rather than
# filling the frame, and the opening is what the eye lands in. Here that opening
# holds the install gesture, so the orbit is sized to clear the icons, their
# labels, and the caption — the window is 700x500 rather than something tighter
# precisely so it can.
RING_CENTER = (350, 250)
RING_RX, RING_RY = 320, 205
RING_TILT_DEG = -6.0
RING_TILE = 23

# The order they ride the orbit, from modesto-3d.js. Bare marks carry no text,
# so the slug is all this needs.
RING_PROVIDERS = (
    "codex",
    "gemini",
    "kilo",
    "claude",
    "devin",
    "opencode",
    "qwen",
    "cursor",
    "poolside",
    "grok",
    "kimi",
    "droid",
    "meta",
    "copilot",
    "pi",
)

MARKS_DIR = REPO / "apps/marketing/public/brand/marks"

# brand-tokens.css
INK = "#10120f"
PANEL = "#171a14"
FOREGROUND = "#eceee6"
MUTED = "#8b9681"
DIM = "#6d7864"
TILE_CASE = "#2b3227"
LIME = "#d5f995"
LIME_DIM = "#bbd996"


@dataclass(frozen=True)
class Variant:
    name: str
    label: str
    accent: str


VARIANTS = (
    Variant(name="latest", label="LATEST RELEASE", accent=LIME),
    # The nightly build differentiates by label and by a dimmer accent, never by
    # a second colour — rule 2 of the brand system.
    Variant(name="nightly", label="NIGHTLY BUILD", accent=LIME_DIM),
)

_font_cache: dict[int, tuple[object, dict, int]] = {}


def _font_at(weight: int):
    """Manrope instanced at one weight, with its glyph set and units-per-em."""
    cached = _font_cache.get(weight)
    if cached is not None:
        return cached
    font = instancer.instantiateVariableFont(TTFont(FONT), {"wght": weight})
    entry = (font.getGlyphSet(), font.getBestCmap(), font["head"].unitsPerEm)
    _font_cache[weight] = entry
    return entry


def text_path(
    text: str,
    *,
    x: float,
    y: float,
    size: float,
    weight: int = 500,
    tracking: float = 0.0,
    anchor: str = "start",
    fill: str = FOREGROUND,
) -> str:
    """One <path> per glyph of `text`, positioned the way SVG text would be.

    `x`/`y` are the start of the baseline, or its centre/end for the other
    anchors. `tracking` is extra spacing in the same units as `size`.

    The fill is written onto every path rather than inherited from a wrapping
    group: the root <svg> carries `fill="none"` for the stroked artwork, and a
    glyph that forgets to override it disappears silently.
    """
    glyphs, cmap, upem = _font_at(weight)
    unit = size / upem

    runs: list[tuple[str, float]] = []
    width = 0.0
    for character in text:
        name = cmap.get(ord(character))
        if name is None:
            # A glyph the font does not carry would silently vanish; a visible
            # gap is easier to catch than a missing letter.
            width += size * 0.4 + tracking
            continue
        glyph = glyphs[name]
        pen = SVGPathPen(glyphs)
        glyph.draw(pen)
        runs.append((pen.getCommands(), width))
        width += glyph.width * unit + tracking
    if runs and tracking:
        width -= tracking

    offset = {"start": 0.0, "middle": -width / 2, "end": -width}[anchor]

    parts = []
    for commands, advance in runs:
        if not commands:
            continue
        # Glyph outlines are Y-up in font units; SVG user space is Y-down.
        parts.append(
            f'<path fill="{fill}" transform="translate({x + offset + advance:.3f} {y:.3f}) '
            f'scale({unit:.6f} {-unit:.6f})" d="{commands}"/>'
        )
    return "".join(parts)


def handoff_mark(x: float, y: float, size: float, colour: str) -> str:
    """The Handoff Mark from `apps/marketing/public/modesto-logo.svg`, scaled.

    Four converging strokes: many paths, one direction. Authored on a 100-unit
    grid, so the stroke weight scales with the box.
    """
    unit = size / 100
    return (
        f'<g transform="translate({x} {y}) scale({unit:.6f})" fill="none" '
        f'stroke="{colour}" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round">'
        '<path d="M18 32H39C42 32 43.5 30.5 45 28L55 12"/>'
        '<path d="M66 20L60 32C58 36 59 39 62 42L81 58"/>'
        '<path d="M14 45L35 51C39 52 41 55 41 59V80"/>'
        '<path d="M57 58L70 70"/>'
        "</g>"
    )



# ── The ring ─────────────────────────────────────────────────────────


def _mark_inner(slug: str) -> tuple[str, float, float]:
    """A provider mark's drawable content and its own coordinate box.

    The marks are authored as standalone files with their own viewBoxes and a
    black fill on the root element. Inlining them means dropping that root,
    keeping the box so the tile can scale to it, and namespacing every id —
    several marks define gradients and masks, and fifteen of them in one
    document would otherwise collide on `#a`.
    """
    source = (MARKS_DIR / f"{slug}.svg").read_text(encoding="utf-8")
    view_box = re.search(r'viewBox="([\d.\-\s]+)"', source)
    if view_box is None:
        raise SystemExit(f"{slug}.svg has no viewBox")
    numbers = [float(value) for value in view_box.group(1).split()]
    width, height = numbers[2], numbers[3]

    inner = source[source.index(">", source.index("<svg")) + 1 :]
    inner = inner[: inner.rindex("</svg>")]

    # `id="x"` and every `url(#x)` / `href="#x"` that points at it.
    for raw_id in set(re.findall(r'id="([^"]+)"', inner)):
        scoped = f"dmg-{slug}-{raw_id}"
        inner = inner.replace(f'id="{raw_id}"', f'id="{scoped}"')
        inner = inner.replace(f"url(#{raw_id})", f"url(#{scoped})")
        inner = inner.replace(f'href="#{raw_id}"', f'href="#{scoped}"')
    # Marks are authored black-on-light. The tile is dark, so any explicit
    # black has to go — the wrapping group's fill only reaches paths that did
    # not declare one.
    for black in ('fill="#000"', 'fill="#000000"', 'fill="black"'):
        inner = inner.replace(black, 'fill="currentColor"')
    return inner, width, height


def _ellipse_points(samples: int = 2048) -> list[tuple[float, float, float]]:
    """(angle, x, y) around the orbit, before the tilt is applied."""
    return [
        (
            angle := 2 * math.pi * index / samples,
            RING_RX * math.cos(angle),
            RING_RY * math.sin(angle),
        )
        for index in range(samples)
    ]


def _arc_length_angles(count: int) -> list[float]:
    """`count` angles spaced by equal distance along the ellipse, not by angle.

    Spacing marks by angle bunches them at the ends of an ellipse — the first of
    the two details modesto-3d.js calls out as carrying the whole effect.
    """
    points = _ellipse_points()
    cumulative = [0.0]
    for index in range(1, len(points) + 1):
        previous = points[index - 1]
        current = points[index % len(points)]
        cumulative.append(
            cumulative[-1] + math.hypot(current[1] - previous[1], current[2] - previous[2])
        )
    total = cumulative[-1]

    angles: list[float] = []
    cursor = 0
    for index in range(count):
        target = total * index / count
        while cumulative[cursor + 1] < target:
            cursor += 1
        angles.append(points[cursor][0])
    return angles


def ring(accent: str) -> str:
    """The orbit and its riders, as static vector.

    Depth is faked the way the film does it: the near half of the orbit — the
    bottom, once tilted — carries larger, brighter, fully opaque tiles, and the
    far half recedes. Without that the ellipse reads as a flat oval rather than
    a circle seen at an angle.
    """
    cx, cy = RING_CENTER
    tilt = math.radians(RING_TILT_DEG)
    cos_t, sin_t = math.cos(tilt), math.sin(tilt)

    def place(angle: float) -> tuple[float, float]:
        x, y = RING_RX * math.cos(angle), RING_RY * math.sin(angle)
        return cx + x * cos_t - y * sin_t, cy + x * sin_t + y * cos_t

    parts = [
        f'<g transform="rotate({RING_TILT_DEG} {cx} {cy})">'
        f'<ellipse cx="{cx}" cy="{cy}" rx="{RING_RX}" ry="{RING_RY}" fill="none" '
        f'stroke="{accent}" stroke-opacity="0.10" stroke-width="1"/>'
        # The near half brightens, so the orbit itself reads as turning toward you.
        f'<path d="M{cx - RING_RX} {cy}a{RING_RX} {RING_RY} 0 0 0 {2 * RING_RX} 0" fill="none" '
        f'stroke="{accent}" stroke-opacity="0.22" stroke-width="1.2"/>'
        "</g>"
    ]

    for slug, angle in zip(RING_PROVIDERS, _arc_length_angles(len(RING_PROVIDERS))):
        x, y = place(angle)
        # +1 at the near point of the orbit, -1 at the far one.
        depth = math.sin(angle)
        size = RING_TILE * (0.78 + 0.3 * (depth + 1) / 2)
        opacity = 0.34 + 0.62 * (depth + 1) / 2
        half = size / 2

        inner, mark_w, mark_h = _mark_inner(slug)
        inset = size * 0.2
        glyph = size - 2 * inset
        scale = glyph / max(mark_w, mark_h)

        parts.append(
            f'<g opacity="{opacity:.3f}">'
            f'<rect x="{x - half:.2f}" y="{y - half:.2f}" width="{size:.2f}" height="{size:.2f}" '
            f'rx="{size * 0.24:.2f}" fill="{TILE_CASE}" stroke="{accent}" stroke-opacity="0.2" '
            f'stroke-width="0.9"/>'
            f'<g fill="{FOREGROUND}" color="{FOREGROUND}" transform="translate({x - glyph / 2:.2f} {y - glyph / 2:.2f}) '
            f'scale({scale:.5f})">{inner}</g>'
            "</g>"
        )
    return "".join(parts)


def build(variant: Variant) -> str:
    app_x, app_y = APP_ICON
    dest_x, dest_y = APPLICATIONS_ICON
    half = ICON_SIZE / 2

    # The well the Applications alias lands in. Finder draws the alias on top;
    # this is what makes the drop target legible before anything has moved.
    # Kept to a hairline: the ring is already doing the framing, and two boxes
    # competing for the same job is how a window stops reading as one object.
    slot_w, slot_h = 156, 164
    slot_x = dest_x - slot_w / 2
    slot_y = dest_y - half - 24

    # The travel line runs between the app icon and the well, never under either.
    trail_start = app_x + half + 20
    trail_end = slot_x - 12

    # Step numbers clear the well rather than the icon.
    step_y = slot_y - 14
    algn_caption = 374

    return f"""<svg width="{W * SCALE}" height="{H * SCALE}" viewBox="0 0 {W} {H}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Generated by scripts/build-dmg-background.py — edit that, not this. -->
  <defs>
    <radialGradient id="bloom" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
      gradientTransform="translate({W - 80} 10) rotate(142) scale(480 320)">
      <stop stop-color="{variant.accent}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="{variant.accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="trail" x1="{trail_start}" y1="0" x2="{trail_end}" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="{variant.accent}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="{variant.accent}" stop-opacity="0.8"/>
    </linearGradient>
  </defs>

  <rect width="{W}" height="{H}" fill="{INK}"/>
  <rect width="{W}" height="{H}" fill="url(#bloom)"/>

  {ring(variant.accent)}

  <!-- Header: the mark, the wordmark, and which build this is. -->
  {handoff_mark(40, 33, 25, variant.accent)}
  {text_path("MODESTO", x=76, y=53, size=17, weight=700, tracking=0.3)}
  {text_path(variant.label, x=W - 40, y=50, size=8.5, weight=600, tracking=1.7, anchor="end", fill=DIM)}

  <!-- The well the Applications alias drops into. -->
  <rect x="{slot_x}" y="{slot_y}" width="{slot_w}" height="{slot_h}" rx="28"
    fill="{INK}" fill-opacity="0.5" stroke="{variant.accent}" stroke-opacity="0.18"
    stroke-width="1.1"/>

  <!-- Travel line from the app to the well. Dotted so it reads as a path taken
       rather than a rule, and brightening toward the destination. -->
  <path d="M{trail_start} {app_y}H{trail_end - 10}" stroke="url(#trail)" stroke-width="1.75"
    stroke-linecap="round" stroke-dasharray="1.5 7"/>
  <path d="M{trail_end - 12} {app_y - 6}L{trail_end - 2} {app_y}L{trail_end - 12} {app_y + 6}"
    stroke="{variant.accent}" stroke-opacity="0.9" stroke-width="1.9"
    stroke-linecap="round" stroke-linejoin="round"/>

  {text_path("01", x=app_x, y=step_y, size=8.5, weight=700, tracking=1.6, anchor="middle", fill=DIM)}
  {text_path("02", x=dest_x, y=step_y, size=8.5, weight=700, tracking=1.6, anchor="middle", fill=DIM)}

  <!-- Caption. Clear, calm, specific: what to do, then what happens next. -->
  {text_path("Drag Modesto to Applications", x=W / 2, y=algn_caption, size=16, weight=600, tracking=-0.1, anchor="middle")}
  {text_path("Then launch it from Applications.", x=W / 2, y=algn_caption + 22, size=11, weight=400, anchor="middle", fill=MUTED)}
  {text_path("TRYMODESTO.COM", x=W / 2, y=algn_caption + 48, size=7.5, weight=600, tracking=1.5, anchor="middle", fill=DIM)}
</svg>
"""


def preview(variant: Variant) -> str:
    """The background with stand-in icons where Finder will actually draw them.

    The art is unreadable on its own — most of its job is framing two icons that
    are not in the file. This composites them so a layout change can be judged
    against what the window will really look like.
    """
    body = build(variant)
    app_x, app_y = APP_ICON
    dest_x, dest_y = APPLICATIONS_ICON
    half = ICON_SIZE / 2
    stand_ins = (
        f'<g opacity="0.9">'
        f'<rect x="{app_x - half}" y="{app_y - half}" width="{ICON_SIZE}" height="{ICON_SIZE}" '
        f'rx="24" fill="#2b3324" stroke="{LIME}" stroke-opacity="0.5"/>'
        + text_path("Modesto", x=app_x, y=app_y + half + 16, size=11, anchor="middle")
        + f'<rect x="{dest_x - half}" y="{dest_y - half}" width="{ICON_SIZE}" height="{ICON_SIZE}" '
        f'rx="24" fill="#2a2d33" stroke="#8b9681" stroke-opacity="0.45"/>'
        + text_path("Applications", x=dest_x, y=dest_y + half + 16, size=11, anchor="middle")
        + "</g>"
    )
    return body.replace("</svg>", stand_ins + "\n</svg>")


def main() -> None:
    if not FONT.exists():
        raise SystemExit(f"Manrope is missing at {FONT}")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--preview-dir",
        help="Also write composited previews with stand-in icons, for judging a layout change.",
    )
    args = parser.parse_args()

    for variant in VARIANTS:
        target = OUT_DIR / f"dmg-background-{variant.name}.svg"
        target.write_text(build(variant), encoding="utf-8")
        print(f"wrote {target.relative_to(REPO)}")
        if args.preview_dir:
            preview_path = pathlib.Path(args.preview_dir) / f"preview-{variant.name}.svg"
            preview_path.write_text(preview(variant), encoding="utf-8")
            print(f"wrote {preview_path}")


if __name__ == "__main__":
    main()
