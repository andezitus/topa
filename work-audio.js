(() => {
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
      clip = new Audio('work-assets/audio/' + button.dataset.workAudio + '.mp3?v=3');
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
