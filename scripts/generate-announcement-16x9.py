#!/usr/bin/env python3
"""
Modesto 0.4.0 Berkeley - Pure 16:9 Announcement Master (Smooth & Cinematic)
==========================================================================
- Plain black background (#000000)
- Pure, clean typography (Helvetica Neue) - Zero clutter, zero jumping cursors
- Buttery smooth kinetic transitions: micro-scale settle + continuous color aura lerp
- Studio-grade cinematic sound design:
    * Warm analog synth pad & ambient riser (no harsh beeps/clicks)
    * Deep sub-bass bloom impact on 0.4.0 Berkeley
    * Ethereal ambient drone on "One more thing..."
    * Resonant acoustic-warmth chord resolution on "Modesto"
- Seamless pipeline for stitching Kimi K3 trailer if provided
"""

import argparse
import glob
import math
import os
import random
import struct
import subprocess
import sys
import wave
from PIL import Image, ImageDraw, ImageFilter, ImageFont

WIDTH = 1920
HEIGHT = 1080
FPS = 60

COLOR_BG = (0, 0, 0)
COLOR_TEXT = (255, 255, 255)
COLOR_MINT = (64, 224, 160)

FONT_PATH = "/System/Library/Fonts/HelveticaNeue.ttc"


def get_font(size, style="bold"):
    idx_map = {
        "regular": 0,
        "bold": 1,
        "italic": 2,
        "light": 7,
        "medium": 10,
    }
    idx = idx_map.get(style, 1)
    return ImageFont.truetype(FONT_PATH, size, index=idx)


def ease_out_cubic(x):
    return 1.0 - math.pow(1.0 - max(0.0, min(1.0, x)), 3)


def ease_in_out_sine(x):
    return -(math.cos(math.pi * max(0.0, min(1.0, x))) - 1.0) / 2.0


def lerp_color(c1, c2, t):
    t = max(0.0, min(1.0, t))
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
    )


FEATURES = [
    ("Chats", 130, (52, 211, 153)),
    ("Work", 130, (56, 189, 248)),
    ("Snapshots", 120, (45, 212, 191)),
    ("Music", 130, (244, 114, 182)),
    ("Artifacts", 120, (251, 191, 36)),
    ("Browser", 126, (96, 165, 250)),
    ("Simulator", 120, (52, 211, 153)),
    ("Pull Requests", 110, (251, 113, 133)),
    ("Stacks", 130, (163, 230, 53)),
    ("Review", 130, (167, 139, 250)),
    ("Automations", 116, (251, 146, 60)),
    ("Context Graph", 106, (34, 211, 238)),
    ("Multi-Agent", 118, (232, 121, 249)),
    ("Local-First", 122, (110, 231, 183)),
    ("Open Source", 118, (74, 222, 128)),
    ("And much more.", 108, (255, 255, 255)),
]

WORD_DURATIONS = [
    0.46,  # Chats
    0.42,  # Work
    0.38,  # Snapshots
    0.34,  # Music
    0.31,  # Artifacts
    0.28,  # Browser
    0.26,  # Simulator
    0.24,  # Pull Requests
    0.22,  # Stacks
    0.20,  # Review
    0.19,  # Automations
    0.18,  # Context Graph
    0.17,  # Multi-Agent
    0.16,  # Local-First
    0.15,  # Open Source
    0.50,  # And much more.
]

TIMELINE = []
cur_time = 0.25
for i, (word, size, c) in enumerate(FEATURES):
    dur = WORD_DURATIONS[i]
    start = cur_time
    end = start + dur
    TIMELINE.append({
        "index": i,
        "text": word,
        "size": size,
        "color": c,
        "start": start,
        "end": end,
    })
    cur_time = end

WORDS_END = TIMELINE[-1]["end"]
SPARK_PAUSE = 0.40
REVEAL_START = WORDS_END + SPARK_PAUSE
REVEAL_HOLD = 2.40
REVEAL_END = REVEAL_START + REVEAL_HOLD

BLACKOUT_1_START = REVEAL_END
BLACKOUT_1_DUR = 0.65

OMT_START = BLACKOUT_1_START + BLACKOUT_1_DUR
OMT_HOLD = 2.30
OMT_END = OMT_START + OMT_HOLD

BLACKOUT_2_DUR = 0.60
INTRO_TOTAL_TIME = OMT_END + BLACKOUT_2_DUR
INTRO_TOTAL_FRAMES = int(INTRO_TOTAL_TIME * FPS)


