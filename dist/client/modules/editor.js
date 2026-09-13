export const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function highlight(code){
 const pattern=/(#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:for|while|if|else|elif|def|return|in|and|or|not|import|from|as|True|False|None|break|continue|try|except|with|class|lambda|pass)\b|\b(?:print|range|len|int|str|sum|bin|input|list|set|enumerate|abs|min|max)\b|\b\d+(?:\.\d+)?\b)/g;
 let out='',end=0;
 for(const match of code.matchAll(pattern)){out+=escapeHTML(code.slice(end,match.index));const value=match[0],cls=value.startsWith('#')?'comment':/^["']/.test(value)?'string':/^\d/.test(value)?'number':/^(print|range|len|int|str|sum|bin|input|list|set|enumerate|abs|min|max)$/.test(value)?'builtin':'keyword';out+='<span class="syntax-'+cls+'">'+escapeHTML(value)+'</span>';end=match.index+value.length;}
 return out+escapeHTML(code.slice(end));
}
export const codeBlock=code=>'<div class="code-sample"><div class="code-label">Python <button type="button" data-copy-code>Копировать</button></div><pre><code>'+highlight(code)+'</code></pre></div>';
export function editorHTML(value){
 return '<section class="python-panel"><div class="panel-top"><div><span class="small-label">ЧЕРНОВИК РЕШЕНИЯ</span><h2>Python</h2></div><span class="editor-save">Автосохранение</span></div><div class="editor-wrap"><pre id="code-highlight" aria-hidden="true">'+highlight(value)+'\n</pre><textarea id="python-code" aria-label="Код Python" spellcheck="false" autocomplete="off" autocapitalize="off" maxlength="20000">'+escapeHTML(value)+'</textarea></div><details class="stdin-box"><summary>Входные данные для input()</summary><textarea id="python-stdin" aria-label="Входные данные Python" placeholder="Каждое значение с новой строки"></textarea></details><div class="editor-actions"><button class="button" type="button" data-run>▶ Запустить</button><button type="button" class="subtle-button" data-stop disabled>Остановить</button><button type="button" class="subtle-button" data-copy-editor>Копировать код</button><span>Ctrl + Enter</span></div><div class="console-head">Результат <span id="python-status">Готов к запуску</span></div><pre class="python-output" id="python-output" role="log" aria-live="polite">Здесь появится вывод программы.</pre><p class="editor-note">Python запускается на этом компьютере. При первом запуске нужна загрузка среды. Лимит выполнения — 10 секунд.</p></section>';
}
let worker=null,timeout=null,ready=false,running=false;
function status(text){const el=document.querySelector('#python-status');if(el)el.textContent=text;}
function buttons(busy){document.querySelector('[data-run]')?.toggleAttribute('disabled',busy);document.querySelector('[data-stop]')?.toggleAttribute('disabled',!busy);}
export function stopPython(message='Выполнение остановлено'){clearTimeout(timeout);worker?.terminate();worker=null;ready=false;running=false;buttons(false);status(message);}
export function refreshHighlight(){const el=document.querySelector('#python-code'),pre=document.querySelector('#code-highlight');if(el&&pre){pre.innerHTML=highlight(el.value)+'\n';pre.scrollTop=el.scrollTop;pre.scrollLeft=el.scrollLeft;}}
export function runPython(){
 if(running)return;const code=document.querySelector('#python-code')?.value;if(code===undefined)return;
 running=true;buttons(true);const output=document.querySelector('#python-output');output.textContent='';
 const input=document.querySelector('#python-stdin')?.value||'';
 const execute=()=>{status('Выполняется…');clearTimeout(timeout);timeout=setTimeout(()=>stopPython('Остановлено: превышен лимит 10 секунд'),10000);worker.postMessage({type:'run',code,input});};
 if(ready){execute();return}
 status('Загружаем Python…');timeout=setTimeout(()=>stopPython('Не удалось загрузить Python. Проверьте связь и повторите запуск.'),60000);
 worker=new Worker('/python-worker.js');
 worker.onmessage=({data})=>{
  if(data.type==='ready'){ready=true;execute()}
  if(data.type==='output'){output.textContent=(output.textContent+data.text+'\n').slice(0,30000);output.scrollTop=output.scrollHeight}
  if(data.type==='done'){clearTimeout(timeout);running=false;buttons(false);status(data.error?'Ошибка Python':'Завершено');if(!output.textContent)output.textContent='Программа завершена без вывода.';}
  if(data.type==='load-error'){output.textContent=data.text;stopPython('Загрузка не удалась. Можно повторить.');}
 };
 worker.onerror=()=>{output.textContent='Не удалось запустить Python. Проверьте подключение и попробуйте ещё раз.';stopPython('Ошибка запуска');};
}
