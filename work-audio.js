(() => {
  if (!window.TopaWork?.active) return;

  let clip;
  let activeButton;
  let progressFrame;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const playLabel = 'Воспроизвести реплику';

  function setPlaying(button, playing) {
    button.classList.toggle('is-playing', playing);
    button.setAttribute('aria-label', playing ? 'Приостановить реплику' : playLabel);
  }
  function updateProgress() {
    if (clip && Number.isFinite(clip.duration) && clip.duration > 0) {
      const percent = Math.min(100, clip.currentTime / clip.duration * 100);
      activeButton.style.setProperty('--audio-progress', percent + '%');
    }
  }
  function stopAnimation() {
    cancelAnimationFrame(progressFrame);
    progressFrame = undefined;
  }
  function animateProgress() {
    updateProgress();
    if (clip && !clip.paused && !reducedMotion.matches) {
      progressFrame = requestAnimationFrame(animateProgress);
    } else {
      progressFrame = undefined;
    }
  }
  function stop() {
    stopAnimation();
    const previous = clip;
    clip = undefined;
    if (activeButton) {
      setPlaying(activeButton, false);
      activeButton.style.removeProperty('--audio-progress');
    }
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
      clip.addEventListener('playing', () => {
        if (clip !== current || current.paused) return;
        setPlaying(button, true);
        stopAnimation();
        animateProgress();
      });
      clip.addEventListener('waiting', () => { if (clip === current) stopAnimation(); });
      clip.addEventListener('timeupdate', () => {
        if (clip === current && progressFrame === undefined) updateProgress();
      });
      clip.addEventListener('pause', () => {
        if (clip !== current) return;
        stopAnimation();
        updateProgress();
        setPlaying(button, false);
      });
      clip.addEventListener('ended', () => { if (clip === current) stop(); });
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
