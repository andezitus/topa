#!/usr/bin/env python3
"""Import the 39 approved Anatoly clips into the ТОПА corporate course.

Run on GitHub Actions with internet access, ffmpeg and ffprobe installed.
This is a one-time import; playback after import uses only local MP3 files.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "work-assets" / "audio"
VOICE_ID = "9df4585a838b4cafa49498bd01f60fe4"
ACCOUNT_ID = "bfd2f9fc26574304a049c08af0c386cb"
BASE = f"https://resource2.heygen.ai/text_to_speech/{ACCOUNT_ID}/{VOICE_ID}/id="
CLIP_IDS = [
    'cc6fd40c262c460aa2b97896e32b059b',
    'edd88739be7945ec8e506db433f3dd1d',
    'eadc013244b44cfca71d122d92aecff7',
    '2ba2ab3c3ec54c02bb0c29b6b34f1116',
    '572f9758becb42d0976eb17c394e0a74',
    'cfe83923d5d84b89b8b7cac783a9dc1f',
    '007814844ad04d668a23de5f5aa55e74',
    '891b724c46724c8ea0f833098c122129',
    '94c2882f91b34abfa04a137cd4b563be',
    '763cceaee4a147029a9e8169fb511840',
    'f8f01df58ed8403c8d957a48dfe8e9d6',
    '9fae4e636fee4b9c814685050056ce0f',
    '1afaabad3e8c4557ae02498aa50d33e3',
    'a64c03f8e0504b528d8cf6a6f3ca9fc9',
    '4aa166bde6754baf99dfe8127dcc8e8c',
    '179a47d84e5f45199cef10a742aaf5c4',
    '85cac958cd6d495999d53f53506dd850',
    'bac4271409d24f4e86ffd9d6e114edff',
    'e976936048b44dcc9d0508e4dcdc6394',
    '739212ce7bed49b696e66ac14b712b2d',
    'f6655ebc47a0435ebba008e7a9eb0f23',
    '8cb3d744c0704a34869459d358acad55',
    'f6ca143e2b67407699e3095748de6d95',
    'c3a1e9dc0a0a421e8176b24bd361d971',
    'aef3b4f8b5384b2b8fc65a9d2c4951fb',
    '4dbc74b38bef4ae897bcf495c7f5e8fe',
    'd63a255cff8143829261278c9cd7dd8e',
    '3c6a8111a49845daab31c2ebd7fa955c',
    '14bc46db89d842d89102f9b240e954bd',
    'f6619121a8864a1a9c071b39c7dc0bf0',
    '436f79bbfac24e0b8e8aef6df262f62a',
    '3ba9f9c5fe2347f9aa6b4365d3f412e4',
    '623f7493e4214b0a87b9fd94de318c97',
    '60b1906b8fd34735b14ffc5abeec99da',
    '7fa3e32b377948ca8052aa6a8eabb07d',
    '8551a41308344d0db0b1c5f9a0516f17',
    '1d8c524f90704a828ab3c3d203237642',
    'c113dbc77fe6410883f8fd37db0ccab0',
    'bce2dd7eb6044a4e98311a9d47bf86e1'
]
TAIL_CUTS = {2: 0.3, 6: 0.3}


def duration(path: Path) -> float:
    raw = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "a:0",
         "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        text=True,
    ).strip()
    return float(raw)


def download(index: int, clip_id: str, dest: Path) -> None:
    url = BASE + clip_id + ".mp3"
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            request = Request(url, headers={"User-Agent": "TOPA-audio-localizer/1.0", "Accept": "audio/mpeg,*/*"})
            with urlopen(request, timeout=45) as response:
                content = response.read()
                content_type = response.headers.get("Content-Type", "").lower()
            if len(content) < 1000 or not (
                content.startswith(b"ID3") or content[0] == 0xFF
            ):
                raise ValueError(f"Audio #{index}: not a valid-looking MP3 ({len(content)} bytes; {content_type})")
            dest.write_bytes(content)
            print(f"Downloaded clip {index}/38 ({len(content)} bytes)")
            return
        except (HTTPError, URLError, TimeoutError, ValueError) as error:
            last_error = error
            if isinstance(error, HTTPError) and error.code in (401, 403, 404):
                break
            if attempt < 3:
                time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Cannot download clip #{index}: {last_error}")


def main() -> None:
    assert len(CLIP_IDS) == 39 and len(set(CLIP_IDS)) == 39
    assert (ROOT / "work-audio.js").exists()
    TARGET.mkdir(parents=True, exist_ok=True)
    audit = []
    with tempfile.TemporaryDirectory() as dirname:
        temp = Path(dirname)
        for index, clip_id in enumerate(CLIP_IDS):
            source = temp / f"{index}.mp3"
            output = TARGET / f"{index}.mp3"
            download(index, clip_id, source)
            original_duration = duration(source)
            if original_duration < 0.35 or original_duration > 60:
                raise ValueError(f"Clip #{index} has implausible duration {original_duration}")
            cut = TAIL_CUTS.get(index, 0)
            if cut:
                target_duration = original_duration - cut
                if target_duration < 0.25:
                    raise ValueError(f"Clip #{index} becomes too short")
                subprocess.run(
                    ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                     "-i", str(source), "-t", f"{target_duration:.5f}",
                     "-vn", "-ar", "44100", "-ac", "1", "-codec:a", "libmp3lame",
                     "-b:a", "128k", str(output)],
                    check=True,
                )
            else:
                output.write_bytes(source.read_bytes())
            final_duration = duration(output)
            if abs(final_duration - (original_duration - cut)) > 0.08:
                raise ValueError(f"Clip #{index} duration mismatch: {final_duration} vs {original_duration-cut}")
            digest = hashlib.sha256(output.read_bytes()).hexdigest()
            audit.append({
                "index": index,
                "file": f"work-assets/audio/{index}.mp3",
                "duration_seconds": round(final_duration, 3),
                "tail_removed_seconds": cut,
                "sha256": digest,
            })
            print(f"Validated #{index}: {final_duration:.3f}s")

    # Site must use only repository-hosted files; no HeyGen dependency at runtime.
    audio_js = r"""(() => {
  if (!window.TopaWork?.active) return;

  let clip;
  let activeButton;
  const playLabel = 'Воспроизвести реплику';

  function setPlaying(button, playing) {
    button.classList.toggle('is-playing', playing);
    button.setAttribute('aria-label', playing ? 'Приостановить реплику' : playLabel);
  }
  function stop() {
    const previous = clip;
    clip = undefined;
    if (activeButton) setPlaying(activeButton, false);
    activeButton = undefined;
    previous?.pause();
  }

  window.TopaWorkAudio = {stop};
  document.getElementById('taskHost').addEventListener('click', event => {
    const button = event.target.closest('[data-work-audio]');
    if (!button) return;
    if (button !== activeButton) {
      stop();
      clip = new Audio('work-assets/audio/' + button.dataset.workAudio + '.mp3?v=5');
      activeButton = button;
      const current = clip;
      clip.addEventListener('play', () => { if (clip === current) setPlaying(button, true); });
      clip.addEventListener('pause', () => { if (clip === current) setPlaying(button, false); });
      clip.addEventListener('ended', () => { if (clip === current) stop(); });
    }
    if (!clip.paused) {
      clip.pause();
      return;
    }
    window.speechSynthesis?.cancel();
    const current = clip;
    clip.play().catch(error => {
      if (clip !== current || error.name === 'AbortError') return;
      stop();
      showToast('Не удалось воспроизвести аудио. Попробуйте ещё раз.');
    });
  });
})();
"""
    (ROOT / "work-audio.js").write_text(audio_js, encoding="utf-8")
    index_path = ROOT / "index.html"
    index_html = index_path.read_text(encoding="utf-8")
    old = '<script src="work-audio.js?v=4" defer></script>'
    if index_html.count(old) != 1:
        raise ValueError("Unexpected work-audio.js reference; stop without modifying index.html")
    index_path.write_text(index_html.replace(old, '<script src="work-audio.js?v=5" defer></script>'), encoding="utf-8")
    (TARGET / "anatoly-integrity.json").write_text(
        json.dumps({"voice": "Anatoly", "count": 39, "source": "Approved ТОПА voiceover v4",
                    "files": audit}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    assert "heygen.ai" not in (ROOT / "work-audio.js").read_text(encoding="utf-8").lower()
    assert len(audit) == 39
    print("SUCCESS: 39 LOCAL MP3 files, two physically trimmed; switched site to local audio")


if __name__ == "__main__":
    main()
