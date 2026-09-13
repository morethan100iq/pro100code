import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,merge,validState,chooseTasks,firstAttemptStats,needsReview,independent} from '../public/modules/model.js';
import {tasks} from '../public/modules/bank.js';
import {api} from '../server/worker.mjs';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
const event=(id,taskId,correct,extra={})=>({id,taskId,answer:'42',correct,assisted:false,at:1000,day:'2026-09-13',session:null,...extra});
test('bank has 72 unique exercises with complete hints and valid topics',()=>{
 assert.equal(tasks.length,72);assert.equal(new Set(tasks.map(t=>t.id)).size,72);
 for(const t of tasks){assert.match(t.answer,/^\d+$/);assert.equal(t.hints.length,2);assert.ok(t.solution.length>20);assert.ok(t.lesson);assert.ok(t.exam>0)}
});
test('binary conversion variants round-trip to the number in the task',()=>{
 for(const t of tasks.filter(t=>t.title.startsWith('Двоичная запись: ')))assert.equal(parseInt(t.answer,2),Number(t.title.split(': ')[1]));
});
test('all logic variants have answers confirmed by eight-row truth tables',()=>{
 const expected=[3,5,4,3,4,3];tasks.filter(t=>t.title.startsWith('Таблица истинности')).forEach((t,i)=>assert.equal(Number(t.answer),expected[i]));
});
test('a later correct answer does not rewrite first-attempt accuracy',()=>{
 const s=fresh();s.events=[event('a',1,false),event('b',1,true),event('c',2,true,{assisted:true}),event('d',3,true)];
 assert.deepEqual(firstAttemptStats(s),{total:3,correct:1});assert.equal(needsReview(s,1),false);assert.equal(needsReview(s,2),true);assert.equal(independent(s,1),true);
});
test('review priority, filtering, no duplicate tasks and small pools',()=>{
 const s=fresh();s.events=[event('a',1,false)];
 assert.equal(chooseTasks(tasks,s,{count:5},()=>.5)[0],1);
 assert.deepEqual(chooseTasks(tasks,s,{mode:'errors',count:20}),[1]);
 assert.deepEqual(chooseTasks(tasks,s,{mode:'favorites'}),[]);
 const ids=chooseTasks(tasks,s,{group:'code',level:'Средний',count:20});assert.equal(ids.length,new Set(ids).size);for(const id of ids){const t=tasks.find(t=>t.id===id);assert.equal(t.group,'code');assert.equal(t.level,'Средний')}
});
test('a fresh random training avoids the previous set when enough tasks exist',()=>{
 const s=fresh();s.training={ids:[1,2,3,4,5]};const result=chooseTasks(tasks,s,{mode:'random',count:5},()=>.5);assert.ok(result.every(id=>id>5));
});
test('merging devices keeps independent attempts and latest favorite removal',()=>{
 const a=fresh(),b=fresh();a.events=[event('a',1,true)];b.events=[event('b',2,true)];a.favorites[1]={value:true,updatedAt:1};b.favorites[1]={value:false,updatedAt:2};
 const c=merge(a,b);assert.equal(c.events.length,2);assert.equal(c.favorites[1].value,false);assert.equal(merge(c,a).events.length,2);assert.ok(validState(c));
});
test('training merge preserves answers written on different devices',()=>{
 const a=fresh(),b=fresh(),tr={id:'session',ids:[1,2],answers:{},codes:{},index:0,end:10000,updatedAt:1,finished:false};
 a.training={...tr,answers:{1:{value:'101101',updatedAt:2}}};b.training={...tr,answers:{2:{value:'10',updatedAt:3}},updatedAt:3};
 const c=merge(a,b);assert.equal(c.training.answers[1].value,'101101');assert.equal(c.training.answers[2].value,'10');
 b.training.finished=true;assert.equal(merge(c,b).training.finished,true);
});
test('old solved totals survive migration without duplicating',()=>{
 const a=fresh();a.legacy={solved:[1,2],days:['2026-09-10'],attempts:4,correct:2,sessions:1};
 const b=merge(a,a);assert.equal(b.legacy.attempts,4);assert.deepEqual(b.legacy.solved,[1,2]);
});
test('schema validation rejects malformed progress and drafts',()=>{
 assert.ok(validState(fresh()));for(const mutate of [s=>s.events.push({}),s=>s.settings.dailyGoal=0,s=>s.favorites[99]={value:true,updatedAt:1},s=>s.drafts[1]={value:'a'.repeat(20001),updatedAt:1},s=>s.training={ids:[]}]){const s=fresh();mutate(s);assert.equal(validState(s),false)}
});
function database(){
 const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync(new URL('../drizzle/0000_familiar_whirlwind.sql',import.meta.url),'utf8'));
 return {prepare(sql){return {bind(...values){return {async first(){return db.prepare(sql).get(...values)||null}}}}}};
}
const request=(user,method='GET',body,extra={})=>new Request('https://learning.example/api/state',{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),'Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)});
test('API requires identity, isolates users and rejects stale revisions',async()=>{
 const env={DB:database()};assert.equal((await api(request(null),env)).status,401);
 const s=fresh();s.events=[event('attempt',1,true)];
 const saved=await api(request('alice','PUT',{state:s,revision:0}),env);assert.equal(saved.status,200);assert.equal((await saved.json()).revision,1);
 assert.equal((await api(request('alice','PUT',{state:s,revision:0}),env)).status,409);
 assert.equal((await (await api(request('alice'),env)).json()).state.events.length,1);
 assert.equal((await (await api(request('bob'),env)).json()).state.events.length,0);
});
test('API rejects cross-origin writes, invalid state and unsupported methods',async()=>{
 const env={DB:database()};assert.equal((await api(request('alice','PUT',{state:fresh(),revision:0},{Origin:'https://other.example'}),env)).status,403);
 assert.equal((await api(request('alice','PUT',{state:{},revision:0}),env)).status,400);
 assert.equal((await api(request('alice','DELETE'),env)).status,405);
 assert.equal((await api(request('alice'),{})).status,503);
});
