(function(){
  'use strict';
  const key='topa-source-language-v1';
  const names={Русский:'русский',Татарский:'татарский',Чувашский:'чувашский',Киргизский:'киргизский'};
  const selector=document.getElementById('courseSourceLanguage');
  let saved;
  try{saved=localStorage.getItem(key)}catch(error){}
  selector.value=Object.prototype.hasOwnProperty.call(names,saved)?saved:'Русский';
  function renderCourses(){
    const source=selector.value;
    document.getElementById('coursesSourceName').textContent=names[source];
    document.getElementById('availableCourses').hidden=source!=='Русский';
    document.getElementById('upcomingCourses').hidden=source==='Русский';
  }
  selector.addEventListener('change',function(){
    // Changing the source never writes target-language progress or review state.
    try{localStorage.setItem(key,selector.value)}catch(error){}
    renderCourses();
  });
  renderCourses();
})();
