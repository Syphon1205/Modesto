#!/usr/bin/env python3
"""
Generate a razor-sharp, colorful kinetic typography video for Modesto 0.4.0 Berkeley.
- Pure solid black background (#000000).
- ZERO ghosting / double-text collision: exactly ONE crystal-clear word on screen at a time.
- Vibrant, saturated custom gradient text for each feature with soft luminous glow.
- Butter-smooth 60fps micro-spring scale blooms (0.94 -> 1.02).
- Seamless acceleration curve from rhythmic beats into rapid kinetic flicker.
- Clean blackout beat cut to 0.4.0 Berkeley.
"""

import math
import os
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

WIDTH = 1080
HEIGHT = 1920
FPS = 60

FONT_PATH = "/System/Library/Fonts/Avenir.ttc"
FONT_INDEX = 2  # Avenir Black


def get_font(size):
    return ImageFont.truetype(FONT_PATH, size, index=FONT_INDEX)


def ease_out_cubic(x):
    return 1.0 - math.pow(1.0 - x, 3)


# Feature list with curated, radiant color gradients
# (Word, font_size, gradient_top_RGB, gradient_bottom_RGB)
FEATURES = [
    ("Chats", 152, (74, 222, 128), (34, 197, 94)),          # Radiant Emerald
    ("Work", 152, (56, 189, 248), (14, 165, 233)),          # Electric Cyan
    ("Snapshots", 136, (45, 212, 191), (16, 185, 129)),      # Aqua Mint
    ("Music", 152, (244, 114, 182), (192, 132, 252)),       # Hot Pink to Violet
    ("Artifacts", 136, (251, 191, 36), (249, 115, 22)),      # Amber Sunburst
    ("Browser", 146, (96, 165, 250), (59, 130, 246)),        # Electric Sky Blue
    ("Simulator", 136, (52, 211, 153), (20, 184, 166)),      # Seafoam Teal
    ("Pull Requests", 114, (251, 113, 133), (244, 63, 94)),  # Radiant Coral
    ("Stacks", 152, (163, 230, 53), (74, 222, 128)),         # Neon Lime Green
    ("Review", 152, (167, 139, 250), (139, 92, 246)),       # Electric Purple
    ("Automations", 126, (251, 146, 60), (234, 88, 12)),     # Vivid Orange
    ("Context Graph", 114, (34, 211, 238), (59, 130, 246)),  # Cyan to Cobalt
    ("Multi-Agent", 134, (232, 121, 249), (168, 85, 247)),   # Orchid Purple
    ("Local-First", 138, (110, 231, 183), (5, 150, 105)),     # Mint Emerald
    ("Open Source", 128, (74, 222, 128), (22, 163, 74)),     # Laser Green
    ("And much more.", 114, (255, 255, 255), (203, 213, 225)),  # Pure White
]

# Durations for each word (in seconds) — NO overlapping cross-fade
# Clean, crisp sequential timing that accelerates smoothly
WORD_DURATIONS = [
    0.44,  # Chats
    0.40,  # Work
    0.36,  # Snapshots
    0.33,  # Music
    0.30,  # Artifacts
    0.28,  # Browser
    0.26,  # Simulator
    0.24,  # Pull Requests
    0.22,  # Stacks
    0.20,  # Review
    0.18,  # Automations
    0.17,  # Context Graph
    0.16,  # Multi-Agent
    0.15,  # Local-First
    0.14,  # Open Source
    0.46,  # And much more.
]

# Build timeline: strictly contiguous non-overlapping intervals
timeline = []
current_time = 0.20

for i, (word, size, c_start, c_end) in enumerate(FEATURES):
    dur = WORD_DURATIONS[i]
    start = current_time
    end = start + dur
    timeline.append({
        "index": i,
        "text": word,
        "size": size,
        "c_start": c_start,
        "c_end": c_end,
        "start": start,
        "end": end,
    })
    current_time = end

words_end_time = timeline[-1]["end"]

PAUSE_DURATION = 0.35  # Clean blackout beat
REVEAL_START = words_end_time + PAUSE_DURATION
REVEAL_DURATION = 2.60
TOTAL_DURATION = REVEAL_START + REVEAL_DURATION
TOTAL_FRAMES = int(TOTAL_DURATION * FPS)

WORD_CACHE = {}


