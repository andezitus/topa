/* Preload once and decode before a lesson opens. Standard browser caching also
   reuses these SVGs in CSS backgrounds, the glossary and subsequent tasks. */
(function(){
  'use strict';
  const pending=new Map();
  function load(path){
    if(!pending.has(path)){
      const image=new Image();
      image.decoding='async';
      const promise=new Promise(resolve=>{
        image.onload=()=>{if(image.decode)image.decode().catch(()=>{}).then(resolve);else resolve()};
        image.onerror=()=>resolve(); // Asset failure must never block lesson logic.
        image.src=path;
      });
      pending.set(path,promise);
    }
    return pending.get(path);
  }
  window.TopaAssets=Object.freeze({prepare:paths=>Promise.all(paths.map(load))});
  document.querySelectorAll('link[rel="preload"][as="image"]').forEach(link=>load(link.getAttribute('href')));
})();
