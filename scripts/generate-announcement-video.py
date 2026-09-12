#!/usr/bin/env python3
"""
Generate a 9:16 (1080x1920) vertical announcement video for Modesto 0.4.0 Berkeley.
OpenAI-style kinetic typography: rapid-flicker feature list accelerating into a dramatic
blackout cut, followed by the 0.4.0 Berkeley release reveal.
"""

import math
import os
import random
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

WIDTH = 1080
HEIGHT = 1920
FPS = 30

# Colors from Modesto brand palette
COLOR_BG = (13, 14, 12)
COLOR_TEXT = (240, 240, 241)
COLOR_MUTED = (165, 168, 172)
COLOR_FAINT = (100, 103, 108)
COLOR_ACCENT = (110, 156, 114)  # #6e9c72 emerald
COLOR_ACCENT_BRIGHT = (138, 198, 144)
COLOR_WHITE = (255, 255, 255)

# Fonts
FONT_DIR = "/System/Library/Fonts"
FONT_DISPLAY_HEAVY = os.path.join(FONT_DIR, "Avenir.ttc")
FONT_MONO = os.path.join(FONT_DIR, "Menlo.ttc")
FONT_ALT = os.path.join(FONT_DIR, "HelveticaNeue.ttc")


def get_font(size, style="bold"):
    if style == "heavy":
        return ImageFont.truetype(FONT_DISPLAY_HEAVY, size, index=2)  # Avenir Black
    elif style == "bold":
        return ImageFont.truetype(FONT_DISPLAY_HEAVY, size, index=4)  # Avenir Heavy
    elif style == "regular":
        return ImageFont.truetype(FONT_DISPLAY_HEAVY, size, index=0)  # Avenir Book
    elif style == "mono":
        return ImageFont.truetype(FONT_MONO, size, index=0)  # Menlo Regular
    elif style == "mono_bold":
        return ImageFont.truetype(FONT_MONO, size, index=1)  # Menlo Bold
    else:
        return ImageFont.truetype(FONT_ALT, size, index=0)


# Pre-rendered artistic watercolor wash background matching Astro site
def create_base_background():
    base = Image.new("RGBA", (WIDTH, HEIGHT), (*COLOR_BG, 255))
    wash = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    wdraw = ImageDraw.Draw(wash)

    # Ellipses with watercolor wash palette
    wdraw.ellipse([80, 220, 740, 840], fill=(90, 166, 121, 155))
    wdraw.ellipse([460, 300, 1020, 860], fill=(74, 143, 106, 135))
    wdraw.ellipse([260, 700, 880, 1260], fill=(224, 178, 94, 80))
    wdraw.ellipse([60, 1100, 700, 1680], fill=(63, 122, 86, 130))
    wdraw.ellipse([440, 1200, 1040, 1780], fill=(108, 176, 131, 115))
    wdraw.ellipse([680, 780, 1100, 1300], fill=(127, 194, 201, 75))

    wash = wash.filter(ImageFilter.GaussianBlur(140))
    base = Image.alpha_composite(base, wash)

    # Subtle radial vignette
    vignette = Image.new("L", (WIDTH, HEIGHT), 0)
    vdraw = ImageDraw.Draw(vignette)
    cx, cy = WIDTH // 2, HEIGHT // 2
    max_dist = math.hypot(cx, cy)
    for y in range(0, HEIGHT, 8):
        for x in range(0, WIDTH, 8):
            dist = math.hypot(x - cx, y - cy)
            v = int(max(0, min(140, (dist / max_dist) * 160)))
            vdraw.rectangle([x, y, x + 8, y + 8], fill=v)
    vignette = vignette.filter(ImageFilter.GaussianBlur(24))

    vign_img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    vign_img.paste((0, 0, 0, 180), mask=vignette)
    base = Image.alpha_composite(base, vign_img)

    return base.convert("RGB")


# Draw Modesto Handoff Mark vector icon
def draw_modesto_mark(draw, x, y, size, color=(240, 240, 241), stroke_w=8):
    scale = size / 100.0

    def pt(px, py):
        return (x + px * scale, y + py * scale)

    # Path 1: M18 32H39C42 32 43.5 30.5 45 28L55 12
    draw.line([pt(18, 32), pt(39, 32), pt(45, 28), pt(55, 12)], fill=color, width=int(stroke_w * scale), joint="curve")
    # Path 2: M66 20L60 32C58 36 59 39 62 42L81 58
    draw.line([pt(66, 20), pt(60, 32), pt(62, 42), pt(81, 58)], fill=color, width=int(stroke_w * scale), joint="curve")
    # Path 3: M14 45L35 51C39 52 41 55 41 59V80
    draw.line([pt(14, 45), pt(35, 51), pt(41, 59), pt(41, 80)], fill=color, width=int(stroke_w * scale), joint="curve")
    # Path 4: M57 58L70 70
    draw.line([pt(57, 58), pt(70, 70)], fill=color, width=int(stroke_w * scale), joint="curve")


