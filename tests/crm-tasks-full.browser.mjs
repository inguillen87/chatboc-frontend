import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
let input='';for await(const part of process.stdin)input+=part;const settings=JSON.parse(input);
const backend=new URL(settings.origin);assert.equal(backend.hostname,'127.0.0.1');assert.equal(backend.protocol,'http:');
const evidence=path.resolve(settings.evidence);await mkdir(evidence,{recursive:true});
const server=await createServer({configFile:false,plugins:[react()],cacheDir:'.vercel/tasks-browser-cache',optimizeDeps:{entries:['tests/e2e/fixtures/crm-tasks.html']},resolve:{alias:[{find:'@/utils/api',replacement:path.resolve('tests/e2e/fixtures/crm-tasks.transport.ts')},{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:backend.origin,changeOrigin:true,headers:{Authorization:settings.authorization}}}},logLevel:'error'});
let browser;const results=[];
try{
 await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;browser=await chromium.launch({headless:true});
 for(const [index,[width,height,dark]] of [[1440,1050,false],[390,844,true],[320,740,false]].entries()){
  const context=await browser.newContext({viewport:{width,height},locale:'es-AR',reducedMotion:'reduce',timezoneId:'America/Argentina/Buenos_Aires'});
  const writes=[],errors=[],contact=settings.contacts[index];
  await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();
   if(['POST','PATCH'].includes(request.method())){if(!url.pathname.startsWith(`/api/admin/tenants/acceptance-a/contacts/${contact}/tasks`))return route.abort();writes.push({method:request.method(),payload:request.postDataJSON(),key:request.headers()['idempotency-key']});}
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  try{
   const url=`${origin}/tests/e2e/fixtures/crm-tasks.html?tenant=acceptance-a&contact=${contact}`;
   await page.goto(url);if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
   await page.getByRole('button',{name:'Tareas del contacto'}).click();
   await page.getByRole('button',{name:'Crear tarea',exact:true}).click();
   await page.getByLabel('Título',{exact:true}).fill('Tarea principal QA');await page.getByLabel('Descripción',{exact:true}).fill('Trabajo coordinado con el contacto.');
   await page.getByLabel('Responsable',{exact:true}).selectOption(String(settings.assigneeId));await page.getByLabel('Vencimiento',{exact:true}).fill('2026-10-03T12:30');
   await page.getByLabel('Motivo del cambio',{exact:true}).fill('Plan de trabajo');await page.getByRole('button',{name:'Revisar cambios'}).click();
   const confirm=page.getByRole('alertdialog',{name:'Confirmar tarea'});await confirm.getByRole('button',{name:'Volver sin guardar'}).click();assert.equal(writes.length,0);
   await page.getByRole('button',{name:'Revisar cambios'}).click();await confirm.getByRole('button',{name:'Guardar cambios'}).click();
   await expect(page.getByRole('button',{name:'Abrir tarea Tarea principal QA'})).toBeVisible();assert.equal(writes.length,1);assert.ok(writes[0].key);
   await page.getByRole('button',{name:'Crear tarea',exact:true}).click();await page.getByLabel('Título',{exact:true}).fill('Segunda tarea QA');
   await page.getByRole('button',{name:'Revisar cambios'}).click();await confirm.getByRole('button',{name:'Guardar cambios'}).click();
   await expect(page.getByRole('button',{name:'Abrir tarea Segunda tarea QA'})).toBeVisible();assert.equal(writes.length,2);
   await page.getByRole('button',{name:'Abrir tarea Tarea principal QA'}).click();
   await expect(page.getByLabel('Responsable',{exact:true})).toHaveValue(String(settings.assigneeId));await page.getByLabel('Estado',{exact:true}).selectOption('done');
   await page.getByLabel('Motivo del cambio',{exact:true}).fill('Trabajo terminado');await page.getByRole('button',{name:'Revisar cambios'}).click();
   await confirm.getByRole('button',{name:'Guardar cambios'}).click();await expect(page.getByRole('button',{name:'Abrir tarea Tarea principal QA'})).toContainText('Completada');
   assert.equal(writes.length,3);assert.equal(writes[2].payload.expected_revision,1);
   await page.reload();if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
   await page.getByRole('button',{name:'Tareas del contacto'}).click();await page.getByRole('button',{name:'Abrir tarea Tarea principal QA'}).click();
   await expect(page.getByLabel('Estado',{exact:true})).toHaveValue('done');await expect(page.getByLabel('Título',{exact:true})).toBeDisabled();
   await page.locator('.task-history summary').click();await expect(page.locator('.task-history')).toContainText('Trabajo terminado');
   await expect(page.locator('.task-history')).toContainText('Versión 2');
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1,'Horizontal overflow');
   assert.equal(await page.locator('.task-workspace').evaluate(element=>getComputedStyle(element).animationName),'none');
   const axe=await new AxeBuilder({page}).include('.task-workspace').withTags(['wcag2a','wcag2aa']).analyze();
   const serious=axe.violations.filter(item=>['serious','critical'].includes(item.impact));await writeFile(path.join(evidence,`tasks-${width}-axe.json`),JSON.stringify(axe.violations,null,2));
   assert.deepEqual(serious.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.target)})),[]);
   await page.screenshot({path:path.join(evidence,`tasks-${width}.png`),fullPage:true});assert.deepEqual(errors,[]);
   results.push({width,height,dark,passed:true,writes:writes.length,reloadVerified:true,historyVerified:true,seriousViolations:serious.length});
  }catch(error){await page.screenshot({path:path.join(evidence,`tasks-${width}-failure.png`),fullPage:true}).catch(()=>{});results.push({width,height,dark,passed:false,reason:error.message,errors,writes:writes.length});}
  finally{await context.close();}
 }
 const report={originalBackendRoutes:true,disposableDatabase:true,syntheticAccounts:true,transportShim:true,externalAuthenticationVerified:false,results};
 await writeFile(path.join(evidence,'tasks-browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.ok(results.every(result=>result.passed),'Task browser acceptance failed');
}finally{await browser?.close();await server.close();}