def pre_render_word(text, font_size, c_start, c_end):
    font = get_font(font_size)
    dummy = Image.new("RGBA", (1, 1))
    d_dummy = ImageDraw.Draw(dummy)
    bbox = d_dummy.textbbox((0, 0), text, font=font)
    pad = 60
    tw = (bbox[2] - bbox[0]) + pad * 2
    th = (bbox[3] - bbox[1]) + pad * 2

    mask = Image.new("L", (tw, th), 0)
    d_mask = ImageDraw.Draw(mask)
    d_mask.text((pad - bbox[0], pad - bbox[1]), text, font=font, fill=255)

    grad = Image.new("RGBA", (tw, th))
    gdraw = ImageDraw.Draw(grad)
    for y in range(th):
        p = y / float(th)
        r = int(c_start[0] + p * (c_end[0] - c_start[0]))
        g = int(c_start[1] + p * (c_end[1] - c_start[1]))
        b = int(c_start[2] + p * (c_end[2] - c_start[2]))
        gdraw.line([(0, y), (tw, y)], fill=(r, g, b, 255))

    text_img = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    text_img.paste(grad, mask=mask)

    # Clean soft ambient glow
    glow_mask = mask.filter(ImageFilter.GaussianBlur(32))
    glow_img = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    mid_color = (
        int((c_start[0] + c_end[0]) / 2),
        int((c_start[1] + c_end[1]) / 2),
        int((c_start[2] + c_end[2]) / 2),
        90,
    )
    glow_fill = Image.new("RGBA", (tw, th), mid_color)
    glow_img.paste(glow_fill, mask=glow_mask)

    combined = Image.alpha_composite(glow_img, text_img)
    return combined, tw, th


print("Pre-rendering clean colorful text assets...")
for item in FEATURES:
    img, tw, th = pre_render_word(item[0], item[1], item[2], item[3])
    WORD_CACHE[item[0]] = (img, tw, th)

# Final Reveal Text
img_ver, tw_ver, th_ver = pre_render_word("0.4.0", 154, (255, 255, 255), (225, 235, 245))
WORD_CACHE["0.4.0"] = (img_ver, tw_ver, th_ver)

img_berk, tw_berk, th_berk = pre_render_word("Berkeley.", 154, (52, 211, 153), (56, 189, 248))
WORD_CACHE["Berkeley."] = (img_berk, tw_berk, th_berk)


def render_frame(frame_num):
    t = frame_num / FPS

    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 255))
    cx, cy = WIDTH // 2, HEIGHT // 2

    # Find the single active feature word
    active_word = None
    for item in timeline:
        if item["start"] <= t < item["end"]:
            active_word = item
            break

    if active_word is not None:
        text = active_word["text"]
        base_img, tw, th = WORD_CACHE[text]

        start = active_word["start"]
        dur = active_word["end"] - start
        progress = (t - start) / dur

        # Smooth cubic bloom: scale blooms smoothly from 0.95 up to 1.025
        # No jitter, perfectly centered
        scale_e = ease_out_cubic(min(1.0, progress * 1.6))
        scale = 0.95 + scale_e * 0.075

        sw = int(tw * scale)
        sh = int(th * scale)
        scaled_img = base_img.resize((sw, sh), Image.Resampling.BILINEAR)

        px = cx - sw // 2
        py = cy - sh // 2
        canvas.alpha_composite(scaled_img, (px, py))

    # Climax Reveal: "0.4.0" and "Berkeley."
    elif t >= REVEAL_START:
        rev_t = t - REVEAL_START
        rev_progress = min(1.0, rev_t / 0.32)
        scale_e = ease_out_cubic(rev_progress)
        # Smooth entrance bloom, then gentle cinematic hold
        scale = 0.94 + scale_e * 0.08 + (rev_t / REVEAL_DURATION) * 0.02

        # 0.4.0
        img_v, tw_v, th_v = WORD_CACHE["0.4.0"]
        sw_v = int(tw_v * scale)
        sh_v = int(th_v * scale)
        s_v = img_v.resize((sw_v, sh_v), Image.Resampling.BILINEAR)
        canvas.alpha_composite(s_v, (cx - sw_v // 2, cy - 95 - sh_v // 2))

        # Berkeley. (Luminous Emerald -> Cyan)
        img_b, tw_b, th_b = WORD_CACHE["Berkeley."]
        sw_b = int(tw_b * scale)
        sh_b = int(th_b * scale)
        s_b = img_b.resize((sw_b, sh_b), Image.Resampling.BILINEAR)
        canvas.alpha_composite(s_b, (cx - sw_b // 2, cy + 95 - sh_b // 2))

    return canvas.convert("RGB")


def main():
    output_dir = "apps/marketing/public/announcements"
    os.makedirs(output_dir, exist_ok=True)
    output_mp4 = os.path.join(output_dir, "modesto-0.4.0-berkeley-colorful.mp4")

    print(f"Rendering Razor-Clean Colorful 9:16 Video ({WIDTH}x{HEIGHT} @ {FPS}fps)...")
    print(f"Total frames: {TOTAL_FRAMES} ({TOTAL_DURATION:.2f}s)")

    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{WIDTH}x{HEIGHT}",
        "-pix_fmt", "rgb24",
        "-r", str(FPS),
        "-i", "-",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        "-crf", "16",
        output_mp4
    ]

    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for f in range(TOTAL_FRAMES):
        frame_img = render_frame(f)
        proc.stdin.write(frame_img.tobytes())
        if f % 60 == 0:
            pct = (f / TOTAL_FRAMES) * 100
            sys.stdout.write(f"\rProgress: {pct:.1f}% (frame {f}/{TOTAL_FRAMES})")
            sys.stdout.flush()

    proc.stdin.close()
    proc.wait()
    print("\nVideo successfully generated!")

    file_size_mb = os.path.getsize(output_mp4) / (1024 * 1024)
    print(f"Output saved to: {output_mp4} ({file_size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
