import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder='.vercel/section-recovery-evidence',providers=path.resolve('tests/e2e/fixtures/section-recovery.providers.tsx');
const mocked=['@/hooks/useUser','@/context/TenantContext','@/context/CapabilitiesContext','@/context/TicketContext','@/api/client','@/utils/api','@/utils/frontendTelemetry','@/components/tickets/NewTicketsPanel','@/components/enterprise/EnterpriseTopNav','@/components/enterprise/EnterprisePageHeader'];
const server=await createServer({configFile:false,plugins:[react()],cacheDir:'.vercel/section-recovery-cache',optimizeDeps:{entries:['tests/e2e/fixtures/section-recovery.html']},
  resolve:{alias:[...mocked.map(find=>({find,replacement:providers})),{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;const results=[];
try{
  await mkdir(folder,{recursive:true});await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({headless:true});
  for(const [width,height,dark] of [[1440,1000,false],[390,844,true],[320,740,false]]){
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',locale:'es-AR',serviceWorkers:'block'});
    const unexpected=[],expectedFaults=[],api=[],writes=[];
    await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());
      if(url.origin!==origin)return route.abort();
      if(!['GET','HEAD','OPTIONS'].includes(request.method())){writes.push(url.pathname);return route.abort();}
      if(url.pathname.startsWith('/api/')){api.push(url.pathname);return route.abort();}return route.continue();});
    const page=await context.newPage();let navigations=0;
    page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations+=1;});
    page.on('pageerror',error=>{(error.message==='synthetic-section-failure'?expectedFaults:unexpected).push(error.message);});
    try{
      await page.goto(origin+'/tests/e2e/fixtures/section-recovery.html');
      if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
      await expect(page.getByRole('button',{name:'Reintentar',exact:true})).toBeVisible();
      const notes=page.getByRole('textbox',{name:'Borrador externo al bloque'});await notes.fill('Este borrador debe conservarse');
      const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(dimensions.scroll<=dimensions.width+1);
      const violations=(await new AxeBuilder({page}).include('.section-recovery').withTags(['wcag2a','wcag2aa']).analyze()).violations;
      await writeFile(`${folder}/recovery-${width}-axe.json`,JSON.stringify(violations,null,2));
      assert.deepEqual(violations.filter(item=>['critical','serious'].includes(item.impact)).map(item=>item.id),[]);
      await page.screenshot({path:`${folder}/recovery-${width}.png`,fullPage:true});
      const host=page.locator('[data-testid=tickets-panel-root]').locator('..');
      await host.evaluate(element=>element.style.height='250px');
      const compact=await page.locator('.section-recovery').evaluate(element=>({height:element.clientHeight,scroll:element.scrollHeight}));
      assert.ok(compact.height<=250&&compact.scroll>compact.height,'Embedded recovery must remain scrollable');
      await page.getByRole('button',{name:'Reintentar',exact:true}).scrollIntoViewIfNeeded();
      await expect(page.getByRole('button',{name:'Reintentar',exact:true})).toBeInViewport();
      await host.evaluate(element=>element.style.height='580px');
      await page.getByRole('button',{name:'Preparar recuperación'}).click();
      const retry=page.getByRole('button',{name:'Reintentar',exact:true});await retry.focus();await retry.press('Enter');
      await expect(page.getByRole('heading',{name:'Reclamos recuperados'})).toBeVisible();await expect(notes).toHaveValue('Este borrador debe conservarse');
      assert.equal(navigations,1,'Retry must not reload the application');
      await page.getByRole('button',{name:'Consulta asíncrona con error'}).click();await retry.click();
      await expect(page.getByRole('button',{name:'Reintentando…'})).toBeDisabled();
      await expect(page.locator('.section-recovery').getByRole('status')).toContainText('No se pudo recuperar');
      await expect(page.getByTestId('attempts')).toHaveText('1');await expect(notes).toHaveValue('Este borrador debe conservarse');
      await page.getByRole('button',{name:'Preparar recuperación'}).click();await retry.click();
      await expect(page.getByRole('heading',{name:'Reclamos recuperados'})).toBeVisible();
      await expect(page.getByTestId('attempts')).toHaveText('2');assert.equal(navigations,1);
      await page.getByRole('button',{name:'Cambiar organización de prueba'}).click();await expect(page.getByText('Organización: org-b')).toBeVisible();
      assert.deepEqual(unexpected,[]);assert.deepEqual(writes,[]);assert.deepEqual(api,[]);
      results.push({width,height,dark,passed:true,fullPageNavigations:navigations,expectedRenderingFaults:expectedFaults.length,unexpectedErrors:unexpected.length,writes:writes.length});
    }catch(error){
      await page.screenshot({path:`${folder}/recovery-${width}-failure.png`,fullPage:true}).catch(()=>{});
      results.push({width,height,dark,passed:false,reason:error.message,unexpectedErrors:unexpected,writes});
    }finally{await context.close();}
  }
  const report={syntheticFailures:true,realTicketsPage:true,realRecoveryComponent:true,productionData:false,results};
  await writeFile(`${folder}/browser-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  assert.ok(results.every(result=>result.passed),'Section recovery browser validation failed');
}finally{await browser?.close();await server.close();}