def render_intro_frame(frame_num):
    t = frame_num / FPS
    cx, cy = WIDTH // 2, HEIGHT // 2
    canvas = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))

    # 1. "One more thing..." Sequence
    if t >= OMT_START:
        omt_t = t - OMT_START
        fade_in = min(1.0, omt_t / 0.50)
        fade_out = 1.0
        if omt_t > (OMT_HOLD - 0.50):
            fade_out = max(0.0, (OMT_HOLD - omt_t) / 0.50)
        alpha = int(255 * ease_in_out_sine(fade_in) * ease_in_out_sine(fade_out))

        if alpha > 0:
            scale = 1.02 - 0.02 * ease_out_cubic(fade_in)
            f_omt = get_font(int(68 * scale), "light")
            d = ImageDraw.Draw(canvas)
            d.text((cx, cy), "One more thing...", font=f_omt, fill=(alpha, alpha, alpha), anchor="mm")
        return canvas

    # 2. Blackout 1 (Smooth fade out from reveal)
    if t >= BLACKOUT_1_START:
        fade_p = min(1.0, (t - BLACKOUT_1_START) / 0.40)
        rev_alpha = int(255 * (1.0 - ease_in_out_sine(fade_p)))
        if rev_alpha <= 0:
            return canvas

    # 3. Features kinetic stream
    is_spark = (WORDS_END <= t < REVEAL_START)
    is_reveal = (REVEAL_START <= t < BLACKOUT_1_START)

    # Active word / transition calculation
    active_word = None
    next_word = None
    word_prog = 0.0
    active_idx = -1

    for idx, item in enumerate(TIMELINE):
        if item["start"] <= t < item["end"]:
            active_word = item
            active_idx = idx
            word_prog = (t - item["start"]) / (item["end"] - item["start"])
            if idx + 1 < len(TIMELINE):
                next_word = TIMELINE[idx + 1]
            break

    # Ambient fluid aura
    if active_word is not None:
        c_cur = active_word["color"]
        c_next = next_word["color"] if next_word else c_cur
        aura_color = lerp_color(c_cur, c_next, ease_in_out_sine(word_prog))

        orb = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        odraw = ImageDraw.Draw(orb)
        breath = math.sin(t * 3.5) * 12.0
        r = int(240 + breath)
        odraw.ellipse([cx - r, cy - int(r * 0.75), cx + r, cy + int(r * 0.75)], fill=(*aura_color, 48))
        odraw.ellipse([cx - int(r * 0.5), cy - int(r * 0.4), cx + int(r * 0.5), cy + int(r * 0.4)], fill=(255, 255, 255, 45))
        orb = orb.filter(ImageFilter.GaussianBlur(70))
        canvas.paste(orb, (0, 0), orb)

        # Micro-scale and smooth fade envelope for current word
        # Fade-in over 0.04s, hold, fade-out over 0.04s
        fade_dur = 0.04
        cur_dur = active_word["end"] - active_word["start"]
        cur_time_in_word = t - active_word["start"]

        in_p = min(1.0, cur_time_in_word / fade_dur)
        out_p = 1.0
        if cur_time_in_word > (cur_dur - fade_dur):
            out_p = max(0.0, (cur_dur - cur_time_in_word) / fade_dur)

        opacity = ease_out_cubic(in_p) * ease_out_cubic(out_p)
        # Gentle scale: 0.96 -> 1.00
        scale = 0.96 + 0.04 * ease_out_cubic(in_p)

        word_size = int(active_word["size"] * scale)
        font = get_font(word_size, "bold")
        draw = ImageDraw.Draw(canvas)
        text_val = int(255 * opacity)
        draw.text((cx, cy), active_word["text"], font=font, fill=(text_val, text_val, text_val), anchor="mm")

    elif is_spark:
        # Contraction into spark
        spark_p = (t - WORDS_END) / SPARK_PAUSE
        sr = max(3, int(35 * (1.0 - ease_out_cubic(spark_p))))
        orb = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        odraw = ImageDraw.Draw(orb)
        odraw.ellipse([cx - sr * 4, cy - sr * 4, cx + sr * 4, cy + sr * 4], fill=(52, 211, 153, 70))
        odraw.ellipse([cx - sr, cy - sr, cx + sr, cy + sr], fill=(255, 255, 255, 240))
        orb = orb.filter(ImageFilter.GaussianBlur(16))
        canvas.paste(orb, (0, 0), orb)

    elif is_reveal:
        rev_t = t - REVEAL_START
        fade_in = min(1.0, rev_t / 0.40)
        alpha = int(255 * ease_out_cubic(fade_in))
        scale = 1.04 - 0.04 * ease_out_cubic(fade_in)

        # Ambient mint/cyan halo bloom
        halo_scale = ease_out_cubic(fade_in)
        r_halo = int(320 * halo_scale + math.sin(rev_t * 2.0) * 10.0)
        orb = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        odraw = ImageDraw.Draw(orb)
        odraw.ellipse([cx - r_halo, cy - int(r_halo * 0.75), cx + r_halo, cy + int(r_halo * 0.75)], fill=(52, 211, 153, 40))
        orb = orb.filter(ImageFilter.GaussianBlur(80))
        canvas.paste(orb, (0, 0), orb)

        # Pure centered text: 0.4.0 Berkeley.
        f_title = get_font(int(140 * scale), "bold")
        draw = ImageDraw.Draw(canvas)
        draw.text((cx, cy - 80), "0.4.0", font=f_title, fill=(alpha, alpha, alpha), anchor="mm")
        mint_color = (int(COLOR_MINT[0] * alpha / 255), int(COLOR_MINT[1] * alpha / 255), int(COLOR_MINT[2] * alpha / 255))
        draw.text((cx, cy + 80), "Berkeley.", font=f_title, fill=mint_color, anchor="mm")

    return canvas


