import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createPracticeService,settings,normalizeAudio,validateAnswer,makeProviders,curriculum} from '../server/practice-server.mjs';

async function fixture(overrides={}){
 const dir=mkdtempSync(resolve(tmpdir(),'topa-practice-'));
 const cfg={...settings({}),enabled:true,pilotCode:'team-code-for-tests-at-least-32-characters',gladia:'secret-gladia',yandex:'secret-yandex',model:'gpt://test-folder/qwen-test',folder:'test-folder',db:resolve(dir,'data.sqlite'),...overrides};
 let submitted=0,polls=0,replies=0,lastMessages;let release;
 const adapter={async submit(){submitted++;return '00000000-0000-0000-0000-000000000001'},async poll(){polls++;return {done:true,text:'Исәнмесез!'}},async reply(messages){replies++;lastMessages=messages;if(overrides.holdReply)await new Promise(r=>release=r);return {reply:'Исәнмесез! Пальто матур.',explanation:'Опишите пальто знакомыми словами.',correction:''}}};
 const app=createPracticeService(cfg,{providers:adapter,decode:async()=>({wav:Buffer.from('bounded-wav'),duration:1})});
 const server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 async function request(path,{token,method='GET',data,audio,headers={}}={}){
  const response=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{}),...(audio?{'Content-Type':'audio/webm','Idempotency-Key':'11111111-1111-1111-1111-111111111111'}:{}),...headers},body:audio||(data!==undefined?JSON.stringify(data):undefined)});
  return {status:response.status,data:await response.json()};
 }
 async function login(){const r=await request('/api/practice/login',{method:'POST',data:{code:cfg.pilotCode}});assert.equal(r.status,200);return r.data.token}
 async function session(token){const r=await request('/api/practice/sessions',{method:'POST',token,data:{language:'Татарский',lessonId:0}});assert.equal(r.status,200);return r.data.id}
 async function audio(token,sid,key='11111111-1111-1111-1111-111111111111'){return request('/api/practice/sessions/'+sid+'/audio',{method:'POST',token,audio:Buffer.from('audio'),headers:{'Idempotency-Key':key}})}
 return {app,cfg,request,login,session,audio,adapter,get submitted(){return submitted},get replies(){return replies},get messages(){return lastMessages},release(){release?.()},async close(){server.closeAllConnections();await new Promise(r=>server.close(r));app.close();rmSync(dir,{recursive:true,force:true})}};
}
test('voice-only chain, fixed lesson/context, transcript confirmation, idempotent paid calls',async()=>{
 const f=await fixture();try{
  const token=await f.login(),sid=await f.session(token);
  const upload=await f.audio(token,sid);assert.equal(upload.status,200);assert.equal(upload.data.state,'processing');const id=upload.data.id;
  assert.equal((await f.audio(token,sid)).data.id,id);assert.equal(f.submitted,1);
  assert.equal((await f.request('/api/practice/turns/'+id+'/reply',{method:'POST',token,data:{}})).status,409);
  const transcribed=await f.request('/api/practice/turns/'+id,{token});assert.equal(transcribed.data.transcript,'Исәнмесез!');assert.equal(f.replies,0,'ASR is shown before explicit confirmation');
  assert.equal((await f.request('/api/practice/turns/'+id+'/reply',{method:'POST',token,data:{model:'attacker'}})).status,400);
  const reply=await f.request('/api/practice/turns/'+id+'/reply',{method:'POST',token,data:{}});assert.equal(reply.data.state,'done');assert.equal(reply.data.answer.reply,'Исәнмесез! Пальто матур.');
  await f.request('/api/practice/turns/'+id+'/reply',{method:'POST',token,data:{}});assert.equal(f.replies,1);
  assert.equal(f.messages[0].role,'system');assert.match(f.messages[0].content,/җылы/);assert.doesNotMatch(JSON.stringify(f.messages),/secret-gladia|secret-yandex|team-code/);assert.equal(f.messages.at(-1).role,'user');
 }finally{await f.close()}
});
test('authentication, per-session ownership, fixed lesson, origins, secrets and source isolation',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/api/practice/sessions',{method:'POST',data:{language:'Татарский',lessonId:0}})).status,401);
  assert.equal((await f.request('/api/practice/config',{headers:{Origin:'https://attacker.example'}})).status,403);
  const a=await f.login(),b=await f.login(),sid=await f.session(a),up=await f.audio(a,sid);
  assert.equal((await f.request('/api/practice/turns/'+up.data.id,{token:b})).status,404);
  assert.equal((await f.audio(b,sid)).status,404);
  assert.equal((await f.request('/api/practice/sessions',{method:'POST',token:a,data:{language:'Киргизский',lessonId:0}})).status,400);
  for(const path of ['/server/.env','/server/data/practice.sqlite','/.env','/server/practice-server.mjs','/server/curriculum.json'])assert.equal((await f.request(path)).status,404,path);
  const conf=await f.request('/api/practice/config');assert.equal(conf.data.configured,true);assert.doesNotMatch(JSON.stringify(conf),/secret|team-code|test-folder/);
 }finally{await f.close()}
});
test('server budgets survive process state, rerecording consumes ASR attempts, turn limit enforced',async()=>{
 const f=await fixture({asrCap:2,llmCap:1,turns:1});try{
  const token=await f.login(),sid=await f.session(token),first=await f.audio(token,sid);
  await f.request('/api/practice/turns/'+first.data.id+'/discard',{method:'POST',token,data:{}});
  const second=await f.audio(token,sid,'22222222-2222-2222-2222-222222222222');await f.request('/api/practice/turns/'+second.data.id,{token});
  await f.request('/api/practice/turns/'+second.data.id+'/reply',{method:'POST',token,data:{}});
  assert.equal((await f.audio(token,sid,'33333333-3333-3333-3333-333333333333')).data.error.code,'turn_limit');
  const sid2=await f.session(token);assert.equal((await f.audio(token,sid2,'44444444-4444-4444-4444-444444444444')).data.error.code,'budget_limit');assert.equal(f.submitted,2);
  assert.equal(f.app.db.prepare('SELECT n FROM counters WHERE name=?').get('llm').n,1);
  const reloaded=createPracticeService(f.cfg,{providers:f.adapter});assert.equal(reloaded.db.prepare('SELECT n FROM counters WHERE name=?').get('asr').n,2);reloaded.close();
 }finally{await f.close()}
});
test('concurrent reply/retries reserve a single model call; ended sessions are inaccessible',async()=>{
 const f=await fixture({holdReply:true});try{
  const token=await f.login(),sid=await f.session(token),up=await f.audio(token,sid),id=up.data.id;
  await f.request('/api/practice/turns/'+id,{token});
  const first=f.request('/api/practice/turns/'+id+'/reply',{method:'POST',token,data:{}});
  for(let i=0;i<50&&!f.replies;i++)await new Promise(r=>setTimeout(r,5));
  assert.equal((await f.request('/api/practice/turns/'+id+'/reply',{method:'POST',token,data:{}})).data.state,'replying');assert.equal(f.replies,1);f.release();await first;
  await f.request('/api/practice/sessions/'+sid+'/end',{method:'POST',token,data:{}});
  assert.equal((await f.request('/api/practice/turns/'+id,{token})).status,404);assert.equal(f.app.db.prepare('SELECT count(*) n FROM turns WHERE session=?').get(sid).n,0);
 }finally{f.release();await f.close()}
});
test('upstream failures are redacted and never automatically resubmit paid jobs',async()=>{
 const f=await fixture();try{
  f.adapter.submit=async()=>{throw Error('SECRET-KEY-UPSTREAM https://private.example')};
  const token=await f.login(),sid=await f.session(token),result=await f.audio(token,sid);
  assert.equal(result.status,500);assert.doesNotMatch(JSON.stringify(result),/SECRET|private\.example/);
  const retry=await f.audio(token,sid);assert.equal(retry.data.state,'error');assert.equal(f.app.db.prepare('SELECT n FROM counters WHERE name=?').get('asr').n,1);
 }finally{await f.close()}
});
test('actual provider contract: Gladia tt / solaria-1, async result, bounded Yandex prompt, no tools',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options={})=>{
  calls.push({url,...options});const response=url.endsWith('/upload')?{audio_url:'https://files.gladia.io/test.wav'}:url.endsWith('/pre-recorded')?{id:'00000000-0000-0000-0000-000000000001'}:url.includes('/pre-recorded/')?{status:'done',result:{transcription:{full_transcript:'Рәхмәт!'}}}:{choices:[{message:{content:JSON.stringify({reply:'Рәхмәт!',explanation:'',correction:''})}}]};
  return {ok:true,text:async()=>JSON.stringify(response)};
 };
 try{
  const p=makeProviders({...settings({}),gladia:'g-key',yandex:'y-key',model:'gpt://folder/qwen',folder:'folder'});
  const id=await p.submit(Buffer.from('wav'));assert.equal((await p.poll(id)).text,'Рәхмәт!');await p.reply([{role:'user',content:'Рәхмәт!'}]);
  const config=JSON.parse(calls[1].body);assert.deepEqual(config.language_config,{languages:['tt'],code_switching:false});assert.equal(config.model,'solaria-1');assert.equal(config.translation,false);
  const request=JSON.parse(calls[3].body);assert.equal(request.max_completion_tokens,320);assert.equal(request.reasoning_effort,'none');assert.deepEqual(request.response_format,{type:'json_object'});assert.equal(request.store,false);assert.equal('tools' in request,false);assert.equal(calls[3].headers.Authorization,'Api-Key y-key');assert.equal(calls[0].redirect,'error');
 }finally{globalThis.fetch=original}
});
test('bounded audio decode rejects non-audio and too-long input; normalizes PCM',async()=>{
 const wav=duration=>{const pcm=Buffer.alloc(32000*duration);const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+pcm.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(16000,24);h.writeUInt32LE(32000,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);return Buffer.concat([h,pcm])};
 const decoded=await normalizeAudio(wav(1),3);assert.equal(decoded.duration,1);assert.equal(decoded.wav.toString('ascii',0,4),'RIFF');
 await assert.rejects(normalizeAudio(Buffer.from('not audio'),3));await assert.rejects(normalizeAudio(wav(8),3),e=>e.code==='audio_long');
});
test('model output validation and disabled-by-default configuration fail closed',()=>{
 assert.throws(()=>validateAnswer('<script>alert(1)</script>'));assert.throws(()=>validateAnswer(JSON.stringify({reply:'<img src=x>',explanation:'',correction:''})));
 assert.throws(()=>validateAnswer(JSON.stringify({reply:'test',explanation:'',correction:'',tool:'run'})));
 assert.equal(settings({}).enabled,false);assert.throws(()=>settings({RETENTION_HOURS:'100'}));
 const html=readFileSync('index.html','utf8');assert.match(html,/practice-config\.js/);assert.match(html,/practice\.js/);
 const ui=readFileSync('practice.js','utf8');assert.doesNotMatch(ui,/speechSynthesis|SpeechRecognition|localStorage\.setItem/);assert.match(ui,/getUserMedia/);assert.match(ui,/textContent=result\.transcript/);assert.match(ui,/stream\.getTracks\(\)\.forEach/);
 assert.deepEqual(curriculum.words.map(x=>x.word),['пальто','кибет','җылы','Исәнмесез','Рәхмәт','ярдәм','матур','һәм']);
});
