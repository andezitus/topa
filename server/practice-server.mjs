// Node.js 24+, built-in modules only. Paid providers are never called in tests.
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {readFileSync, mkdirSync, existsSync} from 'node:fs';
import {dirname, resolve, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const here=dirname(fileURLToPath(import.meta.url));
export const curriculum=JSON.parse(readFileSync(resolve(here,'curriculum.json'),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const uid=()=>randomBytes(24).toString('hex');
const safeEqual=(a,b)=>timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));
const uuidPattern=/^[a-f0-9-]{20,64}$/i;
const types=new Set(['audio/webm','audio/mp4','audio/ogg','audio/wav','audio/x-wav']);
const seconds=()=>Math.floor(Date.now()/1000);
class PublicError extends Error{constructor(status,code,message){super(message);Object.assign(this,{status,code})}}
const fail=(status,code,message)=>{throw new PublicError(status,code,message)};

export function settings(env=process.env){
  const num=(key,fallback,min,max)=>{const n=Number(env[key]||fallback);if(!Number.isInteger(n)||n<min||n>max)throw Error('Invalid setting '+key);return n};
  const origins=(env.ALLOWED_ORIGINS||'http://localhost:8080,http://127.0.0.1:8080').split(',').map(x=>x.trim());
  for(const origin of origins){const u=new URL(origin);if(!['http:','https:'].includes(u.protocol)||u.origin!==origin)throw Error('Use exact origins without paths')}
  return {
    port:num('PORT',8080,1,65535),host:env.HOST||'127.0.0.1',
    db:env.DATA_PATH||resolve(here,'data/practice.sqlite'),origins,
    gladia:env.GLADIA_API_KEY||'',yandex:env.YANDEX_API_KEY||'',model:env.YANDEX_MODEL_URI||'',folder:env.YANDEX_FOLDER_ID||'',
    pilotCode:env.PILOT_ACCESS_CODE||'',
    enabled:env.PRACTICE_ENABLED==='true',
    turns:num('MAX_TURNS',8,1,12),duration:num('MAX_AUDIO_SECONDS',15,3,30),
    asrCap:num('MAX_ASR_JOBS_TOTAL',100,1,10000),llmCap:num('MAX_LLM_CALLS_TOTAL',100,1,10000),
    tokenCap:num('MAX_LLM_OUTPUT_TOKENS',320,64,600),
    sessionCap:num('MAX_SESSIONS_PER_ACCESS',3,1,10),retention:num('RETENTION_HOURS',24,1,24)
  };
}

// Decode a bounded stream to PCM; do not trust duration/format supplied by a browser.
// No URL/file protocols and no shell execution; every input is piped bytes.
export function normalizeAudio(bytes,maxSeconds){
  return new Promise((resolvePromise,reject)=>{
    const child=spawn('ffmpeg',['-hide_banner','-loglevel','error','-threads','1','-protocol_whitelist','pipe','-i','pipe:0','-vn','-t',String(maxSeconds+1),'-ac','1','-ar','16000','-f','s16le','pipe:1'],{stdio:['pipe','pipe','ignore']});
    let chunks=[],size=0,settled=false;
    const timer=setTimeout(()=>{child.kill('SIGKILL');finish(new PublicError(422,'audio_invalid','Не удалось прочитать запись. Запишите фразу ещё раз.'))},10000);
    function finish(error,value){if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolvePromise(value)}
    child.on('error',()=>finish(new PublicError(503,'audio_decoder','Сервер записи ещё не настроен.')));
    child.stdin.on('error',()=>{});
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>32000*(maxSeconds+1.5)){child.kill('SIGKILL');finish(new PublicError(413,'audio_long','Запись слишком длинная.'))}else chunks.push(chunk)});
    child.on('close',code=>{
      if(code!==0)return finish(new PublicError(422,'audio_invalid','Не удалось прочитать запись. Попробуйте ещё раз.'));
      const duration=size/32000;
      if(duration>maxSeconds+.1)return finish(new PublicError(413,'audio_long','Одна запись — не более '+maxSeconds+' секунд.'));
      if(duration<.25)return finish(new PublicError(422,'audio_short','Запись слишком короткая. Произнесите фразу ещё раз.'));
      const pcm=Buffer.concat(chunks),header=Buffer.alloc(44);
      header.write('RIFF',0);header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(16000,24);header.writeUInt32LE(32000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
      finish(null,{wav:Buffer.concat([header,pcm]),duration});
    });
    child.stdin.end(bytes);
  });
}

