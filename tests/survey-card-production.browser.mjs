// Browser acceptance for the real SurveyCard; all records and callbacks are synthetic.
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const evidence='.vercel/survey-session-evidence';
const server=await createServer({configFile:false,plugins:[react()],cacheDir:'.vercel/survey-browser-cache',optimizeDeps:{entries:['tests/e2e/fixtures/survey-card-workspace.html']},resolve:{alias:{'@':path.resolve('src')}},server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;const results=[];
try{
 await mkdir(evidence,{recursive:true});await server.listen();
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 browser=await chromium.launch({headless:true});
 for(const [width,height,dark] of [[1440,1050,false],[390,844,true],[320,740,false]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',locale:'es-AR',timezoneId:'America/Argentina/Buenos_Aires'});
  const errors=[],apiRequests=[];
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin)return route.abort();
   if(url.pathname.startsWith('/api/')){apiRequests.push(url.pathname);return route.abort();}
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto(`${origin}/tests/e2e/fixtures/survey-card-workspace.html`);
   if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
   const cards=page.locator('.survey-card');await expect(cards).toHaveCount(3);
   await expect(cards.nth(0).getByText('No informado',{exact:true})).toHaveCount(3);
   await expect(cards.nth(1).getByText('Datos no conciliados',{exact:true})).toBeVisible();
   await expect(cards.nth(2).locator('[aria-label="Métricas de participación"] dd')).toHaveText(['0','0','0']);
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(size.scroll<=size.width+1,`Horizontal overflow ${JSON.stringify(size)}`);
   for(const button of await page.locator('.survey-card button').all()){
    if(await button.isVisible())assert.ok((await button.boundingBox()).height>=43,'Button touch target too small');
   }
   const scan=await new AxeBuilder({page}).include('.survey-admin-workspace').withTags(['wcag2a','wcag2aa']).analyze();
   const serious=scan.violations.filter(issue=>['serious','critical'].includes(issue.impact));
   await writeFile(`${evidence}/cards-${width}-axe.json`,JSON.stringify(scan.violations,null,2));
   assert.deepEqual(serious.map(issue=>({id:issue.id,nodes:issue.nodes.map(node=>node.target)})),[]);
   await page.screenshot({path:`${evidence}/cards-${width}.png`,fullPage:true});
   await page.getByRole('checkbox').check();
   for(const button of await page.locator('.survey-card button').all())await expect(button).toBeDisabled();
   await page.getByRole('checkbox').uncheck();
   await cards.nth(0).getByRole('button',{name:'Cerrar participación'}).click();
   let dialog=page.getByRole('alertdialog');await expect(dialog).toContainText('ID 41');
   await dialog.getByRole('button',{name:'Volver',exact:true}).click();
   assert.equal(JSON.parse(await page.getByTestId('calls').innerText()).close,0);
   await cards.nth(0).getByRole('button',{name:'Cerrar participación'}).click();
   await dialog.getByRole('button',{name:'Cerrar definitivamente'}).click();
   await expect(dialog).not.toBeVisible();
   assert.equal(JSON.parse(await page.getByTestId('calls').innerText()).close,1);
   await cards.nth(1).getByRole('button',{name:'Borrar borrador'}).focus();
   await page.keyboard.press('Enter');dialog=page.getByRole('alertdialog');
   await expect(dialog).toContainText('ID 42');
   await dialog.getByRole('button',{name:'Eliminar',exact:true}).click();
   await expect(dialog.getByRole('alert')).toContainText('No se confirmó la operación');
   assert.equal(JSON.parse(await page.getByTestId('calls').innerText()).remove,1);
   assert.equal(await dialog.evaluate(element=>getComputedStyle(element).animationName),'none');
   const dialogScan=await new AxeBuilder({page}).include('[role="alertdialog"]').withTags(['wcag2a','wcag2aa']).analyze();
   const modalSerious=dialogScan.violations.filter(issue=>['serious','critical'].includes(issue.impact));
   await writeFile(`${evidence}/dialog-${width}-axe.json`,JSON.stringify(dialogScan.violations,null,2));
   assert.deepEqual(modalSerious.map(issue=>({id:issue.id,nodes:issue.nodes.map(node=>node.target)})),[]);
   await page.screenshot({path:`${evidence}/dialog-${width}.png`,fullPage:true});
   await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
   await expect(dialog).not.toBeVisible();
   assert.deepEqual(errors,[]);assert.deepEqual(apiRequests,[]);
   results.push({width,height,dark,passed:true,seriousViolations:serious.length,dialogSeriousViolations:modalSerious.length});
  }catch(error){await page.screenshot({path:`${evidence}/failure-${width}.png`,fullPage:true}).catch(()=>{});results.push({width,height,dark,passed:false,reason:error.message,errors});}
  finally{await context.close();}
 }
 const report={syntheticRecords:true,syntheticCallbacks:true,productionBackend:false,results};
 await writeFile(`${evidence}/browser-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.ok(results.every(result=>result.passed),'Survey card browser acceptance failed');
}finally{await browser?.close();await server.close();}
