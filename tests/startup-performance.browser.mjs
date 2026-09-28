import {preview} from 'vite';
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {HEAVY_STARTUP_CHUNK} from '../scripts/startupGraph.mjs';

const [directory='dist',folder='.vercel/startup-evidence/browser',mode='check']=process.argv.slice(2);
const manifest=JSON.parse(await readFile(path.join(directory,'.vite/manifest.json'),'utf8'));
const chartFile=Object.values(manifest).find(chunk=>/^assets\/vendor-charts-.*\.js$/.test(chunk.file))?.file;
assert.ok(chartFile,'Chart feature must still be built');
await mkdir(folder,{recursive:true});
// Never proxy a synthetic QA request to the production backend.
const server=await preview({build:{outDir:directory},preview:{host:'127.0.0.1',port:0,strictPort:false,proxy:{}}});
const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({headless:true});
const results=[];
try{
 for(const [route,width,height,dark] of [['/login',1440,1000,false],['/login',390,844,true],['/login',320,740,false],['/portal/index.html#/portal/dashboard',390,844,false],['/iframe.html',390,844,false]]){
  const context=await browser.newContext({viewport:{width,height},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});
  const errors=[],writes=[];
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(!['GET','HEAD','OPTIONS'].includes(request.method())){writes.push({method:request.method(),path:url.pathname});return route.abort();}
   if(url.origin!==origin)return route.abort();
   if(/^\/(?:api|auth|me|admin|municipal|estadisticas|socket\.io)(?:\/|$)/.test(url.pathname))return route.fulfill({status:401,json:{error:'Synthetic unauthenticated'}});
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const session=await context.newCDPSession(page);await session.send('Network.enable');await session.send('Network.setCacheDisabled',{cacheDisabled:true});
  const id=route==='/login'?`login-${width}`:route.startsWith('/portal')?'portal':'iframe';
  try{
   const response=await page.goto(origin+route,{waitUntil:'networkidle'});assert.equal(response.status(),200);
   if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
   if(route==='/login'){
    await expect(page.getByRole('textbox',{name:'Correo electrónico'})).toBeVisible();
    await expect(page.getByLabel('Contraseña',{exact:true})).toBeVisible();
    const violations=(await new AxeBuilder({page}).include('form').withTags(['wcag2a','wcag2aa']).analyze()).violations;
    await writeFile(`${folder}/${id}-axe.json`,JSON.stringify(violations,null,2));
    assert.deepEqual(violations.filter(item=>['critical','serious'].includes(item.impact)).map(item=>item.id),[]);
   }else await expect.poll(()=>page.locator('#root').evaluate(root=>root.childElementCount)).toBeGreaterThan(0);
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(size.scroll<=size.width+1,'Horizontal overflow');
   const resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).origin===location.origin&&new URL(entry.name).pathname.endsWith('.js')).map(entry=>({path:new URL(entry.name).pathname,decodedBytes:entry.decodedBodySize,transferBytes:entry.transferSize})));
   const heavy=resources.filter(item=>HEAVY_STARTUP_CHUNK.test(item.path.slice(1))).map(item=>item.path);
   if(mode==='check')assert.deepEqual(heavy,[],'Heavy feature must not be requested while opening the shell');
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
   await page.screenshot({path:`${folder}/${id}.png`,fullPage:true});
   let chartProof=null;
   if(route==='/login'&&width===1440){
    chartProof=await page.evaluate(async chartPath=>{
     const module=await import('/'+chartPath);
     const values=Object.values(module);
     const Chart=values.find(value=>typeof value==='function'&&typeof value.register==='function'&&typeof value.getChart==='function');
     if(!Chart)throw new Error('Chart.js constructor not found in the emitted feature');
     Chart.register(...values.filter(value=>value&&['category','linear','bar'].includes(value.id)));
     const canvas=document.createElement('canvas');canvas.width=400;canvas.height=240;document.body.appendChild(canvas);
     const chart=new Chart(canvas,{type:'bar',data:{labels:['A','B','C'],datasets:[{data:[4,9,6]}]},options:{animation:false,responsive:false}});
     try{
      const elements=chart.getDatasetMeta(0).data;
      const pixels=canvas.getContext('2d').getImageData(0,0,400,240).data;
      return {bars:elements.length,finiteGeometry:elements.every(element=>Number.isFinite(element.x)&&Number.isFinite(element.y)),painted:pixels.some((value,index)=>index%4===3&&value>0)};
     }finally{chart.destroy();canvas.remove();}
    },chartFile);
    assert.deepEqual(chartProof,{bars:3,finiteGeometry:true,painted:true});assert.deepEqual(errors,[]);
   }
   results.push({route,width,height,dark,passed:true,scriptRequests:resources.length,decodedScriptBytes:resources.reduce((sum,item)=>sum+item.decodedBytes,0),heavy,chartProof,resources});
  }catch(error){
   await page.screenshot({path:`${folder}/${id}-failure.png`,fullPage:true}).catch(()=>{});
   results.push({route,width,height,dark,passed:false,error:error.message,errors,writes});
  }finally{await context.close();}
 }
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
const report={compiledProductionBuild:true,api:'synthetic-denied',credentialsSubmitted:false,serviceWorker:'blocked to isolate startup',coldCache:true,mode,results};
await writeFile(`${folder}/browser-results.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:results.map(({resources,...rest})=>rest)}));
assert.ok(results.every(result=>result.passed),'Compiled startup browser regression failed');