export function validateAnswer(value){
  let data;try{data=JSON.parse(value)}catch{fail(502,'reply_format','Наставник не смог подготовить учебный ответ. Попробуйте следующую реплику.')}
  if(!data||Array.isArray(data)||typeof data!=='object'||Object.keys(data).sort().join(',')!=='correction,explanation,reply')fail(502,'reply_format','Не удалось подготовить учебный ответ.');
  for(const [key,max] of [['reply',350],['explanation',600],['correction',200]]){
    if(typeof data[key]!=='string'||data[key].length>max||/[<>]|https?:|data:|javascript:/i.test(data[key]))fail(502,'reply_format','Не удалось подготовить учебный ответ.');
  }
  if(!data.reply.trim())fail(502,'reply_format','Наставник вернул пустой ответ.');
  return data;
}

export function makeProviders(config){
  async function request(url,options={}){
    // Fixed provider hosts; never follow redirects with a credential.
    let response;
    try{response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(35000)})}catch{fail(502,'provider_unavailable','Сервис временно не отвечает. Подождите и проверьте результат.')}
    if(!response.ok)fail(502,'provider_unavailable','Сервис временно недоступен. Проверьте подключение и лимиты у провайдера.');
    const raw=await response.text();if(raw.length>2000000)fail(502,'provider_response','Не удалось прочитать ответ сервиса.');
    try{return JSON.parse(raw)}catch{fail(502,'provider_response','Сервис вернул непонятный ответ.')}
  }
  const asrHeaders={'x-gladia-key':config.gladia};
  return {
    async submit(wav){
      const form=new FormData();form.append('audio',new Blob([wav],{type:'audio/wav'}),'speech.wav');
      const uploaded=await request('https://api.gladia.io/v2/upload',{method:'POST',headers:asrHeaders,body:form});
      if(typeof uploaded.audio_url!=='string'||!uploaded.audio_url.startsWith('https://'))fail(502,'provider_response','Не удалось загрузить запись.');
      const job=await request('https://api.gladia.io/v2/pre-recorded',{method:'POST',headers:{...asrHeaders,'Content-Type':'application/json'},body:JSON.stringify({audio_url:uploaded.audio_url,model:'solaria-1',language_config:{languages:['tt'],code_switching:false},diarization:false,translation:false,summarization:false,audio_to_llm:false})});
      if(typeof job.id!=='string'||!uuidPattern.test(job.id))fail(502,'provider_response','Не удалось начать распознавание.');
      return job.id;
    },
    async poll(id){
      const data=await request('https://api.gladia.io/v2/pre-recorded/'+encodeURIComponent(id),{headers:asrHeaders});
      if(data.status==='done')return {done:true,text:data.result?.transcription?.full_transcript};
      if(data.status==='error')fail(502,'asr_failed','Не удалось распознать запись. Произнесите фразу ещё раз.');
      return {done:false};
    },
    async reply(messages){
      const data=await request('https://ai.api.cloud.yandex.net/v1/chat/completions',{method:'POST',headers:{Authorization:'Api-Key '+config.yandex,'Content-Type':'application/json','OpenAI-Project':config.folder},body:JSON.stringify({model:config.model,messages,temperature:.3,max_completion_tokens:config.tokenCap,reasoning_effort:'none',response_format:{type:'json_object'},store:false,stream:false})});
      return validateAnswer(data.choices?.[0]?.message?.content);
    }
  };
}

