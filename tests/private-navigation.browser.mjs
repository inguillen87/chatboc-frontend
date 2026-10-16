import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder='.vercel/private-navigation-evidence',providers=path.resolve('tests/e2e/fixtures/private-navigation.providers.tsx');
const aliases=['@/hooks/useUser','@/context/TenantContext','@/components/access/SessionAuthorityContext','@/context/CapabilitiesContext','@/hooks/useCartCount'].map(find=>({find,replacement:providers}));
const server=await createServer({configFile:false,plugins:[react()],cacheDir:'.vercel/private-navigation-cache',optimizeDeps:{entries:['tests/e2e/fixtures/private-navigation.html']},resolve:{alias:[...aliases,{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;const results=[];
try{
 await mkdir(folder,{recursive:true});await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 browser=await chromium.launch({headless:true});
 for(const [width,height,dark] of [[1440,1000,false],[390,844,true],[320,740,false]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',locale:'es-AR'});
  if(dark)await context.addInitScript(()=>localStorage.setItem('theme','dark'));
  const requests=[],writes=[],errors=[];
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(!['GET','HEAD','OPTIONS'].includes(request.method())){writes.push(url.pathname);return route.abort();}
   if(url.origin!==origin)return route.abort();
   if(url.pathname.startsWith('/api/')||url.pathname==='/public/tenant'){requests.push(url.pathname);return route.abort();}
   if(url.pathname==='/qa-logo.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="9" fill="#21636f"/><path d="M12 36V18l12-7 12 7v18M18 36V22h12v14" fill="none" stroke="white" stroke-width="3"/></svg>'});
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto(origin+'/tests/e2e/fixtures/private-navigation.html');
   const brand=page.getByRole('link',{name:'Panel de Organización de prueba A'});
   await expect(brand).toBeVisible();await expect(brand.locator('img')).toBeVisible();
   await expect(page.getByRole('contentinfo',{name:'Información del panel privado'})).toContainText('Organización de prueba A');
   await expect(page.getByRole('link',{name:'Ver carrito'})).toHaveCount(0);
   await expect(page.getByText('Validaciones publicas de Chatboc')).toHaveCount(0);
   const axe=await new AxeBuilder({page}).include('header').include('.private-workspace-footer').withTags(['wcag2a','wcag2aa']).analyze();
   await writeFile(`${folder}/shell-${width}-axe.json`,JSON.stringify(axe.violations,null,2));
   const severe=axe.violations.filter(issue=>['serious','critical'].includes(issue.impact));assert.deepEqual(severe.map(issue=>({id:issue.id,nodes:issue.nodes.map(node=>node.target)})),[]);
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1);
   await page.screenshot({path:`${folder}/shell-${width}.png`,fullPage:true});
   if(width<768){
    const trigger=page.getByRole('button',{name:'Abrir menú'});await trigger.focus();await trigger.press('Enter');
    const nav=page.getByRole('navigation',{name:'Navegación principal móvil'});await expect(nav).toBeVisible();
    await expect(nav.getByRole('link',{name:'Carrito',exact:true})).toHaveCount(0);
    await nav.getByRole('link',{name:'Perfil y organización',exact:true}).click();
    await expect(page.getByTestId('current-route')).toHaveText('/perfil?tab=perfil');await expect(nav).toHaveCount(0);
    await expect(brand).toBeVisible();await trigger.click();await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
    await trigger.click();await page.getByRole('button',{name:'Cambiar sección'}).evaluate(button=>button.click());await expect(nav).toHaveCount(0);
    await trigger.click();await page.getByRole('button',{name:'other',exact:true}).evaluate(button=>button.click());await expect(nav).toHaveCount(0);
   }else{await page.getByRole('button',{name:'other',exact:true}).click();}
   await expect(page.getByRole('link',{name:'Panel de Organización de prueba B'})).toBeVisible();
   await expect(page.getByText('Organización de prueba A',{exact:true})).toHaveCount(0);
   assert.deepEqual(requests,[]);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
   results.push({width,height,dark,passed:true,severeViolations:severe.length,writes:writes.length,privateRequests:requests.length});
  }catch(error){
   await page.screenshot({path:`${folder}/shell-${width}-failure.png`,fullPage:true}).catch(()=>{});
   results.push({width,height,dark,passed:false,error:error.message,errors});
  }finally{await context.close();}
 }
 const report={syntheticSession:true,realNavigationComponents:true,customerAuthentication:false,results};
 await writeFile(`${folder}/browser-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.ok(results.every(result=>result.passed),'Private navigation browser validation failed');
}finally{await browser?.close();await server.close();}
