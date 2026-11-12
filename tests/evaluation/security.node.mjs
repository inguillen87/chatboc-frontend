import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { configuration, passwordHash, passwordMatches, issueSession, readSession, sessionCookie, COOKIE } from '../../server/evaluation/security.mjs';
import { createHandler } from '../../server/evaluation/handler.mjs';
import { loadGuide, responseFor } from '../../server/evaluation/guide.mjs';

const now = Date.now();
const env = { EVAL_ENABLED: 'true', EVAL_USER: 'guest@example.test',
  EVAL_PASSWORD_HASH: passwordHash('local-test-only'), EVAL_SESSION_KEY: 'a'.repeat(64),
  EVAL_EXPIRES_AT: String(Math.floor(now/1000)+86400), EVAL_PUBLIC_HOST:'evaluation.example.test', EVAL_SPACE:'test' };
const guide = { contract_version:'accessible.support.guide.v1', evaluation_only:true,
  source:{page_count:14}, policy:{creates_real_cases:false}, nodes:{start:{id:'start',title:'Inicio',text:'Demo',
  source_pages:[1],actions:[{code:'1',label:'Menú',target:'main'}]},main:{id:'main',title:'Menú',text:'Prueba',source_pages:[9],actions:[]}} };

test('credential comparison and malformed hashes', () => {
  assert.equal(passwordMatches('local-test-only',env.EVAL_PASSWORD_HASH),true);
  for (const value of ['incorrect',null,{},'a'.repeat(129)]) assert.equal(passwordMatches(value,env.EVAL_PASSWORD_HASH),false);
  assert.equal(passwordMatches('local-test-only','bad-hash'),false);
});
test('configuration fails closed and rejects product domains', () => {
  assert.equal(configuration({}),null);
  assert.equal(configuration({...env,EVAL_PUBLIC_HOST:'chatboc.ar'}),null);
  assert.equal(configuration({...env,EVAL_SESSION_KEY:'weak'}),null);
  assert.ok(configuration(env));
});
test('signed evaluation sessions are host, space and time scoped', () => {
  const config=configuration(env); const issued=issueSession(config,env.EVAL_PUBLIC_HOST,now);
  const req={headers:{host:env.EVAL_PUBLIC_HOST,cookie:`${COOKIE}=${issued.token}`}};
  assert.equal(readSession(req,config,now).aud,'chatboc-evaluation-only-v1');
  assert.equal(readSession(req,{...config,space:'other'},now),null);
  assert.equal(readSession({...req,headers:{...req.headers,host:'other.example.test'}},config,now),null);
  assert.equal(readSession(req,config,now+7200001),null);
  assert.equal(readSession({...req,headers:{...req.headers,cookie:`${COOKIE}=${issued.token}x`}},config,now),null);
  assert.equal(readSession({...req,headers:{...req.headers,cookie:`${COOKIE}=${issued.token}; ${COOKIE}=${issued.token}`}},config,now),null);
});
test('cookie is separate, secure and host-only', () => {
  const cookie=sessionCookie('test');
  for (const flag of ['__Host-chatboc-evaluation=','HttpOnly','Secure','SameSite=Strict','Path=/']) assert.ok(cookie.includes(flag));
  assert.ok(!cookie.includes('Domain=')); assert.ok(sessionCookie('',0).includes('Max-Age=0'));
});
test('menu selection rejects arbitrary free text and prototype properties', () => {
  assert.equal(responseFor(guide,'start','1').id,'main');
  assert.equal(responseFor(guide,'__proto__'),null);
  assert.equal(responseFor(guide,'start','12345678'),null);
});
async function withServer(run, options={}) {
  const liveEnv={...env,EVAL_SPACE:`test-${Math.random()}`};
  const server=createServer((req,res)=>createHandler({env:liveEnv,guideLoader:()=>guide,clock:()=>now,...options})(req,res));
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const host=`127.0.0.1:${server.address().port}`; liveEnv.EVAL_TEST_HOST=host;
  try { await run(`http://${host}`,host); } finally { server.closeAllConnections(); await new Promise((resolve)=>server.close(resolve)); }
}
test('real HTTP handler requires login and returns no production privileges', async () => {
  await withServer(async (base,host)=>{
    const post=(action,body,cookie='')=>fetch(`${base}/api/evaluation?action=${action}`,{method:'POST',
      headers:{'Content-Type':'application/json',Origin:`https://${host}`,Cookie:cookie},body:JSON.stringify(body)});
    assert.equal((await post('menu',{})).status,401);
    assert.equal((await post('login',{username:env.EVAL_USER,password:'wrong'})).status,401);
    const login=await post('login',{username:env.EVAL_USER,password:'local-test-only'});
    assert.equal(login.status,200);
    const data=await login.json();
    for (const field of ['production_access','email_verified','mfa_verified','provider_connected']) assert.equal(data[field],false);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const menu=await post('menu',{node:'start',selection:'1'},cookie);
    assert.equal(menu.status,200); assert.equal((await menu.json()).id,'main');
    const logout=await post('logout',{},cookie);
    assert.equal(logout.status,200); assert.ok(logout.headers.get('set-cookie').includes('Max-Age=0'));
    assert.equal((await post('menu',{})).status,401);
  });
});
test('cross-origin POST is rejected before processing credentials', async () => {
  await withServer(async (base)=>{
    const response=await fetch(`${base}/api/evaluation?action=login`,{method:'POST',headers:{Origin:'https://other.example.test','Content-Type':'application/json'},body:'{}'});
    assert.equal(response.status,403);
  });
});
test('expired evaluation fails closed', async () => {
  await withServer(async (base)=>assert.equal((await fetch(`${base}/api/evaluation`)).status,410),{clock:()=>now+172800000});
});
test('login attempts are bounded on a worker', async () => {
  await withServer(async (base,host)=>{
    for (let i=0;i<6;i++) assert.equal((await fetch(`${base}/api/evaluation?action=login`,{method:'POST',
      headers:{Origin:`https://${host}`,'Content-Type':'application/json'},body:JSON.stringify({username:'guest',password:'wrong'})})).status,401);
    const response=await fetch(`${base}/api/evaluation?action=login`,{method:'POST',headers:{Origin:`https://${host}`,'Content-Type':'application/json'},body:'{}'});
    assert.equal(response.status,429); assert.equal(response.headers.get('Retry-After'),'60');
  });
});
test('public session state does not disclose credential material', async () => {
  await withServer(async (base)=>{
    const response=await fetch(`${base}/api/evaluation`); const text=await response.text();
    assert.equal(response.status,200); assert.ok(!text.includes(env.EVAL_SESSION_KEY));
    assert.ok(!text.includes(env.EVAL_PASSWORD_HASH)); assert.ok(!text.includes(env.EVAL_USER));
    assert.equal(JSON.parse(text).authenticated,false);
  });
});
