/* Reuse the same controls across layouts, retaining handlers and course state. */
(function(){
  'use strict';
  const mobile=window.matchMedia('(max-width:860px)');
  const review=document.getElementById('reviewBtn');
  const settings=document.querySelector('.nav__settings');
  const settingsAnchor=document.createComment('Desktop location: settings');
  settings.before(settingsAnchor);
  const placements=['streakCard','goalCard','wordCard','progressCard'].map(id=>{
    const node=document.getElementById(id);
    const anchor=document.createComment('Desktop location: '+id);
    node.before(anchor);
    return {node,anchor};
  });
  function updateLanguage(){
    document.getElementById('statisticsLanguage').textContent=language+' язык';
  }
  function layout(){
    if(mobile.matches)document.getElementById('profileSettingsSlot').append(settings);
    else settingsAnchor.after(settings);
    document.getElementById(mobile.matches?'mobileReviewSlot':'trailReviewSlot').append(review);
    placements.forEach(item=>{
      if(mobile.matches)document.getElementById('statisticsCards').append(item.node);
      else item.anchor.after(item.node);
    });
    const selected=document.querySelector('.nav__item.active');
    if(!mobile.matches&&selected&&selected.dataset.section==='Статистика')showSection('Обучение');
    updateLanguage();
  }
  mobile.addEventListener('change',layout);
  window.addEventListener('topa:progress',updateLanguage);
  layout();
})();
