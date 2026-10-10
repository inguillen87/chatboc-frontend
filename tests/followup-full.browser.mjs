// Local-only acceptance: real follow-up API, original backend routes, disposable DB.
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
let input='';for await(const chunk of process.stdin)input+=chunk;
const settings=JSON.parse(input),backend=new URL(settings.backendOrigin);
assert.equal(backend.hostname,'127.0.0.1');assert.equal(backend.protocol,'http:');
const evidence=path.resolve(settings.evidence);await mkdir(evidence,{recursive:true});
const server=await createServer({configFile:false,plugins:[react()],cacheDir:'.vercel/followup-full-cache',optimizeDeps:{entries:['tests/e2e/fixtures/followup-workspace.html']},
 resolve:{alias:[{find:'@/utils/api',replacement:path.resolve('tests/e2e/fixtures/followup-workspace.transport.ts')},{find:'@',replacement:path.resolve('src')}]},
 server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:backend.origin,changeOrigin:true,headers:{Authorization:settings.authorization}}}},logLevel:'error'});
let browser;const mutations=[],errors=[],queries=[];
try{
 await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1280,height:960},reducedMotion:'reduce',locale:'es-AR',timezoneId:'America/Argentina/Buenos_Aires'});
 const stage=`/api/admin/tenants/${settings.tenantSlug}/contacts/${settings.contactId}/stage`;
 await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());
  if(url.origin!==origin)return route.abort();
  if(req.method()==='PATCH'&&url.pathname===stage){mutations.push(req.postDataJSON());return route.continue();}
  if(!['GET','HEAD','OPTIONS'].includes(req.method()))return route.abort();
  if(url.pathname.startsWith('/api/'))queries.push(url.pathname);
  return route.continue();
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${origin}/tests/e2e/fixtures/followup-workspace.html`);
 const open=page.getByRole('button',{name:'Seguimiento de Synthetic follow-up en acceptance-a'});
 await open.click();const notes=page.getByRole('textbox',{name:'Notas del responsable'});
 await expect(notes).toHaveValue('Contexto conservado');
 await notes.fill('Seguimiento QA integrado');await page.getByLabel('Próxima acción',{exact:true}).fill('2026-10-02T12:30');
 await page.getByRole('button',{name:'Revisar seguimiento'}).click();
 const review=page.getByRole('alertdialog',{name:'Confirmar seguimiento'});await review.getByRole('button',{name:'Volver sin guardar'}).click();
 assert.equal(mutations.length,0);await expect(notes).toHaveValue('Seguimiento QA integrado');
 await page.getByRole('button',{name:'Revisar seguimiento'}).click();await review.getByRole('button',{name:'Guardar seguimiento'}).click();
 await expect(page.getByText('Seguimiento guardado y verificado en el servidor.')).toBeVisible();
 assert.equal(mutations.length,1);assert.deepEqual(mutations[0],{owner_notes:'Seguimiento QA integrado',next_action_at:'2026-10-02T15:30:00.000Z'});
 await page.reload();await open.click();await expect(notes).toHaveValue('Seguimiento QA integrado');
 await expect(page.getByLabel('Próxima acción',{exact:true})).toHaveValue('2026-10-02T12:30');
 await expect(page.getByText('Usuario #',{exact:false})).not.toBeVisible(); // Actor is inside the explicit metadata disclosure.
 await page.locator('.followup-details summary').click();
 await expect(page.locator('.followup-details')).toContainText('Usuario #');
 assert.deepEqual(errors,[]);assert.equal(mutations.length,1);
 await page.screenshot({path:path.join(evidence,'full-http-persisted.png'),fullPage:true});
 const report={passed:true,realBackendRoutes:true,disposableDatabase:true,syntheticAccounts:true,externalClerkVerified:false,transportShim:true,mutationCount:mutations.length,reloadVerified:true,readCount:queries.length};
 await writeFile(path.join(evidence,'full-browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){await writeFile(path.join(evidence,'full-browser-failure.json'),JSON.stringify({reason:error.message,errors,mutationCount:mutations.length},null,2));throw error;}
finally{await browser?.close();await server.close();}
