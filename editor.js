(function adventEditor(){
'use strict';
const OWNER='interzone83',PUBLIC=`${OWNER}/musical-advent-2026`,PRIVATE=`${OWNER}/musical-advent-2026-admin`;
const DEF_THEME={preset:'midnight',accent:'#e9c88a',snow:true,useBackgroundImage:false,backgroundImageId:'',shape:'soft',layout:'grid',title:'Musical Advent Calendar',subtitle:'25 days of music & memories'};
const PRESETS={midnight:['#10182a','#243859','#24344f'],forest:['#092a26','#244d41','#1b4c3d'],berry:['#301a2b','#642e43','#532a40']};
const $=id=>document.getElementById(id);
let draft={version:1,year:2026,theme:{...DEF_THEME},doors:[]},library={version:1,assets:[]};
let token=sessionStorage.getItem('advent_2026_github_token')||'',selected=1,dirty=false,connected=false,busy=false;
let pendingImport=[];
 let mediaFilter='photo';
const shas={draft:null,library:null,public:null};
const media=()=>Array.isArray(library.assets)?library.assets:[];
const asset=id=>media().find(a=>a.id===id)||null;
function photoSrc(a){return a?`https://raw.githubusercontent.com/${PUBLIC}/main/${a.path.split('/').map(encodeURIComponent).join('/')}`:'';}
function status(msg,kind=''){let el=$('editor-status');el.textContent=msg;el.className='status '+kind;}
function setDirty(yes=true){dirty=yes;$('dirty-indicator').textContent=dirty?'● Unsaved draft changes':'✓ All draft changes saved';$('dirty-indicator').style.color=dirty?'var(--accent)':'';}
function setBusy(val){busy=val;for(let id of ['connect-button','save-button','quick-save','publish-button','upload-button','scan-button'])$(id).disabled=val;}
function setTab(id){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));document.querySelectorAll('.tab-content').forEach(x=>x.classList.toggle('hidden',x.id!=='tab-'+id));}
function randomId(){let b=crypto.getRandomValues(new Uint8Array(16));return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');}
function safeBase64(bytes){let parts=[];for(let i=0;i<bytes.length;i+=8192)parts.push(String.fromCharCode(...bytes.subarray(i,i+8192)));return btoa(parts.join(''));}
function encodeText(s){return safeBase64(new TextEncoder().encode(s));}
function decodeText(b64){let b=atob(b64.replace(/\s/g,'')),v=new Uint8Array(b.length);for(let i=0;i<b.length;i++)v[i]=b.charCodeAt(i);return new TextDecoder().decode(v);}
async function api(url,options={}){if(!token)throw Error('Enter your GitHub token on the Publish tab first.');let r=await fetch('https://api.github.com'+url,{...options,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+token,...(options.headers||{})},cache:'no-store'});if(!r.ok){let m='';try{let x=await r.json();m=x.message||''}catch{}let err=new Error(`GitHub ${r.status}: ${m||r.statusText}`);err.status=r.status;throw err}return r.json();}
function pathUrl(repo,path){return `/repos/${repo}/contents/${path}`;}
async function getJson(repo,path){try{let v=await api(pathUrl(repo,path));if(!v.content)throw Error('GitHub returned no content for '+path);return{value:JSON.parse(decodeText(v.content)),sha:v.sha}}catch(err){if(err.status===404)return{value:null,sha:null};throw err}}
async function writeJson(repo,path,data,sha){let body={message:`Advent Studio: update ${path}`,content:encodeText(JSON.stringify(data,null,2)+'\n')};if(sha)body.sha=sha;let r=await api(pathUrl(repo,path),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return r.content?.sha||null;}
function ensureDoor(day){let d=draft.doors.find(x=>Number(x.day)===day);if(!d){d={day,photoId:'',songId:'',title:'',message:'',chosenBy:'',songTitle:'',artist:''};draft.doors.push(d);}return d;}
function selectedDoor(){return ensureDoor(selected);}
function backgroundAsset(){const a=asset(draft.theme.backgroundImageId);return a&&a.kind==='photo'&&typeof a.path==='string'&&a.path.startsWith('media/photos/')?a:null;}
function renderBackgroundOptions(){
  const el=$('setting-background-image'),id=draft.theme.backgroundImageId||'';
  el.replaceChildren();
  const blank=document.createElement('option');blank.value='';blank.textContent='Choose an uploaded image';el.append(blank);
  for(const a of media().filter(a=>a.kind==='photo').sort((a,b)=>a.name.localeCompare(b.name))){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;el.append(o);}
  el.value=backgroundAsset()?id:'';
  const preview=$('background-image-preview');preview.replaceChildren();
  const a=backgroundAsset();
  if(a){const img=new Image();img.src=photoSrc(a);img.alt='';img.className='background-image-thumb';const label=document.createElement('span');label.textContent=a.name;preview.append(img,label);}
  else{const message=document.createElement('span');message.className='muted';message.textContent='Upload a picture in Media Library, then select it here.';preview.append(message);}
}
function themePreview(){
  const t=draft.theme,p=PRESETS[t.preset]||PRESETS.midnight,el=$('preview-surface');
  el.style.setProperty('--bg',p[0]);el.style.setProperty('--bg2',p[1]);el.style.setProperty('--door',p[2]+'d1');el.style.setProperty('--accent',/^#[0-9a-f]{6}$/i.test(t.accent)?t.accent:DEF_THEME.accent);
  el.style.background='radial-gradient(circle at 50% -10%,var(--bg2),var(--bg) 75%)';
  const bg=t.useBackgroundImage&&backgroundAsset();
  if(bg){el.style.backgroundImage='linear-gradient(rgba(16,24,42,.58),rgba(16,24,42,.72)),url("'+photoSrc(bg)+'")';el.style.backgroundSize='cover';el.style.backgroundPosition='center';el.style.backgroundRepeat='no-repeat';}
  el.classList.toggle('shape-square',t.shape==='square');el.classList.toggle('shape-pill',t.shape==='pill');el.classList.toggle('layout-staggered',t.layout==='staggered');
  $('preview-title').textContent=t.title||DEF_THEME.title;$('preview-subtitle').textContent=t.subtitle||DEF_THEME.subtitle;
}
function renderGrid(){const grid=$('preview-grid');grid.replaceChildren();for(let i=1;i<=25;i++){let d=draft.doors.find(x=>Number(x.day)===i)||{},complete=Boolean(asset(d.photoId)&&asset(d.songId));let b=document.createElement('button');b.type='button';b.className='door'+(i===selected?' selected':'')+(complete?' opened':'');b.setAttribute('aria-label',`Edit door ${i}${complete?', complete':''}`);let n=document.createElement('span');n.className='door-number';n.textContent=i;let s=document.createElement('span');s.className='door-word';s.textContent=complete?'Ready':(d.photoId||d.songId?'In progress':'Empty');b.append(n,s);b.onclick=()=>{selected=i;setTab('doors');renderDoor();renderGrid()};grid.append(b);}renderProgress();}
function renderProgress(){let completed=0,partial=0;for(let n=1;n<=25;n++){let d=draft.doors.find(x=>Number(x.day)===n)||{};if(asset(d.photoId)&&asset(d.songId))completed++;else if(asset(d.photoId)||asset(d.songId))partial++;}$('progress-count').textContent=`${completed} of 25 doors ready (photo + music). ${partial} partially filled.`;}
function themeForm(){let t=draft.theme;for(let [key,id] of [['title','setting-title'],['subtitle','setting-subtitle'],['preset','setting-preset'],['accent','setting-accent'],['shape','setting-shape'],['layout','setting-layout']])$(id).value=t[key]??DEF_THEME[key];$('setting-snow').checked=Boolean(t.snow);$('setting-use-background').checked=Boolean(t.useBackgroundImage);renderBackgroundOptions();themePreview();}
function selectList(elId,kind,value){let el=$(elId);el.replaceChildren();let empty=document.createElement('option');empty.value='';empty.textContent=kind==='photo'?'No photo selected':'No song selected';el.append(empty);for(let a of media().filter(x=>x.kind===kind).sort((a,b)=>a.name.localeCompare(b.name))){let o=document.createElement('option');o.value=a.id;o.textContent=a.name;el.append(o);}el.value=asset(value)?.kind===kind?value:'';}
function renderPhoto(){let area=$('photo-preview');area.replaceChildren();let a=asset(selectedDoor().photoId);if(a){let img=new Image();img.src=photoSrc(a);img.alt=a.name;area.append(img);}else{let msg=document.createElement('span');msg.className='empty';msg.textContent='No photograph selected yet';area.append(msg);}}
function renderDoor(){let d=selectedDoor();$('door-day').value=String(selected);selectList('door-photo','photo',d.photoId);selectList('door-song','song',d.songId);$('door-title').value=d.title||'';$('door-message').value=d.message||'';$('door-chosen-by').value=d.chosenBy||'';$('door-song-title').value=d.songTitle||'';$('door-artist').value=d.artist||'';let complete=Boolean(asset(d.photoId)&&asset(d.songId));$('door-status-dot').classList.toggle('ok',complete);$('door-status').textContent=complete?'Photo and song assigned — ready':(asset(d.photoId)||asset(d.songId)?'Partially complete':'Awaiting photo and music');renderPhoto();}
function renderLibrary(){
  const list=$('media-list');list.replaceChildren();
  const all=media(),photos=all.filter(a=>a.kind==='photo'),songs=all.filter(a=>a.kind==='song');
  $('media-filter-images').textContent='Images ('+photos.length+')';
  $('media-filter-audio').textContent='MP3 / Audio ('+songs.length+')';
  for(const [id,kind] of [['media-filter-images','photo'],['media-filter-audio','song']]){$(id).classList.toggle('active',mediaFilter===kind);$(id).setAttribute('aria-pressed',String(mediaFilter===kind));}
  const files=(mediaFilter==='photo'?photos:songs).slice().sort((a,b)=>a.name.localeCompare(b.name));
  $('media-count').textContent=String(files.length);
  if(!files.length){const p=document.createElement('p');p.className='muted';p.textContent=mediaFilter==='photo'?'No images yet. Upload one above or scan the public GitHub folders.':'No audio files yet. Upload an MP3, M4A or WAV above.';list.append(p);return;}
  for(const a of files){
    const row=document.createElement('div');row.className='media-item';
    if(a.kind==='photo'){const img=new Image();img.src=photoSrc(a);img.alt='';img.loading='lazy';row.append(img)}
    else{const ico=document.createElement('span');ico.textContent='♫';ico.style.fontSize='2rem';row.append(ico)}
    const detail=document.createElement('div');detail.className='label';const name=document.createElement('div');name.textContent=a.name;
    const usage=draft.doors.filter(d=>d.photoId===a.id||d.songId===a.id).map(d=>d.day).sort((a,b)=>a-b);
    const small=document.createElement('small');small.textContent=(a.kind==='photo'?'Image':'Audio')+' · '+(usage.length?'Door '+usage.join(', '):'Unassigned')+(draft.theme.backgroundImageId===a.id?' · Calendar background':'');
    detail.append(name,small);row.append(detail);
    const btn=document.createElement('button');btn.type='button';btn.className='btn small ghost';btn.textContent='Assign';
    btn.onclick=()=>{setTab('doors');if(a.kind==='photo')selectedDoor().photoId=a.id;else selectedDoor().songId=a.id;setDirty();renderAll()};
    row.append(btn);list.append(row);
  }
}
function renderAll(){renderBackgroundOptions();themePreview();renderGrid();renderDoor();renderLibrary();}
function feedbackError(e){console.error(e);status(e?.message||String(e),'bad')}
async function connect(){const v=$('github-token').value.trim()||token;if(!v){status('Enter your GitHub token first.','bad');setTab('publish');return}token=v;setBusy(true);status('Checking GitHub access…');try{await api(`/repos/${PRIVATE}`);await api(`/repos/${PUBLIC}`);let [a,b,c]=await Promise.all([getJson(PRIVATE,'draft.json'),getJson(PRIVATE,'media-library.json'),getJson(PUBLIC,'calendar.json')]);if(a.value){draft={...a.value,theme:{...DEF_THEME,...a.value.theme},doors:Array.isArray(a.value.doors)?a.value.doors:[]};shas.draft=a.sha}if(b.value){library={...b.value,assets:Array.isArray(b.value.assets)?b.value.assets:[]};shas.library=b.sha}shas.public=c.sha;connected=true;sessionStorage.setItem('advent_2026_github_token',token);$('connection-state').textContent='Connected to GitHub';$('github-token').value='';themeForm();renderAll();setDirty(false);status('Connected. Private draft and media library loaded.','good');}catch(e){connected=false;$('connection-state').textContent='Connection failed';if(e.status===404)status('Cannot access a repository. Grant the GitHub token access to BOTH repositories and check their names.','bad');else feedbackError(e)}finally{setBusy(false)}}
async function disconnect(){connected=false;token='';sessionStorage.removeItem('advent_2026_github_token');$('github-token').value='';$('connection-state').textContent='Not connected';status('Disconnected. Unsaved changes remain in this browser tab.');}
async function saveDraft(silent=false){if(!connected)throw Error('Connect to both GitHub repositories on the Publish tab first.');shas.draft=await writeJson(PRIVATE,'draft.json',draft,shas.draft);shas.library=await writeJson(PRIVATE,'media-library.json',library,shas.library);setDirty(false);$('saved-time').textContent='Draft saved to private GitHub repository: '+new Date().toLocaleString();if(!silent)status('Draft saved privately. Public calendar unchanged.','good');}
async function doSave(){if(busy)return;setBusy(true);status('Saving private draft…');try{await saveDraft()}catch(e){feedbackError(e)}finally{setBusy(false)}}
async function publish(){if(busy)return;if(!connected){setTab('publish');status('Connect to GitHub first.','bad');return}let filled=draft.doors.filter(d=>asset(d.photoId)&&asset(d.songId)).length;let msg=`Publish your calendar with ${filled} fully assigned doors? This updates the PUBLIC website. Continue?`;if(!confirm(msg))return;setBusy(true);status('Saving private draft, then publishing…');try{await saveDraft(true);if(draft.theme.useBackgroundImage&&!backgroundAsset()){setTab('appearance');status('Choose a background image in Appearance before publishing.','bad');return;}
let {backgroundImageId,...publicTheme}=draft.theme;
publicTheme.backgroundImage=draft.theme.useBackgroundImage?backgroundAsset()?.path||'':'';
let result={version:1,year:2026,theme:publicTheme,doors:[]};for(let day=1;day<=25;day++){let d=draft.doors.find(x=>Number(x.day)===day)||{},p=asset(d.photoId),s=asset(d.songId);result.doors.push({day,photo:p?.path||'',song:s?.path||'',title:String(d.title||''),message:String(d.message||''),chosenBy:String(d.chosenBy||''),songTitle:String(d.songTitle||''),artist:String(d.artist||'')});}shas.public=await writeJson(PUBLIC,'calendar.json',result,shas.public);status('Published! Your public website will update once GitHub Pages finishes deploying.','good');}catch(e){feedbackError(e)}finally{setBusy(false)}}
function fileToB64(f){return new Promise((resolve,reject)=>{let r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(Error('Could not read selected file.'));r.readAsDataURL(f);})}
async function upload(){if(!connected){setTab('publish');status('Connect to GitHub before uploading.','bad');return}let kind=$('upload-kind').value,file=$('upload-file').files[0];if(!file){status('Choose a file first.','bad');return}let ext=(file.name.split('.').pop()||'').toLowerCase(),allow=kind==='photo'?['jpg','jpeg','png','webp']:['mp3','m4a','wav'];if(!allow.includes(ext)){status('Unsupported file type for '+kind+'.','bad');return}if(file.size>20*1024*1024){status('This file exceeds the 20 MB editor limit. Compress it first.','bad');return}const path=`media/${kind==='photo'?'photos':'music'}/${randomId()}.${ext}`;setBusy(true);status(`Uploading ${file.name}…`);try{const encoded=await fileToB64(file);await api(pathUrl(PUBLIC,path),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Add anonymous Advent ${kind}`,content:encoded})});library.assets.push({id:randomId(),kind,name:file.name,path,size:file.size});shas.library=await writeJson(PRIVATE,'media-library.json',library,shas.library);$('upload-file').value='';setDirty();renderAll();status(`Uploaded “${file.name}” with a random public filename. Assign it on the Doors tab.`,`good`);}catch(e){feedbackError(e);status('Upload issue: '+(e.message||e)+'. If the public upload succeeded before the private save failed, use Scan GitHub folders to recover it.','bad')}finally{setBusy(false)}}
async function scan(){if(!connected){setTab('publish');status('Connect to GitHub first.','bad');return}setBusy(true);status('Scanning media folders…');try{let count=0;for(let [path,kind] of [['media/photos','photo'],['media/music','song']]){let items=[];try{items=await api(pathUrl(PUBLIC,path))}catch(e){if(e.status===404)continue;throw e}if(!Array.isArray(items))continue;for(let x of items){if(x.type!=='file'||media().some(a=>a.path===x.path))continue;library.assets.push({id:randomId(),kind,name:x.name,path:x.path,size:x.size||0});count++;}}if(count){shas.library=await writeJson(PRIVATE,'media-library.json',library,shas.library);setDirty();renderAll()}status(count?`Imported ${count} new file(s). These use their GitHub filenames as labels.`:'No new media files found.','good')}catch(e){feedbackError(e)}finally{setBusy(false)}}

function excelLibrary(){if(!window.XLSX)throw Error('The Excel reader could not load. Check your internet connection and reload the editor.');return window.XLSX;}
function downloadImportTemplate(){
  try {
    const XLSX=excelLibrary();
    const rows=[['Day','Chosen by','Song title','Artist']];
    for(let n=1;n<=25;n++)rows.push([n,'','','']);
    const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:10},{wch:26},{wch:40},{wch:32}];
    XLSX.utils.book_append_sheet(wb,ws,'Songs');
    XLSX.writeFile(wb,'musical_advent_song_template.xlsx',{compression:true});
    status('Downloaded blank Excel song template.','good');
  }catch(e){feedbackError(e)}
}
function normalHeader(v){return String(v==null?'':v).trim().toLowerCase().replace(/[^a-z0-9]/g,'');}
function parseSongRows(rows){
  const data=rows.filter(r=>Array.isArray(r)),first=data.findIndex(r=>r.some(x=>String(x==null?'':x).trim()!=='')); 
  if(first<0)throw Error('The spreadsheet is empty.');
  const firstRow=data[first].map(normalHeader);
  const aliases={day:['day','date','daynumber'],chosenBy:['chosenby','name','person','personname','chosen'],songTitle:['songtitle','song','track','tracktitle','title'],artist:['artist','performer','band']};
  const findCol=key=>firstRow.findIndex(v=>aliases[key].includes(v));
  const found=Object.fromEntries(Object.keys(aliases).map(k=>[k,findCol(k)]));
  const hasHeader=Object.values(found).filter(v=>v>=0).length>=2;
  const start=hasHeader?first+1:first;
  const cols=hasHeader?found:(data[first].length>=4?{day:0,chosenBy:1,songTitle:2,artist:3}:{day:-1,chosenBy:0,songTitle:1,artist:2});
  for(let key of ['chosenBy','songTitle','artist'])if(cols[key]<0)throw Error('Missing column: '+({chosenBy:'Chosen by',songTitle:'Song title',artist:'Artist'}[key]));
  const dayCol=cols.day>=0;
  const used=new Set(),out=[];
  for(let j=start;j<data.length;j++){
    const r=data[j],val=k=>String(r[cols[k]]==null?'':r[cols[k]]).trim();
    const hasDetail=['chosenBy','songTitle','artist'].some(k=>val(k));
    const rawDay=dayCol?val('day'):String(j-start+1);
    if(!rawDay&&!hasDetail)continue;
    if(!/^\d+$/.test(rawDay))throw Error('Invalid day "'+rawDay+'" on spreadsheet row '+(j+1)+'. Use whole day numbers 1–25.');
    const day=Number(rawDay);
    if(day<1||day>25)throw Error('Day '+day+' is outside the 1–25 range.');
    if(used.has(day))throw Error('Day '+day+' appears more than once.');
    used.add(day);
    out.push({day,chosenBy:val('chosenBy').slice(0,120),songTitle:val('songTitle').slice(0,200),artist:val('artist').slice(0,200)});
  }
  if(!out.length)throw Error('No valid song rows were found.');
  return out.sort((a,b)=>a.day-b.day);
}
function importDifference(row){
  const existing=draft.doors.find(x=>Number(x.day)===row.day)||{};
  const fields=['chosenBy','songTitle','artist'];
  return {
    changed:fields.some(k=>String(existing[k]||'')!==String(row[k]||'')),
    overwrite:fields.some(k=>String(existing[k]||'')&&String(existing[k]||'')!==String(row[k]||''))
  };
}
function clearImportPreview(){
  pendingImport=[];
  $('import-preview').replaceChildren();
  $('import-summary').textContent='Choose a source above to see which days will change.';
  $('import-apply').disabled=true;$('import-cancel').disabled=true;
}
function showImportPreview(rows,source){
  pendingImport=parseSongRows(rows);
  const changed=pendingImport.filter(r=>importDifference(r).changed);
  const overwritten=changed.filter(r=>importDifference(r).overwrite);
  $('import-summary').textContent=source+': '+pendingImport.length+' days found, '+changed.length+' days with changes, '+overwritten.length+' with existing values to overwrite.';
  const container=$('import-preview');container.replaceChildren();
  const table=document.createElement('table');table.style.width='100%';table.style.fontSize='.85rem';table.style.borderCollapse='collapse';
  const head=document.createElement('tr');
  for(let h of ['Day','Chosen by','Song title','Artist','Status']){const th=document.createElement('th');th.textContent=h;th.style.textAlign='left';th.style.padding='6px';head.append(th)}
  table.append(head);
  for(let row of pendingImport){
    const tr=document.createElement('tr'),info=importDifference(row);
    const values=[row.day,row.chosenBy,row.songTitle,row.artist,info.overwrite?'Overwrite':info.changed?'New / updated':'No change'];
    for(let v of values){const td=document.createElement('td');td.textContent=String(v);td.style.padding='6px';td.style.borderTop='1px solid #7775';td.style.verticalAlign='top';tr.append(td)}
    table.append(tr);
  }
  container.append(table);
  $('import-apply').disabled=changed.length===0;
  $('import-cancel').disabled=false;
  status('Spreadsheet loaded for review. No changes applied yet.','good');
}
async function previewImportFile(){
  try{
    const file=$('import-file').files[0];
    if(!file)throw Error('Choose an Excel or CSV file first.');
    if(!/\.(xlsx|xls|csv|tsv)$/i.test(file.name))throw Error('Choose an Excel (.xlsx/.xls) or CSV file.');
    if(file.size>10*1024*1024)throw Error('Spreadsheet exceeds the 10 MB import limit.');
    const XLSX=excelLibrary();
    const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
    const sheet=workbook.Sheets[workbook.SheetNames[0]];
    if(!sheet)throw Error('The spreadsheet contains no worksheets.');
    const rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:'',blankrows:false});
    showImportPreview(rows,file.name);
  }catch(e){clearImportPreview();feedbackError(e)}
}
async function previewImportGoogle(){
  try{
    const link=$('import-sheet-url').value.trim();
    const parsed=new URL(link);
    if(parsed.hostname!=='docs.google.com')throw Error('Paste a Google Sheets link from docs.google.com.');
    const match=parsed.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
    if(!match)throw Error('This is not a Google Sheets document link.');
    const gid=(parsed.searchParams.get('gid')||parsed.hash.match(/gid=(\d+)/)?.[1]||'0');
    if(!/^\d+$/.test(gid))throw Error('Invalid worksheet ID in the link.');
    const url=new URL('https://docs.google.com/spreadsheets/d/'+match[1]+'/gviz/tq');
    url.searchParams.set('tqx','out:json');url.searchParams.set('headers','0');url.searchParams.set('gid',gid);
    const response=await fetch(url.toString(),{mode:'cors',credentials:'omit',cache:'no-store'});
    if(!response.ok)throw Error('Google Sheets responded with '+response.status+'. Check the sheet sharing settings.');
    const body=await response.text();
    const first=body.indexOf('{'),last=body.lastIndexOf('}');
    if(first<0||last<first)throw Error('Google Sheets did not return song data. Check sharing permissions.');
    const result=JSON.parse(body.slice(first,last+1));
    if(result.status!=='ok'||!result.table)throw Error('Google Sheets could not read this tab. Check that Anyone with the link can view.');
    const rows=(result.table.rows||[]).map(r=>[0,1,2,3].map(i=>{
      const cell=(r.c||[])[i];
      return cell==null?'':String(cell.f==null?cell.v==null?'':cell.v:cell.f);
    }));
    showImportPreview(rows,'Google Sheets');
  }catch(e){clearImportPreview();feedbackError(e)}
}
function applyImport(){
  if(!pendingImport.length)return;
  const changed=pendingImport.filter(r=>importDifference(r).changed);
  const overwritten=changed.filter(r=>importDifference(r).overwrite);
  if(!changed.length){clearImportPreview();return}
  if(overwritten.length){
    const days=overwritten.map(r=>r.day).join(', ');
    if(!confirm('Overwrite existing song details for '+overwritten.length+' door(s): '+days+'? Photos, music files and messages will be preserved.'))return;
  }
  for(let row of changed){let d=ensureDoor(row.day);for(let key of ['chosenBy','songTitle','artist'])d[key]=row[key]}
  setDirty();renderAll();
  const count=changed.length;
  clearImportPreview();
  status('Applied song details to '+count+' door(s) in your local draft. Use Save Draft to store them privately; publishing is separate.','good');
}

function showTest(){let d=selectedDoor(),a=asset(d.photoId),s=asset(d.songId);$('test-day').textContent=`December ${selected}, 2026`;$('test-title').textContent=d.title||('December '+selected+(selected%100>=11&&selected%100<=13?'th':selected%10===1?'st':selected%10===2?'nd':selected%10===3?'rd':'th'));$('test-message').textContent=(d.chosenBy?'Chosen by '+d.chosenBy:'')+(d.message?'\n'+d.message:'')+(d.songTitle?'\n'+d.songTitle+(d.artist?' — '+d.artist:''):'');let zone=$('test-image');zone.replaceChildren();if(a){let img=new Image();img.alt=a.name;img.src=photoSrc(a);zone.append(img)}else{let m=document.createElement('div');m.className='empty';m.textContent='No photo assigned';zone.append(m)}let audio=$('test-audio');audio.pause();audio.removeAttribute('src');audio.load();audio.classList.toggle('hidden',!s);if(s){audio.src=photoSrc(s);audio.load()}$('test-dialog').showModal();}
function listeners(){document.querySelectorAll('.tab').forEach(el=>el.onclick=()=>setTab(el.dataset.tab));for(let [key,id] of [['title','setting-title'],['subtitle','setting-subtitle'],['preset','setting-preset'],['accent','setting-accent'],['shape','setting-shape'],['layout','setting-layout']]){$(id).addEventListener(key==='accent'?'input':'change',()=>{draft.theme[key]=$(id).value;setDirty();themePreview()});if(key==='title'||key==='subtitle')$(id).addEventListener('input',()=>{draft.theme[key]=$(id).value;setDirty();themePreview()});}$('setting-snow').onchange=()=>{draft.theme.snow=$('setting-snow').checked;setDirty()};
$('setting-use-background').onchange=()=>{draft.theme.useBackgroundImage=$('setting-use-background').checked;setDirty();themePreview()};
$('setting-background-image').onchange=()=>{draft.theme.backgroundImageId=$('setting-background-image').value;setDirty();renderBackgroundOptions();themePreview()};
$('go-background-media').onclick=()=>{mediaFilter='photo';setTab('media');renderLibrary()};
$('media-filter-images').onclick=()=>{mediaFilter='photo';renderLibrary()};
$('media-filter-audio').onclick=()=>{mediaFilter='song';renderLibrary()};$('door-day').onchange=()=>{selected=Number($('door-day').value);renderDoor();renderGrid()};for(let [key,id] of [['photoId','door-photo'],['songId','door-song'],['title','door-title'],['message','door-message'],['chosenBy','door-chosen-by'],['songTitle','door-song-title'],['artist','door-artist']])$(id).addEventListener(['title','message','chosenBy','songTitle','artist'].includes(key)?'input':'change',()=>{selectedDoor()[key]=$(id).value;setDirty();if(key==='photoId'||key==='songId')renderAll();else renderProgress()});$('door-test').onclick=showTest;$('go-media').onclick=()=>setTab('media');$('test-close').onclick=()=>$('test-dialog').close();$('test-dialog').addEventListener('close',()=>{$('test-audio').pause()});$('upload-kind').onchange=()=>{$('upload-file').accept=$('upload-kind').value==='photo'?'image/jpeg,image/png,image/webp':'.mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav';$('upload-file').value=''};$('connect-button').onclick=connect;$('disconnect-button').onclick=disconnect;$('save-button').onclick=doSave;$('quick-save').onclick=doSave;$('publish-button').onclick=publish;$('upload-button').onclick=upload;$('scan-button').onclick=scan;$('import-download').onclick=downloadImportTemplate;$('import-file-button').onclick=previewImportFile;$('import-sheet-button').onclick=previewImportGoogle;$('import-apply').onclick=applyImport;$('import-cancel').onclick=clearImportPreview;window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});}
function init(){for(let n=1;n<=25;n++){let option=document.createElement('option');option.value=n;option.textContent='Door '+n;$('door-day').append(option)}listeners();themeForm();renderAll();setDirty(false);if(token){$('connection-state').textContent='Reconnecting…';status('Restoring GitHub connection from this browser tab…');void connect();}else status('Start designing now. Connect to GitHub to save or upload.');}
init();
})();
