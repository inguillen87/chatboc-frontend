import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadGuide } from '../server/evaluation/guide.mjs';

const root=process.cwd(); const output=path.join(root,'.vercel/output');
const lock=JSON.parse(await readFile('server/evaluation/content.lock.json','utf8'));
if (lock.repository !== 'inguillen87/chatbot-backend' || !/^[a-f0-9]{40}$/.test(lock.commit)
    || lock.path !== 'data/conversation_guides/accessible-support.evaluation.v1.json') throw new Error('unsafe_content_pin');
const localIndex=process.argv.indexOf('--guide');
const bytes=localIndex >= 0 ? await readFile(process.argv[localIndex+1]) : Buffer.from(await (async()=>{
  const response=await fetch(`https://raw.githubusercontent.com/${lock.repository}/${lock.commit}/${lock.path}`,{signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('pinned_guide_unavailable'); return response.arrayBuffer();
})());
if (createHash('sha256').update(bytes).digest('hex') !== lock.sha256) throw new Error('guide_digest_mismatch');
const manifest=JSON.parse(await readFile('dist/.vite/manifest.json','utf8'));
if (!manifest['demo/evaluation/index.html']) throw new Error('evaluation_entry_missing');
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await rm(output,{recursive:true,force:true});
const staticRoot=path.join(output,'static'); const functionRoot=path.join(output,'functions/api/evaluation.func');
await mkdir(staticRoot,{recursive:true}); await mkdir(functionRoot,{recursive:true});
const copied=new Set();
async function copyAsset(asset) {
  if (!asset.startsWith('assets/') || asset.includes('..')) throw new Error('unexpected_static_asset');
  if (copied.has(asset)) return; copied.add(asset);
  await mkdir(path.dirname(path.join(staticRoot,asset)),{recursive:true}); await copyFile(path.join('dist',asset),path.join(staticRoot,asset));
}
const visited=new Set();
async function copyGraph(key) {
  if (visited.has(key)) return; visited.add(key); const chunk=manifest[key];
  if (!chunk) throw new Error('chunk_missing');
  for (const asset of [chunk.file,...(chunk.css||[]),...(chunk.assets||[])]) await copyAsset(asset);
  for (const dependency of [...(chunk.imports||[]),...(chunk.dynamicImports||[])]) await copyGraph(dependency);
}
await copyGraph('demo/evaluation/index.html');
let html=await readFile('dist/demo/evaluation/index.html','utf8');
if (/<link[^>]+rel=["']manifest/i.test(html)) throw new Error('global_manifest_not_allowed');
html=html.replace('</head>',`<meta name="evaluation-release" content="${revision}" /></head>`);
await writeFile(path.join(staticRoot,'index.html'),html);
await writeFile(path.join(staticRoot,'robots.txt'),'User-agent: *\nDisallow: /\n');
for (const name of ['handler.mjs','security.mjs','guide.mjs']) await copyFile(`server/evaluation/${name}`,path.join(functionRoot,name));
await writeFile(path.join(functionRoot,'guide.json'),bytes); loadGuide(path.join(functionRoot,'guide.json'),lock.sha256);
await writeFile(path.join(functionRoot,'package.json'),JSON.stringify({type:'module'}));
await writeFile(path.join(functionRoot,'.vc-config.json'),JSON.stringify({runtime:'nodejs22.x',handler:'handler.mjs',launcherType:'Nodejs',maxDuration:10,shouldAddHelpers:false},null,2));
const headers={'X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'X-Frame-Options':'DENY','Cache-Control':'no-store','Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
const config={version:3,routes:[{src:'/(.*)',headers,continue:true},
  {src:'/api/evaluation',dest:'/api/evaluation'},{src:'/api/(.*)',status:404},
  {src:'/(?:sw\\.js|manifest\\.webmanifest)',status:404},{handle:'filesystem'},
  {src:'/(?:login|perfil)?',dest:'/index.html'},{src:'/(.*)',status:404}]};
await writeFile(path.join(output,'config.json'),JSON.stringify(config,null,2));
await writeFile(path.join(output,'evaluation-build.json'),JSON.stringify({frontend:revision,guide:lock,static_assets:[...copied],production_proxy_routes:0},null,2));
console.log(JSON.stringify({frontend:revision,guide_commit:lock.commit,static_assets:copied.size,production_proxy_routes:0,credentials_in_static:false}));
