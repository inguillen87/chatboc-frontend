import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
let input='';for await(const chunk of process.stdin)input+=chunk;
const settings=JSON.parse(input),backend=new URL(settings.backendOrigin);
assert.equal(backend.hostname,'127.0.0.1');assert.equal(backend.protocol,'http:');
const providers=path.resolve('tests/e2e/fixtures/unified-login.providers.tsx');
const mocked=['hooks/useUser','context/TenantContext','hooks/useDateSettings','components/auth/GoogleLoginButton','components/auth/ClerkAuthButtons','services/passkeys','services/enterpriseService','api/rubros','features/demo/demoApi'];
const server=await createServer({configFile:false,cacheDir:'.vercel/unified-login-cache',optimizeDeps:{entries:['tests/e2e/fixtures/unified-login.html']},plugins:[react(),{name:'local-auth-fixture',configureServer(server){server.middlewares.use((req,res,next)=>{
  if(req.headers.accept?.includes('text/html')&&/^\/(?:login|perfil|t\/[^/]+\/login)(?:\?|$)/.test(req.url))req.url='/tests/e2e/fixtures/unified-login.html';next();
});}}],resolve:{dedupe:['react','react-dom'],alias:[{find:'@/utils/api',replacement:path.resolve('tests/e2e/fixtures/unified-login.transport.ts')},...mocked.map(name=>({find:'@/'+name,replacement:providers})),{find:'@',replacement:path.resolve('src')}]},
server:{host:'127.0.0.1',port:0,proxy:{'/auth':{target:backend.origin,changeOrigin:true},'/api':{target:backend.origin,changeOrigin:true}}},logLevel:'error'});
const evidence=path.resolve(settings.evidence);let browser;const results=[];
try{
  await mkdir(evidence,{recursive:true});await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({headless:true});
  for(const [width,height,dark] of [[1440,1050,false],[390,844,true],[320,740,false]]){
    const context=await browser.newContext({viewport:{width,height},locale:'es-AR',reducedMotion:'reduce',serviceWorkers:'block'});
    const attempts=[],errors=[];
    await context.addInitScript(()=>{
      if(!sessionStorage.getItem('fixture-seeded')){
        localStorage.setItem('tenantSlug','previous-public-space');localStorage.setItem('entityToken','old-widget');localStorage.setItem('authToken','old-session');
        localStorage.setItem('user',JSON.stringify({id:999,rol:'superadmin',tenant_slug:'previous-public-space',organization_profile:{name:'Previous brand'}}));
        sessionStorage.setItem('fixture-seeded','yes');
      }
    });
    await context.route('**/*',route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin!==origin)return route.abort();
      if(request.method()==='POST'&&url.pathname==='/auth/admin/login'){
        const body=request.postDataJSON();attempts.push({tenant:body.tenant_slug||null,authorization:request.headers().authorization||null,entityHeader:request.headers()['x-entity-token']||null});
        return route.continue();
      }
      if(!['GET','HEAD','OPTIONS'].includes(request.method()))return route.abort();
      return route.continue();
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    const fill=async()=>{await page.getByRole('textbox',{name:'Correo electrónico'}).fill(settings.email);await page.getByLabel('Contraseña',{exact:true}).fill(settings.password);};
    try{
      await page.goto(origin+'/login');if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
      await fill();await page.screenshot({path:path.join(evidence,`login-${width}-central.png`),fullPage:true});
      await page.getByRole('button',{name:'Iniciar Sesión',exact:true}).click();
      await expect(page.getByTestId('account-tenant')).toHaveText('acceptance-a');await expect(page.getByTestId('account-id')).toHaveText(String(settings.userId));
      assert.equal(attempts[0].tenant,null);assert.equal(attempts[0].authorization,null);assert.equal(attempts[0].entityHeader,null);
      const stored=await page.evaluate(()=>({user:JSON.parse(localStorage.getItem('user')||'{}'),entity:localStorage.getItem('entityToken')}));
      assert.equal(stored.user.id,settings.userId);assert.equal(stored.user.tenant_slug,'acceptance-a');assert.equal(stored.entity,null);assert.equal(stored.user.organization_profile,undefined);
      await page.reload();await expect(page.getByTestId('account-tenant')).toHaveText('acceptance-a');
      await page.goto(origin+'/t/acceptance-a/login');if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
      await expect(page.getByRole('heading',{name:'Ingresar a Organización acceptance-a'})).toBeVisible();await fill();
      const axe=await new AxeBuilder({page}).include('form').withTags(['wcag2a','wcag2aa']).analyze();
      const serious=axe.violations.filter(item=>['serious','critical'].includes(item.impact));
      await writeFile(path.join(evidence,`login-${width}-axe.json`),JSON.stringify(axe.violations,null,2));
      assert.deepEqual(serious.map(item=>item.id),[]);
      const size=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.viewport+1);
      await page.screenshot({path:path.join(evidence,`login-${width}-organization.png`),fullPage:true});
      await page.getByRole('button',{name:'Iniciar Sesión',exact:true}).click();await expect(page.getByTestId('account-id')).toHaveText(String(settings.userId));
      assert.equal(attempts[1].tenant,'acceptance-a');assert.equal(attempts[1].authorization,null);
      await page.goto(origin+'/t/acceptance-b/login');await fill();
      const previous=await page.evaluate(()=>localStorage.getItem('authToken'));
      await page.getByRole('button',{name:'Iniciar Sesión',exact:true}).click();await expect(page.getByRole('alert')).toContainText('otra organización');
      assert.equal(new URL(page.url()).pathname,'/t/acceptance-b/login');assert.equal(await page.evaluate(()=>localStorage.getItem('authToken')),previous);
      assert.equal(attempts.length,3);assert.deepEqual(errors,[]);
      results.push({width,height,dark,passed:true,logins:attempts.length,centralAndInstitutionalSameUser:true,reloadVerified:true,foreignEntryRejected:true});
    }catch(error){await page.screenshot({path:path.join(evidence,`login-${width}-failure.png`),fullPage:true}).catch(()=>{});results.push({width,height,dark,passed:false,reason:error.message,errors});}
    finally{await context.close();}
  }
  const report={realLoginPage:true,realAuthRoutes:true,realSessionPersistence:true,transportShim:true,optionalProviders:'synthetic',accounts:'disposable',externalIdentityProvidersTested:false,results};
  await writeFile(path.join(evidence,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  assert.ok(results.every(item=>item.passed),'Unified login acceptance failed');
}finally{await browser?.close();await server.close();}
