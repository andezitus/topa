#!/usr/bin/env python3
"""Download 52 fresh HeyGen MP3 and copy 12 approved clips from existing audio.
This script is for the isolated flashcard-audio-demo branch only.
Generated clips must be reviewed before merging with main.
"""
import json
import shutil
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "flashcard-assets" / "audio"
LANGS = ("tt", "cv", "ky", "work")

def probe(path):
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
        "default=noprint_wrappers=1:nokey=1", str(path)], capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError("Invalid MP3 " + str(path) + ": " + p.stderr[-200:])
    seconds = float(p.stdout.strip())
    if seconds <= 0.2 or seconds > 30:
        raise RuntimeError(f"Unexpected MP3 duration {seconds} for {path}")
    return seconds

def fetch(url, target):
    request = urllib.request.Request(url, headers={"User-Agent":"TOPA-flashcards-audio-import/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        contents = response.read()
    if len(contents) < 500:
        raise RuntimeError(f"Empty MP3 response: {url}")
    target.write_bytes(contents)

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    report = []
    for prefix in LANGS:
        data = json.loads((ROOT / "flashcard-assets" / f"manifest-{prefix}.json").read_text(encoding="utf8"))
        for item in data["items"]:
            target = DEST / item["file"]
            if item.get("reuse"):
                source = ROOT / item["reuse"]
                if not source.is_file():
                    raise FileNotFoundError(f"Expected approved source MP3: {source}")
                shutil.copyfile(source, target)
                origin = "approved-existing"
            elif item.get("sourceUrl"):
                fetch(item["sourceUrl"], target)
                origin = "new-heygen"
            else:
                raise ValueError(f"No audio source for {data['language']} {item['original_text']}")
            seconds = probe(target)
            report.append({"language":data["language"],"word":item["original_text"],
                "file":item["file"],"origin":origin,"seconds":round(seconds,3),"bytes":target.stat().st_size})
            print(f"OK {data['language']} {item['original_text']}: {item['file']} {seconds:.2f}s")
    if len(report) != 64:
        raise RuntimeError(f"Expected 64 audio clips, got {len(report)}")
    if sum(item["origin"]=="approved-existing" for item in report)!=12:
        raise RuntimeError("Approved audio source counts do not match")
    (DEST/"import_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
    print("SUCCESS: 64 MP3, 12 reused, 52 generated — all are local.")
if __name__=="__main__":
    main()
