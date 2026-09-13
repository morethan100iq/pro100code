import {validState,fresh} from '../public/modules/model.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function api(request,env){
 const user=request.headers.get('oai-authenticated-user-id');
 if(!user)return json({error:'signin_required'},401);
 if(!env.DB)return json({error:'storage_unavailable'},503);
 if(request.method==='GET'){
  const row=await env.DB.prepare('SELECT payload, revision FROM learner_state WHERE user_id = ?').bind(user).first();
  return json({user,state:row?JSON.parse(row.payload):fresh(),revision:row?.revision||0,local:env.LOCAL_PREVIEW===true});
 }
 if(request.method!=='PUT')return json({error:'method_not_allowed'},405);
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return json({error:'origin_not_allowed'},403);
 if(!(request.headers.get('content-type')||'').startsWith('application/json'))return json({error:'json_required'},415);
 if(Number(request.headers.get('content-length'))>1500000)return json({error:'too_large'},413);
 const text=await request.text();if(text.length>1500000)return json({error:'too_large'},413);
 let body;try{body=JSON.parse(text)}catch{return json({error:'invalid_json'},400)}
 if(!validState(body?.state)||!Number.isInteger(body.revision)||body.revision<0)return json({error:'invalid_state'},400);
 const row=await env.DB.prepare('INSERT INTO learner_state (user_id, payload, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, revision = learner_state.revision + 1, updated_at = excluded.updated_at WHERE learner_state.revision = ? RETURNING revision').bind(user,JSON.stringify(body.state),Date.now(),body.revision).first();
 if(!row)return json({error:'conflict'},409);
 return json({revision:row.revision});
}
export default {
 async fetch(request,env){
  try{
   const url=new URL(request.url);
   if(url.pathname==='/api/state')return await api(request,env);
   if(url.pathname.startsWith('/api/'))return json({error:'not_found'},404);
   if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
   const asset=ASSETS[url.pathname==='/'?'/index.html':url.pathname];
   if(!asset)return new Response('Not found',{status:404});
   const headers={'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};
   return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0)),{headers});
  }catch(error){console.error('Request failed',error.message);return json({error:'temporarily_unavailable'},503)}
 }
};
