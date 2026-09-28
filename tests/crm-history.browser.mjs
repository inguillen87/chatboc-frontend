import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder='.vercel/history-evidence';await mkdir(folder,{recursive:true});
const server=await createServer({configFile:false,plugins:[react()],cacheDir:'.vercel/history-browser-cache',resolve:{alias:[{find:'@/utils/api',replacement:path.resolve('tests/e2e/fixtures/crm-history.transport.ts')},{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:0},logLevel:'error'});
const data=(tenant,id)=>({contact:{id},tenant_slug:tenant,interactions:[{content:`History ${tenant} ${id}`,channel:'web',direction:'inbound',ts:'2026-09-28T12:00:00Z'}],cases_contract_version:'crm.contact_cases.v1',cases_total:1,cases_total_is_exact:true,cases_truncated:false,cases:[{source_model:'MunicipioTicket',ticket_id:id==='42'?'419':'420',tenant_slug:tenant,title:`Case ${tenant} ${id}`,assignee_name:`Owner ${tenant} ${id}`,status:'nuevo'}]});
let browser;const results=[];
try{
 await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 browser=await chromium.launch({headless:true});
 for(const [width,height,dark] of [[1440,1000,false],[390,844,true],[320,740,false]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'});
  let mode='valid',pending=null,release=null;const reads=[],writes=[],errors=[];
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==origin)return route.abort();
   if(!url.pathname.startsWith('/api/'))return route.continue();
   if(request.method()!=='GET'){writes.push(url.pathname);return route.abort();}
   const match=url.pathname.match(/^\/api\/admin\/tenants\/([^/]+)\/contacts\/([^/]+)\/history$/);
   if(!match)return route.fulfill({status:404,json:{error:'Unexpected synthetic endpoint'}});
   const tenant=decodeURIComponent(match[1]),id=decodeURIComponent(match[2]);reads.push({tenant,id,header:request.headers()['x-qa-tenant']});
   if(pending&&id==='42'&&tenant==='qa-a')await pending;
   if(mode==='denied')return route.fulfill({status:403,json:{error:'Synthetic denial'}});
   return route.fulfill({json:mode==='foreign'?data('qa-foreign','999'):mode==='malformed'?{contact:{id},interactions:{}}:data(tenant,id)});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-09-28T12:00:00Z'));
  const opened=()=>page.evaluate(()=>window.__historyOpened);
  try{
   await page.goto(`${origin}/tests/e2e/fixtures/crm-history.html`);
   if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
   await expect(page.getByRole('heading',{name:'Contacto Alfa',exact:true})).toBeVisible();
   await expect(page.getByRole('button',{name:'Abrir caso',exact:true})).toBeEnabled();
   await page.getByRole('button',{name:'Abrir caso',exact:true}).click();
   assert.equal((await opened()).length,1);assert.ok((await opened())[0].includes('ticket_id=419'));
   const beforeFocus=reads.length;mode='denied';
   await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});window.dispatchEvent(new Event('visibilitychange'));});
   await page.clock.setFixedTime(new Date('2026-09-28T12:00:31Z'));
   await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});window.dispatchEvent(new Event('visibilitychange'));});
   await expect.poll(()=>reads.length).toBeGreaterThan(beforeFocus);
   await expect(page.getByText('Owner qa-a 42',{exact:true})).toHaveCount(0);
   await expect(page.getByRole('button',{name:'Abrir caso',exact:true})).toHaveCount(0);
   await page.getByRole('button',{name:'Ver casos',exact:true}).click();
   await expect(page.getByRole('button',{name:'Ver casos',exact:true})).toBeEnabled();
   assert.equal((await opened()).length,1);
   assert.ok(!JSON.stringify(await page.evaluate(()=>window.__cachedHistory())).includes('Owner qa-a 42'));
   for(const rejected of ['foreign','malformed']){
    mode=rejected;await page.evaluate(()=>window.__refreshHistory());
    await expect(page.getByRole('button',{name:'Abrir caso',exact:true})).toHaveCount(0);
    await expect(page.getByText(/qa-foreign/)).toHaveCount(0);
    assert.equal((await opened()).length,1);
   }
   await page.screenshot({path:`${folder}/rejected-${width}.png`,fullPage:true});
   mode='valid';await page.evaluate(()=>window.__refreshHistory());
   await expect(page.getByRole('button',{name:'Abrir caso',exact:true})).toBeEnabled();
   const before=reads.length;pending=new Promise(resolve=>{release=resolve;});
   const request=page.evaluate(()=>window.__refreshHistory());
   await expect.poll(()=>reads.length).toBeGreaterThan(before);
   await expect(page.getByRole('button',{name:'Abrir caso',exact:true})).toHaveCount(0);
   await page.evaluate(()=>window.__selectHistoryContact('84'));
   await expect(page.getByRole('heading',{name:'Contacto Beta',exact:true})).toBeVisible();
   release();pending=null;release=null;await request;
   await expect(page.getByText('Owner qa-a 42',{exact:true})).toHaveCount(0);
   await expect(page.getByRole('button',{name:'Abrir caso',exact:true})).toBeEnabled();
   await page.evaluate(()=>window.__setHistoryTenant('qa-b'));
   await expect(page.getByRole('button',{name:'Abrir caso',exact:true})).toBeEnabled();
   await expect(page.getByText('Owner qa-a 84',{exact:true})).toHaveCount(0);
   await page.getByRole('button',{name:'Abrir caso',exact:true}).click();
   assert.equal((await opened()).length,2);assert.ok((await opened())[1].includes('tenant_slug=qa-b'));
   const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(bounds.scroll<=bounds.width+1,'History workspace horizontal overflow');
   await page.getByRole('tab',{name:/Casos/}).click();
   await expect(page.getByRole('region',{name:'Casos exactos del contacto'})).toBeVisible();
   const axe=await new AxeBuilder({page}).include('[aria-label="Casos exactos del contacto"]').withTags(['wcag2a','wcag2aa']).analyze();
   await writeFile(`${folder}/cases-${width}-axe.json`,JSON.stringify(axe.violations,null,2));
   const serious=axe.violations.filter(issue=>['critical','serious'].includes(issue.impact));
   assert.deepEqual(serious.map(issue=>({id:issue.id,nodes:issue.nodes.map(node=>node.target)})),[]);
   await page.screenshot({path:`${folder}/verified-${width}.png`,fullPage:true});
   assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
   assert.ok(reads.every(read=>read.header===read.tenant));
   results.push({width,height,dark,passed:true,readRequests:reads.length,writeRequests:writes.length,focusRevalidation:true,denialWithdrawsHistory:true,rejectsForeignContactAndTenant:true,rejectsMalformedHistory:true,recoveryVerified:true,lateResponseDiscarded:true,seriousAccessibilityViolations:serious.length});
  }catch(error){
   await page.screenshot({path:`${folder}/failure-${width}.png`,fullPage:true}).catch(()=>{});
   results.push({width,height,dark,passed:false,reason:error.message,errors});
  }finally{release?.();await context.close();}
 }
 const report={syntheticData:true,productionBackend:false,realAuthentication:false,realWorkspace:true,realHistoryHook:true,realCaseIdentity:true,results};
 await writeFile(`${folder}/browser-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.ok(results.every(result=>result.passed),'CRM history regression failed');
}finally{await browser?.close();await server.close();}
