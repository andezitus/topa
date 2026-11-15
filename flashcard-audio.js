/* TOPA flashcards: local recorded MP3. Only the target-language side is voiced.
 * Translation stays visible on the reverse side, preserving the existing card UX.
 * Separate from lesson audio players. No third-party TTS at runtime.
 */
(function () {
  'use strict';
  const clips = {"Татарский":{"исәнмесез":"tt_00.mp3","рәхмәт":"tt_01.mp3","әйе":"tt_02.mp3","юк":"tt_03.mp3","сау булыгыз":"tt_04.mp3","минем исемем…":"tt_05.mp3","яхшы":"tt_06.mp3","кибет":"tt_07.mp3","пальто":"tt_08.mp3","ярдәм":"tt_09.mp3","эшлисез":"tt_10.mp3","матур":"tt_11.mp3","арзан":"tt_12.mp3","җылы":"tt_13.mp3"},"Чувашский":{"салам":"cv_00.mp3","тавтапуҫ":"cv_01.mp3","ҫапла":"cv_02.mp3","ҫук":"cv_03.mp3","сывӑ пулӑр":"cv_04.mp3","епӗ … ятлӑ":"cv_05.mp3","аван":"cv_06.mp3","магазин":"cv_07.mp3","пальто":"cv_08.mp3","пулӑшу":"cv_09.mp3","ӗҫлетӗр":"cv_10.mp3","илемлӗ":"cv_11.mp3","хаклӑ мар":"cv_12.mp3","ӑшӑ":"cv_13.mp3"},"Киргизский":{"саламатсызбы":"ky_00.mp3","рахмат":"ky_01.mp3","ооба":"ky_02.mp3","жок":"ky_03.mp3","кош болуңуз":"ky_04.mp3","менин атым…":"ky_05.mp3","жакшы":"ky_06.mp3","дүкөн":"ky_07.mp3","пальто":"ky_08.mp3","жардам":"ky_09.mp3","иштейсиз":"ky_10.mp3","кооз":"ky_11.mp3","арзан":"ky_12.mp3","жылуу":"ky_13.mp3"},"Русский":{"каска":"work_00.mp3","перчатки":"work_01.mp3","жилет":"work_02.mp3","стой":"work_03.mp3","опасно":"work_04.mp3","не подходи":"work_05.mp3","надень каску":"work_06.mp3","лопата":"work_07.mp3","молоток":"work_08.mp3","пила":"work_09.mp3","работа":"work_10.mp3","принеси":"work_11.mp3","возьми":"work_12.mp3","копай":"work_13.mp3","убери мусор":"work_14.mp3","кирпичи":"work_15.mp3","этаж":"work_16.mp3","тачка":"work_17.mp3","повторите, пожалуйста":"work_18.mp3","где перчатки":"work_19.mp3","всё понятно":"work_20.mp3","я позову":"work_21.mp3"}};
  let active = null;
  function stop() {
    const a = active;
    active = null;
    if (!a) return;
    a.audio.pause();
    a.audio.removeAttribute('src');
    a.audio.load();
    a.button.classList.remove('is-playing');
    a.button.setAttribute('aria-pressed', 'false');
    a.button.setAttribute('aria-label', a.label);
  }
  function play(language, word, button) {
    if (!button) return false;
    const key = String(word).trim().toLocaleLowerCase('ru').normalize('NFC');
    const file = clips[language]?.[key];
    if (!file) return false;
    if (active && active.button === button) { stop(); return true; }
    stop();
    window.TopaWorkAudio?.stop();
    window.TopaSelfStudyAudio?.stop();
    window.speechSynthesis?.cancel();
    const audio = new Audio('flashcard-assets/audio/' + file + '?v=1');
    const item = {audio, button, label: button.getAttribute('aria-label') || 'Прослушать слово'};
    active = item;
    button.classList.add('is-playing');
    button.setAttribute('aria-pressed', 'true');
    button.setAttribute('aria-label', 'Остановить озвучку');
    audio.addEventListener('ended', () => { if (active === item) stop(); });
    audio.addEventListener('error', () => {
      if (active !== item) return;
      stop();
      button.title = 'Не удалось загрузить MP3. Проверьте интернет и повторите.';
    });
    audio.play().catch(() => { if (active === item) { stop(); button.title='Не удалось начать воспроизведение.'; } });
    return true;
  }
  window.TopaCardAudio = Object.freeze({play,stop,count:64});
})();
