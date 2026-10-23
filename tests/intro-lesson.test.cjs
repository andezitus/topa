const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const progress={};
const context=vm.createContext({console,Map,Set,Number,String,Object,Array,Math,language:'Татарский',getLanguageProgress:name=>progress[name]||(progress[name]={completed:0,introDone:false,introStep:0}),activeLesson:0});
vm.runInContext(html.slice(html.indexOf('    const courseData='),html.indexOf('    const STORY_ROLES=')),context);
const run=code=>vm.runInContext(code,context);
for(const name of ['Татарский','Чувашский','Киргизский']){
  context.language=name;
  const tasks=run('INTRO_DATA[language].tasks');
  assert.equal(tasks.length,10);
  assert.deepEqual([...new Set(tasks.map(task=>task.type))].sort(),['choice','match','order','picture']);
  assert.equal(tasks.filter(task=>task.type==='picture').length,2);
  assert.ok(tasks.every(task=>task.words.length>=1));
  for(const task of tasks){
    if(task.type==='picture')for(const option of task.options)assert.ok(fs.existsSync(option.image));
    if(['choice','picture'].includes(task.type))assert.ok(task.options[task.answer]);
  }
  assert.equal(run('isLessonAvailable(0)'),true);
  assert.equal(run('isLessonAvailable(1)'),false);
  assert.equal(run('isLessonAvailable(2)'),false);
  assert.equal(run('nextLessonId()'),0);
  assert.equal(run('getGuideSections().length'),0);
  progress[name].introStep=4;
  assert.equal(run('getActiveTasks()[getLanguageProgress(language).introStep].source'),'Здравствуйте');
  progress[name].introDone=true;
  assert.equal(run('isLessonAvailable(1)'),true);
  assert.equal(run('isLessonAvailable(2)'),false);
  assert.equal(run('nextLessonId()'),1);
  assert.equal(run('getGuideSections().flatMap(section=>section.words).length'),7);
  assert.equal(run('getGlossaryWords().filter(word=>word.lessons.some(n=>isLessonCompleted(n))).length'),7);
  assert.equal(run('getGlossaryWords().find(word=>word.word===INTRO_DATA[language].words[3][0]).id'),'1:0','hello retains existing review ID');
  assert.equal(run('getGlossaryWords().find(word=>word.word===INTRO_DATA[language].words[0][0]).id'),'2:1','coat retains existing review ID');
  progress[name].completed=1;
  assert.equal(run('nextLessonId()'),2);
  assert.equal(run('isLessonAvailable(2)'),true);
  assert.equal(run('getGuideSections().flatMap(section=>section.words).length'),12);
  progress[name].completed=2;
  const words=run('getGuideSections().flatMap(section=>section.words)');
  assert.equal(words.length,14);
  assert.equal(new Set(words.map(word=>word.id)).size,14,'no duplicate glossary or review IDs');
  assert.equal(new Set(words.map(word=>word.word.toLowerCase())).size,14,'no duplicate visible terms');
  assert.deepEqual([...run('getGuideSections().map(section=>section.words.length)')],[7,5,2]);
  assert.equal(run('getCompletedLessonCount(getLanguageProgress(language))'),3);
  assert.equal(run('isLessonAvailable(3)'),false);
  assert.equal(run('isLessonAvailable(4)'),false);
  // Migrated users keep previous lessons and vocabulary even before doing intro.
  progress[name].introDone=false;
  assert.equal(run('getGuideSections().flatMap(section=>section.words).length'),14);
  assert.equal(run('isLessonAvailable(1)'),true);
  assert.equal(run('isLessonAvailable(2)'),true);
  assert.equal(run('nextLessonId()'),0);
}
context.language='Татарский';progress['Татарский']={completed:0,introDone:false};
assert.equal(run('isLessonCompleted(0)'),false);
assert.equal(progress['Киргизский'].completed,2);
assert.equal(run("glossaryWordKey('  РАХМАТ!  ')"),'рахмат');
console.log('PASS: four formats, all languages, sequential gates, resume, original IDs, deduplication and legacy progress.');