def render_modesto_ending_frame(opacity=1.0):
    """
    Renders pure text ending: Modesto
    """
    cx, cy = WIDTH // 2, HEIGHT // 2
    canvas = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))
    alpha = int(255 * opacity)
    if alpha > 0:
        scale = 1.03 - 0.03 * ease_out_cubic(opacity)
        f_title = get_font(int(140 * scale), "bold")
        draw = ImageDraw.Draw(canvas)
        draw.text((cx, cy), "Modesto", font=f_title, fill=(alpha, alpha, alpha), anchor="mm")
    return canvas


def generate_cinematic_audio(output_wav):
    """
    Generate rich, warm, studio-grade cinematic audio:
    - Ambient synth riser & warm chords (no piercing beeps)
    - Sub-bass impact bloom on 0.4.0 Berkeley
    - Deep ethereal drone on 'One more thing...'
    - Resonant harmonic chord resolution on 'Modesto'
    """
    sample_rate = 44100
    duration_secs = INTRO_TOTAL_TIME
    total_samples = int(sample_rate * duration_secs)
    audio = [0.0] * total_samples

    for i in range(total_samples):
        t = i / sample_rate

        # 1. Smooth ambient building pad during features (0.0 to 4.5s)
        if t < 4.5:
            prog = t / 4.5
            vol = 0.14 + 0.22 * math.pow(prog, 2)
            # Warm chord: F2 (87.3Hz) + C3 (130.8Hz) + G3 (196.0Hz)
            chord = (
                math.sin(2 * math.pi * 87.3 * t) * 0.45 +
                math.sin(2 * math.pi * 130.8 * t) * 0.35 +
                math.sin(2 * math.pi * 196.0 * t) * 0.20
            )
            # Filtered gentle harmonic riser
            sweep_f = 110 + 200 * math.pow(prog, 2.5)
            riser = math.sin(2 * math.pi * sweep_f * t) * 0.22 * prog
            audio[i] += (chord + riser) * vol

        # 2. Reverse vacuum suction into spark (4.1 to 4.5s)
        if 4.1 <= t < 4.5:
            sp = (t - 4.1) / 0.4
            noise = (random.random() * 2 - 1) * math.pow(sp, 3) * 0.06
            audio[i] += noise

        # 3. 0.4.0 Berkeley Reveal Sub Impact (at 4.7s)
        if 4.7 <= t < 7.5:
            dt = t - 4.7
            env = math.exp(-dt * 1.6)
            # Pitch drop 75Hz -> 42Hz
            f = 42 + 33 * math.exp(-dt * 4.5)
            sub = math.sin(2 * math.pi * f * dt) * 0.55
            # Lush harmonic bloom (F3, C4, E4 major 7th warmth)
            pad = (
                math.sin(2 * math.pi * 174.6 * dt) * 0.25 +
                math.sin(2 * math.pi * 261.6 * dt) * 0.20 +
                math.sin(2 * math.pi * 329.6 * dt) * 0.15
            ) * math.exp(-dt * 0.85)
            audio[i] += (sub + pad) * env

        # 4. 'One more thing...' Ethereal ambient swell (at 8.3s)
        if 8.3 <= t < 10.6:
            dt = t - 8.3
            env = math.sin(math.pi * min(1.0, dt / 2.3)) * 0.32
            ethereal = (
                math.sin(2 * math.pi * 110.0 * dt) * 0.35 +
                math.sin(2 * math.pi * 220.0 * dt) * 0.25 +
                math.sin(2 * math.pi * 277.18 * dt) * 0.20 +
                math.sin(2 * math.pi * 440.0 * dt) * 0.15
            )
            audio[i] += ethereal * env

    with wave.open(output_wav, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        raw = bytearray()
        for s in audio:
            val = max(-0.95, min(0.95, s))
            raw.extend(struct.pack("<h", int(val * 32767)))
        wf.writeframes(raw)


def generate_ending_audio(output_wav, dur=3.0):
    """
    Warm, resonant acoustic chord chime for the final 'Modesto' screen.
    """
    sample_rate = 44100
    total_samples = int(sample_rate * dur)
    audio = [0.0] * total_samples

    for i in range(total_samples):
        t = i / sample_rate
        env = math.exp(-t * 0.85) * 0.40
        chime = (
            math.sin(2 * math.pi * 220.0 * t) * 0.35 +
            math.sin(2 * math.pi * 330.0 * t) * 0.25 +
            math.sin(2 * math.pi * 440.0 * t) * 0.20 +
            math.sin(2 * math.pi * 659.25 * t) * 0.12
        )
        sub = math.sin(2 * math.pi * 55.0 * t) * 0.35 * math.exp(-t * 1.5)
        audio[i] += (chime + sub) * env

    with wave.open(output_wav, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        raw = bytearray()
        for s in audio:
            val = max(-0.95, min(0.95, s))
            raw.extend(struct.pack("<h", int(val * 32767)))
        wf.writeframes(raw)


def render_intro_video(output_mp4):
    temp_wav = "/tmp/temp_cinematic_audio.wav"
    generate_cinematic_audio(temp_wav)

    ffmpeg_cmd = [
        "/opt/homebrew/bin/ffmpeg", "-y",
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

    print(f"[1/2] Rendering Pure 16:9 Intro ({WIDTH}x{HEIGHT} @ {FPS}fps, {INTRO_TOTAL_TIME:.2f}s)...")
    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for f in range(INTRO_TOTAL_FRAMES):
        frame = render_intro_frame(f)
        proc.stdin.write(frame.tobytes())
        if f % 60 == 0:
            pct = (f / INTRO_TOTAL_FRAMES) * 100
            sys.stdout.write(f"\rIntro Progress: {pct:.1f}% ({f}/{INTRO_TOTAL_FRAMES})")
            sys.stdout.flush()

    proc.stdin.close()
    proc.wait()
    if os.path.exists(temp_wav):
        os.remove(temp_wav)
    print(f"\nIntro rendered: {output_mp4}")


def stitch_trailer_with_modesto_ending(intro_mp4, trailer_file, output_final_mp4):
    probe_cmd = [
        "/opt/homebrew/bin/ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        trailer_file
    ]
    res = subprocess.run(probe_cmd, capture_output=True, text=True)
    try:
        trailer_dur = float(res.stdout.strip())
    except ValueError:
        print(f"Error reading trailer duration for {trailer_file}")
        return

    print(f"[2/2] Stitching Kimi Trailer ({trailer_file}, duration: {trailer_dur:.2f}s)...")

    ending_dur = 3.0
    ending_frames = int(ending_dur * FPS)
    temp_ending_mp4 = "/tmp/temp_modesto_ending.mp4"
    temp_ending_wav = "/tmp/temp_ending_audio.wav"
    generate_ending_audio(temp_ending_wav, ending_dur)

    ffmpeg_cmd = [
        "/opt/homebrew/bin/ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{WIDTH}x{HEIGHT}",
        "-pix_fmt", "rgb24",
        "-r", str(FPS),
        "-i", "-",
        "-i", temp_ending_wav,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        "-crf", "17",
        "-c:a", "aac",
        "-shortest",
        temp_ending_mp4
    ]
    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for f in range(ending_frames):
        t = f / FPS
        fade_in = min(1.0, t / 0.45)
        fade_out = 1.0
        if t > (ending_dur - 0.50):
            fade_out = max(0.0, (ending_dur - t) / 0.50)
        op = ease_in_out_sine(fade_in) * ease_in_out_sine(fade_out)
        img = render_modesto_ending_frame(opacity=op)
        proc.stdin.write(img.tobytes())

    proc.stdin.close()
    proc.wait()

    temp_norm_trailer = "/tmp/temp_norm_trailer.mp4"
    norm_cmd = [
        "/opt/homebrew/bin/ffmpeg", "-y",
        "-i", trailer_file,
        "-vf", f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,fps={FPS},settb=AVTB,fade=t=in:st=0:d=0.5",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "17",
        "-c:a", "aac",
        "-b:a", "192k",
        temp_norm_trailer
    ]
    subprocess.run(norm_cmd, check=True)

    concat_cmd = [
        "/opt/homebrew/bin/ffmpeg", "-y",
        "-i", intro_mp4,
        "-i", temp_norm_trailer,
        "-i", temp_ending_mp4,
        "-filter_complex", "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]",
        "-map", "[v]",
        "-map", "[a]",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-crf", "17",
        output_final_mp4
    ]
    subprocess.run(concat_cmd, check=True)

    for p in [temp_ending_mp4, temp_norm_trailer, temp_ending_wav]:
        if os.path.exists(p):
            os.remove(p)

    print(f"Master announcement video created: {output_final_mp4}")


def render_preview_with_modesto_ending(intro_mp4, output_final_mp4):
    print("[2/2] Appending pure 'Modesto' text ending sequence...")
    ending_dur = 3.0
    ending_frames = int(ending_dur * FPS)
    temp_ending_mp4 = "/tmp/temp_modesto_ending.mp4"
    temp_ending_wav = "/tmp/temp_ending_audio.wav"
    generate_ending_audio(temp_ending_wav, ending_dur)

    ffmpeg_cmd = [
        "/opt/homebrew/bin/ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{WIDTH}x{HEIGHT}",
        "-pix_fmt", "rgb24",
        "-r", str(FPS),
        "-i", "-",
        "-i", temp_ending_wav,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        "-crf", "17",
        "-c:a", "aac",
        "-shortest",
        temp_ending_mp4
    ]
    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for f in range(ending_frames):
        t = f / FPS
        fade_in = min(1.0, t / 0.45)
        fade_out = 1.0
        if t > (ending_dur - 0.50):
            fade_out = max(0.0, (ending_dur - t) / 0.50)
        op = ease_in_out_sine(fade_in) * ease_in_out_sine(fade_out)
        img = render_modesto_ending_frame(opacity=op)
        proc.stdin.write(img.tobytes())

    proc.stdin.close()
    proc.wait()

    concat_cmd = [
        "/opt/homebrew/bin/ffmpeg", "-y",
        "-i", intro_mp4,
        "-i", temp_ending_mp4,
        "-filter_complex", "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]",
        "-map", "[v]",
        "-map", "[a]",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-crf", "17",
        output_final_mp4
    ]
    subprocess.run(concat_cmd, check=True)
    for p in [temp_ending_mp4, temp_ending_wav]:
        if os.path.exists(p):
            os.remove(p)
    print(f"Master announcement video generated: {output_final_mp4}")


def find_candidate_kimi_video():
    search_globs = [
        "scripts/*kimi*.*",
        "scripts/*trailer*.*",
        "apps/marketing/public/announcements/*kimi*.*",
        "/Users/tannerdavidson/Desktop/*kimi*.*",
        "/Users/tannerdavidson/Desktop/*trailer*.*",
        "/Users/tannerdavidson/Downloads/*kimi*.*",
        "/Users/tannerdavidson/Downloads/*moonshot*.*",
    ]
    for g in search_globs:
        for f in glob.glob(g):
            if f.lower().endswith((".mp4", ".mov", ".webm", ".m4v")):
                return f
    return None


def main():
    parser = argparse.ArgumentParser(description="Modesto 0.4.0 Pure 16:9 Announcement Generator")
    parser.add_argument("--kimi", type=str, default=None, help="Path to Kimi K3 trailer video")
    args = parser.parse_args()

    out_dir = "apps/marketing/public/announcements"
    os.makedirs(out_dir, exist_ok=True)
    intro_mp4 = os.path.join(out_dir, "modesto-0.4.0-intro-16x9.mp4")
    master_mp4 = os.path.join(out_dir, "modesto-0.4.0-berkeley-16x9-master.mp4")

    render_intro_video(intro_mp4)

    trailer_path = args.kimi or find_candidate_kimi_video()
    if trailer_path and os.path.exists(trailer_path):
        print(f"Found Kimi trailer at: {trailer_path}")
        stitch_trailer_with_modesto_ending(intro_mp4, trailer_path, master_mp4)
    else:
        print("\nNote: No Kimi trailer file found on disk.")
        render_preview_with_modesto_ending(intro_mp4, master_mp4)

    size_mb = os.path.getsize(master_mp4) / (1024 * 1024)
    print("\n========================================================")
    print(f"SUCCESS: Master 16:9 Video Ready!")
    print(f"Master File: {master_mp4} ({size_mb:.2f} MB)")
    print("========================================================\n")


if __name__ == "__main__":
    main()
