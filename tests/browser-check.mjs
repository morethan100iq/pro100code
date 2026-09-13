import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs/promises';
import {api} from '../server/worker.mjs';
const db=new DatabaseSync(':memory:');db.exec(await fs.readFile('drizzle/0000_familiar_whirlwind.sql','utf8'));
const env={DB:{prepare(sql){return {bind(...v){return {async first(){return db.prepare(sql).get(...v)||null}}}}}}};
await fs.mkdir('qa',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[],failures=[];
async function context(){
 const c=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light'});
 await c.route('**/api/state',async route=>{
  const r=route.request(),headers=new Headers(r.headers());headers.set('oai-authenticated-user-id','browser-test');
  const response=await api(new Request(r.url(),{method:r.method(),headers,body:r.postData()||undefined}),env);
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
 return c;
}
const c=await context(),page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
const go=async route=>{await page.goto('http://127.0.0.1:5173/#'+route);await page.locator('main h1').waitFor();};
async function sync(){await page.evaluate(async()=>{await (await import('/modules/store.js')).sync()})}
try{
 await go('home');assert.equal(await page.locator('.launch-hero').count(),1);
 await go('practice');assert.equal(await page.locator('.task-card').count(),72);
 await page.locator('#level-filter').selectOption('Средний');assert.ok(await page.locator('.task-card').count()<72);
 await page.locator('[data-reset-filters]').click();
 await page.locator('[data-favorite="1"]').click();await page.locator('#status-filter').selectOption('favorites');assert.equal(await page.locator('.task-card').count(),1);
 await go('task/1');await page.locator('[data-hint]').click();await page.locator('#answer').fill('101101');await page.locator('#practice-answer button').click();
 assert.match(await page.locator('#feedback').innerText(),/Решено с помощью/);
 await go('errors');assert.equal(await page.locator('.review-card').count(),1);
 await page.getByRole('link',{name:'Повторить самостоятельно',exact:true}).click();await page.locator('#answer').fill('101101');await page.locator('#practice-answer button').click();assert.match(await page.locator('#feedback').innerText(),/Самостоятельное/);
 await sync();
 await go('progress');assert.match(await page.locator('.stat').nth(1).innerText(),/0%/);
 await go('errors');assert.equal(await page.locator('.review-card').count(),0);
 await go('training');
 await page.locator('[name="group"]').selectOption('code');await page.locator('[name="level"]').selectOption('Средний');
 await page.locator('[name="count"]').selectOption('10');await page.locator('[name="minutes"]').selectOption('30');
 await page.locator('#training-settings button').click();
 await page.locator('#training-value').fill('123');
 await page.locator('#python-code').fill('print(6 * 7)');
 const before=await page.locator('#countdown').innerText();
 await sync();await page.reload();await page.locator('#training-value').waitFor();
 assert.equal(await page.locator('#training-value').inputValue(),'123');assert.equal(await page.locator('#python-code').inputValue(),'print(6 * 7)');assert.ok((await page.locator('#countdown').innerText())<=before);
 const c2=await context(),p2=await c2.newPage();p2.on('pageerror',e=>errors.push(e.message));
 await p2.goto('http://127.0.0.1:5173/#training');await p2.locator('#training-value').waitFor();assert.equal(await p2.locator('#training-value').inputValue(),'123');
 await p2.locator('[data-step="1"]').click();await p2.locator('#training-value').fill('456');await p2.evaluate(async()=>{await (await import('/modules/store.js')).sync()});
 await page.reload();await page.locator('#training-value').waitFor();assert.equal(await page.locator('#training-value').inputValue(),'456');
 await page.locator('.training-steps [data-step="0"]').click();assert.equal(await page.locator('#training-value').inputValue(),'123');
 await page.screenshot({path:'qa/training-desktop.png',fullPage:true,animations:'disabled'});
 await page.locator('[data-finish]').click();await page.locator('[data-cancel-finish]').click();assert.equal(await page.locator('#training-value').count(),1);
 await page.locator('[data-finish]').click();await page.locator('[data-confirm-finish]').click();assert.equal(await page.locator('.result-row').count(),10);
 await sync();const ids1=await page.evaluate(async()=>(await import('/modules/store.js')).state.training.ids);
 await page.locator('[data-new-training]').click();await page.locator('#training-settings button').click();const ids2=await page.evaluate(async()=>(await import('/modules/store.js')).state.training.ids);assert.notDeepEqual(ids1,ids2);
 await page.evaluate(async()=>{const s=await import('/modules/store.js');s.state.training.end=Date.now()-1000;s.state.training.updatedAt=Date.now();s.save()});
 await page.locator('.result-summary').waitFor();await sync();
 await go('task/7');await page.locator('#python-code').fill('print(6 * 7)');await page.locator('[data-run]').click();
 await page.waitForFunction(()=>['Завершено','Загрузка не удалась. Можно повторить.','Ошибка запуска'].includes(document.querySelector('#python-status').textContent),{},{timeout:75000});
 const pythonStatus=await page.locator('#python-status').innerText();
 if(pythonStatus==='Завершено'){
  assert.match(await page.locator('#python-output').innerText(),/42/);
  await page.locator('#python-code').fill('print(int(input()) + 2)');await page.locator('.stdin-box summary').click();await page.locator('#python-stdin').fill('40');await page.locator('[data-run]').click();await page.waitForFunction(()=>document.querySelector('#python-status').textContent==='Завершено');assert.match(await page.locator('#python-output').innerText(),/42/);
  await page.locator('#python-code').fill('while True:\n    pass');await page.locator('[data-run]').click();await page.locator('[data-stop]').click();assert.match(await page.locator('#python-status').innerText(),/остановлено/);
 }else failures.push('Python unavailable: '+pythonStatus);
 await page.locator('#python-code').fill('for i in range(5):\n    print(i ** 2)');await sync();
 await page.screenshot({path:'qa/task-desktop.png',fullPage:true,animations:'disabled'});
 for(const route of ['home','practice','theory','progress','errors']){
  await go(route);await page.screenshot({path:'qa/'+route+'-desktop.png',fullPage:true,animations:'disabled'});
  for(const width of [1440,1280]){
   await page.setViewportSize({width,height:1000});
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>window.setTheme(theme),theme);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,route+' overflow '+width+' '+theme);
   }
  }
 }
 await page.setViewportSize({width:1440,height:1000});await go('home');await page.evaluate(()=>window.setTheme('dark'));await page.screenshot({path:'qa/dashboard-dark.png',fullPage:true,animations:'disabled'});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({checks:'72 tasks, filters, favorites, assistance, independent retry, first-attempt stats, training reload, two-device sync, finish confirmation, timer expiry, varied sets, Python execution/input/stop, desktop layouts and both themes',errors,failures},null,2));
 if(failures.length)process.exitCode=1;
}finally{await browser.close()}
