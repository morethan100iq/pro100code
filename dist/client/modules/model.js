export const dayKey=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
export const fresh=()=>({version:2,events:[],favorites:{},help:{},drafts:{},training:null,settings:{dailyGoal:5,updatedAt:0},lastTask:null,legacy:{solved:[],attempts:0,correct:0,sessions:0,days:[]}});
const latest=(a,b)=>!a?b:!b?a:(a.updatedAt||0)>(b.updatedAt||0)?a:b;
const mergeMap=(a={},b={})=>Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].map(k=>[k,latest(a[k],b[k])]));
export function merge(a=fresh(),b=fresh()){
 const eventMap=new Map();for(const e of [...a.events,...b.events]){const prior=eventMap.get(e.id);if(!prior||e.at<prior.at||(e.at===prior.at&&JSON.stringify(e)<JSON.stringify(prior)))eventMap.set(e.id,e);}const events=[...eventMap.values()].sort((x,y)=>x.at-y.at||x.id.localeCompare(y.id));
 let training=latest(a.training,b.training);
 if(a.training&&b.training&&a.training.id===b.training.id){training={...training,answers:mergeMap(a.training.answers,b.training.answers),codes:mergeMap(a.training.codes,b.training.codes)};if(a.training.finished||b.training.finished)training={...training,...(a.training.finished?a.training:b.training),finished:true};}
 return {version:2,events,favorites:mergeMap(a.favorites,b.favorites),help:mergeMap(a.help,b.help),drafts:mergeMap(a.drafts,b.drafts),training,settings:latest(a.settings,b.settings),lastTask:latest(a.lastTask,b.lastTask),legacy:{solved:[...new Set([...a.legacy.solved,...b.legacy.solved])],days:[...new Set([...a.legacy.days,...b.legacy.days])],attempts:Math.max(a.legacy.attempts,b.legacy.attempts),correct:Math.max(a.legacy.correct,b.legacy.correct),sessions:Math.max(a.legacy.sessions,b.legacy.sessions)}};
}
export function validState(s){
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 if(!object(s)||s.version!==2||!Array.isArray(s.events)||s.events.length>10000||!['favorites','help','drafts','settings','legacy'].every(k=>object(s[k])))return false;
 if(!s.events.every(e=>object(e)&&typeof e.id==='string'&&e.id.length<150&&Number.isInteger(e.taskId)&&e.taskId>0&&e.taskId<=72&&Number.isFinite(e.at)&&typeof e.correct==='boolean'&&typeof e.assisted==='boolean'&&typeof e.answer==='string'&&e.answer.length<=80&&/^\d{4}-\d{2}-\d{2}$/.test(e.day)))return false;
 if(!Array.isArray(s.legacy.solved)||!s.legacy.solved.every(n=>Number.isInteger(n)&&n>0&&n<=72)||!Array.isArray(s.legacy.days)||!s.legacy.days.every(d=>typeof d==='string')||!['attempts','correct','sessions'].every(k=>Number.isFinite(s.legacy[k])&&s.legacy[k]>=0))return false;
 if(!Number.isInteger(s.settings.dailyGoal)||s.settings.dailyGoal<1||s.settings.dailyGoal>30||!Number.isFinite(s.settings.updatedAt))return false;
 for(const name of ['favorites','help','drafts']){if(Object.keys(s[name]).length>72)return false;for(const [key,v] of Object.entries(s[name])){if(!/^\d+$/.test(key)||Number(key)<1||Number(key)>72||!object(v)||!Number.isFinite(v.updatedAt))return false;if(name==='favorites'&&typeof v.value!=='boolean')return false;if(name==='help'&&(!Number.isInteger(v.level)||v.level<0||v.level>3))return false;if(name==='drafts'&&(typeof v.value!=='string'||v.value.length>20000))return false;}}
 if(s.lastTask!==null&&(!object(s.lastTask)||!Number.isInteger(s.lastTask.id)||s.lastTask.id<1||s.lastTask.id>72||!Number.isFinite(s.lastTask.updatedAt)))return false;
 const t=s.training;
 if(t!==null){if(!object(t)||typeof t.id!=='string'||t.id.length>100||!Array.isArray(t.ids)||!t.ids.length||t.ids.length>20||new Set(t.ids).size!==t.ids.length||!t.ids.every(n=>Number.isInteger(n)&&n>0&&n<=72)||!Number.isInteger(t.index)||t.index<0||t.index>=t.ids.length||!Number.isFinite(t.end)||!Number.isFinite(t.updatedAt)||typeof t.finished!=='boolean'||!object(t.answers)||!object(t.codes))return false;for(const [key,v]of Object.entries(t.answers)){if(!t.ids.includes(Number(key))||!object(v)||typeof v.value!=='string'||v.value.length>80||!Number.isFinite(v.updatedAt))return false;}for(const [key,v]of Object.entries(t.codes)){if(!t.ids.includes(Number(key))||!object(v)||typeof v.value!=='string'||v.value.length>20000||!Number.isFinite(v.updatedAt))return false;}}
 return true;
}
export const taskEvents=(s,id)=>s.events.filter(e=>e.taskId===id);
export const isSolved=(s,id)=>s.legacy.solved.includes(id)||s.events.some(e=>e.taskId===id&&e.correct);
export const independent=(s,id)=>s.events.some(e=>e.taskId===id&&e.correct&&!e.assisted);
export const needsReview=(s,id)=>{const e=taskEvents(s,id).at(-1);return !!e&&(!e.correct||e.assisted)};
export function firstAttemptStats(s,filter=()=>true){const first=new Map();for(const e of s.events)if(filter(e)&&!first.has(e.taskId))first.set(e.taskId,e);const values=[...first.values()];return {total:values.length,correct:values.filter(e=>e.correct&&!e.assisted).length};}
export function chooseTasks(bank,s,{group='all',level='all',count=5,mode='smart'}={},random=Math.random){
 let pool=bank.filter(t=>(group==='all'||t.group===group)&&(level==='all'||t.level===level));
 if(mode==='errors')pool=pool.filter(t=>needsReview(s,t.id));
 if(mode==='new')pool=pool.filter(t=>!isSolved(s,t.id));
 if(mode==='favorites')pool=pool.filter(t=>s.favorites[t.id]?.value);
 const old=new Set(s.training?.ids||[]);
 return pool.map(t=>({t,key:random()+(mode==='smart'?(needsReview(s,t.id)?0:!isSolved(s,t.id)?2:4):0)+(old.has(t.id)?1:0)})).sort((a,b)=>a.key-b.key).slice(0,count).map(x=>x.t.id);
}
