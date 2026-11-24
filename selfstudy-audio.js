// ТОПА: предварительная интеграция утверждённой озвучки самостоятельного режима.
// Когда MP3 будут импортированы в selfstudy-assets/audio/, установите useLocal=true.
// Пока проигрываем исходные HeyGen URL и применяем шесть утверждённых срезов в браузере.
(function () {
  'use strict';
  const CONFIG = {"project":"ТОПА — языки народов России","version":"selfstudy-heygen-71-2026-11-15","sourceBase":"https://resource2.heygen.ai/text_to_speech/bfd2f9fc26574304a049c08af0c386cb/","voices":{"woman":"cc484a0bd95445c589a86316513cc64c","learner":"b94b0dda433d40c38b92290eba94484a","narrator":"cc484a0bd95445c589a86316513cc64c"},"storyWomanIndices":[0,2,4,5,6,7,13,14,15],"approvedTailTrimSeconds":{"Татарский::3":0.46,"Татарский::8":0.28,"Чувашский::5":0.42,"Чувашский::7":0.42,"Киргизский::7":0.42,"Киргизский::12":0.44},"languages":{"Татарский":{"prefix":"tt","story":["a117dfaf70844b96964e48e4fd3cffd6","f928abbd55014d5aa579dfd58bfd83be","a9cb54fb0b9048d29d66cf69ef70a29e","ba68ff60c584430c9e1c3c6a0a5844b6","f3ef7f27104f498994de13d7cc6c4417","8272d4fbb22c40abb37719e2334719d7","6837177f3a94405d9a3bee1963c5756c","74c0e73bfa414a789586dd5ff6a9f6a3","47fbe1ed223549beb6d6a29bd1ebc287","3063658ee7ef4d1aa9d2e3d50d80dfce","3ca3263ab876454986f9012602dc30dd","6393bda3392c43cfbd25ed26fae80000","9cc65a66fac54e50b6d367db5f508672","cb56334631c04cae93746e7c89720c04","c70e923dbd284918a76eb15eb3e54581","3033bef6862546b6ae7ae9fd3410e1d6","755ffd2889da4222b5c13d70006823cf","2ef37e3b1af84279891d3922fbbedbee"],"order":"a099dc47de07415a99679828d5746999","choice":"a11dbd41977447a5b5f83fc6e6a6962f","orderText":"Минем исемем Айгөл.","choiceText":"Сау булыгыз!","greeting":"Исәнмесез!"},"Чувашский":{"prefix":"cv","story":["765a2336b75d4ee2abb0c23fda312afb","b03b40236aeb451a9ac026641c695c08","bf58075208cf465087189356906d517f","b5661d13431c4e7083d370fbafb620bd","975dacb7a76b4ef28ad3c9f9245d95be","a467dadf46b74f63b0a372253d32b878","7d58761f49f941e6b4d0582497d205d4","4aa58d7f35304546b7d834dbfcf00034","09038df3cc0f44d1830f062fcc43703f","ac4cb1de405a4bf992dadffad77a8bcb","3fc51aa7534b43ca973e7a0eaf15db71","9bc2f38b0b2445d688925472b86796b9","6db7c561a1c24278b936b6890d0059d1","4e98930b2a5345ffa612ab8a9ca44c68","983380b0f8d24fdab2aff2345ce2b177","588defb189514a7a9375dab04d6b3741","1e3ebab4aa37429ab165d5018b9d2847","63520c02703d4ff6949f118d6baa7f10"],"order":"004a47c7344d4f58931b2ba92197b813","choice":"96210f9d05ae4996a8fe15bd109423fa","orderText":"Епӗ Анне ятлӑ.","choiceText":"Сывӑ пулӑр!","greeting":"Салам!"},"Киргизский":{"prefix":"ky","story":["7b0519317b3d42d1a7ac99664b7a0cb4","9e4ea0e8426b4b278cc67d550dc4f0ad","aaba38dc2bec4fec96bd777fc7a2da02","1592636488b94501b81201e0b1200c46","4413069b9a6b4f2cab86ee86fe120ab9","e93ebcb2bc014f52b23c66f5bd48ea7d","1551a95ddc824413b2d323bd931b3cfd","baf5c3d522d345669f1ce80e1cab0984","698da46bb733451eb94720fc36fdda6d","d418d95bbe9c4650b159a9763b75686b","e684df2c8191415ca7ab188e2d1860c1","68c34a69ea4f4165a1e1fe9843fe881d","ecbfe5e11d9d48c996c4ee0b44ed445c","4a7395e5ad3947d8b6800e20d30d2880","09ee6daa68a14236b59440d40513d0e5","37d22b12848b43368b54c52332cf4e3d","94589ae3408a41b6ae2c43cbb012bcc9","6b2c321c5e484dc1a24c34fef030d345"],"order":"7ef969ac6f054d2ebf8b1fab94aa69f3","choice":"ee563f7026e848ad8533e6a3a1eccf9d","orderText":"Менин атым Айгүл.","choiceText":"Кош болуңуз!","greeting":"Саламатсызбы!"}},"intro":{"common":[{"text":"тёплый","asset":"01416674f4a84d4f8291d22caf29ff15","file":"intro_ru_warm.mp3"},{"text":"Здравствуйте","asset":"a4812e5423504dc4933e7f10b04bac31","file":"intro_ru_hello.mp3"},{"text":"Спасибо","asset":"40d81f410cb84119945286085df269a3","file":"intro_ru_thanks.mp3"},{"text":"помощь","asset":"9ce16d89cc3346949b296c294b897c81","file":"intro_ru_help.mp3"},{"text":"красивый","asset":"1998aabfcf5143c4a97d61f99730c3bb","file":"intro_ru_beautiful.mp3"}],"byLanguage":{"Татарский":[{"text":"Җылы пальто.","asset":"a5265257e1d84fd28f5c924fefbffe56","file":"tt_intro_warm.mp3"},{"text":"Матур һәм җылы пальто.","asset":"53a86e72ae984525bf3e66bccbfc22b4","file":"tt_intro_description.mp3"}],"Чувашский":[{"text":"Ӑшӑ пальто.","asset":"acceabef230d451ba6e4373fc93055ba","file":"cv_intro_warm.mp3"},{"text":"Илемлӗ тата ӑшӑ пальто.","asset":"ba33a5883df34392ae791bcdae0476a4","file":"cv_intro_description.mp3"}],"Киргизский":[{"text":"Жылуу пальто.","asset":"1435b3fcb9bd44999839566ea563564f","file":"ky_intro_warm.mp3"},{"text":"Кооз жана жылуу пальто.","asset":"5ba5f37782694b0a863f8dc516812aa7","file":"ky_intro_description.mp3"}]}}};
  const WOMEN = new Set(CONFIG.storyWomanIndices);
  let active = null;
  let token = 0;
  let useLocal = true;
  function stop() {
    const current = active;
    active = null;
    token += 1;
    if (!current) return;
    if (current.raf) cancelAnimationFrame(current.raf);
    current.audio.pause();
    current.audio.removeAttribute('src');
    current.audio.load();
    current.button.classList.remove('is-speaking');
    current.button.removeAttribute('aria-pressed');
  }
  function resolve(opts) {
    const group = CONFIG.languages[opts.language];
    if (!group) return null;
    if (Number(opts.lesson) === 0) {
      const allIntro = CONFIG.intro.common.concat(CONFIG.intro.byLanguage[opts.language] || []);
      const selected = allIntro.find(record => record.text === opts.text);
      if (!selected) return null;
      const file = selected.file;
      return {url:useLocal ? 'selfstudy-assets/audio/'+file :
        CONFIG.sourceBase+CONFIG.voices.narrator+'/id='+selected.asset+'.mp3',
        trim:0,file:file,role:'narrator'};
    }
    const index = opts.storyIndex === null || opts.storyIndex === undefined || opts.storyIndex === ''
      ? null : Number(opts.storyIndex);
    let asset, role, name, cut = 0;
    if (index !== null && Number.isInteger(index) && index >= 0 && index < 18) {
      asset = group.story[index];
      role = WOMEN.has(index) ? 'woman' : 'learner';
      name = group.prefix + '_story_' + String(index).padStart(2,'0') + '.mp3';
      cut = CONFIG.approvedTailTrimSeconds[opts.language+'::'+index] || 0;
    } else if (opts.text === group.orderText) {
      asset = group.order; role = 'narrator'; name = group.prefix + '_order.mp3';
    } else if (opts.text === group.choiceText) {
      asset = group.choice; role = 'narrator'; name = group.prefix + '_choice.mp3';
    } else if (opts.text === group.greeting) {
      asset = group.story[0]; role = 'woman'; name = group.prefix + '_story_00.mp3';
    } else return null;
    return {url: useLocal ? 'selfstudy-assets/audio/'+name : CONFIG.sourceBase+CONFIG.voices[role]+'/id='+asset+'.mp3',
      trim: useLocal ? 0 : cut, file:name, role:role};
  }
  function play(opts) {
    if (!opts || !opts.button) return false;
    const item = resolve(opts);
    if (!item) return false;
    if (active && active.button === opts.button) { stop(); return true; }
    stop();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    const audio = new Audio();
    audio.preload = 'auto';
    const myToken = ++token;
    const state = {audio:audio,button:opts.button,raf:0};
    active = state;
    audio.addEventListener('playing', () => {
      if (!isActive() || audio.paused) return;
      opts.button.classList.add('is-speaking');
      opts.button.setAttribute('aria-pressed','true');
    });
    function isActive() { return active === state && myToken === token; }
    function checkCutoff() {
      if (!isActive()) return;
      if (item.trim && Number.isFinite(audio.duration) &&
          audio.currentTime >= audio.duration - item.trim - 0.006) {
        stop(); return;
      }
      state.raf = requestAnimationFrame(checkCutoff);
    }
    function fallback() {
      if (!isActive()) return;
      stop();
      if (typeof opts.fallback === 'function') opts.fallback();
    }
    audio.addEventListener('error', fallback, {once:true});
    audio.addEventListener('ended', function () { if (isActive()) stop(); },{once:true});
    audio.addEventListener('timeupdate', function () {
      if (isActive() && item.trim && Number.isFinite(audio.duration) &&
          audio.currentTime >= audio.duration - item.trim - 0.006) stop();
    });
    audio.src = item.url;
    const started = audio.play();
    if (started && typeof started.then === 'function') started.then(function(){
      if (isActive() && item.trim) state.raf = requestAnimationFrame(checkCutoff);
    }).catch(fallback);
    return true;
  }
  document.addEventListener('click', function (event) {
    if (active && !event.target.closest('button[data-speak]')) stop();
  }, true);
  window.TopaSelfStudyAudio = {
    play:play,
    stop:stop,
    setUseLocal:function(value) { stop(); useLocal = Boolean(value); },
    getUseLocal:function() { return useLocal; },
    resolve:resolve,
    count:71,
    version:CONFIG.version
  };
})();