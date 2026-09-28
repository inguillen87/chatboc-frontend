import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder='.vercel/cart-evidence';
const replacement=path.resolve('tests/e2e/fixtures/cart-session.transport.ts');
const server=await createServer({configFile:false,plugins:[react()],cacheDir:'.vercel/cart-cache',optimizeDeps:{entries:['tests/e2e/fixtures/cart-session.html']},resolve:{alias:[{find:/^@\/utils\/(api|frontendTelemetry)$/,replacement},{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:0},logLevel:'error'});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
let browser;const results=[];
try{
 await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 await mkdir(folder,{recursive:true});browser=await chromium.launch({headless:true});
 for(const [width,height,dark] of [[1440,1000,false],[390,844,true],[320,740,false]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  const requests=[],errors=[];let readGate=deferred(),writeGate=null,readFailure=false;
  const quantities={'qa-a':1,'qa-b':7,'qa-c':2,'qa-d':4};
  const snapshot=(tenant,quantity)=>({items:[{id:'product-1',product_id:'product-1',name:'Producto '+tenant,quantity,price:10,currency:'ARS'}],totalAmount:quantity*10,totalPoints:0,customer_profile:{name:'Cliente '+tenant},checkout_options:{payment_required:true,gateway_configured:true},checkout_preview:{amount_validated:true,payment_ready:true,stock_status:'available'},mercadopago_ready:true});
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==origin)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();
   const tenant=decodeURIComponent(request.headers()['x-qa-tenant-uri']??'');requests.push({path:url.pathname,method:request.method(),tenant,body:request.postDataJSON()});
   if(url.pathname.includes('/productos/'))return route.fulfill({json:{id:'product-1',name:'Producto '+tenant,price:10,currency:'ARS',amount_validated:true,available_to_sell:true,stock_status:'validated',stock_quantity:20}});
   if(url.pathname.endsWith('/carrito')){
    if(request.method()==='POST'){
     const gate=writeGate,body=request.postDataJSON();if(gate)await gate.promise;
     quantities[tenant]=(quantities[tenant]??0)+Number(body.quantity??body.cantidad);
     return route.fulfill({json:snapshot(tenant,quantities[tenant])});
    }
    const gate=readGate,fail=readFailure,quantity=quantities[tenant]??0;if(gate)await gate.promise;
    if(fail)return route.fulfill({status:503,json:{error:'Synthetic unavailable cart'}});
    return route.fulfill({json:snapshot(tenant,quantity)});
   }
   return route.fulfill({status:404,json:{error:'Unexpected test endpoint'}});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const writes=()=>requests.filter(request=>request.method==='POST');
  const stored=tenant=>page.evaluate(tenant=>JSON.parse(localStorage.getItem('chatboc_market_cart_'+tenant)||'null'),tenant);
  try{
   await page.goto(origin+'/tests/e2e/fixtures/cart-session.html');if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
   const commerce=page.getByTestId('market-product-commerce-panel');
   const add=page.getByRole('button',{name:'Agregar al carrito',exact:true});
   await expect(page.getByRole('button',{name:'Agregando...',exact:true})).toBeDisabled();
   await expect(page.getByRole('button',{name:'Sumar cantidad'})).toBeDisabled();
   readGate.resolve();readGate=null;await expect(add).toBeEnabled();await expect(commerce).toContainText('1 en carrito');
   writeGate=deferred();await add.evaluate(button=>{button.dispatchEvent(new MouseEvent('click',{bubbles:true}));button.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
   await expect.poll(()=>writes().length).toBe(1);await expect(page.getByRole('button',{name:'Agregando...',exact:true})).toBeDisabled();
   await expect(page.getByRole('button',{name:'Sumar cantidad'})).toBeDisabled();
   writeGate.resolve();writeGate=null;await expect(add).toBeEnabled();await expect(commerce).toContainText('2 en carrito');
   await expect(commerce).toContainText('Agregado al carrito.');assert.equal((await stored('qa-a')).items[0].quantity,2);
   await add.click();await expect(commerce).toContainText('3 en carrito');assert.equal(writes().length,2);
   const axe=await new AxeBuilder({page}).include('[data-testid="market-product-commerce-panel"]').withTags(['wcag2a','wcag2aa']).analyze();
   const serious=axe.violations.filter(issue=>['critical','serious'].includes(issue.impact));
   await writeFile(`${folder}/product-${width}-axe.json`,JSON.stringify(axe.violations,null,2));
   assert.deepEqual(serious.map(issue=>({id:issue.id,nodes:issue.nodes.map(node=>node.target)})),[]);
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1,'Product horizontal overflow');
   await page.screenshot({path:`${folder}/added-${width}.png`,fullPage:true});
   writeGate=deferred();await add.click();await expect.poll(()=>writes().length).toBe(3);
   await page.evaluate(()=>window.__gotoCartProduct('qa-b'));await expect(commerce).toContainText('7 en carrito');
   const oldWriteResponse=page.waitForResponse(response=>response.url().endsWith('/api/qa-a/carrito')&&response.request().method()==='POST');
   writeGate.resolve();writeGate=null;await (await oldWriteResponse).finished();
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
   await expect(add).toBeEnabled();await expect(commerce).toContainText('7 en carrito');
   assert.equal((await stored('qa-a')).items[0].quantity,3,'Retired write must not repersist the former tenant');
   readGate=deferred();await page.evaluate(()=>window.__gotoCartProduct('qa-c'));
   await expect.poll(()=>requests.filter(request=>request.path==='/api/qa-c/carrito').length).toBe(1);
   const oldRead=readGate;readGate=null;await page.evaluate(()=>window.__gotoCartProduct('qa-d'));
   await expect(commerce).toContainText('4 en carrito');
   const oldReadResponse=page.waitForResponse(response=>response.url().endsWith('/api/qa-c/carrito'));oldRead.resolve();await (await oldReadResponse).finished();
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
   await expect(commerce).toContainText('4 en carrito');
   assert.equal(await stored('qa-c'),null,'A retired GET must not populate browser storage');
   readFailure=true;await page.evaluate(()=>window.__gotoCartProduct('qa-b'));
   await expect(commerce).toContainText('No se pudo actualizar el carrito');await expect(commerce).not.toContainText('7 en carrito');
   assert.deepEqual((await stored('qa-b')).items,[]);
   readFailure=false;await add.click();await expect(commerce).toContainText('8 en carrito');await expect(commerce).not.toContainText('No se pudo actualizar el carrito');
   assert.equal(writes().length,4);assert.deepEqual(errors,[]);
   assert.ok(writes().every(request=>request.path.endsWith('/carrito')),'No checkout or payment writes are part of this test');
   assert.deepEqual(writes().map(request=>request.tenant),['qa-a','qa-a','qa-a','qa-b']);
   const unicodeTenant='peñalolén';quantities[unicodeTenant]=1;
   await page.evaluate(tenant=>window.__gotoCartProduct(tenant),unicodeTenant);
   await expect(add).toBeEnabled();await expect(commerce).toContainText('1 en carrito');
   await add.click();await expect(commerce).toContainText('2 en carrito');
   assert.equal(writes().length,5);assert.equal(writes().at(-1).tenant,unicodeTenant);
   assert.equal(writes().at(-1).path,'/api/'+encodeURIComponent(unicodeTenant)+'/carrito');
   assert.equal((await stored(unicodeTenant)).items[0].quantity,2);
   assert.deepEqual(errors,[]);
   await page.screenshot({path:`${folder}/unicode-${width}.png`,fullPage:true});
   results.push({width,height,dark,passed:true,cartAdds:writes().length,initialReadBlocksActions:true,duplicateAddBlocked:true,quantityLocked:true,retiredAddDoesNotPersist:true,retiredReadDoesNotPersist:true,currentFailureRevokesSnapshot:true,recoveryFromBackend:true,unicodeTenantPreserved:true,seriousAccessibilityViolations:serious.length});
  }catch(error){await page.screenshot({path:`${folder}/failure-${width}.png`,fullPage:true}).catch(()=>{});results.push({width,height,dark,passed:false,reason:error.message,errors,requests});}
  finally{readGate?.resolve();writeGate?.resolve();await context.close();}
 }
 const report={syntheticData:true,productionBackend:false,realPayment:false,realProductPage:true,realMarketApi:true,realCartProvider:true,results};
 await writeFile(`${folder}/browser-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.ok(results.every(result=>result.passed),'Cart session browser checks failed');
}finally{await browser?.close();await server.close();}
