const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const heading=html.slice(html.indexOf('    function taskHeading('),html.indexOf('    function speechCard('));
const context=vm.createContext({activeLesson:0,currentTaskIndex:2,escapeHtml:String,getActiveTasks:()=>Array(10)});
vm.runInContext(heading,context);
assert.equal(vm.runInContext("taskHeading({title:'Выберите слово',help:'Подсказка'})",context),'<h2 class="task-title" id="taskTitle">Выберите слово</h2>');
context.activeLesson=1;assert.match(vm.runInContext("taskHeading({title:'Заголовок',help:'Подсказка'})",context),/task-kicker/,'other lessons retain their headings');
const files=fs.readdirSync('.');assert.equal(files.some(name=>name.endsWith('.png')),false);
for(const name of files.filter(name=>name.endsWith('.svg'))){const svg=fs.readFileSync(name,'utf8');assert.doesNotMatch(svg,/<image|data:image|<script/);assert.match(html,new RegExp('as="image" href="'+name.replaceAll('.','\\.')+'"'),'vector is preloaded: '+name)}
const images=[],loads=[];
class FakeImage{constructor(){images.push(this)}set src(value){this.path=value;loads.push(value)}decode(){return this.path==='broken.svg'?Promise.reject(Error('decode failed')):Promise.resolve()}}
const assets=vm.createContext({Image:FakeImage,Map,Promise,Object,window:{},document:{querySelectorAll:()=>[]}});
vm.runInContext(fs.readFileSync('asset-loading.js','utf8'),assets);
(async()=>{
 let ready=false;const first=assets.window.TopaAssets.prepare(['intro-coat.svg','story-mascot.svg']).then(()=>ready=true);
 assert.equal(ready,false,'waits for image load');assert.equal(images.length,2);
 const second=assets.window.TopaAssets.prepare(['intro-coat.svg']);assert.equal(images.length,2,'pending loads are shared');
 images[0].onload();images[1].onload();await Promise.all([first,second]);assert.equal(ready,true);
 await assets.window.TopaAssets.prepare(['intro-coat.svg']);assert.equal(loads.length,2,'decoded resources are reused');
 const broken=assets.window.TopaAssets.prepare(['broken.svg']);images.at(-1).onload();await broken;
 const missing=assets.window.TopaAssets.prepare(['missing.svg']);images.at(-1).onerror();await missing;
 const modalClasses=new Set(),bodyClasses=new Set();
 function classList(set){return {add:name=>set.add(name),remove:name=>set.delete(name),contains:name=>set.has(name)}}
 let release,renders=0;
 const state=vm.createContext({window:{TopaAssets:{prepare:()=>new Promise(resolve=>release=resolve)}},document:{body:{classList:classList(bodyClasses),style:{}}},lessonOpenRequest:0,language:'Татарский',activeLesson:1,isLessonAvailable:()=>true,showToast(){},modal:{classList:classList(modalClasses)},lessonPlayer:{classList:classList(new Set()),scrollTop:0},host:{classList:classList(new Set()),querySelector:()=>null},repeatModal:{classList:classList(new Set())},guideModal:{classList:classList(new Set())},getLanguageProgress:()=>({introStep:0}),getActiveTasks:()=>Array(10),renderTask:()=>renders++,setTimeout(){}});
 const start=html.indexOf('    async function openLesson('),end=html.indexOf('    function scrollPageToTop(',start);
 vm.runInContext(html.slice(start,end),state);
 const canceled=vm.runInContext('openLesson(0,false)',state);
 assert.equal(modalClasses.has('open'),false,'modal waits for image readiness');
 vm.runInContext('closeLesson()',state);release();await canceled;
 assert.equal(modalClasses.has('open'),false,'cancel prevents delayed lesson opening');assert.equal(renders,0);
 const opened=vm.runInContext('openLesson(0,false)',state);release();await opened;
 assert.equal(modalClasses.has('open'),true);assert.equal(renders,1);
 assert.equal(bodyClasses.has('assets-loading'),false);
 console.log('PASS: intro title-only rendering, vector-only assets, preload coverage, decode-before-opening, shared cache and error fallback.');
})().catch(error=>{console.error(error);process.exitCode=1});
