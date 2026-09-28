import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder='.vercel/directory-evidence';
const replacement=path.resolve('tests/e2e/fixtures/crm-directory.transport.ts');
const server=await createServer({configFile:false,plugins:[react()],cacheDir:'.vercel/directory-cache',
 resolve:{alias:[{find:/^@\/(utils\/api|hooks\/(useUser|useRequireRole)|context\/SocketContext|components\/admin\/CampaignPreparationPanel)$/,replacement},{find:'@',replacement:path.resolve('src')}]},
 server:{host:'127.0.0.1',port:0},logLevel:'error'});
const person=(id,name)=>({id,name,email:'p***@example.test',phone:'***1234',pii_masked:true,source:'contact',channel:'web',marketing:false,tags:[],last_seen:'2026-09-27T12:00:00Z'});
const policy={requested:false,masked:true,granted:false,permission:'crm_contacts_pii_read',reason_code:'pii_masked_by_default'};
let browser;const results=[];
try{
 await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 await mkdir(folder,{recursive:true});browser=await chromium.launch({headless:true});
 for(const [width,height,dark] of [[1440,1000,false],[390,844,true],[320,740,false]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  const reads=[],writes=[],errors=[];let mode='normal',holdNext=null,releaseNext=null;
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==origin)return route.abort();
   if(!url.pathname.startsWith('/api/'))return route.continue();
   if(request.method()!=='GET'){writes.push({path:url.pathname,method:request.method()});return route.abort();}
   const tenant=request.headers()['x-qa-tenant'],cursor=url.searchParams.get('cursor'),q=url.searchParams.get('q')??'';
   reads.push({path:url.pathname,tenant,cursor,q});
   if(url.pathname!=='/api/v2/crm/people')return route.fulfill({status:404,json:{error:'Synthetic endpoint unavailable'}});
   const scenario=mode;
   if(cursor&&holdNext)await holdNext;
   if(cursor&&scenario==='denied')return route.fulfill({status:403,json:{error:'PRIVATE CUSTOMER CONTENT'}});
   const alpha=person('masked-a','A*** Prueba'),beta=person('masked-b','B*** Prueba');
   const terminal=Boolean(cursor)||Boolean(q)||tenant==='qa-b';
   const data={contract_version:'crm.people.directory.v2',tenant:{slug:tenant},items:tenant==='qa-b'?[person('other','O*** Otra')]:q?[person('filtered','B*** Filtrada')]:[cursor?beta:alpha],
    page:{limit:50,total:terminal&&(!cursor)?1:2,has_more:!terminal,next_cursor:terminal?null:'cursor-2'},
    filters:{q,marketing:url.searchParams.get('marketing'),channel:url.searchParams.get('channel'),sort:'recent_desc'},pii:{...policy}};
   if(cursor){
    if(scenario==='duplicate')data.items=[alpha];
    if(scenario==='cursor')data.page={limit:50,total:4,has_more:true,next_cursor:'cursor-2'};
    if(scenario==='policy')data.pii={...policy,requested:true,reason_code:'pii_permission_required'};
    if(scenario==='tenant')data.tenant.slug='foreign';
    if(scenario==='filters')data.filters.q='another search';
   }
   return route.fulfill({json:data});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-09-28T12:00:00Z'));
  const cache=()=>page.evaluate(()=>window.__directoryCache());
  const noOldData=async()=>{
   await expect(page.getByRole('heading',{name:'No pudimos cargar Personas'})).toBeVisible();
   await expect(page.getByRole('button',{name:'Cargar más'})).toHaveCount(0);
   await expect(page.getByTestId('crm-person-header')).toHaveCount(0);
   await expect(page.locator('body')).not.toContainText('PRIVATE');
   assert.ok(!JSON.stringify(await cache()).includes('A*** Prueba'),'Rejected pages must not remain cached');
  };
  try{
   await page.goto(origin+'/tests/e2e/fixtures/crm-directory.html');
   if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
   const more=page.getByRole('button',{name:'Cargar más'});
   await expect(more).toBeVisible();await expect(page.getByTestId('crm-person-header')).toContainText('A*** Prueba');
   holdNext=new Promise(resolve=>{releaseNext=resolve;});
   await more.evaluate(button=>{button.dispatchEvent(new MouseEvent('click',{bubbles:true}));button.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
   await expect.poll(()=>reads.filter(read=>read.cursor).length).toBe(1);
   await expect(page.getByRole('button',{name:'Cargando',exact:true})).toBeDisabled();
   releaseNext();releaseNext=null;holdNext=null;
   await expect(more).toHaveCount(0);await expect(page.locator('body')).toContainText('B*** Prueba');
   assert.equal(reads.filter(read=>read.path==='/api/v2/crm/people').length,2);
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1,'Directory horizontal overflow');
   const axe=await new AxeBuilder({page}).include('[data-testid="crm-people-search-toolbar"]').withTags(['wcag2a','wcag2aa']).analyze();
   const serious=axe.violations.filter(issue=>['critical','serious'].includes(issue.impact));
   await writeFile(`${folder}/directory-${width}-axe.json`,JSON.stringify(axe.violations,null,2));
   assert.deepEqual(serious.map(issue=>({id:issue.id,nodes:issue.nodes.map(node=>node.target)})),[]);
   await page.screenshot({path:`${folder}/loaded-${width}.png`,fullPage:true});
   mode='denied';await page.getByRole('button',{name:'Actualizar personas'}).click();await noOldData();
   for(const invalid of ['duplicate','cursor','policy','tenant','filters']){
    mode=invalid;const before=reads.length;await page.getByRole('button',{name:'Reintentar',exact:true}).click();
    await expect(more).toBeVisible();assert.equal(reads[before].cursor,null);
    await more.click();await noOldData();
   }
   await page.screenshot({path:`${folder}/rejected-${width}.png`,fullPage:true});
   mode='normal';await page.getByRole('button',{name:'Reintentar',exact:true}).click();await expect(more).toBeVisible();
   await page.getByRole('textbox',{name:'Buscar personas'}).fill('beta');
   await expect(page.getByTestId('crm-person-header')).toContainText('B*** Filtrada');
   assert.equal(reads.at(-1).q,'beta');assert.equal(reads.at(-1).cursor,null);
   await page.getByRole('textbox',{name:'Buscar personas'}).fill('');await expect(more).toBeVisible();
   holdNext=new Promise(resolve=>{releaseNext=resolve;});await more.click();
   await expect(page.getByRole('button',{name:'Cargando',exact:true})).toBeDisabled();
   await page.evaluate(()=>window.__setDirectoryTenant('qa-b'));
   await expect(page.getByTestId('crm-person-header')).toContainText('O*** Otra');
   releaseNext();holdNext=null;releaseNext=null;
   await expect(page.getByTestId('crm-person-header')).toContainText('O*** Otra');
   assert.ok(!JSON.stringify(await cache()).includes('A*** Prueba'));
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
   assert.equal(reads.filter(read=>read.path==='/api/crm/clientes').length,0);
   results.push({width,height,dark,passed:true,directoryReads:reads.length,writes:writes.length,doubleLoadCoalesced:true,invalidContinuationBlocked:true,retryStartsAtFirstPage:true,filtersScopePreserved:true,lateTenantResultDiscarded:true,seriousAccessibilityViolations:serious.length});
  }catch(error){
   await page.screenshot({path:`${folder}/failure-${width}.png`,fullPage:true}).catch(()=>{});
   results.push({width,height,dark,passed:false,reason:error.message,errors,reads,writes});
  }finally{releaseNext?.();await context.close();}
 }
 const report={syntheticData:true,realAuthentication:false,productionBackend:false,realUsuariosPage:true,realDirectoryHook:true,realNormalizers:true,results};
 await writeFile(`${folder}/browser-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.ok(results.every(result=>result.passed),'Directory browser regression failed');
}finally{await browser?.close();await server.close();}
