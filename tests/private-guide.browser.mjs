import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer,transformWithEsbuild} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {privateGuideApiBoundary} from './e2e/fixtures/private-guide.api-boundary.mjs';
const observeSettlement=(page,matches)=>{
 let selected=null,state=null;
 const started=request=>{if(!selected&&matches(request))selected=request;};
 const settled=request=>{if(request===selected)state=request.failure()?'failed':'finished';};
 page.on('request',started);page.on('requestfinished',settled);page.on('requestfailed',settled);
 return {get state(){return state;},dispose(){page.off('request',started);page.off('requestfinished',settled);page.off('requestfailed',settled);}};
};
const compiled=await transformWithEsbuild(await readFile('tests/fixtures/private-guide.synthetic.ts','utf8'),'private-guide.synthetic.ts');
const {guideActivation,guideNode,guideCopy}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const folder='.vercel/private-guide-evidence';await mkdir(folder,{recursive:true});
const transport=path.resolve('tests/e2e/fixtures/private-guide.transport.ts');
// Rebuild the controlled dependency graph before the first browser width;
// cached graphs from older fixtures must not trigger React replacement mid-test.
const server=await createServer({configFile:false,plugins:[privateGuideApiBoundary(transport),react()],cacheDir:'.vercel/private-guide-cache',optimizeDeps:{force:true,entries:['tests/e2e/fixtures/private-guide.html']},
 resolve:{alias:[{find:'@/utils/api',replacement:path.resolve('tests/e2e/fixtures/private-guide.transport.ts')},{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;const results=[];
try{await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;browser=await chromium.launch({headless:true});
 for(const [width,height,dark] of [[1440,1000,false],[390,844,true],[320,740,false]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  let mode='normal',hold=null,release=null,activationHold=null,releaseActivation=null;
  let releaseProfile;const profileHold=new Promise(resolve=>{releaseProfile=resolve;});const reads=[],writes=[],errors=[];
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();
   if(!url.pathname.startsWith('/api/'))return route.continue();
   if(request.method()!=='GET'){writes.push(request.method());return route.abort();}
   reads.push(url.pathname+url.search);
   if(url.pathname==='/api/me'){
    const actor=request.headers()['x-qa-actor'];await profileHold;
    if(mode==='profile-denied')return route.fulfill({status:403,json:{message:'PRIVATE SERVER BODY'}});
    return route.fulfill({json:{id:actor==='actor-a'?741:742,name:actor,email:`${actor}@example.invalid`,
     rol:'admin',tipo_chat:'municipio',tenant_slug:'qa-guide',permissions:[],capabilities:[]}});
   }
   if(url.pathname==='/api/v2/tenants/qa-guide/activation/channels'){
    const scenario=mode;if(activationHold)await activationHold;
    return route.fulfill({json:{...guideActivation(),...(scenario==='revoked'?{organization_setup:null}:{})}});
   }
   if(url.pathname!=='/api/admin/tenants/qa-guide/conversation-guide')return route.fulfill({status:404,json:{}});
   const scenario=mode;if(hold)await hold;
   if(scenario==='denied')return route.fulfill({status:403,json:{message:'PRIVATE SERVER BODY'}});
   const value=guideNode(url.searchParams.get('selection')==='1'?'requirements':url.searchParams.get('node'));
   if(scenario==='wrong')value.tenant={id:702,slug:'other'};if(scenario==='changed')value.source.sha256='c'.repeat(64);
   return route.fulfill({json:value});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));const observations=[];
  try{
   await page.goto(origin+'/tests/e2e/fixtures/private-guide.html');if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
   const summary=page.locator('.private-guide>summary');
   await expect.poll(()=>reads.filter(read=>read==='/api/me').length).toBe(1);
   await expect(summary).toHaveCount(0);assert.equal(reads.filter(read=>read.includes('/activation/channels')).length,0);
   await page.evaluate(()=>window.__setGuideSessionVerified(true));
   await expect(page.getByTestId('profile-authority')).toHaveText('pending');await expect(summary).toHaveCount(0);
   assert.equal(reads.filter(read=>read.includes('/activation/channels')).length,0);
   releaseProfile();releaseProfile=null;
   await expect(page.getByTestId('profile-authority')).toHaveText('verified');await expect(summary).toHaveText(guideCopy.open);
   assert.equal(reads.filter(read=>read.includes('/activation/channels')).length,1);await summary.focus();await summary.press('Enter');
   await expect(page.getByRole('heading',{name:'Nodo start'})).toBeFocused();
   hold=new Promise(resolve=>{release=resolve;});
   const action=page.getByRole('button',{name:'Consultar requisitos QA'});
   await action.evaluate(button=>{button.dispatchEvent(new MouseEvent('click',{bubbles:true}));button.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
   await expect.poll(()=>reads.filter(read=>read.includes('selection=1')).length).toBe(1);
   await expect(page.getByTestId('private-guide-node')).toHaveCount(0);release();release=null;hold=null;
   await expect(page.getByRole('heading',{name:'Nodo requirements'})).toBeFocused();
   const axe=await new AxeBuilder({page}).include('.private-guide').withTags(['wcag2a','wcag2aa']).analyze();
   const serious=axe.violations.filter(issue=>['serious','critical'].includes(issue.impact));assert.deepEqual(serious.map(issue=>issue.id),[]);
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1);
   await page.screenshot({path:`${folder}/guide-${width}.png`,fullPage:true});
   mode='changed';await page.getByRole('button',{name:guideCopy.back_to_menu,exact:true}).click();
   await expect(page.getByRole('alert')).toHaveText(guideCopy.error);await expect(page.getByTestId('private-guide-node')).toHaveCount(0);
   for(const scenario of ['wrong','denied']){await summary.click();mode=scenario;await summary.click();await expect(page.getByRole('alert')).toHaveText(guideCopy.error);await expect(page.locator('body')).not.toContainText('PRIVATE SERVER BODY');}
   // Both actor changes occur in the same browser task: React may batch back
   // to A, but the real store subscription must retire A's pending guide.
   await summary.click();mode='normal';hold=new Promise(resolve=>{release=resolve;});
   const abaSettled=observeSettlement(page,request=>request.url().includes('/conversation-guide'));observations.push(abaSettled);
   await summary.click();await expect(page.getByRole('status')).toHaveText(guideCopy.loading);
   activationHold=new Promise(resolve=>{releaseActivation=resolve;});
   await page.evaluate(()=>{window.__setGuideActor('actor-b');window.__setGuideActor('actor-a');});
   await expect(summary).toHaveCount(0);release();release=null;hold=null;
   await expect.poll(()=>abaSettled.state).toMatch(/^(finished|failed)$/);abaSettled.dispose();
   await expect(page.getByTestId('private-guide-node')).toHaveCount(0);
   releaseActivation();releaseActivation=null;activationHold=null;
   await expect(summary).toHaveText(guideCopy.open);await expect(page.getByTestId('private-guide-node')).toHaveCount(0);
   await summary.click();await expect(page.getByRole('heading',{name:'Nodo start'})).toBeVisible();
   // A fresh 403 from the real profile reader removes previously verified
   // authority; no private guide survives and the error body stays hidden.
   mode='profile-denied';await page.evaluate(()=>window.__refreshGuideProfile());
   await expect(page.getByTestId('profile-authority')).toHaveText('unverified');await expect(summary).toHaveCount(0);
   await expect(page.getByTestId('private-guide-node')).toHaveCount(0);await expect(page.locator('body')).not.toContainText('PRIVATE SERVER BODY');
   mode='normal';await page.evaluate(()=>window.__refreshGuideProfile());
   await expect(page.getByTestId('profile-authority')).toHaveText('verified');await expect(summary).toHaveText(guideCopy.open);
   mode='normal';hold=new Promise(resolve=>{release=resolve;});
   const settled=observeSettlement(page,request=>request.url().includes('/conversation-guide'));observations.push(settled);
   await summary.click();await expect(page.getByRole('status')).toHaveText(guideCopy.loading);
   mode='revoked';await page.evaluate(()=>window.__setGuideActor('actor-b'));
   await expect(summary).toHaveCount(0);release();hold=null;release=null;
   await expect.poll(()=>settled.state).toMatch(/^(finished|failed)$/);settled.dispose();
   await expect(page.getByTestId('private-guide-node')).toHaveCount(0);
   const stored=await page.evaluate(()=>JSON.stringify([Object.values(localStorage),Object.values(sessionStorage)]));assert.ok(!stored.includes('Contenido de evaluación'));
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
   results.push({width,height,dark,passed:true,profileReadVerified:true,unverifiedAndPendingDoNotRead:true,lazyRead:true,doubleClickBlocked:true,sourceVersionChangeRejected:true,crossTenantRejected:true,denialHandled:true,synchronousActorABA:true,profileDenialWithdrawsGuide:true,sessionRetirement:true,writes:0,seriousAccessibilityViolations:serious.length});
  }catch(error){results.push({width,height,dark,passed:false,reason:error.message,errors,reads,writes});await page.screenshot({path:`${folder}/failure-${width}.png`,fullPage:true}).catch(()=>{});}
  finally{observations.forEach(observation=>observation.dispose());releaseProfile?.();release?.();releaseActivation?.();await context.close();}
 }
 const report={syntheticData:true,realAccount:false,realAuthentication:false,productionBackend:false,loopbackOnly:true,syntheticClerkAuthority:true,realUserProvider:true,realSessionAuthorityContext:true,realChecklist:true,realReader:true,realParser:true,results};
 await writeFile(`${folder}/browser-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.ok(results.every(result=>result.passed),'Private guide browser regression failed');
}finally{await browser?.close();await server.close();}
