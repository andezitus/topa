/* Match the usable phone viewport, including changing browser chrome. Scroll
   locks apply only to mobile app sections; lessons/glossary remain scrollable. */
(function(){
  'use strict';
  const mobile=window.matchMedia('(max-width:860px)');
  const root=document.documentElement,body=document.body;
  let frame=0;
  function metrics(){
    frame=0;
    const viewport=window.visualViewport;
    const height=viewport?viewport.height:window.innerHeight;
    const top=viewport?viewport.offsetTop:0;
    root.style.setProperty('--app-height',height+'px');
    root.style.setProperty('--visible-top',top+'px');
    root.style.setProperty('--visible-bottom',Math.max(0,window.innerHeight-height-top)+'px');
    body.classList.toggle('viewport-compact',height<620);
    body.classList.toggle('viewport-tight',height<500);
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(metrics)}
  function section(){
    const selected=document.querySelector('.nav__item.active');
    const locked=mobile.matches&&selected&&['Курсы','Статистика','Профиль'].includes(selected.dataset.section);
    root.classList.toggle('mobile-static-page',Boolean(locked));
    body.classList.toggle('mobile-static-page',Boolean(locked));
  }
  window.addEventListener('topa:section',section);
  mobile.addEventListener('change',()=>{metrics();section()});
  window.addEventListener('resize',schedule);
  window.addEventListener('orientationchange',schedule);
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',schedule);
    window.visualViewport.addEventListener('scroll',schedule);
  }
  // Safari's gesture events need a guard in addition to touch-action/meta.
  function stopZoom(event){if(mobile.matches)event.preventDefault()}
  document.addEventListener('gesturestart',stopZoom,{passive:false});
  document.addEventListener('gesturechange',stopZoom,{passive:false});
  document.addEventListener('touchmove',event=>{
    if(!mobile.matches)return;
    if(event.touches.length>1||(root.classList.contains('mobile-static-page')&&!event.target.closest('.modal.open')))event.preventDefault();
  },{passive:false});
  document.addEventListener('wheel',event=>{
    if(mobile.matches&&event.ctrlKey)event.preventDefault();
  },{passive:false});
  metrics();section();
})();
