// Real boundary/gate/CSS; API responses synthetic, not institutional acceptance.
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
process.env.VITE_BACKEND_BOOTSTRAP_GATE_ENABLED='true';
process.env.VITE_EXPECTED_BACKEND_REVISION='a'.repeat(40);
const server=await createServer({cacheDir:'.vercel/startup-cache',server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;const results=[];const errors=[];
try{
 await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 await mkdir('.vercel/startup-evidence',{recursive:true});
 browser=await chromium.launch(process.platform==='win32'?{channel:'chrome',headless:true}:{headless:true});
 for(const [width,mode] of [[1440,'unavailable'],[820,'mismatch'],[390,'offline'],[320,'waiting']]){
  const context=await browser.newContext({viewport:{width,height:940},reducedMotion:'reduce',colorScheme:width===390?'dark':'light'});
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(dark=>{document.addEventListener('DOMContentLoaded',()=>document.documentElement.classList.toggle('dark',dark));},width===390);
  let healthy=false,calls=0;const held=[];
  const ready={backend:'a'.repeat(40),frontend:'web'};
  await page.route('**/api/version',async route=>{
   calls++;
   if(healthy)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(ready)});
   if(mode==='unavailable')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"synthetic outage"}'});
   if(mode==='mismatch')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...ready,backend:'b'.repeat(40)})});
   held.push(route);
  });
  await page.goto(origin+'/tests/e2e/fixtures/startup-runtime.html',{waitUntil:'domcontentloaded'});
  const card=page.getByTestId('startup-recovery');await card.waitFor();
  if(mode==='offline'){
   await context.setOffline(true);await page.getByRole('heading',{name:'Parece que estás sin conexión'}).waitFor();
  }else if(mode==='waiting')await page.getByRole('heading',{name:'Tu espacio sigue preparándose'}).waitFor();
  else await page.getByRole('alert').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.getByRole('progressbar').count(),0);
  if(mode==='waiting') {
   assert.equal(await card.locator('svg').nth(1).evaluate(el=>getComputedStyle(el).animationName),'none');
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.evaluate(()=>document.documentElement.classList.add('a11y-reduced-motion'));
   assert.equal(await card.locator('svg').nth(1).evaluate(el=>getComputedStyle(el).animationName),'none');
  }
  await page.screenshot({path:`.vercel/startup-evidence/startup-${width}-${mode}.png`,fullPage:true});
  if(mode==='unavailable'||mode==='mismatch'){
   healthy=true;const retry=page.getByRole('button',{name:'Reintentar inicio'});
   await page.keyboard.press('Tab');await expect(retry).toBeFocused();await page.keyboard.press('Enter');
   await page.getByRole('heading',{name:'Workspace fixture'}).waitFor();assert.equal(calls,2);
   await page.getByRole('textbox').fill('Pending work');await context.setOffline(true);await context.setOffline(false);
   await expect(page.getByRole('textbox')).toHaveValue('Pending work');assert.equal(calls,2);
  }else{
   healthy=true;
   for(const route of held)await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(ready)}).catch(()=>{});
   if(mode==='offline')await context.setOffline(false);
   await page.getByRole('heading',{name:'Workspace fixture'}).waitFor();
  }
  results.push({width,mode,passed:true,synthetic_api:true});await context.close();
 }
 assert.deepEqual(errors,[]);
 await writeFile('.vercel/startup-evidence/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();await server.close();}
