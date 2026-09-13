import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {api} from './worker.mjs';
await fs.mkdir('.local',{recursive:true});
const db=new DatabaseSync('.local/preview.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for(const name of (await fs.readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort()){
 if(!db.prepare('SELECT name FROM local_migrations WHERE name = ?').get(name)){
  db.exec(await fs.readFile('drizzle/'+name,'utf8'));
  db.prepare('INSERT INTO local_migrations(name) VALUES (?)').run(name);
 }
}
const DB={prepare(sql){return {bind(...params){return {async first(){return db.prepare(sql).get(...params)||null}}}}}};
const root=path.resolve('public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:5173');
  if(url.pathname==='/api/state'){
   const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>1500000){res.writeHead(413);res.end();return}chunks.push(c)}
   const headers=new Headers(req.headers);
   headers.set('oai-authenticated-user-id','local-preview-learner');
   const request=new Request(url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
   const response=await api(request,{DB,LOCAL_PREVIEW:true});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch(error){res.writeHead(error.code==='ENOENT'?404:500);res.end('Unable to load request');console.error(error.message)}
});
server.listen(5173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:5173/'));
