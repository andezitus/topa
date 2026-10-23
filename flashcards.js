/* TOPA flashcards. The glossary and completed lessons are the only content source.
 * Progress is browser-local, separately keyed by the selected course language.
 * Dates are absolute timestamps; future cards are excluded from automatic sessions.
 */
(function(){
  'use strict';
  const KEY='topa-word-review-v1';
  const DAY=86400000;
  const intervals=[1,3,7,14,30,60];
  let store={version:1,languages:{}};
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(saved&&saved.version===1&&saved.languages&&typeof saved.languages==='object')store=saved;
  }catch(error){/* A malformed review record does not affect course progress. */}
  let session=null,flipped=false,lastFocus=null,sessionLanguage=null;
  const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="13" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 3h10a3 3 0 0 1 3 3v11M7 11h5m-5 4h3" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>';
  const root=document.createElement('div');
  root.id='reviewModal';root.className='modal review-modal';
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','reviewTitle');
  root.innerHTML='<section class="review-dialog" tabindex="-1"><header class="review-header"><div class="review-header__title"><span class="review-header__symbol">'+icon+'</span><div><h2 id="reviewTitle">Карточки повторения</h2><p id="reviewLanguage"></p></div></div><button class="close" id="closeReview" type="button" aria-label="Закрыть повторение">×</button></header><div id="reviewContent"></div></section>';
  document.body.append(root);
  const content=root.querySelector('#reviewContent');
  const clone=value=>JSON.parse(JSON.stringify(value));
  function persist(){
    try{localStorage.setItem(KEY,JSON.stringify(store))}catch(error){showToast('Не удалось сохранить повторение. Проверьте свободное место в браузере.')}
  }
  function state(){
    if(!store.languages[language]||typeof store.languages[language]!=='object')store.languages[language]={cards:{},session:null};
    const value=store.languages[language];
    if(!value.cards||typeof value.cards!=='object')value.cards={};
    return value;
  }
  function allWords(){
    return getGlossaryWords(language);
  }
  function unlockedWords(){
    return allWords().filter(word=>word.lessons.some(number=>isLessonCompleted(number)));
  }
  function record(id){
    const cards=state().cards;
    if(!cards[id]||typeof cards[id]!=='object')cards[id]={createdAt:Date.now(),lastReviewed:0,due:0,streak:0,mistakes:0,reviews:0,manual:false,lessonMistakes:0};
    return cards[id];
  }
  function sync(){
    const words=unlockedWords();
    const fresh=words.filter(word=>!state().cards[word.id]);
    words.forEach(word=>record(word.id));
    const saved=state().session;
    if(saved&&Array.isArray(saved.queue)&&saved.index<saved.queue.length){
      fresh.forEach(word=>{if(!saved.queue.slice(saved.index).includes(word.id))saved.queue.push(word.id)});
    }
    persist();
  }
  function rank(rec){
    if(rec.manual)return 0;
    if(rec.mistakes>0&&rec.streak===0)return 1;
    if(rec.lastReviewed)return 2;
    return 3;
  }
  function dueWords(){
    const now=Date.now();
    return unlockedWords().filter(word=>{const rec=record(word.id);return rec.manual||rec.due<=now}).sort((a,b)=>{
      const aa=record(a.id),bb=record(b.id);
      return rank(aa)-rank(bb)||aa.due-bb.due||bb.mistakes-aa.mistakes||bb.createdAt-aa.createdAt||a.id.localeCompare(b.id);
    });
  }
  function refreshLaunch(){
    sync();
    const words=unlockedWords(),due=dueWords();
    const saved=state().session;
    const pending=saved&&Array.isArray(saved.queue)?saved.queue.slice(saved.index).filter(id=>words.some(word=>word.id===id)):[];
    const count=new Set([...pending,...due.map(word=>word.id)]).size;
    $('#reviewDueCount').textContent=count;
    $('#reviewDueLabel').textContent=!words.length?'Слова появятся после урока':count?count+' '+plural(count,'карточка ждёт','карточки ждут','карточек ждут')+' повторения':'Всё повторено на сегодня';
    $('#reviewBtn').setAttribute('aria-label','Повторить. '+$('#reviewDueLabel').textContent);
  }
  function plural(n,one,few,many){return n%10===1&&n%100!==11?one:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?few:many}
  function refreshGuide(){
    const valid=new Set(unlockedWords().map(word=>word.id));
    document.querySelectorAll('[data-review-add]').forEach(button=>{
      const id=button.dataset.reviewAdd;
      const queued=valid.has(id)&&record(id).manual;
      button.textContent=queued?'Добавлено для повторения':'Добавить для повторения';
      button.disabled=queued||!valid.has(id);
    });
    document.querySelectorAll('[data-review-lesson]').forEach(checkbox=>{
      const words=unlockedWords().filter(word=>word.lesson===Number(checkbox.dataset.reviewLesson));
      const selected=words.filter(word=>record(word.id).manual).length;
      checkbox.checked=words.length>0&&selected===words.length;
      checkbox.indeterminate=selected>0&&selected<words.length;
      checkbox.disabled=!words.length;
    });
  }
  function createSession(){
    const candidates=dueWords().slice(0,10);
    if(!candidates.length)return null;
    return {queue:candidates.map(word=>word.id),index:0,ratings:{},attempts:{},undo:null,createdAt:Date.now()};
  }
  function saveSession(){state().session=session;persist()}
  function currentWord(){
    return session?unlockedWords().find(word=>word.id===session.queue[session.index]):null;
  }
  function counters(){
    const ratings=Object.values(session.ratings);
    return {learning:ratings.filter(value=>!value).length,known:ratings.filter(Boolean).length};
  }
  function open(){
    sync();lastFocus=document.activeElement;sessionLanguage=language;
    const allowed=new Set(unlockedWords().map(word=>word.id));
    const saved=state().session;
    session=saved&&Array.isArray(saved.queue)&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<saved.queue.length&&saved.queue.every(id=>allowed.has(id))?saved:createSession();
    saveSession();
    $('#reviewLanguage').textContent=language+' язык';
    root.classList.add('open');document.body.style.overflow='hidden';
    root.querySelector('.review-dialog').scrollTop=0;
    render();$('#closeReview').focus();
  }
  function close(){
    root.classList.remove('open');
    if(!document.querySelector('.modal.open'))document.body.style.overflow='';
    if('speechSynthesis' in window)window.speechSynthesis.cancel();
    refreshLaunch();
    if(lastFocus&&lastFocus.isConnected)lastFocus.focus();
  }
  function emptyIcon(){return '<div class="review-empty__icon">'+icon+'</div>'}
  function renderEmpty(){
    const words=unlockedWords();
    content.innerHTML='<div class="review-empty">'+emptyIcon()+'<h3>'+(words.length?'Всё повторено на сегодня':'Сначала познакомимся со словами')+'</h3><p>'+(words.length?'Вы можете выбрать любое изученное слово в справочнике и добавить его в карточки.':'Завершите ознакомительный урок. Его слова появятся здесь автоматически — вместе с переводом и удобным планом повторения.')+'</p><button class="primary" id="reviewEmptyAction" type="button">'+(words.length?'ОТКРЫТЬ СПРАВОЧНИК':'К УРОКАМ')+'</button></div>';
    $('#reviewEmptyAction').onclick=()=>{close();if(words.length)openGuide();else showSection('Обучение')};
  }
  function renderResult(){
    const counts=counters(),total=Object.keys(session.ratings).length;
    content.innerHTML='<div class="review-empty">'+emptyIcon()+'<h3>Слова стали ближе</h3><p>Вы повторили '+total+' '+plural(total,'слово','слова','слов')+' на '+language.toLowerCase()+' языке. Мы сохранили результат и запланировали следующие повторения.</p><div class="review-summary"><span><strong>'+counts.learning+'</strong>Ещё изучаю</span><span><strong>'+counts.known+'</strong>Знаю</span></div><div class="review-empty__actions"><button class="primary" id="reviewDone" type="button">ГОТОВО</button><button class="secondary" id="reviewMore" type="button"'+(!dueWords().length?' hidden':'')+'>ЕЩЁ КАРТОЧКИ</button><button class="secondary" id="reviewResultUndo" type="button"'+(!session.undo?' hidden':'')+'>ОТМЕНИТЬ ПОСЛЕДНИЙ ОТВЕТ</button></div></div>';
    $('#reviewDone').onclick=close;
    $('#reviewMore').onclick=()=>{session=createSession();saveSession();render()};
    $('#reviewResultUndo').onclick=undo;
  }
  function render(){
    flipped=false;
    if(!session){renderEmpty();return}
    if(session.index>=session.queue.length){renderResult();return}
    const word=currentWord();
    if(!word){session=null;saveSession();renderEmpty();return}
    const counts=counters();
    content.innerHTML=`
      <div class="review-counters">
        <span class="review-counter"><b>${counts.learning}</b>Ещё изучаю</span>
        <span class="review-counter review-counter--known">Знаю<b>${counts.known}</b></span>
      </div>
      <div class="review-track" role="progressbar" aria-label="Повторение карточек" aria-valuemin="0" aria-valuemax="${session.queue.length}" aria-valuenow="${session.index}">
        <i style="width:${session.index/session.queue.length*100}%"></i>
      </div>
      <div class="review-card-shell">
        <button class="review-flip" id="reviewFlip" type="button" aria-label="${escapeHtml(word.word)}. Показать перевод" aria-pressed="false">
          <span class="review-flip__inner">
            <span class="review-face review-face--front" aria-hidden="false">
              <strong>${escapeHtml(word.word)}</strong>
              <span class="review-face__hint">Нажмите, чтобы увидеть перевод</span>
            </span>
            <span class="review-face review-face--back" aria-hidden="true" hidden>
              <span class="review-face__label">Перевод на русский</span>
              <strong>${escapeHtml(word.translation)}</strong>
            </span>
          </span>
        </button>
        <div class="review-card-tools">
          <button class="review-audio" id="reviewAudio" type="button" aria-label="Прослушать слово"><img src="speaker-icon.svg" alt=""></button>
        </div>
      </div>
      <div class="review-bottom">
        <span class="review-position" aria-label="Карточка ${session.index+1} из ${session.queue.length}">Карточка ${session.index+1} из ${session.queue.length}</span>
        <div class="review-ratings">
          <button class="review-rate review-rate--learning" id="reviewLearning" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>Ещё изучаю</button>
          <button class="review-rate review-rate--known" id="reviewKnown" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>Знаю</button>
        </div>
        <button class="review-undo" id="reviewUndo" type="button"${!session.undo?' disabled':''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5-5 5 5 5M4 10h10a6 6 0 0 1 0 12h-4"/></svg>Отменить</button>
      </div>`;
    $('#reviewFlip').onclick=flip;
    $('#reviewAudio').onclick=()=>speak(word.word);
    $('#reviewLearning').onclick=()=>rate(false);
    $('#reviewKnown').onclick=()=>rate(true);
    $('#reviewUndo').onclick=undo;
  }
  function flip(){
    if(!currentWord())return;
    flipped=!flipped;
    $('#reviewFlip').setAttribute('aria-pressed',String(flipped));
    $('#reviewFlip').setAttribute('aria-label',flipped?currentWord().translation+'. Вернуться к слову':currentWord().word+'. Показать перевод');
    root.querySelector('.review-face--front').hidden=flipped;
    root.querySelector('.review-face--front').setAttribute('aria-hidden',String(flipped));
    root.querySelector('.review-face--back').hidden=!flipped;
    root.querySelector('.review-face--back').setAttribute('aria-hidden',String(!flipped));
  }
  function rate(known){
    const word=currentWord();
    if(!word||sessionLanguage!==language)return;
    const rec=record(word.id);
    const before=clone(session);delete before.undo;
    session.undo={id:word.id,record:clone(rec),session:before};
    rec.manual=false;delete rec.manualDueBefore;rec.lastReviewed=Date.now();rec.reviews++;
    if(known){rec.streak=Math.min(intervals.length,rec.streak+1);rec.due=Date.now()+intervals[rec.streak-1]*DAY}
    else{rec.streak=0;rec.mistakes++;rec.due=Date.now()+10*60000}
    session.ratings[word.id]=known;
    session.attempts[word.id]=(session.attempts[word.id]||0)+1;
    if(!known&&session.attempts[word.id]<2){
      // A difficult card returns after two other cards, at most once per session.
      session.queue.splice(Math.min(session.index+3,session.queue.length),0,word.id);
    }
    session.index++;saveSession();refreshLaunch();render();
    const target=$('#reviewFlip')||$('#reviewDone');if(target)target.focus();
  }
  function undo(){
    if(!session||!session.undo)return;
    const snapshot=session.undo;
    state().cards[snapshot.id]=snapshot.record;
    session=snapshot.session;session.undo=null;
    saveSession();refreshLaunch();render();
    if($('#reviewFlip'))$('#reviewFlip').focus();
  }
  function addWords(ids){
    const allowed=new Set(unlockedWords().map(word=>word.id));
    const saved=state().session;
    let added=0;
    [...new Set(ids)].filter(id=>allowed.has(id)).forEach(id=>{
      const rec=record(id);if(rec.manual)return;
      rec.manualDueBefore=rec.due;rec.manual=true;added++;
      if(saved&&saved.index<saved.queue.length&&!saved.queue.slice(saved.index).includes(id))saved.queue.push(id);
    });
    if(!added)return;
    persist();refreshLaunch();refreshGuide();
  }
  function add(id){addWords([id])}
  function addLesson(number){
    addWords(unlockedWords().filter(word=>word.lesson===number).map(word=>word.id));
  }
  function removeLesson(number){
    const cancelled=new Set();
    unlockedWords().filter(word=>word.lesson===number).forEach(word=>{
      const rec=record(word.id);if(!rec.manual)return;
      // Older builds forced manual cards' due dates to zero. Recover their
      // prior interval when no snapshot exists; keep genuinely due/new words.
      rec.due=Number.isFinite(rec.manualDueBefore)?rec.manualDueBefore:
        rec.lastReviewed&&rec.streak>0?rec.lastReviewed+intervals[Math.min(intervals.length,rec.streak)-1]*DAY:rec.due;
      rec.manual=false;delete rec.manualDueBefore;cancelled.add(word.id);
    });
    const saved=state().session;
    if(saved&&Array.isArray(saved.queue)&&cancelled.size){
      const history=saved.queue.slice(0,saved.index);
      const pending=saved.queue.slice(saved.index).filter(id=>!cancelled.has(id)||record(id).due<=Date.now());
      saved.queue=history.concat(pending);saved.undo=null;
    }
    persist();refreshLaunch();refreshGuide();
  }
  function noteMistake(detail){
    if(detail.correct)return;
    let ids=[];
    if(detail.words){
      const normalize=value=>value.toLocaleLowerCase().replace(/[!?.…\s]/g,'');
      const terms=detail.words.map(normalize);
      ids=allWords().filter(word=>terms.includes(normalize(word.word))).map(word=>word.id);
    }else if(detail.lesson===1){
      const indexMap={0:[0],1:[1,6],3:[5],4:[4]};
      ids=(indexMap[detail.task]||[]).map(index=>'1:'+index);
    }else{
      // Corresponding glossary concepts in the story: greeting, help, coat,
      // beautiful, work, shop. Quiz mistakes flag their relevant vocabulary.
      const storyMap={1:['1:0'],3:['2:2'],5:['2:1','2:4'],7:['2:3'],9:['2:0','2:3']};
      ids=storyMap[detail.task]||[];
    }
    ids.forEach(id=>{const rec=record(id);rec.mistakes++;rec.lessonMistakes++;rec.streak=0;rec.due=0;if(rec.manual)rec.manualDueBefore=0});
    const saved=state().session;
    const allowed=new Set(unlockedWords().map(word=>word.id));
    if(saved&&Array.isArray(saved.queue)&&saved.index<saved.queue.length){
      ids.filter(id=>allowed.has(id)&&!saved.queue.slice(saved.index).includes(id)).forEach(id=>saved.queue.push(id));
    }
    persist();refreshLaunch();
  }
  root.addEventListener('click',event=>{if(event.target===root)close()});
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return}
    if(event.key==='Tab'){
      const focusables=Array.from(root.querySelectorAll('button:not(:disabled),[tabindex="0"]')).filter(el=>!el.hidden&&el.getClientRects().length);
      const first=focusables[0],last=focusables[focusables.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
    if(event.key==='ArrowLeft'&&$('#reviewLearning')&&!$('#reviewLearning').disabled){event.preventDefault();rate(false)}
    if(event.key==='ArrowRight'&&$('#reviewKnown')&&!$('#reviewKnown').disabled){event.preventDefault();rate(true)}
  });
  $('#closeReview').onclick=close;
  $('#reviewBtn').onclick=open;
  $('#guideReviewBtn').onclick=()=>{
    closeGuide();
    $('#reviewBtn').focus({preventScroll:true});
    open();
  };
  $('#guideContent').addEventListener('click',event=>{const button=event.target.closest('[data-review-add]');if(button)add(button.dataset.reviewAdd)});
  $('#guideContent').addEventListener('change',event=>{
    const checkbox=event.target.closest('[data-review-lesson]');
    if(!checkbox)return;
    const number=Number(checkbox.dataset.reviewLesson);
    if(checkbox.checked)addLesson(number);else removeLesson(number);
  });
  window.addEventListener('topa:guide',refreshGuide);
  window.addEventListener('topa:progress',refreshLaunch);
  window.addEventListener('topa:answer',event=>noteMistake(event.detail));
  window.addEventListener('focus',refreshLaunch);
  // Other open tabs share review statistics; never display another language's deck.
  window.addEventListener('storage',event=>{
    if(event.key===KEY&&event.newValue){try{const saved=JSON.parse(event.newValue);if(saved.version===1&&saved.languages){store=saved;if(root.classList.contains('open'))close();refreshLaunch();refreshGuide()}}catch(error){}}
  });
  refreshLaunch();
})();
