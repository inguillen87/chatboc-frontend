import {chromium, expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const ui=JSON.parse(await readFile(new URL('./fixtures/runtime-recovery-ui.json',import.meta.url),'utf8'));
process.env.VITE_BACKEND_BOOTSTRAP_GATE_ENABLED='false';
process.env.VITE_EXPECTED_BACKEND_REVISION='a'.repeat(40);
const server=await createServer({cacheDir:'.vercel/resume-cache',server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser; const results=[];
try {
  await server.listen(); const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  await mkdir('.vercel/runtime-resume-evidence',{recursive:true});
  browser=await chromium.launch(process.platform==='win32'?{channel:'chrome',headless:true}:{headless:true});
  for(const [width,scenario] of [[1440,'failure'],[820,'mismatch'],[390,'offline'],[320,'waiting']]) {
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    const page=await context.newPage(); const calls=[];const configurationCalls=[];const errors=[];let responseMode=scenario;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/config/runtime-recovery',route=>{
      configurationCalls.push({method:route.request().method(),cookie:route.request().headers()['cookie']??null});
      return route.fulfill({status:200,json:ui});
    });
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
    const bottom=page.getByTestId('workspace-bottom');
    await expect(bottom).toBeInViewport({ratio:1});
    const initialBottom=await bottom.boundingBox();
    const stableBottom=async()=>{
      await expect(bottom).toBeInViewport({ratio:1});
      const bounds=await bottom.boundingBox(); assert.ok(bounds&&initialBottom&&Math.abs(bounds.y-initialBottom.y)<1);
    };
    const network=async online=>page.evaluate(value=>{
      Object.defineProperty(navigator,'onLine',{configurable:true,value});
      window.dispatchEvent(new Event(value?'online':'offline'));
    },online);
    await network(false); if(scenario!=='offline')await network(true);
    const states={failure:'unavailable',mismatch:'mismatch',offline:'offline',waiting:'waiting'};
    await expect(page.getByText(ui.states[states[scenario]].title,{exact:true})).toBeVisible();
    await expect(draft).toHaveValue('Edición local que permanece abierta');
    await stableBottom();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.getByRole('progressbar').count(),0);
    if(scenario==='waiting')assert.equal(await page.locator('[data-testid="runtime-recovery-bar"] > svg').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.screenshot({path:`.vercel/runtime-resume-evidence/resume-${width}.png`,fullPage:true});
    if(scenario==='failure'||scenario==='mismatch') {
      responseMode='ready'; const button=page.getByRole('button',{name:ui.check_label});
      await button.focus();await page.keyboard.press('Enter');
      await expect(page.getByText(ui.states.verified.title,{exact:true})).toBeVisible();
      await expect(draft).toHaveValue('Edición local que permanece abierta');
      await stableBottom();
      await page.getByRole('button',{name:ui.dismiss_label}).click();
      await expect(page.getByRole('region',{name:ui.region_label})).toHaveCount(0);
    }
    if(scenario==='offline'||scenario==='waiting') {
      if(scenario==='offline')assert.equal(calls.length,0);
      responseMode='ready'; if(scenario==='offline')await page.getByRole('button',{name:ui.check_label}).click();
      await expect(page.getByText(ui.states.verified.title,{exact:true})).toBeVisible({timeout:10000});
      await expect(draft).toHaveValue('Edición local que permanece abierta');
      await stableBottom();
    }
    assert.ok(calls.length>0&&calls.every(call=>call.method==='GET'&&call.cookie===null));
    assert.equal(configurationCalls.length,1);
    assert.ok(configurationCalls.every(call=>call.method==='GET'&&call.cookie===null));
    assert.deepEqual(errors,[]);
    results.push({width,scenario,versionRequests:calls.length,configurationRequests:configurationCalls.length,
      onlyAnonymousGet:true,draftPreserved:true,workspaceBottomPreserved:true});
    await context.close();
  }
  await writeFile('.vercel/runtime-resume-evidence/results.json',JSON.stringify({syntheticApi:true,syntheticNetworkEvents:true,results},null,2));
  console.log(JSON.stringify({syntheticApi:true,syntheticNetworkEvents:true,results}));
} finally {await browser?.close();await server.close();}
