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
  const errors=[],writes=[],answerRequests=[];let denied=false,state=workspace({revision:null,visibility:'empty',knowledge:null});
  if(dark)await context.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>document.documentElement.classList.add('dark'),{once:true});});
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();
   const canonicalNode=url.pathname.match(/^\/api\/admin\/tenants\/qa-knowledge\/institutional-assistant\/nodes\/([^/]+)$/);
   if(canonicalNode){
    assert.equal(request.method(),'GET');assert.equal(request.postData(),null);
    assert.equal(url.searchParams.get('revision'),state.revision);
    assert.equal(url.searchParams.get('tenant_slug'),'qa-knowledge');
    assert.equal(url.searchParams.get('tenant'),'qa-knowledge');
    const input={method:'GET',node_id:decodeURIComponent(canonicalNode[1]),revision:url.searchParams.get('revision')};
    answerRequests.push(input);return route.fulfill({json:reply(input.node_id,state)});
   }
   if(url.pathname.endsWith('/answer')){
    assert.equal(request.method(),'POST');
    const input=request.postDataJSON();assert.equal(input.revision,state.revision);assert.equal(typeof input.question,'string');
    assert.ok(input.question.trim());assert.ok(!input.node_id||['start','requirements'].includes(input.node_id));answerRequests.push({method:'POST',...input});
    const response=reply(input.question?'requirements':input.node_id,state);
    if(input.question==='Consulta extensa'){response.nodes[0].text=Array(30).fill(response.nodes[0].text).join('\n\n');response.text=response.nodes[0].text;}
    if(input.question==='Consulta sin fuente'){response.nodes=[];response.text=state.ui.unknown;}
    return route.fulfill({json:response});
   }
   if(request.method()==='PUT'){
    const body=request.postDataJSON();writes.push(body);if(denied)return route.fulfill({status:403,json:{reason_code:'knowledge_forbidden'}});
    assert.equal(body.expected_revision,state.revision);state=workspace({revision:(writes.length===1?'c':'d').repeat(64),visibility:body.operation==='publish'?'public':'private'});
    state.knowledge.sources.push(...Array.from({length:14},(_,index)=>({...state.knowledge.sources[0],id:'additional-'+index,title:'Documento de prueba '+(index+1)+' - antecedentes, referencias y orientaciones del servicio'})));
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
   await expect(page.getByRole('dialog',{name:state.ui.import})).toBeVisible();
   await expect(page.getByRole('button',{name:state.ui.cancel,exact:true})).toBeFocused();assert.equal(writes.length,0);
   await page.getByRole('button',{name:state.ui.confirm,exact:true}).click();
   await expect(page.getByRole('button',{name:'Consultar requisitos',exact:true})).toBeVisible();
   assert.deepEqual(writes[0].bundle,sourceFile);assert.equal(writes.length,1);
   await page.getByRole('button',{name:'Consultar requisitos',exact:true}).click();
   await expect(page.getByRole('heading',{name:'Requisitos de la consulta'})).toBeVisible();
   assert.deepEqual(answerRequests,[{method:'GET',node_id:'requirements',revision:state.revision}]);assert.equal(writes.length,1);
   await expect(page.getByRole('link',{name:'Referencia institucional'})).toHaveAttribute('href','https://example.org/informacion');
   const input=page.getByLabel(state.ui.question);
   await input.fill('Consulta extensa');await input.press('Enter');
   const answerHeading=page.getByRole('heading',{name:'Requisitos de la consulta'});
   await expect(answerHeading).toBeFocused();await expect(answerHeading).toBeInViewport();
   const reading=page.getByRole('region',{name:state.ui.answer,exact:true});
   await reading.evaluate(element=>{element.scrollTop=element.scrollHeight;});
   const scrollBefore=await reading.evaluate(element=>element.scrollTop);assert.ok(scrollBefore>0);
   await input.fill('Consulta en borrador');
   const sourceTrigger=page.getByRole('button',{name:state.ui.sources,exact:true});const beforeSources=answerRequests.length;
   await sourceTrigger.click();const sources=page.getByRole('dialog',{name:state.ui.sources,exact:true});
   await expect(sources).toBeVisible();await expect(sources.getByRole('heading',{name:state.ui.sources,exact:true})).toBeFocused();
   const sourceRegion=sources.getByRole('region',{name:state.ui.sources,exact:true});
   await sourceRegion.focus();await sourceRegion.press('PageDown');
   await expect.poll(()=>sourceRegion.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
   for(let step=0;step<5;step++){await page.keyboard.press('Tab');assert.ok(await sources.evaluate(element=>element.contains(document.activeElement)));}
   const dialogSize=await sources.boundingBox();assert.ok(dialogSize&&dialogSize.x>=0&&dialogSize.y>=0&&dialogSize.width<=width&&dialogSize.height<=height);
   const sourceAxe=await new AxeBuilder({page}).include('[role="dialog"]').withTags(['wcag2a','wcag2aa']).analyze();
   const sourceSevere=sourceAxe.violations.filter(issue=>['serious','critical'].includes(issue.impact));assert.deepEqual(sourceSevere.map(issue=>issue.id),[]);
   await writeFile(`${folder}/sources-${width}-axe.json`,JSON.stringify(sourceAxe.violations,null,2));
   await sourceRegion.evaluate(element=>{element.scrollTop=0;});
   await sources.getByRole('heading',{name:state.ui.sources,exact:true}).focus();
   await page.screenshot({path:`${folder}/sources-${width}.png`});
   await sources.press('Escape');await expect(sources).toHaveCount(0);await expect(sourceTrigger).toBeFocused();
   await expect(input).toHaveValue('Consulta en borrador');assert.equal(answerRequests.length,beforeSources);
   assert.equal(await reading.evaluate(element=>element.scrollTop),scrollBefore);
   await input.press('Shift+Enter');await expect(input).toHaveValue('Consulta en borrador\n');assert.equal(answerRequests.length,beforeSources);
   await input.fill('Consulta sin fuente');await input.press('Enter');
   await expect(page.getByText(state.ui.unknown,{exact:true})).toBeFocused();
   await page.getByLabel(state.ui.question).fill('¿Qué documentos necesito?');
   await page.getByRole('button',{name:state.ui.send,exact:true}).click();
   await expect(page.getByRole('heading',{name:'Requisitos de la consulta'})).toBeVisible();
   const before=writes.length,answerCount=answerRequests.length;
   const publish=page.getByRole('button',{name:state.ui.publish,exact:true});
   await input.fill('Borrador preservado');await publish.click();
   const review=page.getByRole('dialog',{name:state.ui.publish,exact:true});await expect(review).toBeVisible();
   await expect(review.getByRole('button',{name:state.ui.cancel,exact:true})).toBeFocused();
   await page.locator('.institutional-assistant__composer').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   assert.equal(answerRequests.length,answerCount);assert.equal(writes.length,before);
   const reviewAxe=await new AxeBuilder({page}).include('[role="dialog"]').withTags(['wcag2a','wcag2aa']).analyze();
   const reviewSevere=reviewAxe.violations.filter(issue=>['serious','critical'].includes(issue.impact));assert.deepEqual(reviewSevere.map(issue=>issue.id),[]);
   await writeFile(`${folder}/review-${width}-axe.json`,JSON.stringify(reviewAxe.violations,null,2));
   await page.screenshot({path:`${folder}/review-${width}.png`});
   await review.press('Escape');await expect(review).toHaveCount(0);await expect(publish).toBeFocused();
   await expect(input).toHaveValue('Borrador preservado');assert.equal(writes.length,before);
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
   await expect(page.getByRole('alert')).toBeFocused();await expect(page.getByRole('heading',{name:'Requisitos de la consulta'})).toHaveCount(0);
   assert.equal(writes.length,3);denied=false;await page.getByRole('button',{name:state.ui.retry,exact:true}).click();
   await expect(page.getByRole('heading',{name:state.ui.heading})).toBeVisible();assert.deepEqual(errors,[]);
   await page.evaluate(()=>window.__openKnowledgeConsole());
   await expect(page.getByRole('heading',{name:state.ui.heading})).toBeVisible();
   await expect(page.getByRole('heading',{name:'Preparar la organización para operar'})).toHaveCount(0);
   await expect(page.getByText('Normativa Municipal V2.pdf')).toHaveCount(0);
   assert.deepEqual(errors,[]);
   results.push({width,height,dark,passed:true,registeredKnowledgeRoute:true,realApiFetch:true,realImplementationPage:true,canonicalNavigation:true,canonicalGetRead:true,questionUsesSameSources:true,importRequiresConfirmation:true,publicationReadback:true,denialDoesNotRetry:true,syntheticWriteAttempts:writes.length,syntheticChanges:2,seriousAccessibilityViolations:severe.length,sourceDialogViolations:sourceSevere.length,reviewDialogViolations:reviewSevere.length,sourceFocusRestored:true,readingPositionPreserved:true,reviewBlocksBackground:true,multilineQuestion:true,uncoveredResponseFocused:true});
  }catch(error){results.push({width,height,dark,passed:false,error:error.message,errors,writeAttempts:writes.length});await page.screenshot({path:`${folder}/failure-${width}.png`,fullPage:true}).catch(()=>{});}
  finally{await context.close();}
 }
 await writeFile(`${folder}/browser-results.json`,JSON.stringify({syntheticData:true,realSession:false,realExternalModel:false,realImplementationPage:true,results},null,2));
 console.log(JSON.stringify(results));assert.ok(results.every(result=>result.passed));
}finally{await browser?.close();await server.close();}
