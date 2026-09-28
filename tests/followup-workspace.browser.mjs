import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder='.vercel/followup-evidence';
const server=await createServer({configFile:false,plugins:[react()],cacheDir:'.vercel/followup-cache',optimizeDeps:{entries:['tests/e2e/fixtures/followup-workspace.html']},resolve:{alias:[{find:'@/utils/api',replacement:path.resolve('tests/e2e/fixtures/followup-workspace.transport.ts')},{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;const results=[];
try{
 await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 await mkdir(folder,{recursive:true});browser=await chromium.launch({headless:true});
 for(const [width,height,dark] of [[1440,1000,false],[390,844,true],[320,740,false]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',locale:'es-AR',timezoneId:'America/Argentina/Buenos_Aires'});
  const writes=[],reads=[],errors=[];let deny=false,conflict=false,holdList=null,releaseList=null;
  const preferences={owner_notes:'Nota de prueba',next_action_at:'2000-01-01T12:00:00Z',stage_updated_at:'2026-09-24T00:00:00Z',stage_updated_by:9};
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==origin)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();
   if(request.method()==='GET')reads.push(url.pathname);
   if(deny)return route.fulfill({status:403,json:{error:'Synthetic permission denied'}});
   if(url.pathname==='/api/admin/crm/leads'){
    if(holdList)await holdList;
    return route.fulfill({json:{items:[{contact_id:'contact-qa',name:'Contacto de prueba',tenant:{slug:'org-qa',nombre:'Organización de prueba'},next_action_at:preferences.next_action_at}]}});
   }
   if(url.pathname==='/api/admin/tenants/org-qa/contacts/contact-qa/history'){
    if(conflict){preferences.owner_notes='Nota de otro operador';preferences.stage_updated_at='2026-09-24T00:01:00Z';conflict=false;}
    return route.fulfill({json:{contact:{id:'contact-qa',name:'Contacto de prueba',preferences}}});
   }
   if(url.pathname==='/api/admin/tenants/org-qa/contacts/contact-qa/stage'&&request.method()==='PATCH'){
    const body=request.postDataJSON();writes.push({path:url.pathname,body,tenant:request.headers()['x-qa-tenant']});
    Object.assign(preferences,body,{stage_updated_at:'2026-09-24T00:00:30Z'});
    return route.fulfill({json:{ok:true,contact:{contact_id:'contact-qa'}}});
   }
   return route.fulfill({status:404,json:{error:'Unexpected request'}});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto(`${origin}/tests/e2e/fixtures/followup-workspace.html`);
   if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
   const contact=page.getByRole('button',{name:'Seguimiento de Contacto de prueba en Organización de prueba'});
   await expect(contact).toBeVisible();
   const before=reads.length;
   const search=page.getByRole('searchbox');
   await search.fill('Sin coincidencias');await expect(contact).toHaveCount(0);
   await page.getByRole('button',{name:'Ver vencidos'}).click();
   await expect(search).toHaveValue('');await expect(contact).toBeVisible();
   await expect(page.getByTestId('followup-results-summary')).toBeFocused();
   await expect(page.getByTestId('followup-results-summary')).toBeInViewport();
   await search.fill('contacto');await page.getByRole('button',{name:/^Vencidos/}).click();
   await expect(search).toHaveValue('contacto');assert.equal(reads.length,before);
   const queueAxe=await new AxeBuilder({page}).include('.followup-queue').withTags(['wcag2a','wcag2aa']).analyze();
   const queueSerious=queueAxe.violations.filter(issue=>['critical','serious'].includes(issue.impact));
   await writeFile(`${folder}/queue-${width}-axe.json`,JSON.stringify(queueAxe.violations,null,2));
   assert.deepEqual(queueSerious.map(issue=>({id:issue.id,nodes:issue.nodes.map(node=>node.target)})),[]);
   const queueSize=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(queueSize.scroll<=queueSize.width+1,'Queue horizontal overflow');
   await page.screenshot({path:`${folder}/queue-${width}.png`,fullPage:true});
   await contact.focus();await contact.press('Enter');
   const notes=page.getByRole('textbox',{name:'Notas del responsable'});await expect(notes).toHaveValue('Nota de prueba');
   await page.getByRole('dialog',{name:'Seguimiento del contacto'}).press('Escape');
   await expect(contact).toBeFocused();assert.equal(writes.length,0);
   await contact.press('Enter');await expect(notes).toHaveValue('Nota de prueba');
   await notes.fill('Enviar propuesta revisada.');await page.getByLabel('Próxima acción',{exact:true}).fill('2026-10-01T12:30');
   await page.getByRole('button',{name:'Revisar seguimiento'}).click();
   const confirm=page.getByRole('alertdialog',{name:'Confirmar seguimiento'});await expect(confirm).toBeVisible();
   await confirm.getByRole('button',{name:'Volver sin guardar'}).click();assert.equal(writes.length,0);await expect(notes).toHaveValue('Enviar propuesta revisada.');
   const axe=await new AxeBuilder({page}).include('.followup-dialog').withTags(['wcag2a','wcag2aa']).analyze();
   await writeFile(`${folder}/dialog-${width}-axe.json`,JSON.stringify(axe.violations,null,2));
   const serious=axe.violations.filter(issue=>['critical','serious'].includes(issue.impact));
   assert.deepEqual(serious.map(issue=>({id:issue.id,nodes:issue.nodes.map(node=>node.target)})),[]);
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1,'Horizontal overflow');
   assert.equal(await page.locator('.followup-dialog').evaluate(element=>getComputedStyle(element).animationName),'none');
   await page.screenshot({path:`${folder}/editor-${width}.png`,fullPage:true});
   await page.getByRole('button',{name:'Revisar seguimiento'}).click();await confirm.getByRole('button',{name:'Guardar seguimiento'}).click();
   await expect(page.getByText('Seguimiento guardado y verificado en el servidor.')).toBeVisible();
   assert.equal(writes.length,1);assert.deepEqual(writes[0].body,{owner_notes:'Enviar propuesta revisada.',next_action_at:'2026-10-01T15:30:00.000Z'});assert.equal(writes[0].tenant,'org-qa');
   const beforeClose=reads.filter(path=>path==='/api/admin/crm/leads').length;
   holdList=new Promise(resolve=>{releaseList=resolve;});
   await page.getByRole('dialog',{name:'Seguimiento del contacto'}).press('Escape');
   const agendaHeading=page.getByRole('heading',{name:'Agenda de próximos contactos'});
   await expect(agendaHeading).toBeFocused();await expect(contact).toHaveCount(0);
   await expect.poll(()=>reads.filter(path=>path==='/api/admin/crm/leads').length).toBe(beforeClose+1);
   await search.focus();releaseList();holdList=null;releaseList=null;
   await expect(page.getByText('No hay contactos que coincidan con estos filtros.')).toBeVisible();
   await expect(search).toBeFocused();await expect(search).toHaveValue('contacto');
   await expect(page.getByRole('button',{name:/^Vencidos/})).toHaveAttribute('aria-pressed','true');
   assert.equal(writes.length,1);
   const beforeReset=reads.length;
   await page.getByRole('button',{name:'Limpiar búsqueda y prioridad'}).click();
   await expect(page.getByTestId('followup-results-summary')).toBeFocused();
   await expect(page.getByTestId('followup-results-summary')).toBeInViewport();
   await expect(contact).toBeVisible();assert.equal(reads.length,beforeReset);
   await page.screenshot({path:`${folder}/saved-queue-${width}.png`,fullPage:true});
   await page.reload();if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
   await contact.click();await expect(notes).toHaveValue('Enviar propuesta revisada.');await expect(page.getByLabel('Próxima acción',{exact:true})).toHaveValue('2026-10-01T12:30');
   await notes.fill('Borrador que no debe pisar cambios');await page.getByRole('button',{name:'Revisar seguimiento'}).click();
   conflict=true;await confirm.getByRole('button',{name:'Guardar seguimiento'}).click();
   await expect(page.getByText(/cambió desde que abriste/)).toBeVisible();assert.equal(writes.length,1);await expect(notes).toHaveValue('Borrador que no debe pisar cambios');
   await page.getByRole('button',{name:'Actualizar ficha'}).click();const discard=page.getByRole('alertdialog',{name:'Hay un borrador sin guardar'});
   await discard.getByRole('button',{name:'Seguir editando'}).click();assert.equal(writes.length,1);
   await page.getByRole('button',{name:'Actualizar ficha'}).click();deny=true;await discard.getByRole('button',{name:'Descartar y continuar'}).click();
   await expect(page.getByText(/No pudimos verificar el contacto/)).toBeVisible();await expect(notes).toHaveCount(0);
   assert.deepEqual(errors,[]);assert.equal(writes.length,1);
   results.push({width,height,dark,passed:true,verifiedWrites:writes.length,seriousViolations:serious.length,seriousQueueViolations:queueSerious.length,reloadPreserved:true,preflightConflictBlocked:true,priorityClearsConflictingSearch:true,ordinaryFilterPreservesSearch:true,returnFocusWithoutSave:true,returnFocusAfterSave:true,lateRefreshDoesNotStealFocus:true,filtersSurviveSave:true});
  }catch(error){await page.screenshot({path:`${folder}/failure-${width}.png`,fullPage:true}).catch(()=>{});results.push({width,height,dark,passed:false,reason:error.message,errors,writes});}
  finally{releaseList?.();await context.close();}
 }
 const report={syntheticTransport:true,syntheticPersistence:true,realFollowUpApi:true,realAuthentication:false,results};
 await writeFile(`${folder}/browser-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.ok(results.every(result=>result.passed),'Follow-up browser checks failed');
}finally{await browser?.close();await server.close();}
