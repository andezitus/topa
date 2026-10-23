const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const nodes=new Map(),storage=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,style:{setProperty(){}},classList:{toggle(name,value){this[name]=value}},setAttribute(name,value){this[name]=value},insertAdjacentHTML(){}});return nodes.get(id)}
const context=vm.createContext({console,Number,Math,JSON,PROGRESS_KEY:'test-progress',language:'Татарский',progressStore:{},completed:0,today:0,goal:1,lessonFinishedView:false,STORY_FLOW:Array(28),STORY_STEPS:Array(7),storyCursor:0,courseData:{'Татарский':{story:{title:'Новое пальто'}}},$:node,host:node('host'),lessonAction:node('action'),lessonFeedback:node('feedback'),document:{querySelectorAll:()=>[]},localStorage:{setItem:(k,v)=>storage.set(k,v)},window:{dispatchEvent(){}},CustomEvent:class{constructor(type){this.type=type}},showToast(){},updateStoryProgress(){},scrollStoryToBottom(){},escapeHtml:s=>s});
for(const name of ['getLanguageProgress','saveProgress','syncLanguageState','renderProgress','finishLessonOne','finishStory']){
 const start=html.indexOf('    function '+name+'('),end=html.indexOf('\n    function ',start+5);
 assert.ok(start>=0&&end>start,name+' source found');vm.runInContext(html.slice(start,end),context);
}
function run(code){return vm.runInContext(code,context)}
run('syncLanguageState();renderProgress()');assert.equal(node('#streakStart').hidden,false);assert.equal(node('#streakValue').hidden,true);
run('finishLessonOne()');assert.equal(run('getLanguageProgress(language).streakCount'),1);assert.equal(run('completed'),1);assert.equal(node('#streakCount').textContent,1);
run('finishLessonOne()');assert.equal(run('getLanguageProgress(language).streakCount'),1,'duplicate finish must not increment');
run('lessonFinishedView=false;finishStory()');assert.equal(run('getLanguageProgress(language).streakCount'),2);assert.equal(run('completed'),2);
run('lessonFinishedView=false;finishLessonOne()');assert.equal(run('getLanguageProgress(language).streakCount'),3,'a completed review counts as a new finished lesson');assert.equal(run('completed'),2,'review preserves completion gates');
run("language='Киргизский';lessonFinishedView=false;syncLanguageState();renderProgress()");assert.equal(node('#streakStart').hidden,false);assert.equal(run('getLanguageProgress(language).streakCount'),0);
run('finishLessonOne()');assert.equal(run('getLanguageProgress(language).streakCount'),1);
run("language='Татарский';syncLanguageState();renderProgress()");assert.equal(node('#streakCount').textContent,3);assert.equal(node('#streakValue').hidden,false);
assert.equal(JSON.parse(storage.get('test-progress'))['Татарский'].streakCount,3);
run("progressStore['Чувашский']={completed:2};language='Чувашский';syncLanguageState()");assert.equal(run('getLanguageProgress(language).streakCount'),2,'existing completed lessons migrate');
console.log('PASS: initial prompt, first completion, repeated lesson, duplicate finish guard, language isolation, persistence and progress migration.');