export function createPracticeService(config,{providers=makeProviders(config),decode=normalizeAudio}={}){
  mkdirSync(dirname(config.db),{recursive:true,mode:0o700});
  const db=new DatabaseSync(config.db);db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS access_tokens(token TEXT PRIMARY KEY,expires INTEGER,created INTEGER);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,owner TEXT,created INTEGER,expires INTEGER,ended INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS turns(id TEXT PRIMARY KEY,session TEXT,request TEXT,digest TEXT,state TEXT,job TEXT,transcript TEXT,answer TEXT,error TEXT,created INTEGER,poll_after INTEGER DEFAULT 0,UNIQUE(session,request));
    CREATE TABLE IF NOT EXISTS counters(name TEXT PRIMARY KEY,n INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS throttles(key TEXT PRIMARY KEY,window INTEGER,n INTEGER);
    CREATE INDEX IF NOT EXISTS turn_session ON turns(session);`);
  // An interrupted paid submission must not be retried automatically after restart.
  db.prepare("UPDATE turns SET state='error',error=? WHERE state IN ('uploading','replying')").run('Обработка прервалась при перезапуске сервера. Новая запись расходует отдельную попытку.');
  let workers=0,decoders=0;
  const configured=()=>config.enabled&&config.pilotCode.length>=20&&!config.pilotCode.includes('REPLACE_')&&!!config.gladia&&!!config.yandex&&/^gpt:\/\/[^/]+\/[^/]+/.test(config.model)&&!config.model.includes('YOUR_')&&!!config.folder;
  const get=(sql,...args)=>db.prepare(sql).get(...args);
  const run=(sql,...args)=>db.prepare(sql).run(...args);
  function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v}catch(e){db.exec('ROLLBACK');throw e}}
  function reserve(name,max){const n=get('SELECT n FROM counters WHERE name=?',name)?.n||0;if(n>=max)fail(429,'budget_limit','Лимит пробного запуска исчерпан. Обратитесь к команде ТОПА.');run('INSERT INTO counters(name,n) VALUES(?,1) ON CONFLICT(name) DO UPDATE SET n=n+1',name)}
  function throttle(key,max,windowSeconds){
    const window=Math.floor(seconds()/windowSeconds)*windowSeconds,old=get('SELECT * FROM throttles WHERE key=?',key);
    if(old?.window===window&&old.n>=max)fail(429,'rate_limit','Слишком много попыток. Подождите немного.');
    run('INSERT INTO throttles(key,window,n) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window=excluded.window,n=CASE WHEN throttles.window=excluded.window THEN throttles.n+1 ELSE 1 END',key,window);
  }
  function cleanup(){const now=seconds();run('DELETE FROM turns WHERE created<?',now-config.retention*3600);run('DELETE FROM sessions WHERE expires<?',now);run('DELETE FROM access_tokens WHERE expires<?',now);run('DELETE FROM throttles WHERE window<?',now-7200)}
  const cleanupTimer=setInterval(cleanup,60000);cleanupTimer.unref();cleanup();
  function auth(req){
    const token=req.headers.authorization?.replace(/^Bearer /,'')||'';
    if(token.length!==48)fail(401,'unauthorized','Введите код доступа команды.');
    const owner=hash(token);if(!get('SELECT token FROM access_tokens WHERE token=? AND expires>?',owner,seconds()))fail(401,'unauthorized','Доступ истёк. Введите код команды ещё раз.');return owner;
  }
  function ownedSession(id,owner){const s=get('SELECT * FROM sessions WHERE id=? AND owner=? AND expires>?',id,owner,seconds());if(!s)fail(404,'not_found','Разговор не найден или уже завершён.');if(s.ended)fail(409,'ended','Разговор завершён.');return s}
  function ownedTurn(id,owner){const t=get('SELECT turns.* FROM turns JOIN sessions ON turns.session=sessions.id WHERE turns.id=? AND sessions.owner=? AND sessions.expires>? AND sessions.ended=0',id,owner,seconds());if(!t)fail(404,'not_found','Запись не найдена.');return t}
  const publicTurn=t=>({id:t.id,state:t.state,transcript:t.transcript||'',answer:t.answer?JSON.parse(t.answer):null,error:t.error||null});
  async function body(req,max=4096){
    if(req.headers['transfer-encoding'])fail(400,'body_format','Неподдерживаемый формат запроса.');
    const length=Number(req.headers['content-length']);if(!Number.isSafeInteger(length)||length<0||length>max)fail(413,'body_size','Слишком большой запрос.');
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max)fail(413,'body_size','Слишком большой запрос.');chunks.push(chunk)}
    if(size!==length)fail(400,'body_size','Неполный запрос.');return Buffer.concat(chunks);
  }
  async function json(req){
    if(req.headers['content-type']?.split(';')[0]!=='application/json')fail(415,'content_type','Нужен JSON-запрос.');
    let data;try{data=JSON.parse((await body(req)).toString())}catch(e){if(e instanceof PublicError)throw e;fail(400,'json_invalid','Неверный запрос.')}
    if(!data||Array.isArray(data)||typeof data!=='object')fail(400,'json_invalid','Неверный запрос.');return data;
  }
  async function route(req,path){
    if(req.method==='GET'&&path==='/api/practice/config')return {configured:!!configured(),language:'Татарский',lessonId:0,maxSeconds:config.duration,maxTurns:config.turns,title:curriculum.title};
    if(!configured())fail(503,'not_configured','Голосовая практика ещё не подключена. Команде нужно настроить сервер и ключи API.');
    if(req.method==='POST'&&path==='/api/practice/login'){
      throttle('login:'+hash(req.socket.remoteAddress||''),10,900);throttle('login-global',50,900);
      const data=await json(req);if(typeof data.code!=='string'||data.code.length>256||!safeEqual(data.code,config.pilotCode))fail(401,'access_code','Неверный код доступа.');
      const token=uid();run('INSERT INTO access_tokens VALUES(?,?,?)',hash(token),seconds()+3600,seconds());return {token,expiresIn:3600};
    }
    const owner=auth(req);throttle('api:'+owner,120,60);
    if(req.method==='POST'&&path==='/api/practice/sessions'){
      const data=await json(req);if(data.language!=='Татарский'||data.lessonId!==0||Object.keys(data).length!==2)fail(400,'lesson','Для пилота доступен только первый урок татарского языка.');
      if(get('SELECT count(*) AS n FROM sessions WHERE owner=?',owner).n>=config.sessionCap)fail(429,'session_limit','Лимит разговоров на этот вход исчерпан.');
      // A global cap also prevents obtaining unbounded sessions with a known pilot code.
      transaction(()=>reserve('sessions',config.asrCap));
      const id=uid();run('INSERT INTO sessions(id,owner,created,expires) VALUES(?,?,?,?)',id,owner,seconds(),seconds()+3600);return {id,greeting:curriculum.greeting,maxTurns:config.turns};
    }
    let match=path.match(/^\/api\/practice\/sessions\/([a-f0-9]{48})\/end$/);
    if(req.method==='POST'&&match){const s=ownedSession(match[1],owner);run('UPDATE sessions SET ended=1 WHERE id=?',s.id);run('DELETE FROM turns WHERE session=?',s.id);return {ended:true}}
    match=path.match(/^\/api\/practice\/sessions\/([a-f0-9]{48})\/audio$/);
    if(req.method==='POST'&&match){
      const s=ownedSession(match[1],owner),request=req.headers['idempotency-key'];
      if(typeof request!=='string'||!uuidPattern.test(request))fail(400,'request_id','Нужен идентификатор записи.');
      if(!types.has(req.headers['content-type']?.split(';')[0]))fail(415,'audio_type','Браузер отправил неподдерживаемый формат записи.');
      const audio=await body(req,2*1024*1024),digest=hash(audio),old=get('SELECT * FROM turns WHERE session=? AND request=?',s.id,request);
      if(old){if(old.digest!==digest)fail(409,'idempotency_conflict','Идентификатор уже использован для другой записи.');return publicTurn(old)}
      if(decoders>=2)fail(429,'busy','Сервис занят. Попробуйте через несколько секунд.');
      decoders++;let normalized;try{normalized=await decode(audio,config.duration)}finally{decoders--}
      const id=uid();
      transaction(()=>{
        ownedSession(s.id,owner);
        if(get("SELECT count(*) AS n FROM turns WHERE session=? AND state IN ('uploading','processing','transcribed','replying')",s.id).n)fail(409,'pending','Сначала отправьте или отмените текущую запись.');
        if(get("SELECT count(*) AS n FROM turns WHERE session=? AND state='done'",s.id).n>=config.turns)fail(429,'turn_limit','Практика завершена. Все реплики использованы.');
        if(get('SELECT count(*) AS n FROM turns WHERE session=?',s.id).n>=config.turns+4)fail(429,'attempt_limit','Лимит записей этого разговора исчерпан.');
        if(workers>=2)fail(429,'busy','Сервис занят. Попробуйте немного позже.');
        reserve('asr',config.asrCap);
        run('INSERT INTO turns(id,session,request,digest,state,created) VALUES(?,?,?,?,?,?)',id,s.id,request,digest,'uploading',seconds());
      });
      workers++;
      try{const job=await providers.submit(normalized.wav);run("UPDATE turns SET job=?,state='processing' WHERE id=?",job,id)}
      catch(e){run("UPDATE turns SET state='error',error=? WHERE id=?",'Не удалось отправить запись. Повторная отправка может расходовать ещё одну попытку.',id);throw e}
      finally{workers--}
      return publicTurn(ownedTurn(id,owner));
    }
    match=path.match(/^\/api\/practice\/turns\/([a-f0-9]{48})(\/reply|\/discard)?$/);
    if(match){
      let t=ownedTurn(match[1],owner);
      if(req.method==='POST'&&match[2]==='/discard'){
        if(!['processing','transcribed','error'].includes(t.state))fail(409,'state','Эту запись уже нельзя отменить.');
        run("UPDATE turns SET state='discarded',transcript=NULL,answer=NULL WHERE id=?",t.id);return {discarded:true};
      }
      if(req.method==='GET'&&!match[2]){
        if(t.state==='processing'&&seconds()>=t.poll_after&&workers<2){
          run('UPDATE turns SET poll_after=? WHERE id=?',seconds()+3,t.id);workers++;
          try{
            const result=await providers.poll(t.job);
            if(result.done){
              const text=typeof result.text==='string'?result.text.trim():'';
              if(!text||text.length>500)run("UPDATE turns SET state='error',error=? WHERE id=? AND state='processing'",'Не удалось разобрать короткую фразу. Запишите её ещё раз.',t.id);
              else run("UPDATE turns SET state='transcribed',transcript=? WHERE id=? AND state='processing'",text,t.id);
            }
          }finally{workers--}
        }
        t=ownedTurn(t.id,owner);return publicTurn(t);
      }
      if(req.method==='POST'&&match[2]==='/reply'){
        // No user-supplied message history, model name or system instructions accepted.
        const data=await json(req);if(Object.keys(data).length)fail(400,'body_fields','Неподдерживаемые параметры.');
        if(t.state==='done'||t.state==='replying')return publicTurn(t);
        if(t.state!=='transcribed')fail(409,'state','Сначала дождитесь распознавания записи.');
        transaction(()=>{
          if(workers>=2)fail(429,'busy','Сервис занят. Попробуйте через несколько секунд.');
          reserve('llm',config.llmCap);run("UPDATE turns SET state='replying' WHERE id=? AND state='transcribed'",t.id);
        });
        const history=db.prepare("SELECT transcript,answer FROM turns WHERE session=? AND state='done' ORDER BY created,rowid").all(t.session);
        const messages=[{role:'system',content:curriculum.rules.join('\n')+'\nУчебный материал:\n'+JSON.stringify({words:curriculum.words,examples:curriculum.examples,goals:curriculum.goals})},{role:'assistant',content:JSON.stringify(curriculum.greeting)}];
        for(const old of history)messages.push({role:'user',content:old.transcript},{role:'assistant',content:old.answer});
        messages.push({role:'user',content:t.transcript});workers++;
        try{
          const answer=await providers.reply(messages);
          // Validate again even when a provider adapter is replaced.
          validateAnswer(JSON.stringify(answer));
          run("UPDATE turns SET state='done',answer=? WHERE id=?",JSON.stringify(answer),t.id);
        }catch(e){run("UPDATE turns SET state='error',error=? WHERE id=?",'Не удалось получить учебный ответ. Можно записать следующую реплику.',t.id);throw e}
        finally{workers--}
        return publicTurn(ownedTurn(t.id,owner));
      }
    }
    fail(404,'not_found','Запрос не найден.');
  }
  async function handler(req,res){
    req.setTimeout(90000,()=>req.destroy());
    const origin=req.headers.origin;
    const send=(status,value)=>{const data=JSON.stringify(value);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(data),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin',...(origin&&config.origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{} )});res.end(data)};
    try{
      if(origin&&!config.origins.includes(origin))fail(403,'origin','Этот адрес сайта не разрешён.');
      if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':origin||config.origins[0],'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, Idempotency-Key','Access-Control-Max-Age':'600','Vary':'Origin'});res.end();return}
      const path=new URL(req.url,'http://localhost').pathname;
      if(path.startsWith('/api/')){send(200,await route(req,path));return}
      if(req.method!=='GET'&&req.method!=='HEAD')fail(405,'method','Метод не поддерживается.');
      // Serve only flat, public runtime assets. Never expose server/, env, DB or sources.
      const name=path==='/'?'index.html':path.slice(1);
      const allowed=name==='index.html'||/^[a-z][a-z0-9-]*\.(css|js|svg)$/.test(name);
      const file=resolve(here,'..',name);
      if(!allowed||!existsSync(file))fail(404,'not_found','Страница не найдена.');
      const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'}[extname(file)];
      const data=readFileSync(file);res.writeHead(200,{'Content-Type':mime,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Permissions-Policy':'microphone=(self)','Referrer-Policy':'same-origin'});res.end(req.method==='HEAD'?undefined:data);
    }catch(error){
      const known=error instanceof PublicError;
      // Never echo upstream bodies, request content, headers, keys, stack traces or exception messages.
      if(!known)console.error('practice_request_failed');
      if(!res.headersSent)send(known?error.status:500,{error:{code:known?error.code:'internal',message:known?error.message:'Не удалось выполнить запрос. Попробуйте позже.'}});else res.end();
    }
  }
  return {handler,close(){clearInterval(cleanupTimer);db.close()},db,configured};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const config=settings();const app=createPracticeService(config),server=http.createServer(app.handler);
  server.headersTimeout=10000;server.requestTimeout=20000;server.maxHeadersCount=40;
  server.listen(config.port,config.host,()=>console.log('TOPA practice listening on port '+config.port+'; providers '+(app.configured()?'configured':'not configured')));
  process.on('SIGTERM',()=>server.close(()=>{app.close();process.exit(0)}));
}
