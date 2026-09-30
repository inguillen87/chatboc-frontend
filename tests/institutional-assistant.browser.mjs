import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder='.vercel/institutional-assistant-evidence';
const boundary=path.resolve('tests/e2e/fixtures/institutional-assistant.transport.tsx');
const server=await createServer({configFile:false,plugins:[react()],cacheDir:'.vercel/institutional-qa-cache',optimizeDeps:{entries:['tests/e2e/fixtures/institutional-assistant.html']},
 resolve:{alias:[{find:/^@\/(context\/TenantContext|hooks\/useUser|components\/implementation\/(TenantProvisioningReadinessPanel|TenantBlueprintProvisioningPanel|GovernmentMesaUnicaLaunchPanel|GovernmentJurisdictionReadinessPanel)|components\/profile\/ChannelActivationChecklist)$/,replacement:boundary},{find:/^@\/config$/,replacement:path.resolve('tests/e2e/fixtures/institutional-assistant.config.ts')},{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;const results=[];
try{
 await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 const {workspace,node,reply}=await server.ssrLoadModule('/tests/fixtures/institutional-assistant.synthetic.ts');
 await mkdir(folder,{recursive:true});browser=await chromium.launch({headless:true});
 for(const [width,height,dark] of [[1440,1000,false],[390,844,true],[320,740,false]]){
  const context=await browser.newContext({viewport:{width,height},locale:'es-AR',reducedMotion:'reduce'});
  const errors=[],writes=[];let denied=false,state=workspace({revision:null,visibility:'empty',knowledge:null});
  if(dark)await context.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>document.documentElement.classList.add('dark'),{once:true});});
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();
   if(url.pathname.endsWith('/answer'))return route.fulfill({json:reply(request.postDataJSON().question?'requirements':request.postDataJSON().node_id,state)});
   if(request.method()==='PUT'){
    const body=request.postDataJSON();writes.push(body);if(denied)return route.fulfill({status:403,json:{reason_code:'knowledge_forbidden'}});
    assert.equal(body.expected_revision,state.revision);state=workspace({revision:(writes.length===1?'c':'d').repeat(64),visibility:body.operation==='publish'?'public':'private'});
   }
   return route.fulfill({json:state});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto(origin+'/tests/e2e/fixtures/institutional-assistant.html');
   await expect(page.getByRole('heading',{name:'Preparar la organización para operar'})).toBeVisible();
   await expect(page.getByRole('heading',{name:state.ui.empty})).toBeVisible();
   const sourceFile={contract_version:'chatboc.institutional_guide.composed.v1',tenant:{id:701,slug:'qa-knowledge'},syntheticFixture:true};
   await page.locator('input[type=file]').setInputFiles({name:'knowledge-qa.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(sourceFile))});
   await expect(page.getByRole('group',{name:state.ui.confirm})).toBeVisible();assert.equal(writes.length,0);
   await page.getByRole('button',{name:state.ui.confirm,exact:true}).click();
   await expect(page.getByRole('button',{name:'Consultar requisitos',exact:true})).toBeVisible();
   assert.deepEqual(writes[0].bundle,sourceFile);assert.equal(writes.length,1);
   await page.getByRole('button',{name:'Consultar requisitos',exact:true}).click();
   await expect(page.getByRole('heading',{name:'Requisitos de la consulta'})).toBeVisible();
   await expect(page.getByRole('link',{name:'Referencia institucional'})).toHaveAttribute('href','https://example.org/informacion');
   await page.getByLabel(state.ui.question).fill('¿Qué documentos necesito?');
   await page.getByRole('button',{name:state.ui.send,exact:true}).click();
   await expect(page.getByRole('heading',{name:'Requisitos de la consulta'})).toBeVisible();
   const before=writes.length;await page.getByRole('button',{name:state.ui.publish,exact:true}).click();await page.getByRole('button',{name:state.ui.cancel,exact:true}).click();assert.equal(writes.length,before);
   await page.getByRole('button',{name:state.ui.large_text,exact:true}).click();
   await expect(page.getByTestId('institutional-assistant')).toHaveClass(/institutional-assistant--large/);
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1,'Workspace overflows');
   const axe=await new AxeBuilder({page}).include('[data-testid="institutional-assistant"]').withTags(['wcag2a','wcag2aa']).analyze();
   const severe=axe.violations.filter(issue=>['serious','critical'].includes(issue.impact));
   await writeFile(`${folder}/workspace-${width}-axe.json`,JSON.stringify(axe.violations,null,2));
   assert.deepEqual(severe.map(issue=>({id:issue.id,nodes:issue.nodes.map(n=>n.target)})),[]);
   await page.screenshot({path:`${folder}/workspace-${width}.png`,fullPage:true});
   await page.getByRole('button',{name:state.ui.publish,exact:true}).click();
   await page.getByRole('button',{name:state.ui.confirm,exact:true}).evaluate(button=>{button.dispatchEvent(new MouseEvent('click',{bubbles:true}));button.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
   await expect(page.getByRole('button',{name:state.ui.retire,exact:true})).toBeVisible();assert.equal(writes.length,2);
   denied=true;await page.getByRole('button',{name:state.ui.retire,exact:true}).click();await page.getByRole('button',{name:state.ui.confirm,exact:true}).click();
   await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('heading',{name:'Requisitos de la consulta'})).toHaveCount(0);
   assert.equal(writes.length,3);denied=false;await page.getByRole('button',{name:state.ui.retry,exact:true}).click();
   await expect(page.getByRole('heading',{name:state.ui.heading})).toBeVisible();assert.deepEqual(errors,[]);
   await page.evaluate(()=>window.__openKnowledgeConsole());
   await expect(page.getByRole('heading',{name:state.ui.heading})).toBeVisible();
   await expect(page.getByRole('heading',{name:'Preparar la organización para operar'})).toHaveCount(0);
   await expect(page.getByText('Normativa Municipal V2.pdf')).toHaveCount(0);
   assert.deepEqual(errors,[]);
   results.push({width,height,dark,passed:true,registeredKnowledgeRoute:true,realApiFetch:true,realImplementationPage:true,canonicalNavigation:true,questionUsesSameSources:true,importRequiresConfirmation:true,publicationReadback:true,denialDoesNotRetry:true,syntheticWriteAttempts:writes.length,syntheticChanges:2,seriousAccessibilityViolations:severe.length});
  }catch(error){results.push({width,height,dark,passed:false,error:error.message,errors,writeAttempts:writes.length});await page.screenshot({path:`${folder}/failure-${width}.png`,fullPage:true}).catch(()=>{});}
  finally{await context.close();}
 }
 await writeFile(`${folder}/browser-results.json`,JSON.stringify({syntheticData:true,realSession:false,realExternalModel:false,realImplementationPage:true,results},null,2));
 console.log(JSON.stringify(results));assert.ok(results.every(result=>result.passed));
}finally{await browser?.close();await server.close();}
