(()=>{'use strict';
const DEFAULT={year:2026,theme:{preset:'midnight',accent:'#e9c88a',snow:true,useBackgroundImage:false,backgroundImage:'',shape:'soft',layout:'grid',title:'Musical Advent Calendar',subtitle:'25 days of music & memories'},doors:[]};
const PRESETS={midnight:['#10182a','#243859','#24344f'],forest:['#092a26','#244d41','#1b4c3d'],berry:['#301a2b','#642e43','#532a40']};
const $=id=>document.getElementById(id);
// An explicitly requested editor test mode: not authentication or a secure date restriction.
const previewMode=new URLSearchParams(location.search).get('preview')==='1';
// Mobile Safari (including Chrome on iOS) needs audio.play() in the original tap handler.
// Play immediately inside the door tap handler for browser audio permissions.
let cfg=DEFAULT;let currentAudio=null;let activeTrack='';let activeDay=null;const previewOpened={};
const safeText=s=>typeof s==='string'?s:'';
function theme(t){t={...DEFAULT.theme,...t};const p=PRESETS[t.preset]||PRESETS.midnight;let s=document.documentElement.style;s.setProperty('--bg',p[0]);s.setProperty('--bg2',p[1]);s.setProperty('--door',p[2]+'d1');if(/^#[0-9a-f]{6}$/i.test(t.accent))s.setProperty('--accent',t.accent);document.body.classList.toggle('shape-square',t.shape==='square');document.body.classList.toggle('shape-pill',t.shape==='pill');document.body.classList.toggle('layout-staggered',t.layout==='staggered');$('calendar-title').textContent=t.title||DEFAULT.theme.title;$('calendar-subtitle').textContent=t.subtitle||DEFAULT.theme.subtitle;document.title=`${t.title||'Musical Advent Calendar'} ${cfg.year}`;snow(Boolean(t.snow));
  const bg=(typeof t.backgroundImage==='string'&&/^media\/(?:photos|backgrounds)\/[a-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(t.backgroundImage))?t.backgroundImage:'';
  if(t.useBackgroundImage&&bg){
    document.body.style.backgroundImage='linear-gradient(rgba(16,24,42,.65),rgba(16,24,42,.78)),url("'+bg+'")';
    document.body.style.backgroundSize='cover';document.body.style.backgroundPosition='center';
    document.body.style.backgroundRepeat='no-repeat';
  }else{document.body.style.backgroundImage='';document.body.style.backgroundSize='';document.body.style.backgroundPosition='';document.body.style.backgroundRepeat='';}
}
function snow(on){let el=$('snow');el.replaceChildren();if(!on||matchMedia('(prefers-reduced-motion: reduce)').matches)return;for(let i=0;i<28;i++){let x=document.createElement('span');x.textContent=i%3===0?'✳':'·';x.style.left=(i*37.93%100)+'%';x.style.fontSize=(9+i%5*3)+'px';x.style.animationDelay=(-i*.83)+'s';x.style.animationDuration=(9+i%8*2)+'s';el.append(x);}}
function eligible(d){if(previewMode)return true;const now=new Date(),year=Number(cfg.year)||2026;if(now.getFullYear()>year)return true;if(now.getFullYear()<year)return false;return now.getMonth()===11&&now.getDate()>=d;}
function opened(){try{return JSON.parse(localStorage.getItem('advent-opened-'+cfg.year))||{}}catch{return {}}}
function mark(d){if(previewMode){previewOpened[d]=true;return;}let a=opened();a[d]=true;try{localStorage.setItem('advent-opened-'+cfg.year,JSON.stringify(a))}catch{}}
function door(d){return cfg.doors.find(x=>Number(x.day)===d)||{day:d};}
function draw(){let grid=$('calendar-grid');grid.replaceChildren();let history=previewMode?previewOpened:opened();for(let n=1;n<=25;n++){let ok=eligible(n),d=door(n),isOpen=Boolean(history[n]);let b=document.createElement('button');b.type='button';b.className='door'+(ok?'':' locked')+(isOpen?' opened':'')+(isOpen&&d.photo?' photo-revealed':'');b.setAttribute('aria-label',`December ${n}: ${isOpen?'view opened door':ok?'open door':'locked until December '+n}`);b.setAttribute('aria-disabled',String(!ok));if(isOpen&&d.photo){let photo=document.createElement('img');photo.className='door-thumbnail';photo.src=d.photo;photo.alt='';photo.loading='lazy';b.append(photo);}let number=document.createElement('span');number.className='door-number';number.textContent=n;let word=document.createElement('span');word.className='door-word';word.textContent=isOpen?'Opened':previewMode?'Preview door':(ok?'Open door':'Locked');b.append(number,word);b.addEventListener('click',()=>{if(!ok)return;openDoor(n)});grid.append(b);}}
function openDoor(n){
  stop(); activeDay=n; mark(n); draw();
  const d=door(n);
  const suffix=n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';
  $('dialog-title').textContent=`December ${n}${suffix}`;
  const chosen=safeText(d.chosenBy), songTitle=safeText(d.songTitle)||safeText(d.title), artist=safeText(d.artist);
  $('dialog-message').textContent=chosen?'Chosen by '+chosen:'';
  $('dialog-message').classList.toggle('hidden',!chosen);
  $('dialog-song-title').textContent=songTitle;
  $('dialog-song-title').classList.toggle('hidden',!songTitle);
  $('dialog-artist').textContent=artist;
  $('dialog-artist').classList.toggle('hidden',!artist);
  const img=$('dialog-image'),none=$('dialog-placeholder');
  img.classList.toggle('hidden',!d.photo);
  none.classList.toggle('hidden',Boolean(d.photo));
  if(d.photo){img.src=d.photo;img.alt='Photograph for December '+n;}else img.removeAttribute('src');
  $('door-dialog').showModal();
  if(d.song)play();
}
function closeDoor(){$('door-dialog').close();}
function stop(){if(currentAudio){currentAudio.pause();currentAudio.removeAttribute('src');currentAudio.load();currentAudio=null;}activeTrack='';$('nowplaying').classList.add('hidden');$('song-seek').value=0;$('elapsed-time').textContent='0:00';$('total-time').textContent='0:00';}
function play(){const d=door(activeDay||1);if(!d.song)return;if(activeTrack===d.song&&currentAudio){currentAudio.paused?currentAudio.play().catch(()=>{syncPlayer();}):currentAudio.pause();syncPlayer();return}stop();let audio=new Audio(d.song);currentAudio=audio;activeTrack=d.song;audio.addEventListener('ended',stop);audio.addEventListener('loadedmetadata',syncProgress);audio.addEventListener('durationchange',syncProgress);audio.addEventListener('timeupdate',syncProgress);audio.addEventListener('pause',syncPlayer);audio.addEventListener('play',syncPlayer);audio.addEventListener('error',()=>{if(currentAudio===audio){$('playing-title').textContent='Unable to load this song';syncPlayer();}});$('playing-title').textContent=safeText(d.songTitle)||safeText(d.title)||`Door ${d.day}`;$('playing-artist').textContent=safeText(d.artist);$('nowplaying').classList.remove('hidden');syncProgress();audio.play().catch(()=>{syncPlayer();});syncPlayer();}
function formatTime(seconds){if(!Number.isFinite(seconds)||seconds<0)return '0:00';let n=Math.floor(seconds);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
function syncProgress(){if(!currentAudio)return;let duration=currentAudio.duration;let valid=Number.isFinite(duration)&&duration>0;$('song-seek').disabled=!valid;$('song-seek').max=valid?String(duration):'100';$('song-seek').value=valid?String(Math.min(currentAudio.currentTime,duration)):'0';$('elapsed-time').textContent=formatTime(currentAudio.currentTime);$('total-time').textContent=valid?formatTime(duration):'0:00';}
function syncPlayer(){if(!currentAudio)return;$('toggle-play').textContent=currentAudio.paused?'▶':'❚❚';}
async function init(){if(previewMode)$('preview-banner').classList.remove('hidden');try{let r=await fetch('calendar.json?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);let data=await r.json();cfg={...DEFAULT,...data,theme:{...DEFAULT.theme,...data.theme},doors:Array.isArray(data.doors)?data.doors:[]}}catch(e){console.warn('Calendar configuration could not be loaded:',e);$('calendar-footer').textContent='Preview calendar — content has not been published yet.'}theme(cfg.theme);draw();$('close-door').onclick=closeDoor;$('door-dialog').addEventListener('click',e=>{if(e.target===$('door-dialog'))closeDoor()});$('stop-play').onclick=stop;$('song-seek').oninput=()=>{if(!currentAudio||!Number.isFinite(currentAudio.duration))return;currentAudio.currentTime=Number($('song-seek').value);syncProgress()};$('toggle-play').onclick=()=>{if(!currentAudio)return;currentAudio.paused?currentAudio.play().catch(()=>{}):currentAudio.pause()};}
init();
})();