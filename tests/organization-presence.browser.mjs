import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const evidence='.vercel/presence-evidence';
const server=await createServer({configFile:false,plugins:[react()],cacheDir:'.vercel/presence-browser-cache',optimizeDeps:{entries:['tests/e2e/fixtures/organization-presence.html']},
 resolve:{alias:[{find:'@/utils/api',replacement:path.resolve('tests/e2e/fixtures/organization-presence.transport.ts')},{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;const results=[];
try {
  await mkdir(evidence,{recursive:true});await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({headless:true});
  for(const [width,height,dark] of [[1440,1000,false],[390,844,true],[320,740,false]]) {
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',locale:'es-AR'});
    const calls=[],mutations=[],errors=[];let responseMode='normal';
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin!==origin)return route.abort();
      if(!['GET','HEAD','OPTIONS'].includes(request.method())){mutations.push(url.pathname);return route.abort();}
      if(url.pathname==='/api/admin/tenants/qa-presence/config'){
        calls.push(url.pathname);
        if(responseMode==='unavailable')return route.fulfill({status:503,json:{error:'Synthetic unavailable'}});
        return route.fulfill({json:{tenant:{slug:'qa-presence',nombre:'Organización de prueba',logo_url:null,theme_json:{primary:'#1c5968'}}}});
      }
      if(url.pathname==='/public/tenant'){
        calls.push(url.pathname);
        return route.fulfill({json:{tenant:{id:7,slug:'qa-presence',nombre:'Organización de prueba',logo_url:null,tema:{primary:'#1c5968'},dominio:responseMode==='without-domain'?null:'marca.example.com'}}});
      }
      return route.continue();
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    try {
      await page.goto(origin+'/tests/e2e/fixtures/organization-presence.html');
      if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
      const trigger=page.getByRole('button',{name:'Revisar organización de prueba'});
      await trigger.focus();await trigger.press('Enter');
      await expect(page.getByRole('region',{name:'Identidad publicada'})).toBeVisible();
      assert.equal(calls.length,2);assert.deepEqual(mutations,[]);
      const safeLinks=await page.locator('.presence-link a').evaluateAll(nodes=>nodes.map(node=>({href:node.href,rel:node.rel,target:node.target})));
      assert.equal(safeLinks.length,3);assert.ok(safeLinks.every(link=>link.target==='_blank'&&link.rel.includes('noreferrer')));
      const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1,'Horizontal overflow');
      assert.equal(await page.locator('.organization-presence-dialog').evaluate(element=>getComputedStyle(element).animationName),'none');
      const axe=await new AxeBuilder({page}).include('.organization-presence-dialog').withTags(['wcag2a','wcag2aa']).analyze();
      await writeFile(`${evidence}/presence-${width}-axe.json`,JSON.stringify(axe.violations,null,2));
      const severe=axe.violations.filter(issue=>['serious','critical'].includes(issue.impact));
      assert.deepEqual(severe.map(issue=>({id:issue.id,nodes:issue.nodes.map(node=>node.target)})),[]);
      await page.screenshot({path:`${evidence}/presence-${width}.png`,fullPage:true});
      responseMode='without-domain';await page.getByRole('button',{name:'Actualizar datos'}).click();
      await expect(page.getByText('El servidor no publicó un dominio propio. No se inventa una URL a partir del nombre o del identificador.')).toBeVisible();
      await expect(page.getByRole('link',{name:/Abrir Dominio declarado/})).toHaveCount(0);assert.equal(calls.length,4);
      await page.getByRole('button',{name:'Editar organización'}).click();
      await expect(page.getByTestId('destination')).toHaveText('organization-settings');await expect(page.getByRole('dialog')).toHaveCount(0);
      await trigger.click();await expect(page.getByRole('region',{name:'Identidad publicada'})).toBeVisible();
      responseMode='unavailable';await page.getByRole('button',{name:'Actualizar datos'}).click();
      await expect(page.getByRole('alert')).toContainText('No se pudieron verificar');
      await expect(page.getByRole('region',{name:'Identidad publicada'})).toHaveCount(0);
      await expect(page.locator('.presence-link')).toHaveCount(0);assert.equal(calls.length,7);
      await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
      assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
      results.push({width,height,dark,passed:true,reads:calls.length,mutations:mutations.length,seriousViolations:severe.length});
    } catch(error) {
      await page.screenshot({path:`${evidence}/presence-${width}-failure.png`,fullPage:true}).catch(()=>{});
      results.push({width,height,dark,passed:false,reason:error.message,errors,reads:calls.length});
    } finally { await context.close(); }
  }
  const report={syntheticOrganizations:true,syntheticTransport:true,credentialTesting:false,results};
  await writeFile(`${evidence}/browser-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  assert.ok(results.every(result=>result.passed),'Presence browser validation failed');
} finally { await browser?.close();await server.close(); }
