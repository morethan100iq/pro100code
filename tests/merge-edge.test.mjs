import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,merge} from '../public/modules/model.js';
test('two devices finishing the same session do not replace its first recorded result',()=>{
 const a=fresh(),b=fresh();
 const first={id:'run:1',taskId:1,answer:'101101',correct:true,assisted:false,at:1000,day:'2026-09-13',session:'run'};
 a.events=[first];b.events=[{...first,at:2000,answer:'',correct:false}];
 assert.deepEqual(merge(a,b).events,[first]);assert.deepEqual(merge(b,a).events,[first]);
});
