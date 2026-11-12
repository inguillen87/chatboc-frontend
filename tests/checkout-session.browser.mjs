import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder='.vercel/checkout-evidence';
const replacement=path.resolve('tests/e2e/fixtures/checkout-session.transport.ts');
const server=await createServer({configFile:false,plugins:[react()],cacheDir:'.vercel/checkout-cache',optimizeDeps:{entries:['tests/e2e/fixtures/checkout-session.html']},resolve:{alias:[{find:/^@\/utils\/(api|frontendTelemetry)$/,replacement},{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:0},logLevel:'error'});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
let browser;const results=[];
try{
 await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 await mkdir(folder,{recursive:true});browser=await chromium.launch({headless:true});
 for(const [width,height,dark] of [[1440,1000,false],[390,844,true],[320,740,false]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  const requests=[],errors=[];let previewMode='error',startMode='valid',refreshFails=false,previewGate=null,startGate=null;
  await context.addInitScript(()=>localStorage.setItem('chatboc_market_checkout_state_qa-a',JSON.stringify({status:'success',paymentUrl:'https://forged.example.test',orderId:'FORGED',message:'FORGED RECEIPT',contact:{name:'PRIVATE STORED NAME',phone:'999'}})));
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==origin)return route.abort();
   if(!url.pathname.startsWith('/api/'))return route.continue();
   const tenant=request.headers()['x-qa-tenant'];requests.push({path:url.pathname,tenant,method:request.method(),body:request.postDataJSON()});
   if(url.pathname.endsWith('/carrito')){
    if(refreshFails)return route.fulfill({status:503,json:{error:'PRIVATE CART ERROR'}});
    return route.fulfill({json:{items:[{id:'product-1',product_id:1,name:'Producto de prueba',quantity:2,price:100,currency:'ARS'}],totalAmount:200,totalPoints:0,customer_profile:{name:'Cliente '+tenant,phone:'12345'},checkout_options:{requires_contact_or_auth:true,payment_required:true,gateway_configured:true},checkout_preview:{contact_ready:true,payment_required:true,payment_ready:true,amount_validated:true,stock_status:'available'}}});
   }
   if(url.pathname==='/api/v2/payments/checkout-preview'){
    const mode=previewMode,gate=previewGate;if(gate)await gate.promise;
    if(mode==='error')return route.fulfill({status:503,json:{error:'PRIVATE PREVIEW ERROR'}});
    return route.fulfill({json:{payment_required:true,payment_ready:true,contact_ready:true,amount_validated:true,stock_status:'available'}});
   }
   if(url.pathname==='/api/v2/payments/checkout-session'){
    const mode=startMode,gate=startGate;if(gate)await gate.promise;
    const response={contract_version:'payments.checkout_session.v1',preference_id:'pref-'+tenant,order_id:'81',status:'pending',init_point:mode==='unsafe'?'javascript:alert(1)':'https://checkout.example.test/'+tenant,message:'Continuar con el proveedor'};
    if(mode==='url-only'){delete response.order_id;delete response.preference_id;delete response.status;}
    if(mode==='preference-only'){delete response.order_id;delete response.init_point;delete response.status;}
    if(mode==='valid')refreshFails=true;
    return route.fulfill({json:response});
   }
   return route.fulfill({status:404,json:{error:'Unexpected synthetic endpoint'}});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const starts=()=>requests.filter(request=>request.path==='/api/v2/payments/checkout-session');
  const previews=()=>requests.filter(request=>request.path==='/api/v2/payments/checkout-preview');
  const changeTenant=async tenant=>{refreshFails=false;await page.evaluate(tenant=>window.__gotoCheckout(tenant),tenant);await expect(page.getByLabel('Nombre',{exact:true})).toHaveValue('Cliente '+tenant);};
  try{
   await page.goto(origin+'/tests/e2e/fixtures/checkout-session.html');if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
   const start=page.getByRole('button',{name:'Iniciar checkout',exact:true});
   await expect(start).toBeEnabled();await expect(page.getByLabel('Nombre',{exact:true})).toHaveValue('Cliente qa-a');
   await expect(page.locator('body')).not.toContainText('FORGED');await expect(page.getByRole('link',{name:'Continuar al pago'})).toHaveCount(0);
   assert.equal(await page.evaluate(()=>localStorage.getItem('chatboc_market_checkout_state_qa-a')),null);
   previewGate=deferred();await start.evaluate(button=>{button.dispatchEvent(new MouseEvent('click',{bubbles:true}));button.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
   await expect.poll(()=>previews().length).toBe(1);assert.equal(starts().length,0);
   await expect(page.getByLabel('Nombre',{exact:true})).toBeDisabled();await expect(page.getByLabel('Teléfono',{exact:true})).toBeDisabled();
   previewGate.resolve();previewGate=null;
   await expect(page.getByTestId('checkout-outcome')).toBeFocused();await expect(page.getByTestId('checkout-outcome')).toBeInViewport();
   await expect(page.locator('body')).not.toContainText('PRIVATE PREVIEW ERROR');
   previewMode='valid';await page.getByRole('button',{name:'Reintentar',exact:true}).click();
   assert.equal(previews().length,1);await page.getByLabel('Teléfono',{exact:true}).press('Enter');
   const pay=page.getByRole('link',{name:'Continuar al pago'});
   await expect(pay).toHaveAttribute('href','https://checkout.example.test/qa-a');
   await expect(page.getByTestId('checkout-outcome')).toBeFocused();await expect(page.getByTestId('checkout-outcome')).toBeInViewport();
   await expect.poll(()=>requests.filter(request=>request.path==='/api/qa-a/carrito').length).toBe(2);
   await expect(pay).toBeVisible();await expect(start).toBeDisabled();assert.equal(starts().length,1);
   await expect(page.locator('body')).not.toContainText('Carrito vacío');
   assert.deepEqual(starts()[0].body,{items:[{id:'product-1',product_id:1,catalogo_item_id:1,catalog_item_id:1,quantity:2,cantidad:2}],customer:{name:'Cliente qa-a',phone:'12345'}});
   assert.equal(starts()[0].tenant,'qa-a');assert.equal(await page.evaluate(()=>localStorage.getItem('chatboc_market_checkout_state_qa-a')),null);
   const axe=await new AxeBuilder({page}).include('form').include('[data-testid="checkout-outcome"]').withTags(['wcag2a','wcag2aa']).analyze();
   const serious=axe.violations.filter(issue=>['critical','serious'].includes(issue.impact));await writeFile(`${folder}/checkout-${width}-axe.json`,JSON.stringify(axe.violations,null,2));
   assert.deepEqual(serious.map(issue=>({id:issue.id,nodes:issue.nodes.map(node=>node.target)})),[]);
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1,'Checkout horizontal overflow');
   await page.screenshot({path:`${folder}/accepted-${width}.png`,fullPage:true});
   startMode='unsafe';await changeTenant('qa-b');await expect(pay).toHaveCount(0);await start.click();
   await expect(page.getByTestId('checkout-outcome')).toContainText('No pudimos iniciar el checkout');await expect(pay).toHaveCount(0);await expect(start).toBeDisabled();
   await expect(page.getByRole('button',{name:'Reintentar',exact:true})).toHaveCount(0);const attempted=starts().length;
   await page.getByRole('form',{name:'Datos de contacto'}).evaluate(form=>form.requestSubmit());assert.equal(starts().length,attempted);
   await page.screenshot({path:`${folder}/rejected-${width}.png`,fullPage:true});
   startMode='valid';await changeTenant('qa-c');previewGate=deferred();await start.click();
   await expect.poll(()=>previews().filter(request=>request.tenant==='qa-c').length).toBe(1);
   await changeTenant('qa-d');previewGate.resolve();previewGate=null;
   await expect(start).toBeEnabled();assert.equal(starts().filter(request=>request.tenant==='qa-c').length,0);
   startGate=deferred();await start.click();await expect.poll(()=>starts().filter(request=>request.tenant==='qa-d').length).toBe(1);
   const readsBefore=requests.filter(request=>request.path==='/api/qa-d/carrito').length;
   await changeTenant('qa-e');startGate.resolve();startGate=null;
   await expect(pay).toHaveCount(0);await expect(start).toBeEnabled();
   assert.equal(requests.filter(request=>request.path==='/api/qa-d/carrito').length,readsBefore);
   startMode='url-only';await changeTenant('qa-f');await start.click();
   await expect(pay).toHaveAttribute('href','https://checkout.example.test/qa-f');
   await expect(page.getByTestId('checkout-outcome')).not.toContainText('Orden:');
   await expect(start).toBeDisabled();
   startMode='preference-only';await changeTenant('qa-g');await start.click();
   await expect(page.getByTestId('checkout-outcome')).toContainText('Pago pendiente');
   await expect(pay).toHaveCount(0);await expect(start).toBeDisabled();
   await expect(page.getByTestId('checkout-outcome')).not.toContainText('Orden:');
   assert.deepEqual(errors,[]);
   results.push({width,height,dark,passed:true,syntheticCheckoutStarts:starts().length,previews:previews().length,duplicateSubmissionBlocked:true,localReceiptIgnored:true,keyboardSubmission:true,refreshFailurePreservesReceipt:true,unsafeUrlBlocked:true,obsoletePreviewCannotSubmit:true,lateReceiptDiscarded:true,alternativeSessionReceipts:true,seriousAccessibilityViolations:serious.length});
  }catch(error){await page.screenshot({path:`${folder}/failure-${width}.png`,fullPage:true}).catch(()=>{});results.push({width,height,dark,passed:false,reason:error.message,errors,requests});}
  finally{previewGate?.resolve();startGate?.resolve();await context.close();}
 }
 const report={syntheticData:true,productionBackend:false,realPayment:false,realCheckoutPage:true,realMarketApi:true,realCartProvider:true,results};
 await writeFile(`${folder}/browser-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.ok(results.every(result=>result.passed),'Checkout session browser checks failed');
}finally{await browser?.close();await server.close();}
