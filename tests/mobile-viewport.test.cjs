const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const windowEvents={},documentEvents={},viewportEvents={},styles=new Map(),queue=[];
function classes(){const set=new Set();return {contains:name=>set.has(name),toggle:(name,on)=>on?set.add(name):set.delete(name)}}
const root={style:{setProperty:(key,value)=>styles.set(key,value)},classList:classes()};
const body={classList:classes()};
const selected={dataset:{section:'Обучение'}};
const mq={matches:true,addEventListener:(name,fn)=>windowEvents.mediaChange=fn};
const viewport={height:700,offsetTop:0,addEventListener:(name,fn)=>viewportEvents[name]=fn};
const context=vm.createContext({window:{innerHeight:844,visualViewport:viewport,matchMedia:()=>mq,addEventListener:(name,fn)=>windowEvents[name]=fn},document:{documentElement:root,body,querySelector:()=>selected,addEventListener:(name,fn,options)=>{documentEvents[name]=fn;if(['touchmove','gesturestart','gesturechange','wheel'].includes(name))assert.equal(options.passive,false)}},requestAnimationFrame:fn=>{queue.push(fn);return queue.length},Boolean,Math});
vm.runInContext(fs.readFileSync('mobile-viewport.js','utf8'),context);
assert.equal(styles.get('--app-height'),'700px');assert.equal(styles.get('--visible-bottom'),'144px');
assert.equal(root.classList.contains('mobile-static-page'),false,'learning keeps vertical scroll');
for(const section of ['Курсы','Статистика','Профиль']){selected.dataset.section=section;windowEvents['topa:section']();assert.equal(root.classList.contains('mobile-static-page'),true);assert.equal(body.classList.contains('mobile-static-page'),true)}
function touch(count,modal=false){let blocked=false;documentEvents.touchmove({touches:Array(count),target:{closest:()=>modal?{}:null},preventDefault:()=>blocked=true});return blocked}
assert.equal(touch(1),true,'static pages do not drag');assert.equal(touch(1,true),false,'glossary and modal content can scroll');assert.equal(touch(2,true),true,'pinch is blocked even in a modal');
selected.dataset.section='Обучение';windowEvents['topa:section']();assert.equal(touch(1),false);assert.equal(touch(2),true);
viewport.height=448;viewport.offsetTop=20;viewportEvents.resize();while(queue.length)queue.shift()();
assert.equal(styles.get('--app-height'),'448px');assert.equal(styles.get('--visible-top'),'20px');assert.equal(styles.get('--visible-bottom'),'376px');assert.equal(body.classList.contains('viewport-tight'),true);
let prevented=false;documentEvents.gesturestart({preventDefault:()=>prevented=true});assert.equal(prevented,true);
prevented=false;documentEvents.wheel({ctrlKey:false,preventDefault:()=>prevented=true});assert.equal(prevented,false,'ordinary vertical wheel remains usable');
selected.dataset.section='Курсы';windowEvents['topa:section']();mq.matches=false;windowEvents.mediaChange();assert.equal(root.classList.contains('mobile-static-page'),false,'desktop never inherits mobile scroll lock');assert.equal(touch(2),false);
const html=fs.readFileSync('index.html','utf8');assert.match(html,/maximum-scale=1, user-scalable=no/);
console.log('PASS: visual viewport sizing, chrome offsets, section lock/unlock, modal scrolling, pinch guard and desktop isolation.');
