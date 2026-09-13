import fs from 'node:fs/promises';
import path from 'node:path';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const assets={};
async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await walk(file);else{const key='/'+path.relative('public',file).split(path.sep).join('/');assets[key]={type:types[path.extname(file)]||'application/octet-stream',data:(await fs.readFile(file)).toString('base64')};}}}
await walk('public');
const model=(await fs.readFile('public/modules/model.js','utf8')).replace(/^export /gm,'');
const worker=(await fs.readFile('server/worker.mjs','utf8')).replace(/^import .*;\r?\n/,'');
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});
await fs.writeFile('dist/server/index.js','const ASSETS='+JSON.stringify(assets)+';\n'+model+'\n'+worker);
await fs.cp('public','dist/client',{recursive:true});
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await fs.cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built Worker, '+Object.keys(assets).length+' assets and D1 migrations.');
