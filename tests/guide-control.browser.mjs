import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer,transformWithEsbuild} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {privateGuideApiBoundary} from './e2e/fixtures/private-guide.api-boundary.mjs';
const compiled=await transformWithEsbuild(await readFile('tests/fixtures/guide-control.synthetic.ts','utf8'),'guide-control.synthetic.ts');
const {tenant,endpoint,descriptor,control,receipt,controlUi}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const folder='.vercel/guide-control-evidence';await mkdir(folder,{recursive:true});
const server=await createServer({configFile:false,plugins:[privateGuideApiBoundary(path.resolve('tests/e2e/fixtures/guide-control.transport.ts')),react()],cacheDir:'.vercel/guide-control-cache',optimizeDeps:{entries:['tests/e2e/fixtures/guide-control.html']},resolve:{alias:[{find:'@/utils/api',replacement:path.resolve('tests/e2e/fixtures/guide-control.transport.ts')},{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;const results=[];
try{await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;browser=await chromium.launch({headless:true});
 for(const [width,height,dark] of [[1440,1000,false],[390,844,true],[320,740,false]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  const reads=[],writes=[],errors=[];let enabled=false,version=0,mode='normal',hold=null,release=null,held=false,changed=0;
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());if(url.origin!==origin)return route.abort();
   if(!url.pathname.startsWith('/api/'))return route.continue();
   if(req.method()==='GET'){
    reads.push(url.pathname);
    if(url.pathname===`/api/v2/tenants/${tenant.slug}/activation/channels`)return route.fulfill({json:{contract_version:'tenant.channel_activation.v1',tenant,channels:[],conversation_guide_control:descriptor()}});
    if(url.pathname===endpoint){if(hold){held=true;await hold;}return route.fulfill({json:control(enabled,version)});}
   }
   if(req.method()==='PUT'&&url.pathname===endpoint){
    const body=req.postDataJSON();writes.push(body);
    assert.equal(req.headers()['x-chatboc-guide-control'],'1');assert.deepEqual(body.tenant,tenant);assert.equal(body.expected_revision,control(enabled,version).revision);assert.equal(body.acknowledge_evaluation_only,true);
    if(mode==='denied')return route.fulfill({status:403,json:{error:'PRIVATE SERVER BODY'}});
    assert.equal(body.enabled,!enabled);enabled=body.enabled;version++;changed++;return route.fulfill({json:receipt(enabled,version)});
   }
   return route.fulfill({status:404,json:{}});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin+'/tests/e2e/fixtures/guide-control.html');if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
   const open=page.getByRole('button',{name:controlUi.open});await expect(open).toBeVisible();assert.equal(reads.length,1);
   await open.focus();await open.press('Enter');await expect(page.getByTestId('guide-control-state')).toHaveText(controlUi.disabled_label);
   await page.getByRole('button',{name:controlUi.enable}).click();const confirm=page.getByRole('button',{name:controlUi.confirm});await expect(confirm).toBeDisabled();
   await page.getByRole('button',{name:controlUi.cancel}).click();assert.equal(writes.length,0);
   await page.getByRole('button',{name:controlUi.enable}).click();await page.getByRole('checkbox',{name:controlUi.acknowledgement}).check();
   const axe=await new AxeBuilder({page}).include('[data-testid="private-guide-control"]').withTags(['wcag2a','wcag2aa']).analyze();
   const serious=axe.violations.filter(issue=>['critical','serious'].includes(issue.impact));assert.deepEqual(serious.map(issue=>issue.id),[]);
   await writeFile(`${folder}/control-${width}-axe.json`,JSON.stringify(axe.violations,null,2));
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1);
   await page.screenshot({path:`${folder}/review-${width}.png`,fullPage:true});
   hold=new Promise(resolve=>{release=resolve;});
   await confirm.evaluate(button=>{button.dispatchEvent(new MouseEvent('click',{bubbles:true}));button.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
   await expect.poll(()=>held).toBe(true);assert.equal(writes.length,0);release();release=null;hold=null;held=false;
   await expect(open).toBeVisible();assert.equal(writes.length,1);assert.equal(changed,1);
   await open.click();await expect(page.getByTestId('guide-control-state')).toHaveText(controlUi.enabled_label);
   await page.screenshot({path:`${folder}/enabled-${width}.png`,fullPage:true});
   mode='denied';await page.getByRole('button',{name:controlUi.disable}).click();await page.getByRole('checkbox',{name:controlUi.acknowledgement}).check();await confirm.click();
   await expect(page.getByRole('alert')).toHaveText(controlUi.error);await expect(page.locator('body')).not.toContainText('PRIVATE SERVER BODY');
   assert.equal(writes.length,2);assert.equal(changed,1);await expect(page.getByRole('button',{name:controlUi.disable})).toHaveCount(0);
   mode='normal';await page.getByRole('button',{name:controlUi.refresh,exact:true}).click();await expect(page.getByTestId('guide-control-state')).toHaveText(controlUi.enabled_label);
   await page.getByRole('button',{name:controlUi.disable}).click();await page.getByRole('checkbox',{name:controlUi.acknowledgement}).check();
   hold=new Promise(resolve=>{release=resolve;});const late=page.waitForResponse(response=>new URL(response.url()).pathname===endpoint);
   await confirm.click();await expect.poll(()=>held).toBe(true);
   await page.evaluate(()=>window.__retireGuideControl());await expect(page.getByTestId('private-guide-control')).toHaveCount(0);
   release();release=null;hold=null;await(await late).finished();
   await expect(page.getByTestId('private-guide-control')).toHaveCount(0);assert.equal(writes.length,2);assert.equal(changed,1);assert.deepEqual(errors,[]);
   results.push({width,height,dark,passed:true,lazyStatus:true,acknowledgementRequired:true,cancelDoesNotWrite:true,synchronousDoubleClickBlocked:true,readbackConfirmed:true,denialDoesNotRetry:true,retiredPreflightDoesNotWrite:true,writeAttempts:writes.length,syntheticChanges:changed,seriousAccessibilityViolations:serious.length});
  }catch(error){results.push({width,height,dark,passed:false,reason:error.message,reads,writes,errors});await page.screenshot({path:`${folder}/failure-${width}.png`,fullPage:true}).catch(()=>{});}
  finally{release?.();await context.close();}
 }
 const report={syntheticData:true,realAuthentication:false,productionBackend:false,realChecklist:true,realControl:true,realParsers:true,results};
 await writeFile(`${folder}/browser-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.ok(results.every(result=>result.passed));
}finally{await browser?.close();await server.close();}
