#!/usr/bin/env python3
"""
Generate an authentic OpenAI / ChatGPT-style 9:16 (1080x1920 @ 60fps) announcement video
for Modesto 0.4.0 Berkeley.
- Signature ChatGPT matte dark charcoal background (#212121).
- Living, breathing, multi-layered fluid intelligence orb that reacts to each feature.
- Crisp, modern typography with the glowing ChatGPT cursor (|) that tracks each word.
- Dynamic color aura per feature (Emerald, Cyan, Rose, Amber, Violet).
- Smooth accelerating tempo (generative token stream speed).
- Dramatic contraction to a single spark, blooming into the 0.4.0 Berkeley. reveal card.
"""

import math
import os
import random
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

WIDTH = 1080
HEIGHT = 1920
FPS = 60

COLOR_BG = (33, 33, 33)  # Signature ChatGPT matte dark charcoal #212121
COLOR_TEXT = (248, 248, 250)
COLOR_MUTED = (160, 160, 165)

FONT_PATH = "/System/Library/Fonts/AppleSDGothicNeo.ttc"


def get_font(size, weight="bold"):
    if weight == "bold":
        return ImageFont.truetype(FONT_PATH, size, index=6)  # Bold
    elif weight == "semibold":
        return ImageFont.truetype(FONT_PATH, size, index=4)  # SemiBold
    elif weight == "medium":
        return ImageFont.truetype(FONT_PATH, size, index=2)  # Medium
    else:
        return ImageFont.truetype(FONT_PATH, size, index=0)  # Regular


# Smooth easing curves
def ease_out_cubic(x):
    return 1.0 - math.pow(1.0 - x, 3)


def ease_out_quint(x):
    return 1.0 - math.pow(1.0 - x, 5)


# Feature list with custom ChatGPT fluid orb tint (Layer 1 RGB, Layer 2 RGB)
FEATURES = [
    ("Chats", 136, (52, 211, 153), (56, 189, 248)),          # Mint & Cyan
    ("Work", 136, (56, 189, 248), (99, 102, 241)),          # Sky & Indigo
    ("Snapshots", 126, (45, 212, 191), (52, 211, 153)),      # Aqua & Mint
    ("Music", 136, (244, 114, 182), (192, 132, 252)),       # Hot Pink & Violet
    ("Artifacts", 126, (251, 191, 36), (249, 115, 22)),      # Amber & Coral
    ("Browser", 132, (96, 165, 250), (56, 189, 248)),        # Azure & Sky
    ("Simulator", 126, (52, 211, 153), (20, 184, 166)),      # Seafoam & Teal
    ("Pull Requests", 108, (251, 113, 133), (244, 63, 94)),  # Coral & Rose
    ("Stacks", 136, (163, 230, 53), (52, 211, 153)),         # Neon Lime & Mint
    ("Review", 136, (167, 139, 250), (139, 92, 246)),       # Lavender & Purple
    ("Automations", 120, (251, 146, 60), (234, 88, 12)),     # Tangerine & Amber
    ("Context Graph", 108, (34, 211, 238), (59, 130, 246)),  # Cyan & Blue
    ("Multi-Agent", 124, (232, 121, 249), (168, 85, 247)),   # Magenta & Purple
    ("Local-First", 128, (110, 231, 183), (16, 185, 129)),   # Mint & Forest
    ("Open Source", 124, (74, 222, 128), (52, 211, 153)),    # Laser Green
    ("And much more.", 108, (255, 255, 255), (180, 210, 240)),  # Luminous White
]

# Durations for each word (in seconds) — smooth acceleration
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
    0.48,  # And much more.
]

# Build timeline
timeline = []
current_time = 0.20

for i, (word, size, c1, c2) in enumerate(FEATURES):
    dur = WORD_DURATIONS[i]
    start = current_time
    end = start + dur
    timeline.append({
        "index": i,
        "text": word,
        "size": size,
        "c1": c1,
        "c2": c2,
        "start": start,
        "end": end,
    })
    current_time = end

words_end_time = timeline[-1]["end"]

PAUSE_DURATION = 0.35  # Orb contracts into single spark
REVEAL_START = words_end_time + PAUSE_DURATION
REVEAL_DURATION = 2.80
TOTAL_DURATION = REVEAL_START + REVEAL_DURATION
TOTAL_FRAMES = int(TOTAL_DURATION * FPS)


# Cache text measurement for perfectly centered cursor
WORD_DATA = {}
for word, size, _, _ in FEATURES:
    f = get_font(size, "bold")
    dummy = Image.new("RGBA", (1, 1))
    bbox = ImageDraw.Draw(dummy).textbbox((0, 0), word, font=f)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    WORD_DATA[word] = (tw, th, bbox[0], bbox[1])

# Also cache 0.4.0 and Berkeley.
f_rev = get_font(140, "bold")
b1 = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox((0, 0), "0.4.0", font=f_rev)
WORD_DATA["0.4.0"] = (b1[2] - b1[0], b1[3] - b1[1], b1[0], b1[1])
b2 = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox((0, 0), "Berkeley.", font=f_rev)
WORD_DATA["Berkeley."] = (b2[2] - b2[0], b2[3] - b2[1], b2[0], b2[1])


