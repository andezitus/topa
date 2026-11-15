#!/usr/bin/env python3
"""Physically shorten the six user-flagged flashcard MP3 tails by 0.3 seconds.

Only runs in isolated demo branch flashcard-audio-demo-20261115.
Keep a copy of each original MP3 in flashcard-assets/originals/ for A/B testing.
The other 58 approved MP3 must be byte-for-byte unchanged.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "flashcard-assets" / "audio"
ORIGINALS = ROOT / "flashcard-assets" / "originals"
REPORT = ROOT / "flashcard-assets" / "trim-report-20261115.json"
TRIM_SECONDS = 0.300
TARGETS = {
    "tt_06.mp3": ("Татарский", "Яхшы"),
    "cv_05.mp3": ("Чувашский", "Епӗ … ятлӑ"),
    "cv_07.mp3": ("Чувашский", "магазин"),
    "ky_05.mp3": ("Киргизский", "Менин атым…"),
    "work_04.mp3": ("Русский · для компаний", "опасно"),
    "work_10.mp3": ("Русский · для компаний", "работа"),
}


def duration(path: Path) -> float:
    p = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(p.stdout.strip())


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    if REPORT.exists():
        raise SystemExit("Already trimmed; refusing to apply a second 0.3-second cut.")
    assert len(TARGETS) == 6
    before = {f.name: sha256(f) for f in AUDIO.glob("*.mp3")}
    if len(before) != 64:
        raise RuntimeError(f"Expected 64 MP3, found {len(before)}")
    if not set(TARGETS).issubset(before):
        raise RuntimeError("Some flagged MP3 are missing")

    ORIGINALS.mkdir(parents=True, exist_ok=True)
    results = []
    for filename, (language, word) in TARGETS.items():
        src = AUDIO / filename
        original = ORIGINALS / filename
        if original.exists():
            raise RuntimeError("Backup already present; refusing to trim twice: " + filename)
        shutil.copy2(src, original)
        old_duration = duration(original)
        target_duration = old_duration - TRIM_SECONDS
        if target_duration < 0.35:
            raise RuntimeError("Dangerously short after trim: " + filename)
        fade = min(0.012, target_duration / 15)
        temp = src.with_name(src.stem + ".trimmed.mp3")
        args = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(original), "-map", "0:a:0",
            "-af", "atrim=duration={:.6f},asetpts=PTS-STARTPTS,"
                   "afade=t=out:st={:.6f}:d={:.6f}".format(
                       target_duration, target_duration-fade, fade),
            "-c:a", "libmp3lame", "-b:a", "160k",
            "-ar", "44100", "-write_xing", "1", str(temp),
        ]
        subprocess.run(args, check=True)
        new_duration = duration(temp)
        actual_cut = old_duration - new_duration
        if not (0.25 <= actual_cut <= 0.34):
            raise RuntimeError(
                f"Unexpected duration change for {filename}: "
                f"{old_duration:.3f} -> {new_duration:.3f} (cut {actual_cut:.3f})"
            )
        temp.replace(src)
        results.append({
            "file": filename, "language": language, "word": word,
            "requested_cut_seconds": TRIM_SECONDS,
            "actual_cut_seconds": round(actual_cut, 4),
            "duration_before_seconds": round(old_duration, 4),
            "duration_after_seconds": round(new_duration, 4),
            "original_sha256": sha256(original),
            "trimmed_sha256": sha256(src),
        })
        print(f"TRIMMED {filename} {old_duration:.3f} -> {new_duration:.3f} (-{actual_cut:.3f}s)")

    after = {f.name: sha256(f) for f in AUDIO.glob("*.mp3")}
    if set(after) != set(before):
        raise RuntimeError("Number or names of audio assets changed")
    for filename in before:
        if filename not in TARGETS and before[filename] != after[filename]:
            raise RuntimeError("Previously approved MP3 changed unexpectedly: " + filename)
    REPORT.write_text(json.dumps({
        "source": "topa_card_audio_64_feedback.json",
        "approved_untouched": 58,
        "flagged_trimmed": 6,
        "seconds_requested_per_clip": TRIM_SECONDS,
        "changes": results,
        "other_58_mp3_byte_identical": True
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("SUCCESS: six clips trimmed; other 58 MP3 byte-for-byte unchanged.")


if __name__ == "__main__":
    main()
