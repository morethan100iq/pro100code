import {fresh,merge,validState} from './model.js';
const KEY='pro100code-cache-v2';
export let state=fresh();
let owner=null,revision=0,busy=false,pending=false,job,serial=0;
export let syncStatus='Подключаем прогресс…';
const notify=kind=>window.dispatchEvent(new CustomEvent('learning-state',{detail:{kind,status:syncStatus}}));
try{const c=JSON.parse(localStorage.getItem(KEY));if(c&&validState(c.state)){state=c.state;owner=c.owner||null;}}catch{}
if(!owner&&!state.events.length&&!state.legacy.attempts){try{const s=JSON.parse(localStorage.getItem('orbita-progress-v1'));if(s&&Array.isArray(s.solved)&&Array.isArray(s.days)){state.legacy={solved:s.solved.filter(n=>Number.isInteger(n)&&n>0&&n<=18),days:s.days.filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)),attempts:Math.max(0,Number(s.attempts)||0),correct:Math.max(0,Number(s.correct)||0),sessions:Math.max(0,Number(s.sessions)||0)};}}catch{}}
function cache(){try{localStorage.setItem(KEY,JSON.stringify({owner,state}));return true}catch{syncStatus='Копия в браузере недоступна';return false}}
export function save(){serial++;cache();clearTimeout(job);job=setTimeout(sync,650);notify('local');}
export async function sync(){
 if(busy){pending=true;return}busy=true;pending=false;clearTimeout(job);
 try{
  syncStatus='Сохраняем…';notify('status');
  for(let attempt=0;attempt<3;attempt++){
   const r=await fetch('/api/state',{cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(r.status===401){syncStatus='Войдите, чтобы синхронизировать прогресс';notify('auth');return}
   if(!r.ok)throw new Error('load');
   const remote=await r.json();if(!validState(remote.state)||typeof remote.user!=='string')throw new Error('invalid');
   if(owner&&owner!==remote.user){try{localStorage.setItem(KEY+':'+owner,JSON.stringify(state));const previous=JSON.parse(localStorage.getItem(KEY+':'+remote.user));state=validState(previous)?previous:fresh();}catch{state=fresh();}}
   owner=remote.user;revision=remote.revision;const before=JSON.stringify(state);state=merge(remote.state,state);const changed=before!==JSON.stringify(state);cache();
   const snapshot=serial,payload=JSON.stringify({state,revision});
   const w=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:payload,signal:AbortSignal.timeout(12000)});
   if(w.status===409)continue;
   if(!w.ok)throw new Error('save');
   revision=(await w.json()).revision;syncStatus=remote.local?'Сохранено · локальный просмотр':'Синхронизировано';
   if(serial!==snapshot)pending=true;
   cache();notify(changed?'synced':'status');return;
  }
  throw new Error('conflict');
 }catch{syncStatus=cache()?'Нет связи · изменения ждут отправки':'Нет связи · оставьте страницу открытой';notify('offline');}
 finally{busy=false;if(pending){pending=false;job=setTimeout(sync,800)}}
}
export function identity(){return owner}
window.addEventListener('online',sync);
window.addEventListener('storage',e=>{if(e.key!==KEY||!e.newValue)return;try{const c=JSON.parse(e.newValue);if(c.owner===owner&&validState(c.state)){state=merge(state,c.state);notify('synced')}}catch{}});
setInterval(()=>{if(document.visibilityState==='visible')sync()},30000);
