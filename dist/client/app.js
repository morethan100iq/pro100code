import {tasks,byId} from './modules/bank.js';
import {state,save,sync,syncStatus} from './modules/store.js';
import {dayKey,chooseTasks,isSolved,needsReview} from './modules/model.js';
import * as view from './modules/views.js';
import {landing} from './modules/landing.js';
import {refreshHighlight,runPython,stopPython} from './modules/editor.js';
const main=document.querySelector('main');
let currentPage='',currentId=null,lastAnswer=null,showLastResult=false;
const filters={search:'',group:'all',level:'all',exam:'all',status:'all',topic:''};
const icon=name=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+(name==='check'?'<path d="m5 12 4 4L19 6"/>':'<circle cx="12" cy="14" r="8"/><path d="M12 10v4l3 2M9 2h6M12 2v4"/>')+'</svg>';
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.style.display='none',3500)}
function updateSync(){document.querySelectorAll('[data-sync-status]').forEach(el=>el.textContent=syncStatus);const el=document.querySelector('#account-signin');if(el)el.hidden=!syncStatus.startsWith('Войдите');}
function updateList(){const list=view.filteredTasks(state,filters);document.querySelector('#filter-count').textContent='Найдено: '+list.length;document.querySelector('#task-list').innerHTML=list.length?'<div class="task-grid">'+list.map(t=>view.taskCard(state,t)).join('')+'</div>':'<div class="empty"><h2>Ничего не нашлось</h2><p>Попробуй другую тему или сбрось фильтры.</p><button class="button secondary" data-reset-filters>Сбросить фильтры</button></div>';}
function render(scroll=false){
 const [path,query='']=location.hash.slice(1).split('?'),[rawPage,id]=path.split('/'),page=rawPage||'home',params=new URLSearchParams(query);
 if(currentPage!==page||currentId!==id){stopPython('Готов к запуску');lastAnswer=null}
 currentPage=page;currentId=id;
 if(page==='home'){
  if(state.events.length||state.legacy.attempts||state.lastTask||state.training){landing(main,icon);const hero=main.querySelector('.launch-hero').outerHTML;main.innerHTML=hero+view.home(state).replace('<h1>','<h2 class="dashboard-title">').replace('</h1>','</h2>');}
  else{landing(main,icon);const strip=main.querySelector('.learning-strip');if(strip)strip.innerHTML='<span><b>'+tasks.length+'</b> задачи с разбором</span><span><b>6</b> конспектов</span><span><b>15</b> минут на тренировку</span><a href="#progress"><b>0<span>/'+tasks.length+'</span></b> решено ↗</a>';main.querySelector('.path-grid').outerHTML=view.topicCards(state);main.querySelector('.focus-banner p:last-of-type').textContent='Выбери тему, время и количество задач.';}
 }else if(page==='practice'){
  if(id)filters.group=['logic','code','data'].includes(id)?id:'all';
  if(params.has('topic')){filters.topic=params.get('topic');filters.group='all';}if(params.has('status'))filters.status=params.get('status');
  main.innerHTML=view.practice(state,filters);updateList();
 }else if(page==='task'){
  const task=byId(id);if(!task){main.innerHTML=view.heading('Задача не найдена')+view.link('#practice','К практике');return}
  if(params.get('retry')==='1'){state.help[task.id]={level:0,updatedAt:Date.now()};history.replaceState(null,'','#task/'+task.id)}
  state.lastTask={id:task.id,updatedAt:Date.now()};save();main.innerHTML=view.task(state,task);
 }else if(page==='theory')main.innerHTML=view.theory(id);
 else if(page==='errors')main.innerHTML=view.errors(state);
 else if(page==='progress')main.innerHTML=view.progress(state);
 else if(page==='training'){
  if(state.training&&!state.training.finished&&Date.now()>=state.training.end)finishTraining(false);
  main.innerHTML=state.training&&!state.training.finished?view.trainingRun(state):showLastResult&&state.training?.finished?view.results(state):view.trainingSetup(state);updateSetupCount();tick();
 }else{location.hash='home';return}
 document.querySelectorAll('[data-nav]').forEach(el=>{const active=el.dataset.nav===(page==='task'?'practice':page);el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
 document.querySelector('#crumb').textContent={home:'Главная',practice:'Практика',task:'Задача',theory:'Теория',training:'Тренировка',progress:'Мой прогресс',errors:'Работа над ошибками'}[page]||'Главная';
 updateSync();refreshHighlight();
 if(scroll){window.scrollTo(0,0);main.focus({preventScroll:true})}
}
function record(task,answer,{assisted=false,id=crypto.randomUUID(),session=null}={}){
 if(state.events.some(e=>e.id===id))return state.events.find(e=>e.id===id);
 const event={id,taskId:task.id,answer:answer.trim(),correct:answer.trim()===task.answer,assisted,at:Date.now(),day:dayKey(),session};state.events.push(event);return event;
}
function trainingOptions(){const form=document.querySelector('#training-settings');return form?Object.fromEntries(new FormData(form)):{group:'all',level:'all',count:'5',minutes:'15',mode:'errors'}}
function updateSetupCount(){const el=document.querySelector('#setup-count');if(!el)return;const options=trainingOptions(),pool=chooseTasks(tasks,state,{...options,count:72});el.textContent='Доступно по настройкам: '+pool.length+'. В тренировке будет '+Math.min(Number(options.count),pool.length)+'.';}
function startTraining(options){
 if(state.training&&!state.training.finished){location.hash='training';return}
 const count=Math.max(1,Math.min(20,Number(options.count)||5)),minutes=Math.max(1,Math.min(60,Number(options.minutes)||15)),ids=chooseTasks(tasks,state,{...options,count});
 if(!ids.length){const el=document.querySelector('#setup-error');if(el)el.textContent='Подходящих задач нет. Выбери другие настройки.';else toast('Нет задач для такой тренировки.');return}
 state.training={id:crypto.randomUUID(),ids,answers:{},codes:{},index:0,end:Date.now()+minutes*60000,updatedAt:Date.now(),finished:false};showLastResult=false;save();
 if(location.hash==='#training')render();else location.hash='training';
}
function captureTraining(){const t=state.training;if(!t||t.finished)return;const input=document.querySelector('#training-value');if(input){const id=t.ids[t.index],value=input.value;if(value!==t.answers[id]?.value){t.answers[id]={value,updatedAt:Date.now()};t.updatedAt=Date.now();save()}}}
function finishTraining(rerender=true){
 const tr=state.training;if(!tr||tr.finished)return;
 captureTraining();for(const id of tr.ids)record(byId(id),tr.answers[id]?.value||'',{id:tr.id+':'+id,session:tr.id});
 tr.finished=true;tr.updatedAt=Date.now();showLastResult=true;stopPython();document.querySelector('#finish-dialog')?.close();save();
 if(rerender&&currentPage==='training')render();else if(rerender)toast('Тренировка завершена. Результат сохранён.');
}
function tick(){
 const tr=state.training;if(!tr||tr.finished)return;
 if(Date.now()>=tr.end){finishTraining();return}
 const el=document.querySelector('#countdown');if(el){const n=Math.ceil((tr.end-Date.now())/1000);el.textContent=String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');el.classList.toggle('time-low',n<=60);}
 const count=document.querySelector('#answer-count');if(count)count.textContent='Ответов: '+Object.values(tr.answers).filter(a=>a.value.trim()).length+' / '+tr.ids.length;
}
document.addEventListener('submit',event=>{
 if(event.target.id==='practice-answer'){
  event.preventDefault();const task=byId(currentId),answer=document.querySelector('#answer').value.trim();if(!answer)return;
  if(answer===lastAnswer){toast('Этот ответ уже проверен.');return}
  lastAnswer=answer;const result=record(task,answer,{assisted:(state.help[task.id]?.level||0)>0});save();
  document.querySelector('#feedback').innerHTML='<div class="answer-feedback '+(result.correct?'correct':'incorrect')+'"><strong>'+(result.correct?'✓ Верно!':'Пока не сходится')+'</strong><p>'+(result.correct?(result.assisted?'Решено с помощью. Позже повтори самостоятельно.':'Самостоятельное решение сохранено.'):'Проверь вычисления или открой следующую подсказку.')+'</p>'+(result.correct?'<button type="button" class="subtle-button" data-similar="'+task.id+'">Следующая похожая задача ↗</button>':'')+'</div>';
 }
 if(event.target.id==='training-settings'){event.preventDefault();startTraining(trainingOptions())}
 if(event.target.id==='training-answer'){event.preventDefault();captureTraining();if(state.training.index<state.training.ids.length-1){state.training.index++;state.training.updatedAt=Date.now();save();stopPython();render()}else toast('Ответ сохранён. Можно завершить тренировку.')}
});
document.addEventListener('click',async event=>{
 const el=event.target.closest('button');if(!el)return;
 if(el.dataset.favorite){const id=Number(el.dataset.favorite);state.favorites[id]={value:!state.favorites[id]?.value,updatedAt:Date.now()};save();el.textContent=state.favorites[id].value?'★':'☆';el.classList.toggle('selected',state.favorites[id].value);el.setAttribute('aria-pressed',String(state.favorites[id].value));el.setAttribute('aria-label',state.favorites[id].value?'Убрать из избранного':'В избранное');if(currentPage==='practice'&&filters.status==='favorites')updateList();}
 if(el.hasAttribute('data-reset-filters')){Object.assign(filters,{search:'',group:'all',level:'all',exam:'all',status:'all',topic:''});history.replaceState(null,'','#practice');render()}
 if(el.dataset.hint){const id=Number(el.dataset.hint),level=Math.min(3,(state.help[id]?.level||0)+1);state.help[id]={level,updatedAt:Date.now()};save();document.querySelector('#help-panel').innerHTML=view.helpHTML(byId(id),level);}
 if(el.dataset.similar){const t=byId(el.dataset.similar),similar=tasks.filter(x=>x.id!==t.id&&x.topic===t.topic).sort((a,b)=>Number(isSolved(state,a.id))-Number(isSolved(state,b.id)))[0];if(similar)location.hash='task/'+similar.id;else{filters.topic=t.topic;location.hash='practice?topic='+t.topic;}}
 if(el.hasAttribute('data-review-training'))startTraining({mode:'errors',count:5,minutes:15,group:'all',level:'all'});
 if(el.dataset.step!==undefined&&state.training&&!state.training.finished){captureTraining();state.training.index=Number(el.dataset.step);state.training.updatedAt=Date.now();save();stopPython();render()}
 if(el.hasAttribute('data-finish')){captureTraining();const blank=state.training.ids.filter(id=>!state.training.answers[id]?.value.trim()).length;if(blank){document.querySelector('#confirm-text').textContent='Без ответа осталось '+blank+' задач. Завершить и посмотреть результат?';document.querySelector('#finish-dialog').showModal();}else finishTraining()}
 if(el.hasAttribute('data-confirm-finish')){document.querySelector('#finish-dialog').close();finishTraining()}
 if(el.hasAttribute('data-cancel-finish'))document.querySelector('#finish-dialog').close();
 if(el.hasAttribute('data-new-training')){showLastResult=false;render()}
 if(el.hasAttribute('data-last-result')){showLastResult=true;render()}
 if(el.hasAttribute('data-run'))runPython();
 if(el.hasAttribute('data-stop'))stopPython();
 if(el.hasAttribute('data-copy-code')||el.hasAttribute('data-copy-editor')){const text=el.hasAttribute('data-copy-editor')?document.querySelector('#python-code').value:el.closest('.code-sample').querySelector('code').textContent;try{await navigator.clipboard.writeText(text);toast('Код скопирован.')}catch{toast('Не удалось скопировать. Выдели код и нажми Ctrl+C.')}}
 if(el.hasAttribute('data-sync'))await sync();
});
document.addEventListener('input',event=>{
 const el=event.target;if(el.id==='task-search'){filters.search=el.value;updateList()}
 if(el.id==='training-value'){captureTraining();tick()}
 if(el.id==='python-code'){const t=state.training;if(currentPage==='training'&&t&&!t.finished){t.codes[t.ids[t.index]]={value:el.value,updatedAt:Date.now()};t.updatedAt=Date.now()}else if(currentPage==='task')state.drafts[Number(currentId)]={value:el.value,updatedAt:Date.now()};save();refreshHighlight()}
});
document.addEventListener('scroll',event=>{if(event.target.id==='python-code')refreshHighlight()},true);
document.addEventListener('change',event=>{
 const keys={'group-filter':'group','level-filter':'level','exam-filter':'exam','status-filter':'status'};
 if(keys[event.target.id]){filters[keys[event.target.id]]=event.target.value;if(event.target.id==='group-filter')filters.topic='';updateList()}
 if(event.target.id==='daily-goal'){state.settings={dailyGoal:Number(event.target.value),updatedAt:Date.now()};save();render()}
 if(event.target.closest('#training-settings'))updateSetupCount();
});
document.addEventListener('keydown',event=>{
 if(event.target.id==='python-code'&&event.key==='Tab'){event.preventDefault();const el=event.target;el.setRangeText('    ',el.selectionStart,el.selectionEnd,'end');el.dispatchEvent(new Event('input',{bubbles:true}))}
 if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&document.querySelector('#python-code')){event.preventDefault();runPython()}
});
window.addEventListener('hashchange',()=>{captureTraining();render(true)});
window.addEventListener('learning-state',event=>{updateSync();if(event.detail.kind==='synced'&&(['home','progress','errors'].includes(currentPage)||(currentPage==='training'&&state.training?.finished&&document.querySelector('#training-value')))){if(currentPage==='training')showLastResult=true;render()}});
let motion=true;try{motion=localStorage.getItem('pro100code-motion')!=='off'&&!matchMedia('(prefers-reduced-motion: reduce)').matches}catch{}
function applyMotion(){document.documentElement.classList.toggle('motion-paused',!motion);const button=document.querySelector('#motion-toggle');button.setAttribute('aria-pressed',String(motion));button.setAttribute('aria-label',motion?'Анимация включена. Выключить':'Анимация выключена. Включить')}
document.querySelector('#motion-toggle').addEventListener('click',()=>{motion=!motion;applyMotion();try{localStorage.setItem('pro100code-motion',motion?'on':'off')}catch{}});
applyMotion();main.innerHTML='<div class="empty"><h2>Загружаем твой прогресс…</h2><p>Восстанавливаем задачи и сохранённую тренировку.</p></div>';await sync();render();setInterval(tick,1000);
if(document.modelContext?.registerTool){for(const tool of [
 {name:'get_practice_progress',description:'Read learning progress and available practice tasks.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({solved:tasks.filter(t=>isSolved(state,t.id)).map(t=>t.id),review:tasks.filter(t=>needsReview(state,t.id)).map(t=>t.id),tasks:tasks.map(({id,title,group})=>({id,title,group}))})},
 {name:'open_practice_task',description:'Open a task without submitting an answer.',inputSchema:{type:'object',properties:{id:{type:'integer',minimum:1,maximum:72}},required:['id'],additionalProperties:false},execute:({id})=>{if(!byId(id))throw new Error('Задача не найдена');location.hash='task/'+id;return {id}}}
])try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{})}catch{}}
