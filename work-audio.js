/*
 * ТОПА · voice review PREVIEW ONLY.
 * This file is intentionally limited to the preview branch.
 * MP3s are fetched from approved HeyGen preview URLs, not bundled assets.
 * Do not ship this implementation to main: download/validate MP3 files first.
 */
(() => {
  if (!window.TopaWork?.active) return;

  const voiceClips = [
  "cc6fd40c262c460aa2b97896e32b059b",
  "edd88739be7945ec8e506db433f3dd1d",
  "eadc013244b44cfca71d122d92aecff7",
  "2ba2ab3c3ec54c02bb0c29b6b34f1116",
  "572f9758becb42d0976eb17c394e0a74",
  "cfe83923d5d84b89b8b7cac783a9dc1f",
  "007814844ad04d668a23de5f5aa55e74",
  "891b724c46724c8ea0f833098c122129",
  "94c2882f91b34abfa04a137cd4b563be",
  "763cceaee4a147029a9e8169fb511840",
  "f8f01df58ed8403c8d957a48dfe8e9d6",
  "9fae4e636fee4b9c814685050056ce0f",
  "1afaabad3e8c4557ae02498aa50d33e3",
  "a64c03f8e0504b528d8cf6a6f3ca9fc9",
  "4aa166bde6754baf99dfe8127dcc8e8c",
  "179a47d84e5f45199cef10a742aaf5c4",
  "85cac958cd6d495999d53f53506dd850",
  "bac4271409d24f4e86ffd9d6e114edff",
  "e976936048b44dcc9d0508e4dcdc6394",
  "739212ce7bed49b696e66ac14b712b2d",
  "f6655ebc47a0435ebba008e7a9eb0f23",
  "8cb3d744c0704a34869459d358acad55",
  "f6ca143e2b67407699e3095748de6d95",
  "c3a1e9dc0a0a421e8176b24bd361d971",
  "aef3b4f8b5384b2b8fc65a9d2c4951fb",
  "4dbc74b38bef4ae897bcf495c7f5e8fe",
  "d63a255cff8143829261278c9cd7dd8e",
  "3c6a8111a49845daab31c2ebd7fa955c",
  "14bc46db89d842d89102f9b240e954bd",
  "f6619121a8864a1a9c071b39c7dc0bf0",
  "436f79bbfac24e0b8e8aef6df262f62a",
  "3ba9f9c5fe2347f9aa6b4365d3f412e4",
  "623f7493e4214b0a87b9fd94de318c97",
  "60b1906b8fd34735b14ffc5abeec99da",
  "7fa3e32b377948ca8052aa6a8eabb07d",
  "8551a41308344d0db0b1c5f9a0516f17",
  "1d8c524f90704a828ab3c3d203237642",
  "c113dbc77fe6410883f8fd37db0ccab0",
  "bce2dd7eb6044a4e98311a9d47bf86e1"
];
  const voiceBase = 'https://resource2.heygen.ai/text_to_speech/bfd2f9fc26574304a049c08af0c386cb/9df4585a838b4cafa49498bd01f60fe4/id=';
  const cutTail = new Map([[2, 0.3], [6, 0.3]]);

  let clip;
  let activeButton;
  let activeIndex = -1;
  let frame = 0;
  const playLabel = 'Воспроизвести реплику';

  function setPlaying(button, playing) {
    button.classList.toggle('is-playing', playing);
    button.setAttribute('aria-label', playing ? 'Приостановить реплику' : playLabel);
  }
  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    const previous = clip;
    clip = undefined;
    activeIndex = -1;
    if (activeButton) setPlaying(activeButton, false);
    activeButton = undefined;
    previous?.pause();
  }

  function monitorTail(current, index) {
    if (clip !== current || current.paused) return;
    const cut = cutTail.get(index) || 0;
    if (cut && Number.isFinite(current.duration) && current.currentTime >= current.duration - cut) {
      stop();
      return;
    }
    frame = requestAnimationFrame(() => monitorTail(current, index));
  }

  window.TopaWorkAudio = {stop};
  window.TopaWorkAudioPreview = Object.freeze({
    voice: 'Анатолий',
    clips: voiceClips.length,
    tailTrimmedOnPlaybackOnly: [2, 6],
    source: 'HeyGen URLs (preview only)'
  });

  const host = document.getElementById('taskHost');
  if (!host) return;

  host.addEventListener('click', event => {
    const button = event.target.closest('[data-work-audio]');
    if (!button) return;
    const index = Number(button.dataset.workAudio);
    if (!Number.isInteger(index) || index < 0 || index >= voiceClips.length) {
      if (typeof showToast === 'function') showToast('Не найдена аудиореплика.');
      return;
    }

    if (button !== activeButton || index !== activeIndex) {
      stop();
      const current = new Audio(voiceBase + voiceClips[index] + '.mp3');
      current.preload = 'metadata';
      clip = current;
      activeButton = button;
      activeIndex = index;
      current.addEventListener('play', () => {
        if (clip !== current) return;
        setPlaying(button, true);
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => monitorTail(current, index));
      });
      current.addEventListener('pause', () => {
        if (clip === current) setPlaying(button, false);
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
      });
      current.addEventListener('ended', () => {
        if (clip === current) stop();
      });
    }

    if (!clip.paused) {
      clip.pause();
      return;
    }
    window.speechSynthesis?.cancel();
    const current = clip;
    current.play().catch(error => {
      if (clip !== current || error.name === 'AbortError') return;
      stop();
      if (typeof showToast === 'function') {
        showToast('Демо-аудио недоступно. Проверьте интернет или ссылку HeyGen.');
      }
    });
  });
})();