# Feature list as specified by user
FEATURES = [
    ("Chats", "Multi-turn agent sessions", "01"),
    ("Work", "Tasks, plans & context unified", "02"),
    ("Snapshots", "Checkpoints, decisions & diffs", "03"),
    ("Music", "Coding audio for deep flow", "04"),
    ("Artifacts", "Live previews, docs & sandboxes", "05"),
    ("Browser", "Embedded browser runtime", "06"),
    ("Simulator", "Device & mobile runtime", "07"),
    ("Pull Requests", "GitHub branch handoff workflow", "08"),
    ("Stacks", "Stacked diffs & worktrees", "09"),
    ("Review", "Multi-agent code inspection", "10"),
    ("Automations", "Background tasks & cron triggers", "11"),
    ("Context Graph", "Deep repo semantic indexing", "12"),
    ("Multi-Agent", "Codex, Claude, Gemini & OpenCode", "13"),
    ("Local-First", "100% On-device privacy", "14"),
    ("Open Source", "Public on GitHub under MIT", "15"),
    ("Everything.", "One platform for coding agents", "16"),
]

# Acceleration schedule (frames per item)
FRAME_DURATIONS = [18, 16, 14, 13, 12, 11, 10, 9, 8, 8, 7, 6, 5, 5, 4, 6]

START_FLICKER_FRAME = 30  # Intro is 0..30 (1 second)

schedule = []
curr = START_FLICKER_FRAME
for i, dur in enumerate(FRAME_DURATIONS):
    schedule.append((curr, curr + dur, i))
    curr += dur

BLITZ_START = curr
BLITZ_DURATION = 26
BLITZ_END = BLITZ_START + BLITZ_DURATION

BLACKOUT_START = BLITZ_END
BLACKOUT_END = BLACKOUT_START + 18  # 0.6s tension pause

REVEAL_START = BLACKOUT_END
TOTAL_FRAMES = REVEAL_START + 105  # ~11.0 seconds total


