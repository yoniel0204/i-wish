/* Pantalla de entrada. No lee ni guarda contenido privado. */
(() => {
  'use strict';
  const KEY='iwish_welcome_verses_v1';
  const FALLBACK={reference:'Filipenses 4:13',text:'Todo lo puedo en Cristo que me fortalece.',source:'https://ebible.org/spaRV1909/PHP04.htm#V13'};
  window.createIWishWelcome=({onEnter,onShow=()=>{},storage=localStorage,random=Math.random,isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true}={})=>{
    const $=id=>document.getElementById(id);
    const verses=Array.isArray(window.IWISH_WELCOME_VERSES)&&window.IWISH_WELCOME_VERSES.length?window.IWISH_WELCOME_VERSES:[FALLBACK];
    let opened=false,ready=false,backgrounded=false,last=-1,bag=[];
    function nextVerse(){
      try{const saved=JSON.parse(storage.getItem(KEY)||'null');
        if(saved?.count===verses.length&&Array.isArray(saved.bag)&&saved.bag.every(i=>Number.isInteger(i)&&i>=0&&i<verses.length)&&new Set(saved.bag).size===saved.bag.length){bag=saved.bag;last=Number.isInteger(saved.last)?saved.last:-1;}
      }catch(_){/* If storage is unavailable, retain this session's shuffle. */}
      if(!bag.length){
        bag=verses.map((_,i)=>i);
        for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
        if(bag.length>1&&bag.at(-1)===last)[bag[0],bag[bag.length-1]]=[bag[bag.length-1],bag[0]];
      }
      last=bag.pop();
      try{storage.setItem(KEY,JSON.stringify({count:verses.length,bag,last}));}catch(_){/* Entry stays usable without local storage. */}
      return verses[last]||FALLBACK;
    }
    function show(){
      if(opened)return;opened=true;
      const verse=nextVerse();$('welcome-verse').textContent='“'+verse.text+'”';$('welcome-reference').textContent=verse.reference;
      $('welcome-reference').href=verse.source;
      $('welcome-screen').classList.remove('hidden');document.body.classList.add('welcome-active');onShow();
    }
    $('welcome-enter').addEventListener('click',()=>{
      if(!ready||!opened)return;
      opened=false;$('welcome-screen').classList.add('hidden');document.body.classList.remove('welcome-active');onEnter();
    });
    window.addEventListener('pageshow',event=>{if(event.persisted)show();});
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){backgrounded=true;return;}
      if(backgrounded&&isStandalone()){
        // Do not interrupt password/autofill or authentication callbacks.
        const authenticating=!$('auth-view').classList.contains('hidden');
        if(!authenticating)show();
      }
      backgrounded=false;
    });
    show();
    return {get open(){return opened;},show,ready(){ready=true;$('welcome-enter').disabled=false;$('welcome-enter').removeAttribute('aria-busy');}};
  };
})();
