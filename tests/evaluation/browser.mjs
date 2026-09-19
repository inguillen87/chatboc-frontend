import { createServer } from 'node:https';
import { readFile, mkdir } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createHandler } from '../../server/evaluation/handler.mjs';
import { passwordHash } from '../../server/evaluation/security.mjs';
import { loadGuide } from '../../server/evaluation/guide.mjs';

const staticRoot=path.resolve('.vercel/output/static');
const env={EVAL_ENABLED:'true',EVAL_USER:'guest@example.test',EVAL_PASSWORD_HASH:passwordHash('local-test-only'),
 EVAL_SESSION_KEY:'b'.repeat(64),EVAL_EXPIRES_AT:String(Math.floor(Date.now()/1000)+86400),EVAL_PUBLIC_HOST:'evaluation.example.test',
 EVAL_SPACE:'browser-evaluation',EVAL_DISPLAY_NAME:'Agente conversacional accesible',EVAL_INSTITUTION:'Mesa Única de Discapacidad'};
const handler=createHandler({env,guideLoader:()=>loadGuide('.vercel/output/functions/api/evaluation.func/guide.json')});
const headers=JSON.parse(await readFile('.vercel/output/config.json','utf8')).routes[0].headers;
const server=createServer({key:await readFile('.vercel/local-test/tls.key'),cert:await readFile('.vercel/local-test/tls.crt')},async(req,res)=>{
  for (const [name,value] of Object.entries(headers)) res.setHeader(name,value);
  if (req.url.startsWith('/api/evaluation')) return handler(req,res);
  const pathname=new URL(req.url,'https://localhost').pathname;
  const target=path.resolve(staticRoot,'.'+(pathname==='/'?'/index.html':pathname));
  if (!target.startsWith(staticRoot+path.sep)) { res.writeHead(404);return res.end(); }
  try { const data=await readFile(target); const ext=path.extname(target);
    res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[ext]||'application/octet-stream');res.end(data);
  } catch {res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
env.EVAL_TEST_HOST=`localhost:${server.address().port}`;const origin=`https://${env.EVAL_TEST_HOST}`;
// The browser below connects only to the HTTPS loopback server created above.
// Synthetic test values are valid only in that ephemeral server's configuration.
if (new URL(origin).hostname !== 'localhost') throw new Error('test_origin_must_be_loopback');
await mkdir('.vercel/evidence',{recursive:true});
const browser=await chromium.launch(process.platform==='win32'?{channel:'chrome',headless:true}:{headless:true});
const results=[];
try {
  for (const [name,width,height,colorScheme] of [['desktop',1440,1000,'light'],['mobile',390,844,'dark'],['tablet',820,1180,'light'],['small',320,780,'light']]) {
    const context=await browser.newContext({viewport:{width,height},colorScheme,ignoreHTTPSErrors:true,reducedMotion:'reduce'});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',(e)=>errors.push(e.message));
    await page.goto(origin);
    await page.getByRole('heading',{name:'Ingresar a la demostración'}).waitFor();
    await page.screenshot({path:`.vercel/evidence/${name}-login.png`,fullPage:true});
    await page.getByLabel('Usuario de prueba').fill(env.EVAL_USER);
    await page.getByLabel('Contraseña de prueba',{exact:true}).fill('local-test-only');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await page.getByRole('heading',{name:'¿Para quién es la consulta?'}).waitFor();
    await page.getByRole('button',{name:/Para mí/}).click();
    await page.getByRole('heading',{name:'¿Sobre qué querés consultar?'}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`.vercel/evidence/${name}-menu.png`,fullPage:true});
    await page.getByRole('button',{name:/Documentación: CUD/}).click();
    await page.getByRole('button',{name:/Vigencia y prórrogas/}).click();
    await page.getByRole('heading',{name:'Vigencia y avisos'}).waitFor();
    assert.ok((await page.locator('.evaluation-message').innerText()).includes('90 días'));
    await page.getByRole('button',{name:/Pedir ayuda de una persona/}).click();
    await page.getByRole('button',{name:/Ver resumen de ejemplo/}).click();
    await page.getByRole('heading',{name:'Resumen de ejemplo · no enviado'}).waitFor();
    await page.getByRole('button',{name:/Probar encuesta de cierre/}).click();
    await page.getByRole('button',{name:/En parte/}).click();
    await page.getByRole('button',{name:/Excelente y muy fácil/}).click();
    await page.getByRole('heading',{name:'Recorrido terminado'}).waitFor();
    await page.reload();
    await page.getByRole('heading',{name:'¿Para quién es la consulta?'}).waitFor();
    await page.getByRole('button',{name:'Salir',exact:true}).click();
    await page.getByRole('heading',{name:'Ingresar a la demostración'}).waitFor();
    const denied=await context.request.post(`${origin}/api/evaluation?action=menu`,{headers:{Origin:origin},data:{node:'main'}});
    assert.equal(denied.status(),401);
    assert.deepEqual(errors,[]);
    results.push({name,width,height,passed:true,login:true,menu:true,source:true,feedback:true,reload:true,logout:true});
    await context.close();
  }
  console.log(JSON.stringify({browser:'Chromium',synthetic:true,real_devices:false,tests:results},null,2));
} finally {
  await browser.close();server.closeAllConnections();await new Promise((resolve)=>server.close(resolve));
}
