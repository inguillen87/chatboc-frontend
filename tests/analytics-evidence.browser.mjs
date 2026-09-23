import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const fixtures=JSON.parse(await readFile(new URL('./fixtures/analytics-evidence.json',import.meta.url),'utf8'));
const server=await createServer({cacheDir:'.vercel/analytics-evidence-cache',server:{host:'127.0.0.1',port:0},logLevel:'error'});
const directory='test-evidence/analytics-evidence';
let browser;
const results=[];
try {
 await mkdir(directory,{recursive:true});await server.listen();
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 browser=await chromium.launch(process.platform==='win32'?{channel:'chrome',headless:true}:{headless:true});
 for(const [width,key,dark] of [[1440,'low',false],[820,'partial',false],[390,'partial',true],[320,'synthetic',false],[390,'empty',false]]) {
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[],unexpected=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.hostname!=='127.0.0.1'||!['GET','HEAD'].includes(request.method())||url.pathname.startsWith('/api/')) {
    unexpected.push({method:request.method(),path:url.pathname});return route.abort('blockedbyclient');
   }
   return route.continue();
  });
  const copy=fixtures[key].analytics_evidence;
  await page.goto(`${origin}/tests/e2e/fixtures/analytics-evidence.html?case=${key}&dark=${dark?1:0}`);
  const panel=page.getByTestId('analytics-evidence');
  await expect(panel).toBeVisible();
  if(key==='low') {await expect(page.getByText('0,5 %',{exact:true})).toBeVisible();await expect(page.getByText('50 %',{exact:true})).toHaveCount(0);}
  if(key==='partial') {await expect(page.getByText('\u2248 80 %',{exact:true})).toBeVisible();await expect(page.getByRole('progressbar')).toHaveAttribute('value','41.67');}
  if(key==='empty') {await expect(page.getByRole('progressbar')).toHaveCount(0);await expect(page.getByText('\u2014',{exact:true})).toBeVisible();}
  assert.equal(await panel.evaluate(el=>getComputedStyle(el).animationName),'none');
  const toggle=page.locator('summary');await toggle.focus();await page.keyboard.press('Enter');
  await expect(page.locator('details')).toHaveAttribute('open','');
  for(const item of copy.limitations) await expect(page.getByRole('heading',{name:item.title,exact:true})).toBeVisible();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const bounds=await panel.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+1);
  const target=await toggle.boundingBox();assert.ok(target&&target.height>=44);
  assert.deepEqual(errors,[]);assert.ok(unexpected.every(item=>item.method==='GET'&&item.path==='/css2'), 'Only existing external font requests may be blocked');
  await page.screenshot({path:`${directory}/evidence-${width}-${key}${dark?'-dark':''}.png`,fullPage:true});
  results.push({width,scenario:key,dark,keyboard:true,allLimitationsVisible:true,overflow:false,reducedMotion:true,noApiRequests:true,blockedExternalFontRequests:unexpected.length});
  await context.close();
 }
 await writeFile(`${directory}/results.json`,JSON.stringify({backendGeneratedFixtures:true,realComponent:true,fullSpa:false,results},null,2));
 console.log(JSON.stringify(results));
} finally {await browser?.close();await server.close();}