def render_frame(frame_num, base_bg):
    img = base_bg.copy()
    draw = ImageDraw.Draw(img)

    # 1. Header Bar at y = 140
    header_mark_size = 42
    draw_modesto_mark(draw, 90, 132, header_mark_size, color=COLOR_TEXT, stroke_w=8)
    font_brand = get_font(28, "bold")
    draw.text((144, 138), "Modesto", font=font_brand, fill=COLOR_TEXT)

    # Top Status Pill
    pill_w, pill_h = 210, 38
    pill_x, pill_y = WIDTH - 90 - pill_w, 134
    draw.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h], radius=19, fill=(30, 34, 30), outline=(110, 156, 114, 140), width=1)
    draw.ellipse([pill_x + 16, pill_y + 14, pill_x + 26, pill_y + 24], fill=COLOR_ACCENT)
    font_pill = get_font(12, "mono_bold")
    draw.text((pill_x + 36, pill_y + 11), "0.4.0 BERKELEY", font=font_pill, fill=COLOR_TEXT)

    # Top & Bottom Framing Rules
    draw.line([90, 204, WIDTH - 90, 204], fill=(255, 255, 255, 30), width=1)
    draw.line([90, HEIGHT - 180, WIDTH - 90, HEIGHT - 180], fill=(255, 255, 255, 30), width=1)

    # Footer Metadata
    font_footer = get_font(13, "mono")
    draw.text((90, HEIGHT - 146), "ONE WORKSPACE FOR EVERY AGENT", font=font_footer, fill=(255, 255, 255, 110))
    time_str = f"00:0{frame_num // 30}:{(frame_num % 30) * 3:02d}"
    draw.text((WIDTH - 90, HEIGHT - 146), time_str, font=font_footer, fill=(255, 255, 255, 110), anchor="ra")

    # Corner technical marks
    draw.text((90, 218), "+", font=font_footer, fill=(255, 255, 255, 60))
    draw.text((WIDTH - 102, 218), "+", font=font_footer, fill=(255, 255, 255, 60))

    # =========================================================================
    # PHASE 1: Intro (0 .. START_FLICKER_FRAME)
    # =========================================================================
    if frame_num < START_FLICKER_FRAME:
        cursor_visible = (frame_num // 6) % 2 == 0
        font_kicker = get_font(14, "mono_bold")
        draw.text((WIDTH // 2, 740), "WHAT'S NEW IN MODESTO", font=font_kicker, fill=COLOR_ACCENT, anchor="ma")

        font_hero = get_font(84, "heavy")
        draw.text((WIDTH // 2, 880), "Every feature.", font=font_hero, fill=COLOR_TEXT, anchor="ma")

        if cursor_visible:
            draw.rectangle([WIDTH // 2 + 280, 890, WIDTH // 2 + 296, 970], fill=COLOR_ACCENT)

        font_sub = get_font(24, "regular")
        draw.text((WIDTH // 2, 1020), "Collapsing the gap between code and work.", font=font_sub, fill=COLOR_MUTED, anchor="ma")
        return img

    # =========================================================================
    # PHASE 2: Kinetic Feature Flicker (START_FLICKER_FRAME .. BLITZ_END)
    # =========================================================================
    if frame_num < BLITZ_END:
        is_blitz = frame_num >= BLITZ_START
        if is_blitz:
            idx = ((frame_num - BLITZ_START) // 2) % len(FEATURES)
            is_first_frame = (frame_num - BLITZ_START) % 2 == 0
        else:
            item_info = next((s for s in schedule if s[0] <= frame_num < s[1]), schedule[-1])
            idx = item_info[2]
            is_first_frame = (frame_num == item_info[0])

        name, desc, num_str = FEATURES[idx]

        # 1-frame micro-flash on word switch
        if is_first_frame:
            overlay = Image.new("RGBA", (WIDTH, HEIGHT), (255, 255, 255, 26))
            img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
            draw = ImageDraw.Draw(img)

        # Kinetic stacked teleprompter list
        center_y = 960
        row_height = 112

        # Draw preceding items (above)
        for offset in [-2, -1]:
            t_idx = idx + offset
            if 0 <= t_idx < len(FEATURES):
                t_name = FEATURES[t_idx][0]
                y_pos = center_y + offset * row_height
                alpha = 40 if offset == -2 else 95
                f_size = 46 if offset == -2 else 58
                font_item = get_font(f_size, "bold")
                draw.text((WIDTH // 2, y_pos), t_name, font=font_item, fill=(240, 240, 241, alpha), anchor="mm")

        # ACTIVE ITEM (Center Stage)
        font_cat = get_font(13, "mono_bold")
        badge_text = f"FEATURE // {num_str} OF 16"
        draw.text((WIDTH // 2, center_y - 120), badge_text, font=font_cat, fill=COLOR_ACCENT, anchor="mm")

        # Giant Active Word
        font_size = 124
        if len(name) > 10:
            font_size = 100
        if len(name) > 12:
            font_size = 88
        font_active = get_font(font_size, "heavy")

        # Left indicator bar
        bbox = draw.textbbox((WIDTH // 2, center_y), name, font=font_active, anchor="mm")
        bracket_pad = 32
        draw.line([bbox[0] - bracket_pad, bbox[1] + 10, bbox[0] - bracket_pad, bbox[3] - 10], fill=COLOR_ACCENT, width=5)

        # Active Word
        draw.text((WIDTH // 2, center_y), name, font=font_active, fill=COLOR_WHITE, anchor="mm")

        # Subtitle explanation
        font_desc = get_font(23, "regular")
        draw.text((WIDTH // 2, center_y + 84), desc, font=font_desc, fill=COLOR_MUTED, anchor="mm")

        # Draw following items (below)
        for offset in [1, 2]:
            t_idx = idx + offset
            if 0 <= t_idx < len(FEATURES):
                t_name = FEATURES[t_idx][0]
                y_pos = center_y + offset * row_height + 40
                alpha = 95 if offset == 1 else 40
                f_size = 58 if offset == 1 else 46
                font_item = get_font(f_size, "bold")
                draw.text((WIDTH // 2, y_pos), t_name, font=font_item, fill=(240, 240, 241, alpha), anchor="mm")

        # Progress bar
        progress = (frame_num - START_FLICKER_FRAME) / (BLITZ_END - START_FLICKER_FRAME)
        prog_w = 600
        prog_x = (WIDTH - prog_w) // 2
        draw.line([prog_x, 1380, prog_x + prog_w, 1380], fill=(255, 255, 255, 25), width=2)
        draw.line([prog_x, 1380, prog_x + int(prog_w * progress), 1380], fill=COLOR_ACCENT, width=3)

        return img

    # =========================================================================
    # PHASE 3: Blackout Cut / Tension Drop (BLITZ_END .. BLACKOUT_END)
    # =========================================================================
    if frame_num < BLACKOUT_END:
        black_img = Image.new("RGB", (WIDTH, HEIGHT), (8, 9, 8))
        bdraw = ImageDraw.Draw(black_img)
        bdraw.line([90, 204, WIDTH - 90, 204], fill=(255, 255, 255, 15), width=1)
        bdraw.line([90, HEIGHT - 180, WIDTH - 90, HEIGHT - 180], fill=(255, 255, 255, 15), width=1)

        # Pulsing center emerald dot
        pulse = (math.sin((frame_num - BLACKOUT_START) * 0.45) + 1.0) * 0.5
        r = int(5 + pulse * 4)
        bdraw.ellipse([WIDTH // 2 - r, HEIGHT // 2 - r, WIDTH // 2 + r, HEIGHT // 2 + r], fill=COLOR_ACCENT)
        return black_img

    # =========================================================================
    # PHASE 4: Climax Reveal — "0.4.0 Berkeley." (BLACKOUT_END .. TOTAL_FRAMES)
    # =========================================================================
    reveal_frame = frame_num - BLACKOUT_END

    # Cinematic impact bloom on first 3 frames
    if reveal_frame < 3:
        flash_alpha = int(120 * (1.0 - reveal_frame / 3.0))
        overlay = Image.new("RGBA", (WIDTH, HEIGHT), (*COLOR_ACCENT, flash_alpha))
        img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
        draw = ImageDraw.Draw(img)

    # 1. Large Handoff Mark Logo
    logo_size = 120
    logo_x = (WIDTH - logo_size) // 2
    logo_y = 620
    draw_modesto_mark(draw, logo_x, logo_y, logo_size, color=COLOR_TEXT, stroke_w=9)

    # 2. Brand Lockup Tag
    font_brand_title = get_font(32, "bold")
    draw.text((WIDTH // 2, 780), "MODESTO", font=font_brand_title, fill=COLOR_MUTED, anchor="mm")

    # 3. Massive Version Name: "0.4.0 Berkeley."
    font_version = get_font(98, "heavy")
    draw.text((WIDTH // 2, 920), "0.4.0", font=font_version, fill=COLOR_WHITE, anchor="mm")
    
    font_codename = get_font(104, "heavy")
    draw.text((WIDTH // 2, 1030), "Berkeley.", font=font_codename, fill=COLOR_ACCENT, anchor="mm")

    # 4. Tagline
    font_tagline = get_font(26, "regular")
    draw.text((WIDTH // 2, 1150), "One workspace for every coding agent.", font=font_tagline, fill=COLOR_TEXT, anchor="mm")
    draw.text((WIDTH // 2, 1195), "Now 100% open source & community-driven.", font=font_tagline, fill=COLOR_MUTED, anchor="mm")

    # 5. Badges Row with clean dark container and emerald border
    badge_y = 1285
    badges = ["OPEN SOURCE", "LOCAL-FIRST", "MULTI-AGENT"]
    badge_w, badge_h = 172, 38
    total_w = len(badges) * badge_w + (len(badges) - 1) * 18
    start_bx = (WIDTH - total_w) // 2

    font_badge = get_font(11, "mono_bold")
    for b_i, b_text in enumerate(badges):
        bx = start_bx + b_i * (badge_w + 18)
        draw.rounded_rectangle([bx, badge_y, bx + badge_w, badge_y + badge_h], radius=8, fill=(24, 26, 24), outline=(110, 156, 114, 120), width=1)
        draw.text((bx + badge_w // 2, badge_y + 11), b_text, font=font_badge, fill=COLOR_TEXT, anchor="ma")

    # 6. Call to Action Pill Button
    cta_w, cta_h = 420, 64
    cta_x = (WIDTH - cta_w) // 2
    cta_y = 1410
    draw.rounded_rectangle([cta_x, cta_y, cta_x + cta_w, cta_y + cta_h], radius=32, fill=(74, 143, 106), outline=COLOR_ACCENT_BRIGHT, width=1)
    font_cta = get_font(17, "mono_bold")
    draw.text((WIDTH // 2, cta_y + 22), "DOWNLOAD AT MODESTO.DEV ↓", font=font_cta, fill=(13, 14, 12), anchor="mm")

    # 7. Platforms
    font_plat = get_font(14, "mono")
    draw.text((WIDTH // 2, 1520), "AVAILABLE FOR MACOS · WINDOWS · LINUX", font=font_plat, fill=(255, 255, 255, 120), anchor="mm")

    return img


def generate_audio_track(output_wav):
    """
    Synthesize synchronized tech sound effects track:
    - Accelerating high-tech clicks matching the word flickers
    - Sudden tension drop during blackout
    - Sub-bass impact boom and shimmer on the 0.4.0 Berkeley reveal!
    """
    import struct
    import wave

    sample_rate = 44100
    duration_secs = TOTAL_FRAMES / FPS
    total_samples = int(sample_rate * duration_secs)
    audio_data = [0.0] * total_samples

    def add_click(frame_num, freq=1800, length_ms=25, vol=0.35):
        start_sample = int((frame_num / FPS) * sample_rate)
        num_samples = int((length_ms / 1000.0) * sample_rate)
        for i in range(num_samples):
            idx = start_sample + i
            if idx >= total_samples:
                break
            t = i / sample_rate
            env = math.exp(-i / (num_samples * 0.25))
            sine = math.sin(2 * math.pi * freq * t) + 0.3 * math.sin(2 * math.pi * (freq * 1.5) * t)
            noise = (random.random() * 2 - 1) * 0.15
            audio_data[idx] += (sine + noise) * env * vol

    def add_boom(start_frame, length_ms=1800, vol=0.65):
        start_sample = int((start_frame / FPS) * sample_rate)
        num_samples = int((length_ms / 1000.0) * sample_rate)
        for i in range(num_samples):
            idx = start_sample + i
            if idx >= total_samples:
                break
            t = i / sample_rate
            env = math.exp(-i / (num_samples * 0.2))
            freq = 75 * math.exp(-t * 2.5) + 38
            sub = math.sin(2 * math.pi * freq * t)
            shimmer = math.sin(2 * math.pi * 880 * t) * math.exp(-t * 6) * 0.25
            audio_data[idx] += (sub + shimmer) * env * vol

    add_click(10, freq=900, vol=0.2)
    add_click(20, freq=1100, vol=0.25)

    for s in schedule:
        f_start = s[0]
        f_idx = s[2]
        pitch = 1200 + f_idx * 60
        add_click(f_start, freq=pitch, vol=0.35 + (f_idx / len(FEATURES)) * 0.2)

    for bf in range(BLITZ_START, BLITZ_END, 2):
        add_click(bf, freq=2200 + (bf - BLITZ_START) * 40, vol=0.45)

    add_click(BLACKOUT_START + 8, freq=300, length_ms=80, vol=0.25)
    add_boom(REVEAL_START, length_ms=2200, vol=0.75)

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
    print(f"Rendering Modesto 0.4.0 Berkeley announcement video ({WIDTH}x{HEIGHT} @ {FPS}fps)...")
    print(f"Total frames: {TOTAL_FRAMES} (~{TOTAL_FRAMES/FPS:.1f}s)")

    output_dir = "apps/marketing/public/announcements"
    os.makedirs(output_dir, exist_ok=True)
    output_mp4 = os.path.join(output_dir, "modesto-0.4.0-berkeley-teaser.mp4")
    temp_wav = os.path.join(output_dir, "temp_audio.wav")

    print("Generating synchronized tech sound effects & reveal boom...")
    generate_audio_track(temp_wav)

    print("Rendering organic watercolor wash base...")
    base_bg = create_base_background()

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
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        output_mp4
    ]

    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for f in range(TOTAL_FRAMES):
        frame_img = render_frame(f, base_bg)
        proc.stdin.write(frame_img.tobytes())
        if f % 30 == 0:
            pct = (f / TOTAL_FRAMES) * 100
            sys.stdout.write(f"\rProgress: {pct:.1f}% (frame {f}/{TOTAL_FRAMES})")
            sys.stdout.flush()

    proc.stdin.close()
    proc.wait()
    print("\nVideo encoding completed!")

    if os.path.exists(temp_wav):
        os.remove(temp_wav)

    file_size_mb = os.path.getsize(output_mp4) / (1024 * 1024)
    print(f"Generated: {output_mp4} ({file_size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
