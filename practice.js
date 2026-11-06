/* Voice input only. Provider credentials and trusted curriculum stay on the server. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const mic='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>';
  const launch=document.createElement('button');launch.className='practice-launch';launch.id='practiceBtn';launch.type='button';launch.setAttribute('aria-haspopup','dialog');
  launch.innerHTML='<span class="practice-launch__icon">'+mic+'</span><span><strong>Практика с Топой</strong><small id="practiceLaunchCopy">Говорите на татарском · ответы текстом</small></span>';
  document.querySelector('.course-head').after(launch);
  const modal=document.createElement('div');modal.id='practiceModal';modal.className='practice-modal';modal.hidden=true;
  // Static markup only; provider/user strings are inserted exclusively with textContent.
  modal.innerHTML='<section class="practice-dialog" role="dialog" aria-modal="true" aria-labelledby="practiceTitle"><header class="practice-header"><div><p>ТАТАРСКИЙ · УРОК 1</p><h2 id="practiceTitle">Практика с Топой</h2></div><button class="close" id="practiceClose" type="button" aria-label="Закрыть практику">×</button></header><div class="practice-body" id="practiceBody"><div class="practice-intro" id="practiceIntro"><img src="story-mascot.svg" alt="Топа" width="86" height="86"><div><h3>Выбираем пальто</h3><p>Поздоровайтесь, опишите пальто и поблагодарите. Говорите в микрофон — Топа ответит текстом.</p></div></div><div class="practice-words" aria-label="Слова первого урока"><span>Исәнмесез</span><span>пальто</span><span>кибет</span><span>җылы</span><span>матур</span><span>ярдәм</span><span>Рәхмәт</span><span>һәм</span></div><div class="practice-setup" id="practiceSetup" hidden></div><form class="practice-access" id="practiceAccess" hidden><label for="practiceCode">Код доступа команды</label><input id="practiceCode" type="password" autocomplete="off" maxlength="256" placeholder="Введите код пилота"><label class="practice-consent"><input id="practiceConsent" type="checkbox" required><span>Я согласен отправить запись голоса в Gladia для распознавания, а расшифровку — в Яндекс AI Studio для ответа. История пробного разговора хранится на сервере ТОПА до 24 часов; сроки у провайдеров определяются их условиями.</span></label><button class="primary" id="practiceLogin" type="submit">НАЧАТЬ ПРАКТИКУ</button></form><div class="practice-feed" id="practiceFeed" role="log" aria-label="Разговор с Топой"></div></div><footer class="practice-footer"><p class="practice-status" id="practiceStatus" role="status" aria-live="polite"></p><div class="practice-transcript" id="practiceTranscript" hidden><small>Вот что услышало приложение</small><p id="practiceTranscriptText" lang="tt"></p><div class="practice-transcript__buttons"><button class="primary" id="practiceSend" type="button">Отправить Топе</button><button class="practice-secondary" id="practiceRedo" type="button">Перезаписать</button></div></div><div class="practice-controls" id="practiceControls" hidden><button class="practice-record" id="practiceRecord" type="button">'+mic+'<span id="practiceRecordLabel">Записать реплику</span></button><span class="practice-count" id="practiceCount">0 / 8</span></div><button class="practice-exit" id="practiceEnd" type="button" hidden>Завершить разговор</button></footer></section>';
  document.body.append(modal);
  let token='',session='',turn='',count=0,maxTurns=8,maxSeconds=15,stream=null,recorder=null,clock=null,pollTimer=null,aborter=null,epoch=0,returnFocus=null,oldOverflow='',oldInert=false,phase='idle',elapsed=0,recordStarted=0,config=null,blob=null,requestId='',suppressRecording=false;
  const local=['localhost','127.0.0.1'].includes(location.hostname);
  const rawBase=window.TOPA_PRACTICE?.apiBase||'';
  let base=null;try{if(rawBase){const url=new URL(rawBase);if(url.protocol==='https:'||(local&&url.protocol==='http:'))base=url.origin}else if(local)base=location.origin}catch{}
  function status(text,error=false){$('practiceStatus').textContent=text;$('practiceStatus').classList.toggle('is-error',error)}
  function controls(state){
    phase=state;const recording=state==='recording';$('practiceRecord').classList.toggle('is-recording',recording);
    $('practiceRecord').disabled=!['ready','recording'].includes(state);
    $('practiceRecordLabel').textContent=recording?'Остановить · '+elapsed+' с':'Записать реплику';
    $('practiceTranscript').hidden=state!=='transcribed';
    $('practiceSend').disabled=state!=='transcribed';$('practiceRedo').disabled=state!=='transcribed';
  }
  function releaseMic(){clearInterval(clock);clock=null;if(stream){stream.getTracks().forEach(track=>track.stop());stream=null}}
  function stopCapture(discard=false){suppressRecording=discard;if(recorder&&recorder.state!=='inactive')recorder.stop();releaseMic()}
  function scroll(){const body=$('practiceBody');body.scrollTo({top:body.scrollHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
  function message(value,user=false){
    const entry=document.createElement('div');entry.className='practice-entry'+(user?' practice-entry--user':'');
    if(!user){const image=document.createElement('img');image.src='story-mascot.svg';image.alt='Топа';entry.append(image)}
    const bubble=document.createElement('div');bubble.className='practice-bubble';
    const text=document.createElement('p');text.lang='tt';text.textContent=user?value:value.reply;bubble.append(text);
    if(!user){for(const field of ['correction','explanation'])if(value[field]){const detail=document.createElement('small');detail.lang=field==='correction'?'tt':'ru';detail.textContent=(field==='correction'?'Можно так: ':'')+value[field];if(field==='correction')detail.className='practice-correction';bubble.append(detail)}}
    entry.append(bubble);$('practiceFeed').append(entry);scroll();
  }
  async function api(path,{method='GET',data,body,headers={},signal}={}){
    if(!base)throw Error('Сервер практики ещё не подключён.');
    const response=await fetch(base+'/api/practice'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:data!==undefined?JSON.stringify(data):body,signal:signal||AbortSignal.timeout(90000),credentials:'omit',cache:'no-store'});
    let result;try{result=await response.json()}catch{throw Error(response.status===404?'Сервер практики ещё не подключён.':'Не удалось прочитать ответ сервера.')}
    if(!response.ok){if(response.status===401)token='';const error=Error(result.error?.message||'Не удалось выполнить запрос.');error.code=result.error?.code;error.status=response.status;throw error}
    return result;
  }
  async function open(){
    if(language!=='Татарский')return;
    returnFocus=document.activeElement;oldOverflow=document.body.style.overflow;oldInert=document.querySelector('.app').inert;document.querySelector('.app').inert=true;document.body.style.overflow='hidden';modal.hidden=false;$('practiceClose').focus();
    $('practiceSetup').hidden=true;$('practiceAccess').hidden=true;status('');
    if(session){$('practiceControls').hidden=false;return}
    if(!isLessonCompleted(0)){setup('Сначала пройдите урок 1 «Знакомство». Здесь вы будете практиковать слова, которые уже изучили.');return}
    if(!base){setup('Окно практики готово. Для запуска команде нужно подключить сервер распознавания и наставника. Настройка описана в файле server/README.md.');return}
    const current=++epoch;aborter=new AbortController();status('Подключаем практику…');
    try{
      config=await api('/config',{signal:aborter.signal});if(current!==epoch)return;
      if(!config.configured){setup('Голосовая практика ещё не подключена. Команде нужно настроить сервер и ключи API.');return}
      maxSeconds=config.maxSeconds;maxTurns=config.maxTurns;status('Пробный доступ для команды.');$('practiceAccess').hidden=false;
    }catch(e){if(current===epoch)setup(e.message)}
  }
  function setup(text){$('practiceSetup').textContent=text;$('practiceSetup').hidden=false;$('practiceControls').hidden=true;status('')}
  async function close(){
    const id=session;epoch++;aborter?.abort();clearTimeout(pollTimer);stopCapture(true);session='';turn='';blob=null;requestId='';count=0;controls('idle');
    modal.hidden=true;document.querySelector('.app').inert=oldInert;document.body.style.overflow=oldOverflow;$('practiceFeed').replaceChildren();$('practiceControls').hidden=true;$('practiceEnd').hidden=true;$('practiceTranscript').hidden=true;$('practiceCount').textContent='0 / '+maxTurns;
    if(returnFocus?.isConnected)returnFocus.focus();
    if(id)api('/sessions/'+id+'/end',{method:'POST',data:{}}).catch(()=>{});
  }
  async function login(event){
    event.preventDefault();if(!$('practiceConsent').checked)return;
    const current=epoch;const code=$('practiceCode').value;$('practiceCode').value='';$('practiceLogin').disabled=true;status('Начинаем разговор…');
    try{
      const access=await api('/login',{method:'POST',data:{code}});if(current!==epoch)return;token=access.token;
      const result=await api('/sessions',{method:'POST',data:{language:'Татарский',lessonId:0}});if(current!==epoch){api('/sessions/'+result.id+'/end',{method:'POST',data:{}}).catch(()=>{});return}
      session=result.id;maxTurns=result.maxTurns;count=0;$('practiceAccess').hidden=true;$('practiceControls').hidden=false;$('practiceEnd').hidden=false;message(result.greeting);controls('ready');status('Нажмите на микрофон. Одна реплика — до '+maxSeconds+' секунд.');$('practiceRecord').focus();
    }catch(e){if(current===epoch)status(e.message,true)}finally{$('practiceLogin').disabled=false}
  }
  async function record(){
    if(phase==='recording'){stopCapture();return}
    if(!session||phase!=='ready')return;
    if(!isSecureContext||!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){status('Для записи нужен современный браузер и HTTPS или localhost.',true);return}
    const current=epoch;controls('permission');status('Разрешите доступ к микрофону.');
    try{
      const capture=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      if(current!==epoch||modal.hidden){capture.getTracks().forEach(track=>track.stop());return}
      stream=capture;const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
      recorder=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:32000}:{audioBitsPerSecond:32000});
      const chunks=[];suppressRecording=false;
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      recorder.onerror=()=>{suppressRecording=true;stopCapture(true);controls('ready');status('Запись прервалась. Попробуйте ещё раз.',true)};
      recorder.onstop=()=>{
        releaseMic();if(suppressRecording||current!==epoch)return;
        blob=new Blob(chunks,{type:recorder.mimeType||mime||'audio/webm'});requestId=crypto.randomUUID();upload(current);
      };
      recorder.start();recordStarted=Date.now();elapsed=0;controls('recording');status('Говорите по-татарски. Когда закончите, нажмите «Остановить».');
      clock=setInterval(()=>{elapsed=Math.floor((Date.now()-recordStarted)/1000);$('practiceRecordLabel').textContent='Остановить · '+elapsed+' с';if(elapsed>=maxSeconds-1)stopCapture()},200);
    }catch(e){releaseMic();if(current===epoch){controls('ready');status(e.name==='NotAllowedError'?'Доступ к микрофону закрыт. Разрешите его в настройках браузера.':'Не удалось включить микрофон. Проверьте устройство.',true)}}
  }
  async function upload(current){
    controls('uploading');status('Распознаём вашу реплику…');aborter=new AbortController();
    try{const result=await api('/sessions/'+session+'/audio',{method:'POST',body:blob,headers:{'Content-Type':blob.type,'Idempotency-Key':requestId},signal:aborter.signal});if(current!==epoch)return;turn=result.id;blob=null;await poll(current)}
    catch(e){if(current===epoch){
      if(['audio_invalid','audio_short','audio_long','audio_type','body_size'].includes(e.code)){blob=null;controls('ready');status(e.message,true)}
      else if(['budget_limit','turn_limit','attempt_limit','unauthorized'].includes(e.code)){controls('complete');status(e.message,true);$('practiceRecordLabel').textContent='Практика остановлена'}
      else{controls('upload-retry');status(e.message+' Проверьте отправку: повторится тот же запрос, без новой записи.',true);$('practiceRecord').disabled=false;$('practiceRecordLabel').textContent='Проверить отправку'}
    }}
  }
  async function poll(current,attempt=0){
    if(current!==epoch)return;
    controls('polling');
    try{
      const result=await api('/turns/'+turn);if(current!==epoch)return;
      if(result.state==='transcribed'){$('practiceTranscriptText').textContent=result.transcript;controls('transcribed');status('Проверьте расшифровку. Если приложение услышало неверно — перезапишите.');$('practiceSend').focus();return}
      if(result.state==='done'){finishReply(result);return}
      if(result.state==='error'){controls('ready');status(result.error||'Не удалось обработать запись.',true);turn='';return}
      if(attempt>=60){controls('waiting');status('Распознавание занимает больше времени. Нажмите «Проверить результат» — повторно запись не отправится.');$('practiceRecord').disabled=false;$('practiceRecordLabel').textContent='Проверить результат';return}
      pollTimer=setTimeout(()=>poll(current,attempt+1),2000);
    }catch(e){if(current===epoch){controls('waiting');status(e.message+' Нажмите «Проверить результат».',true);$('practiceRecord').disabled=false;$('practiceRecordLabel').textContent='Проверить результат'}}
  }
  async function send(){
    if(phase!=='transcribed'||!turn)return;const current=epoch;controls('replying');status('Топа готовит ответ…');
    try{const result=await api('/turns/'+turn+'/reply',{method:'POST',data:{}});if(current!==epoch)return;if(result.state==='done')finishReply(result);else await poll(current)}
    catch(e){if(current===epoch){controls('waiting');status(e.message+' Нажмите «Проверить результат».',true);$('practiceRecord').disabled=false;$('practiceRecordLabel').textContent='Проверить результат'}}
  }
  function finishReply(result){
    if(result.id!==turn)return;
    message(result.transcript,true);message(result.answer);count++;turn='';$('practiceCount').textContent=count+' / '+maxTurns;
    controls(count>=maxTurns?'complete':'ready');status(count>=maxTurns?'Практика завершена. Вы поговорили по материалам первого урока.':'Можно записать следующую реплику.');if(count>=maxTurns){$('practiceRecordLabel').textContent='Разговор завершён';$('practiceEnd').focus()}else $('practiceRecord').focus();
  }
  async function redo(){
    const current=epoch;controls('discarding');try{await api('/turns/'+turn+'/discard',{method:'POST',data:{}});if(current!==epoch)return;turn='';controls('ready');status('Запишите фразу ещё раз.')}catch(e){if(current===epoch){controls('transcribed');status(e.message,true)}}
  }
  function refresh(){launch.hidden=language!=='Татарский';$('practiceLaunchCopy').textContent=isLessonCompleted(0)?'Говорите на татарском · ответы текстом':'Откроется после урока 1 «Знакомство»';if(!modal.hidden&&language!=='Татарский')close()}
  launch.addEventListener('click',open);$('practiceClose').addEventListener('click',close);$('practiceEnd').addEventListener('click',close);$('practiceAccess').addEventListener('submit',login);$('practiceRecord').addEventListener('click',()=>phase==='waiting'?poll(epoch):phase==='upload-retry'?upload(epoch):record());$('practiceSend').addEventListener('click',send);$('practiceRedo').addEventListener('click',redo);
  modal.addEventListener('click',event=>{if(event.target===modal)close()});
  modal.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return}
    if(event.key==='Tab'){const buttons=Array.from(modal.querySelectorAll('button,input')).filter(n=>!n.disabled&&n.getClientRects().length);const first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}
  });
  window.addEventListener('topa:progress',refresh);window.addEventListener('topa:section',()=>{if(!modal.hidden)close()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='recording'){stopCapture(true);controls('ready');status('Запись остановлена при сворачивании страницы. Запишите реплику ещё раз.')}});
  window.addEventListener('pagehide',()=>stopCapture(true));refresh();
})();
