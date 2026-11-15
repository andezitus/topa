(() => {
  if (!window.TopaWork?.active) return;

  let clip;
  let activeButton;
  let wave;
  let frame;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const translate = window.TopaWorkLocale?.translate ?? (text => text);
  const playLabel = translate('Воспроизвести реплику');

  function setPlaying(button, playing) {
    button.classList.toggle('is-playing', playing);
    button.setAttribute('aria-label', playing ? translate('Приостановить реплику') : playLabel);
  }

  function syncProgress() {
    if (!wave || !Number.isFinite(clip.duration) || clip.duration <= 0) return;
    const remaining = 100 * (1 - Math.min(1, clip.currentTime / clip.duration));
    wave.style.clipPath = `inset(0 ${remaining}% 0 0)`;
  }

  function updateFrame() {
    frame = undefined;
    syncProgress();
    if (!reducedMotion.matches && !clip.paused && !clip.ended && !clip.seeking && clip.readyState >= 3) {
      frame = requestAnimationFrame(updateFrame);
    }
  }

  function stopFrames() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  }

  function stop() {
    const previous = clip;
    clip = undefined;
    if (activeButton) setPlaying(activeButton, false);
    activeButton = undefined;
    stopFrames();
    wave?.style.removeProperty('clip-path');
    wave = undefined;
    previous?.pause();
  }

  window.TopaWorkAudio = {stop};
  document.getElementById('taskHost').addEventListener('click', event => {
    const transcript = event.target.closest('[data-work-transcript]');
    if (transcript) {
      const expanded = transcript.getAttribute('aria-expanded') !== 'true';
      transcript.setAttribute('aria-expanded', String(expanded));
      transcript.querySelector('.work-transcript__front').setAttribute('aria-hidden', String(expanded));
      transcript.querySelector('.work-transcript__back').setAttribute('aria-hidden', String(!expanded));
      return;
    }

    const button = event.target.closest('[data-work-audio]');
    if (!button) return;
    if (button !== activeButton) {
      stop();
      clip = new Audio('work-assets/audio/' + button.dataset.workAudio + '.mp3?v=5');
      activeButton = button;
      wave = button.parentElement.querySelector('.work-audio-button__progress');
      const current = clip;
      current.addEventListener('playing', () => {
        if (clip !== current || current.paused) return;
        setPlaying(button, true);
        stopFrames();
        updateFrame();
      });
      for (const event of ['waiting', 'seeking', 'pause']) {
        current.addEventListener(event, () => {
          if (clip !== current) return;
          stopFrames();
          syncProgress();
          if (current.paused) setPlaying(button, false);
        });
      }
      for (const event of ['timeupdate', 'durationchange', 'seeked']) {
        current.addEventListener(event, () => {
          if (clip === current) syncProgress();
        });
      }
      current.addEventListener('error', () => {
        if (clip !== current) return;
        stop();
        showToast('Не удалось воспроизвести аудио. Попробуйте ещё раз.');
      });
      current.addEventListener('ended', () => { if (clip === current) stop(); });
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
      showToast('Не удалось воспроизвести аудио. Попробуйте ещё раз.');
    });
  });
})();
