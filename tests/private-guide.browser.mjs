import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer,transformWithEsbuild} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {privateGuideApiBoundary} from './e2e/fixtures/private-guide.api-boundary.mjs';
const compiled=await transformWithEsbuild(await readFile('tests/fixtures/private-guide.synthetic.ts','utf8'),'private-guide.synthetic.ts');
const {guideActivation,guideNode,guideCopy}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const folder='.vercel/private-guide-evidence';await mkdir(folder,{recursive:true});
const transport=path.resolve('tests/e2e/fixtures/private-guide.transport.ts');
const server=await createServer({configFile:false,plugins:[privateGuideApiBoundary(transport),react()],cacheDir:'.vercel/private-guide-cache',optimizeDeps:{entries:['tests/e2e/fixtures/private-guide.html']},
 resolve:{alias:[{find:'@/utils/api',replacement:path.resolve('tests/e2e/fixtures/private-guide.transport.ts')},{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;const results=[];
try{await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;browser=await chromium.launch({headless:true});
 for(const [width,height,dark] of [[1440,1000,false],[390,844,true],[320,740,false]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  let mode='normal',hold=null,release=null;const reads=[],writes=[],errors=[];
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();
   if(!url.pathname.startsWith('/api/'))return route.continue();
   if(request.method()!=='GET'){writes.push(request.method());return route.abort();}
   reads.push(url.pathname+url.search);
   if(url.pathname==='/api/v2/tenants/qa-guide/activation/channels')return route.fulfill({json:{...guideActivation(),...(mode==='revoked'?{organization_setup:null}:{})}});
   if(url.pathname!=='/api/admin/tenants/qa-guide/conversation-guide')return route.fulfill({status:404,json:{}});
   const scenario=mode;if(hold)await hold;
   if(scenario==='denied')return route.fulfill({status:403,json:{message:'PRIVATE SERVER BODY'}});
   const value=guideNode(url.searchParams.get('selection')==='1'?'requirements':url.searchParams.get('node'));
   if(scenario==='wrong')value.tenant={id:702,slug:'other'};if(scenario==='changed')value.source.sha256='c'.repeat(64);
   return route.fulfill({json:value});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto(origin+'/tests/e2e/fixtures/private-guide.html');if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
   const summary=page.locator('.private-guide>summary');await expect(summary).toHaveText(guideCopy.open);
   assert.equal(reads.length,1);await summary.focus();await summary.press('Enter');
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
   await summary.click();mode='normal';hold=new Promise(resolve=>{release=resolve;});const settled=page.waitForResponse(response=>response.url().includes('/conversation-guide'));
   await summary.click();await expect(page.getByRole('status')).toHaveText(guideCopy.loading);
   mode='revoked';await page.evaluate(()=>window.__setGuideActor('actor-b'));
   await expect(summary).toHaveCount(0);release();hold=null;release=null;await (await settled).finished();
   await expect(page.getByTestId('private-guide-node')).toHaveCount(0);
   const stored=await page.evaluate(()=>JSON.stringify([Object.values(localStorage),Object.values(sessionStorage)]));assert.ok(!stored.includes('Contenido de evaluación'));
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
   results.push({width,height,dark,passed:true,lazyRead:true,doubleClickBlocked:true,sourceVersionChangeRejected:true,crossTenantRejected:true,denialHandled:true,sessionRetirement:true,writes:0,seriousAccessibilityViolations:serious.length});
  }catch(error){results.push({width,height,dark,passed:false,reason:error.message,errors,reads,writes});await page.screenshot({path:`${folder}/failure-${width}.png`,fullPage:true}).catch(()=>{});}
  finally{release?.();await context.close();}
 }
 const report={syntheticData:true,realAccount:false,productionBackend:false,realChecklist:true,realReader:true,realParser:true,results};
 await writeFile(`${folder}/browser-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.ok(results.every(result=>result.passed),'Private guide browser regression failed');
}finally{await browser?.close();await server.close();}
