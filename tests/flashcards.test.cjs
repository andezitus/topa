// State-machine integration tests for the real flashcards.js, using a small DOM
// harness. No browser data or demo lesson progress is shipped in the application.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const source=fs.readFileSync('flashcards.js','utf8');
const DATA=html.slice(html.indexOf('    const courseData='),html.indexOf('    const STORY_ROLES='));
let now=Date.UTC(2026,9,21,12),language='Татарский';
const progress={'Татарский':{completed:0},'Чувашский':{completed:0},'Киргизский':{completed:0}};
const storage=new Map(),listeners={},toastMessages=[];
let elements=new Map(),guideButtons=[],guideChecks=[];
class Element{
  constructor(id=''){this.id=id;this.disabled=false;this.hidden=false;this.style={};this.dataset={};this.events={};this.attrs={};const classes=new Set();this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle:(c,b)=>b?classes.add(c):classes.delete(c)}}
  set innerHTML(value){this.html=value;for(const match of value.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){const el=new Element(match[1]);el.disabled=/\sdisabled(?:\s|>)/.test(match[0]);el.hidden=/\shidden(?:\s|>)/.test(match[0]);elements.set(el.id,el)}}
  get innerHTML(){return this.html||''}
  setAttribute(k,v){this.attrs[k]=v}
  querySelector(s){if(s[0]==='#')return elements.get(s.slice(1))||null;if(!elements.has(s))elements.set(s,new Element(s));return elements.get(s)}
  querySelectorAll(){return []}
  addEventListener(name,callback){this.events[name]=callback}
  append(el){elements.set(el.id,el)}
  focus(){}
  getClientRects(){return [1]}
}
const $=s=>{const id=s.replace(/^#/,'');if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
const document={createElement:()=>new Element(),body:new Element('body'),activeElement:null,querySelector:()=>null,querySelectorAll:selector=>selector==='[data-review-lesson]'?guideChecks:guideButtons};
const DateProxy=class extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}};
const context=vm.createContext({console,Map,Set,Date:DateProxy,Math,Object,Array,JSON,String,Number,document,$,window:{addEventListener:(name,callback)=>listeners[name]=callback},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},getLanguageProgress:()=>progress[language],escapeHtml:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;'),showToast:message=>toastMessages.push(message),speak:()=>{},showSection:()=>{},openGuide:()=>{}});
Object.defineProperty(context,'language',{get:()=>language});
vm.runInContext(DATA,context);
assert.equal(vm.runInContext('Object.values(courseData).every(course=>course.tasks.length===5)',context),true,'all courses retain exactly five lesson-one tasks');
assert.equal(vm.runInContext('Object.values(GUIDE_DATA).every(sections=>sections.every(section=>section.words.length>=5&&section.words.length<=7))',context),true,'glossary preserves five to seven terms per lesson');
function boot(){elements=new Map();guideButtons=[];guideChecks=[];vm.runInContext(source,context)}
function click(id){const el=$('#'+id);assert.equal(el.disabled,false,id+' must be enabled');assert.equal(typeof el.onclick,'function',id+' handler exists');el.onclick()}
const saved=()=>JSON.parse(storage.get('topa-word-review-v1'));
const current=()=>saved().languages[language];
const emit=(name,detail)=>listeners[name]({detail});
const open=()=>click('reviewBtn');
function answer(known){click(known?'reviewKnown':'reviewLearning')}
function guideAdd(id){$('#guideContent').events.click({target:{closest:()=>({dataset:{reviewAdd:id}})}})}
boot();assert.equal($('#reviewDueCount').textContent,0);open();assert.match($('#reviewContent').innerHTML,/Завершите ознакомительный урок/);
// Errors recorded before completion may not unlock any words.
emit('topa:answer',{lesson:1,task:0,correct:false});assert.equal($('#reviewDueCount').textContent,0);
progress[language].completed=1;emit('topa:progress');assert.equal($('#reviewDueCount').textContent,7);open();assert.equal(current().session.queue[0],'1:0');assert.doesNotMatch($('#reviewContent').innerHTML,/Новое слово из урока|review-reason|reviewTip/);
assert.equal($('#reviewKnown').disabled,false,'known is available without flipping');
assert.equal($('#reviewLearning').disabled,false,'learning is available without flipping');
assert.equal($('#reviewLanguage').textContent,language+' язык');
assert.doesNotMatch($('#reviewContent').innerHTML,/>Татарский язык</,'no language inside the card');
click('reviewFlip');assert.equal($('.review-face--front').hidden,true);assert.equal($('.review-face--back').hidden,false);
click('reviewFlip');assert.equal($('.review-face--front').hidden,false);assert.equal($('.review-face--back').hidden,true);
answer(false);assert.equal(current().session.queue[3],'1:0');assert.equal(current().session.queue.length,8);
click('reviewUndo');assert.equal(current().session.index,0);assert.equal(current().session.queue.length,7);assert.equal(current().cards['1:0'].reviews,0);
answer(true);assert.equal(current().cards['1:0'].due,now+86400000);assert.equal(current().cards['1:0'].streak,1);
click('closeReview');guideAdd('1:0');assert.equal(current().cards['1:0'].manual,true);assert.equal(current().session.queue.filter(id=>id==='1:0').length,2);guideAdd('1:0');assert.equal(current().session.queue.filter(id=>id==='1:0').length,2,'manual additions are deduplicated');
// Uncompleted lesson content cannot be added even through a forged data attribute.
guideAdd('2:0');assert.equal(current().cards['2:0'],undefined);
const firstLanguage=JSON.stringify(current());language='Киргизский';emit('topa:progress');assert.equal($('#reviewDueCount').textContent,0);open();assert.match($('#reviewContent').innerHTML,/Завершите ознакомительный урок/);progress[language].completed=1;emit('topa:progress');open();assert.equal(current().session.queue.length,7);answer(true);assert.equal(current().cards['1:0'].streak,1);
language='Татарский';emit('topa:progress');assert.equal(JSON.stringify(current()),firstLanguage,'other language results stay intact');
// Completion of the next lesson also extends an unfinished session with new words.
progress[language].completed=2;emit('topa:progress');assert.ok(current().session.queue.includes('2:6'));assert.equal(Object.keys(current().cards).length,14);
// A reload keeps the unfinished queue and completed ratings.
const beforeReload=JSON.stringify(current());boot();assert.equal(JSON.stringify(current()),beforeReload);open();assert.equal(current().session.index,1);
// Pair mistakes flag the exact glossary words; unrelated cards stay untouched.
emit('topa:answer',{lesson:2,words:['ярдәм','эшлисез'],correct:false});assert.equal(current().cards['2:2'].lessonMistakes,1);assert.equal(current().cards['2:3'].lessonMistakes,1);assert.equal(current().cards['2:6'].mistakes,0);
// Finish with known ratings. None of these future cards belongs to the automatic queue.
let guard=0;while(current().session.index<current().session.queue.length){answer(true);assert.ok(++guard<40)}
assert.match($('#reviewContent').innerHTML,/Слова стали ближе/);click('closeReview');assert.equal($('#reviewDueCount').textContent,0);open();assert.match($('#reviewContent').innerHTML,/Всё повторено на сегодня/);
// Overdue words return only once their actual deadline passes.
now+=86400001;emit('focus');assert.ok($('#reviewDueCount').textContent>0);open();const dueId=current().session.queue[0];assert.ok(current().cards[dueId].due<=now);answer(true);assert.equal(current().cards[dueId].due,now+3*86400000,'second successful review uses three days');
// Difficult cards repeat at most once per session, so a session always finishes.
storage.clear();progress[language].completed=1;boot();open();guard=0;while(current().session.index<current().session.queue.length){answer(false);assert.ok(++guard<20)}assert.equal(guard,14);assert.equal(current().session.queue.length,14);click('reviewResultUndo');assert.equal(current().session.index,13);assert.equal(current().cards[current().session.queue[13]].reviews,1);
// Every supported language uses the same data source and completed-lesson gate.
for(language of ['Чувашский','Киргизский']){storage.clear();progress[language].completed=2;boot();assert.equal($('#reviewDueCount').textContent,14);open();assert.equal(current().session.queue.length,10);answer(true);assert.equal(current().cards['1:0'].streak,1)}
// Bulk glossary selection only admits completed-lesson words and is idempotent.
storage.clear();language='Татарский';progress[language].completed=0;boot();
function selectLesson(number,checked=true){$('#guideContent').events.change({target:{closest:()=>({checked,dataset:{reviewLesson:String(number)}})}})}
selectLesson(1);assert.equal(Object.keys(current().cards).length,0,'locked lesson cannot be bulk-added');
progress[language].completed=1;emit('topa:progress');
const check=new Element();check.dataset.reviewLesson='1';guideChecks=[check];
guideAdd('1:0');assert.equal(check.indeterminate,true,'partial manual selection is shown');
selectLesson(1);assert.equal(check.checked,true);assert.equal(check.disabled,false,'selected checkbox remains available for cancellation');
assert.equal(Object.values(current().cards).filter(card=>card.manual).length,7);
const bulkSnapshot=JSON.stringify(current());selectLesson(1);assert.equal(JSON.stringify(current()),bulkSnapshot,'bulk adding twice does not duplicate words');
selectLesson(2);assert.equal(Object.keys(current().cards).length,7,'next lesson stays locked');
open();assert.equal(new Set(current().session.queue).size,7);assert.equal(current().session.queue.length,7);
// Cancelling manual selection keeps automatically due/new words available.
click('closeReview');selectLesson(1,false);
assert.equal(check.checked,false);assert.equal(check.indeterminate,false);
assert.equal(Object.values(current().cards).filter(card=>card.manual).length,0);
assert.equal($('#reviewDueCount').textContent,7,'automatic new words remain due');
selectLesson(1);open();guard=0;while(current().session.index<current().session.queue.length){answer(true);assert.ok(++guard<20)}click('closeReview');
assert.equal($('#reviewDueCount').textContent,0);
const beforeCancel=JSON.stringify(Object.fromEntries(Object.entries(current().cards).map(([id,rec])=>[id,{due:rec.due,reviews:rec.reviews,lastReviewed:rec.lastReviewed}])));
selectLesson(1);assert.equal($('#reviewDueCount').textContent,7);open();click('closeReview');selectLesson(1,false);
assert.equal($('#reviewDueCount').textContent,0,'cancel removes future manual words from the saved pending queue');
assert.equal(current().session.queue.length,current().session.index);
const afterCancel=JSON.stringify(Object.fromEntries(Object.entries(current().cards).map(([id,rec])=>[id,{due:rec.due,reviews:rec.reviews,lastReviewed:rec.lastReviewed}])));
assert.equal(afterCancel,beforeCancel,'cancellation retains intervals and review history');
selectLesson(1);const beforeSelectionReload=JSON.stringify(current());boot();assert.equal(JSON.stringify(current()),beforeSelectionReload,'selection persists across reload');selectLesson(1,false);assert.equal($('#reviewDueCount').textContent,0,'selection can be cancelled after reload');
const tatarBulk=JSON.stringify(current());language='Чувашский';progress[language].completed=1;boot();selectLesson(1);assert.equal(Object.values(current().cards).filter(card=>card.manual).length,7);
language='Татарский';assert.equal(JSON.stringify(current()),tatarBulk,'bulk selection is isolated by language');
console.log('PASS: existing review mechanics, reversible bulk selection, automatic due preservation, queue removal, interval/history retention, reload and language isolation.');
storage.clear();language='Татарский';progress[language]={completed:0,introDone:false};boot();
assert.equal($('#reviewDueCount').textContent,0);selectLesson(0);assert.equal(Object.keys(current().cards).length,0);
progress[language].introDone=true;emit('topa:progress');assert.equal($('#reviewDueCount').textContent,7);
selectLesson(0);assert.equal(Object.values(current().cards).filter(card=>card.manual).length,7);
selectLesson(0,false);assert.equal(Object.values(current().cards).filter(card=>card.manual).length,0);
open();assert.equal(current().session.queue.length,7);answer(true);
const reviewedId=current().session.queue[0],reviewed=JSON.stringify(current().cards[reviewedId]);
progress[language].completed=2;emit('topa:progress');assert.equal(Object.keys(current().cards).length,14);
assert.equal(JSON.stringify(current().cards[reviewedId]),reviewed,'later completion does not reset an intro word');
assert.equal(new Set(current().session.queue).size,current().session.queue.length,'overlapping lessons do not duplicate review words');
const priorMistakes=current().cards['2:1'].lessonMistakes;
emit('topa:answer',{lesson:0,words:['пальто'],correct:false});assert.equal(current().cards['2:1'].lessonMistakes,priorMistakes+1);
const introState=JSON.stringify(current());language='Киргизский';progress[language]={completed:0,introDone:false};emit('topa:progress');assert.equal($('#reviewDueCount').textContent,0);
language='Татарский';boot();assert.equal(JSON.stringify(current()),introState,'intro queue and ratings survive language switch and reload');
console.log('PASS: intro word gating, reversible selection, shared-word rating retention and deduplicated sessions.');

assert.deepEqual(toastMessages,[],'manual add and cancel are silent');
open();assert.match($('#reviewContent').innerHTML,/Нажмите, чтобы увидеть перевод/,'front face contains the flip instruction');
