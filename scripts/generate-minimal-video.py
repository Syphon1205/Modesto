#!/usr/bin/env python3
"""
Generate a minimalist 9:16 (1080x1920 @ 60fps) vertical kinetic typography video.
Pure plain background (solid black) with bold, clean, centered text.
Buttery smooth 60fps easing transitions: words glide up and cross-fade smoothly into
each other, accelerating in tempo, then cutting to the 0.4.0 Berkeley. release name.
"""

import math
import os
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont

WIDTH = 1080
HEIGHT = 1920
FPS = 60

COLOR_BG = (0, 0, 0)
COLOR_TEXT = (255, 255, 255)

FONT_PATH = "/System/Library/Fonts/HelveticaNeue.ttc"
FONT_INDEX = 1  # Helvetica Neue Bold


def get_font(size):
    return ImageFont.truetype(FONT_PATH, size, index=FONT_INDEX)


# Smooth easing curves
def ease_out_cubic(x):
    return 1.0 - math.pow(1.0 - x, 3)


def ease_in_cubic(x):
    return math.pow(x, 3)


def ease_in_out_sine(x):
    return -(math.cos(math.pi * x) - 1.0) / 2.0


# Words in sequence as requested by the user
# (text, target_font_size)
WORDS = [
    ("Chats", 140),
    ("Work", 140),
    ("Snapshots", 124),
    ("Music", 140),
    ("Artifacts", 124),
    ("Browser", 136),
    ("Simulator", 124),
    ("Pull Requests", 106),
    ("Stacks", 140),
    ("Review", 140),
    ("Automations", 120),
    ("Context Graph", 106),
    ("Multi-Agent", 120),
    ("Local-First", 130),
    ("Open Source", 120),
    ("And much more.", 108),
]

# Durations for each word in seconds (smooth acceleration ramp)
# Starts steady, builds speed, finishes on 'And much more.'
WORD_DURATIONS = [
    0.46,  # Chats
    0.42,  # Work
    0.38,  # Snapshots
    0.35,  # Music
    0.32,  # Artifacts
    0.29,  # Browser
    0.27,  # Simulator
    0.25,  # Pull Requests
    0.23,  # Stacks
    0.21,  # Review
    0.19,  # Automations
    0.18,  # Context Graph
    0.17,  # Multi-Agent
    0.16,  # Local-First
    0.15,  # Open Source
    0.45,  # And much more.
]

# Build timeline
# Each word has start_time and end_time
timeline = []
current_time = 0.20  # brief 0.2s initial beat

for i, (word, size) in enumerate(WORDS):
    dur = WORD_DURATIONS[i]
    start = current_time
    end = start + dur
    timeline.append({
        "index": i,
        "text": word,
        "size": size,
        "start": start,
        "end": end,
    })
    # Transitions overlap: next word starts slightly before current word fully finishes
    # Transition overlap is 0.10s to 0.14s
    trans_time = min(0.12, dur * 0.45)
    current_time = end - trans_time

# Total time for words
words_end_time = timeline[-1]["end"]

# Stillness beat between features and reveal
PAUSE_DURATION = 0.35
REVEAL_START = words_end_time + PAUSE_DURATION
REVEAL_DURATION = 2.60
TOTAL_DURATION = REVEAL_START + REVEAL_DURATION
TOTAL_FRAMES = int(TOTAL_DURATION * FPS)


def get_active_elements(t):
    """
    Given time t, returns list of active texts with (text, size, y_offset, alpha)
    """
    elements = []

    # Check the feature list words
    for item in timeline:
        start = item["start"]
        end = item["end"]
        dur = end - start
        # Transition duration at entrance and exit
        trans = min(0.11, dur * 0.45)

        if start <= t <= end:
            # Word is active
            text = item["text"]
            size = item["size"]

            # Entrance phase
            if t < start + trans:
                p = (t - start) / trans
                p_e = ease_out_cubic(max(0.0, min(1.0, p)))
                y_off = 48.0 * (1.0 - p_e)
                alpha = int(255 * p_e)
            # Exit phase
            elif t > end - trans:
                p = (t - (end - trans)) / trans
                p_e = ease_in_cubic(max(0.0, min(1.0, p)))
                y_off = -48.0 * p_e
                alpha = int(255 * (1.0 - p_e))
            # Sustained hold phase
            else:
                y_off = 0.0
                alpha = 255

            if alpha > 0:
                elements.append((text, size, y_off, alpha))

    # Check if in reveal phase: "0.4.0 Berkeley."
    if t >= REVEAL_START:
        rev_t = t - REVEAL_START
        rev_trans = 0.28  # smooth glide-in for version name
        if rev_t < rev_trans:
            p = rev_t / rev_trans
            p_e = ease_out_cubic(p)
            y_off = 56.0 * (1.0 - p_e)
            alpha = int(255 * p_e)
        else:
            y_off = 0.0
            alpha = 255

        # Two-line stacked lockup:
        # "0.4.0"
        # "Berkeley."
        elements.append(("0.4.0", 136, -78 + y_off, alpha))
        elements.append(("Berkeley.", 136, 78 + y_off, alpha))

    return elements


def render_frame(frame_num):
    t = frame_num / FPS

    # Plain solid black background
    img = Image.new("RGBA", (WIDTH, HEIGHT), (*COLOR_BG, 255))
    txt_layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(txt_layer)

    cy = HEIGHT // 2
    cx = WIDTH // 2

    active_items = get_active_elements(t)

    for text, size, y_off, alpha in active_items:
        if alpha <= 0:
            continue
        font = get_font(size)
        y_pos = cy + y_off
        draw.text((cx, y_pos), text, font=font, fill=(255, 255, 255, alpha), anchor="mm")

    final = Image.alpha_composite(img, txt_layer)
    return final.convert("RGB")


def main():
    print(f"Generating Minimalist Kinetic 9:16 Video ({WIDTH}x{HEIGHT} @ {FPS}fps)...")
    print(f"Duration: {TOTAL_DURATION:.2f}s ({TOTAL_FRAMES} frames)")

    output_dir = "apps/marketing/public/announcements"
    os.makedirs(output_dir, exist_ok=True)
    output_mp4 = os.path.join(output_dir, "modesto-0.4.0-berkeley-minimal.mp4")

    # High quality 60fps h264 encoding with yuv420p
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
        "-crf", "17",
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
    print("\nVideo generated successfully!")

    file_size_mb = os.path.getsize(output_mp4) / (1024 * 1024)
    print(f"Saved: {output_mp4} ({file_size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
