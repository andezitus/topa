(() => {
  if (!window.TopaWork?.active) return;

  let clip;
  let activeButton;
  let progress;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const translate = window.TopaWorkLocale?.translate ?? (text => text);
  const playLabel = translate('Воспроизвести реплику');

  function setPlaying(button, playing) {
    button.classList.toggle('is-playing', playing);
    button.setAttribute('aria-label', playing ? translate('Приостановить реплику') : playLabel);
  }

  function syncProgress(running) {
    if (!clip || !Number.isFinite(clip.duration) || clip.duration <= 0) return;
    if (!progress) {
      const wave = activeButton.parentElement.querySelector('.work-audio-button__progress');
      progress = wave.animate(
        [{clipPath: 'inset(0 100% 0 0)'}, {clipPath: 'inset(0 0% 0 0)'}],
        {duration: clip.duration * 1000, fill: 'both'}
      );
    }
    progress.pause();
    progress.currentTime = clip.currentTime * 1000;
    if (running && !reducedMotion.matches) {
      progress.playbackRate = clip.playbackRate;
      progress.play();
    }
  }

  function stop() {
    const previous = clip;
    clip = undefined;
    if (activeButton) setPlaying(activeButton, false);
    activeButton = undefined;
    progress?.cancel();
    progress = undefined;
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
      const current = clip;
      current.addEventListener('play', () => {
        if (clip === current && !current.paused) setPlaying(button, true);
      });
      current.addEventListener('playing', () => {
        if (clip === current && !current.paused) syncProgress(true);
      });
      current.addEventListener('waiting', () => { if (clip === current) syncProgress(false); });
      current.addEventListener('timeupdate', () => {
        if (clip === current && reducedMotion.matches) syncProgress(false);
      });
      current.addEventListener('pause', () => {
        if (clip !== current || !current.paused) return;
        syncProgress(false);
        setPlaying(button, false);
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
