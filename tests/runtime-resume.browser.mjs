import {chromium, expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
process.env.VITE_BACKEND_BOOTSTRAP_GATE_ENABLED='true';
process.env.VITE_EXPECTED_BACKEND_REVISION='a'.repeat(40);
const server=await createServer({cacheDir:'.vercel/resume-cache',server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser; const results=[];
try {
  await server.listen(); const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  await mkdir('.vercel/runtime-resume-evidence',{recursive:true});
  browser=await chromium.launch(process.platform==='win32'?{channel:'chrome',headless:true}:{headless:true});
  for(const [width,scenario] of [[1440,'failure'],[820,'mismatch'],[390,'offline'],[320,'waiting']]) {
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    const page=await context.newPage(); const calls=[]; const errors=[];let responseMode=scenario;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/version',async route=>{
      calls.push({method:route.request().method(),cookie:route.request().headers()['cookie']??null});
      if(responseMode==='waiting') {
        await new Promise(resolve=>setTimeout(resolve,1800));
        return route.fulfill({status:503,json:{contract_version:'chatboc.bootstrap.v1',reason_code:'application_initializing',retryable:true},headers:{'Retry-After':'2'}});
      }
      if(responseMode==='failure')return route.fulfill({status:503,json:{error:'generic-unavailable'}});
      return route.fulfill({status:200,json:{backend:(responseMode==='mismatch'?'b':'a').repeat(40),frontend:'web'}});
    });
    await page.goto(origin+'/tests/e2e/fixtures/runtime-resume.html');
    if(width===390)await page.evaluate(()=>document.documentElement.classList.add('dark'));
    const draft=page.getByRole('textbox',{name:'Borrador de prueba'}); await draft.fill('Edición local que permanece abierta');
    const network=async online=>page.evaluate(value=>{
      Object.defineProperty(navigator,'onLine',{configurable:true,value});
      window.dispatchEvent(new Event(value?'online':'offline'));
    },online);
    await network(false); if(scenario!=='offline')await network(true);
    const titles={failure:'No pudimos confirmar la conexión',mismatch:'La versión del servicio no coincide',offline:'Sin conexión',waiting:'El servicio está tardando'};
    await expect(page.getByText(titles[scenario],{exact:true})).toBeVisible();
    await expect(draft).toHaveValue('Edición local que permanece abierta');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.getByRole('progressbar').count(),0);
    if(scenario==='waiting')assert.equal(await page.locator('[data-testid="runtime-recovery-bar"] > svg').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.screenshot({path:`.vercel/runtime-resume-evidence/resume-${width}.png`,fullPage:true});
    if(scenario==='failure'||scenario==='mismatch') {
      responseMode='ready'; const button=page.getByRole('button',{name:'Comprobar servicio'});
      await button.focus();await page.keyboard.press('Enter');
      await expect(page.getByText('El servicio volvió a responder',{exact:true})).toBeVisible();
      await expect(draft).toHaveValue('Edición local que permanece abierta');
      await page.getByRole('button',{name:'Cerrar estado del servicio'}).click();
      await expect(page.getByRole('region',{name:'Estado del servicio'})).toHaveCount(0);
    }
    if(scenario==='offline'||scenario==='waiting') {
      if(scenario==='offline')assert.equal(calls.length,0);
      responseMode='ready'; if(scenario==='offline')await network(true);
      await expect(page.getByText('El servicio volvió a responder',{exact:true})).toBeVisible({timeout:10000});
      await expect(draft).toHaveValue('Edición local que permanece abierta');
    }
    assert.ok(calls.length>0&&calls.every(call=>call.method==='GET'&&call.cookie===null));
    assert.deepEqual(errors,[]);
    results.push({width,scenario,requests:calls.length,onlyAnonymousGet:true,draftPreserved:true});
    await context.close();
  }
  await writeFile('.vercel/runtime-resume-evidence/results.json',JSON.stringify({syntheticApi:true,results},null,2));
  console.log(JSON.stringify({syntheticApi:true,results}));
} finally {await browser?.close();await server.close();}