def render_frame(frame_num):
    t = frame_num / FPS
    cx, cy = WIDTH // 2, HEIGHT // 2

    # Base matte charcoal canvas
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (*COLOR_BG, 255))

    # Top floating ChatGPT pill
    pill_w, pill_h = 240, 48
    pill_x = cx - pill_w // 2
    pill_y = 300
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h], radius=24, fill=(45, 45, 47), outline=(68, 68, 72), width=1)
    font_pill = get_font(18, "semibold")
    draw.text((cx, pill_y + 24), "✦  Modesto 0.4.0", font=font_pill, fill=(215, 215, 220), anchor="mm")

    # Determine state
    active_word = None
    for item in timeline:
        if item["start"] <= t < item["end"]:
            active_word = item
            break

    is_pause = (words_end_time <= t < REVEAL_START)
    is_reveal = (t >= REVEAL_START)

    # =========================================================================
    # RENDER FLUID INTELLIGENCE ORB
    # =========================================================================
    orb = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(orb)

    if active_word is not None:
        c1 = active_word["c1"]
        c2 = active_word["c2"]
        start = active_word["start"]
        dur = active_word["end"] - start
        progress = (t - start) / dur

        # Pulse on hit
        hit_pulse = math.exp(-progress * 6.0) * 35.0
        r_breath = math.sin(t * 4.0) * 12.0

        # Layer 1 (C1)
        ang1 = t * 1.6
        ox1 = math.cos(ang1) * 35
        oy1 = math.sin(ang1) * 25
        r1 = 180 + r_breath + hit_pulse
        odraw.ellipse([cx + ox1 - r1, cy + oy1 - r1, cx + ox1 + r1, cy + oy1 + r1], fill=(*c1, 75))

        # Layer 2 (C2)
        ang2 = t * 2.0 + 2.2
        ox2 = math.cos(ang2) * 30
        oy2 = math.sin(ang2) * 30
        r2 = 160 + math.cos(t * 3.5) * 12.0 + hit_pulse * 0.8
        odraw.ellipse([cx + ox2 - r2, cy + oy2 - r2, cx + ox2 + r2, cy + oy2 + r2], fill=(*c2, 70))

        # Core luminous glow
        r3 = 105 + math.sin(t * 4.5) * 10.0 + hit_pulse * 0.5
        odraw.ellipse([cx - r3, cy - r3, cx + r3, cy + r3], fill=(255, 255, 255, 85))

        orb = orb.filter(ImageFilter.GaussianBlur(55))
        canvas = Image.alpha_composite(canvas, orb)

    elif is_pause:
        # Pause: Orb contracts into a tiny brilliant spark
        pause_t = (t - words_end_time) / PAUSE_DURATION
        spark_r = max(6, int(35 * (1.0 - ease_out_cubic(pause_t))))
        odraw.ellipse([cx - spark_r * 3, cy - spark_r * 3, cx + spark_r * 3, cy + spark_r * 3], fill=(52, 211, 153, 100))
        odraw.ellipse([cx - spark_r, cy - spark_r, cx + spark_r, cy + spark_r], fill=(255, 255, 255, 240))
        orb = orb.filter(ImageFilter.GaussianBlur(15))
        canvas = Image.alpha_composite(canvas, orb)

    elif is_reveal:
        # Reveal: Luminous radiant halo
        rev_t = t - REVEAL_START
        rev_p = min(1.0, rev_t / 0.40)
        halo_scale = ease_out_quint(rev_p)
        r_halo = int(240 * halo_scale + math.sin(rev_t * 2.5) * 12.0)

        odraw.ellipse([cx - r_halo - 30, cy - r_halo, cx + r_halo + 30, cy + r_halo], fill=(52, 211, 153, 65))
        odraw.ellipse([cx - r_halo, cy - r_halo - 20, cx + r_halo, cy + r_halo + 20], fill=(56, 189, 248, 65))
        odraw.ellipse([cx - int(r_halo * 0.6), cy - int(r_halo * 0.6), cx + int(r_halo * 0.6), cy + int(r_halo * 0.6)], fill=(255, 255, 255, 75))

        orb = orb.filter(ImageFilter.GaussianBlur(65))
        canvas = Image.alpha_composite(canvas, orb)

    # =========================================================================
    # RENDER TYPOGRAPHY & GLOWING CURSOR
    # =========================================================================
    draw = ImageDraw.Draw(canvas)

    if active_word is not None:
        word = active_word["text"]
        size = active_word["size"]
        font = get_font(size, "bold")
        tw, th, bx, by = WORD_DATA[word]

        cursor_w = 6
        cursor_gap = 18
        total_w = tw + cursor_gap + cursor_w
        start_x = cx - total_w // 2

        # Draw word
        text_x = start_x - bx
        text_y = cy - th // 2 - by
        draw.text((text_x, text_y), word, font=font, fill=COLOR_TEXT)

        # Draw glowing ChatGPT cursor
        cursor_x = start_x + tw + cursor_gap
        cursor_top = cy - int(size * 0.42)
        cursor_bottom = cy + int(size * 0.42)
        draw.rounded_rectangle([cursor_x, cursor_top, cursor_x + cursor_w, cursor_bottom], radius=3, fill=(255, 255, 255, 245))

    elif is_reveal:
        rev_t = t - REVEAL_START
        rev_p = min(1.0, rev_t / 0.32)
        scale_e = ease_out_cubic(rev_p)

        font_rev = get_font(140, "bold")

        # Line 1: 0.4.0
        w1, h1, b1x, b1y = WORD_DATA["0.4.0"]
        draw.text((cx - b1x - w1 // 2, cy - 88 - h1 // 2 - b1y), "0.4.0", font=font_rev, fill=(255, 255, 255))

        # Line 2: Berkeley. (with iridescent mint/cyan glow)
        w2, h2, b2x, b2y = WORD_DATA["Berkeley."]
        draw.text((cx - b2x - w2 // 2, cy + 88 - h2 // 2 - b2y), "Berkeley.", font=font_rev, fill=(90, 235, 185))

        # Subtitle
        font_sub = get_font(26, "regular")
        draw.text((cx, cy + 220), "One workspace for every coding agent.", font=font_sub, fill=COLOR_MUTED, anchor="mm")

        # Bottom Action Pill
        cta_w, cta_h = 280, 54
        cta_x = cx - cta_w // 2
        cta_y = cy + 320
        draw.rounded_rectangle([cta_x, cta_y, cta_x + cta_w, cta_y + cta_h], radius=27, fill=(255, 255, 255), outline=(255, 255, 255), width=1)
        font_cta = get_font(18, "semibold")
        draw.text((cx, cta_y + 27), "Try Modesto 0.4.0 →", font=font_cta, fill=(33, 33, 33), anchor="mm")

    return canvas.convert("RGB")


def generate_audio_track(output_wav):
    """
    Synthesize subtle, satisfying mechanical typing haptics and an ambient bloom riser
    matching ChatGPT's polished sound design.
    """
    import struct
    import wave

    sample_rate = 44100
    duration_secs = TOTAL_FRAMES / FPS
    total_samples = int(sample_rate * duration_secs)
    audio_data = [0.0] * total_samples

    def add_haptic_click(frame_num, freq=1600, vol=0.28):
        start_sample = int((frame_num / FPS) * sample_rate)
        num_samples = int((18 / 1000.0) * sample_rate)
        for i in range(num_samples):
            idx = start_sample + i
            if idx >= total_samples:
                break
            t = i / sample_rate
            env = math.exp(-i / (num_samples * 0.22))
            sine = math.sin(2 * math.pi * freq * t) + 0.2 * (random.random() * 2 - 1)
            audio_data[idx] += sine * env * vol

    def add_bloom(start_frame, vol=0.55):
        start_sample = int((start_frame / FPS) * sample_rate)
        num_samples = int((2000 / 1000.0) * sample_rate)
        for i in range(num_samples):
            idx = start_sample + i
            if idx >= total_samples:
                break
            t = i / sample_rate
            env = math.exp(-i / (num_samples * 0.28))
            freq = 68 * math.exp(-t * 2.0) + 40
            sub = math.sin(2 * math.pi * freq * t)
            air = math.sin(2 * math.pi * 520 * t) * math.exp(-t * 5.0) * 0.2
            audio_data[idx] += (sub + air) * env * vol

    # Clicks on every feature word
    for item in timeline:
        add_haptic_click(int(item["start"] * FPS), freq=1400 + item["index"] * 40)

    # Bloom on reveal
    add_bloom(int(REVEAL_START * FPS))

    with wave.open(output_wav, "w") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        raw_bytes = bytearray()
        for s in audio_data:
            val = max(-1.0, min(1.0, s))
            raw_bytes.extend(struct.pack("<h", int(val * 32767)))
        wav_file.writeframes(raw_bytes)


def main():
    output_dir = "apps/marketing/public/announcements"
    os.makedirs(output_dir, exist_ok=True)
    output_mp4 = os.path.join(output_dir, "modesto-0.4.0-berkeley-chatgpt.mp4")
    temp_wav = os.path.join(output_dir, "temp_chatgpt_audio.wav")

    print(f"Generating ChatGPT-Style 9:16 Video ({WIDTH}x{HEIGHT} @ {FPS}fps)...")
    print(f"Total frames: {TOTAL_FRAMES} ({TOTAL_DURATION:.2f}s)")

    generate_audio_track(temp_wav)

    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{WIDTH}x{HEIGHT}",
        "-pix_fmt", "rgb24",
        "-r", str(FPS),
        "-i", "-",
        "-i", temp_wav,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        "-crf", "17",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
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

    if os.path.exists(temp_wav):
        os.remove(temp_wav)

    print("\nChatGPT-style video successfully generated!")
    file_size_mb = os.path.getsize(output_mp4) / (1024 * 1024)
    print(f"Saved: {output_mp4} ({file_size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
