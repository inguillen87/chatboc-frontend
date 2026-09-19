// Actual SPA + disposable full Flask app. No route.fulfill, identity mocks or customer sessions.
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const backend = new URL(process.env.PROFILE_BACKEND_ORIGIN || '');
assert.equal(backend.hostname, '127.0.0.1');
assert.equal(backend.protocol, 'http:');
const accounts = JSON.parse(process.env.PROFILE_TEST_ACCOUNTS || '{}');
const password = process.env.PROFILE_TEST_PASSWORD;
assert.ok(password && accounts['acceptance-a']);
process.env.VITE_BACKEND_URL = '/api';
process.env.VITE_API_URL = '/api';
process.env.VITE_PROXY_TARGET = backend.origin;
process.env.VITE_USE_LOCAL_API_PROXY = 'true';
const server = await createServer({cacheDir:'.vercel/profile-http-cache',
  server:{host:'127.0.0.1',port:0}, logLevel:'error'});
let browser;
const results=[];
const failures=[];
try {
  await server.listen();
  const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  await mkdir('.vercel/profile-http-evidence',{recursive:true});
  browser=await chromium.launch(process.platform==='win32'?{channel:'chrome',headless:true}:{headless:true});
  async function login(account, width=1440) {
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
    await context.route('**/*', route=>new URL(route.request().url()).hostname==='127.0.0.1'
      ? route.continue() : route.abort('blockedbyclient'));
    const page=await context.newPage(); page.setDefaultTimeout(45000);
    page.on('pageerror', error=>failures.push(error.message));
    await page.goto(origin+'/login?next=%2Fperfil%3Fsection%3Dgeneral');
    await page.getByPlaceholder('Correo electrónico',{exact:true}).fill(accounts[account].email);
    await page.getByPlaceholder('Contraseña',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Iniciar Sesión',exact:true}).click();
    await page.waitForURL(/\/perfil/);
    await page.getByRole('textbox',{name:'Nombre legal o institucional'}).waitFor();
    await page.getByText('Sin cambios pendientes en el perfil institucional.',{exact:true}).waitFor();
    return {context,page};
  }
  const first=await login('acceptance-a');
  const second=await login('second');
  const name=first.page.getByRole('textbox',{name:'Nombre legal o institucional'});
  await name.fill('Institución verificada por HTTP');
  await first.page.getByRole('button',{name:'Guardar',exact:true}).click();
  await first.page.getByText('Los datos de la organización quedaron confirmados por el servidor.',{exact:true}).waitFor();
  await second.page.getByRole('textbox',{name:'Nombre legal o institucional'}).fill('Edición de segunda sesión');
  const conflict=second.page.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname.endsWith('/config'));
  await second.page.getByRole('button',{name:'Guardar',exact:true}).click();
  assert.equal((await conflict).status(),412);
  await second.page.getByRole('button',{name:'Revisar versión actual'}).click();
  const useSelection=second.page.getByRole('button',{name:'Usar selección y seguir editando'});
  await expect(useSelection).toBeDisabled();
  await second.page.getByRole('radio',{name:/Tu edición Edición de segunda sesión/}).check();
  await useSelection.click();
  await second.page.getByRole('button',{name:'Guardar',exact:true}).click();
  await second.page.getByText('Los datos de la organización quedaron confirmados por el servidor.',{exact:true}).waitFor();
  await second.page.screenshot({path:'.vercel/profile-http-evidence/resolved.png',fullPage:true});
  await first.page.reload();
  await expect(first.page.getByRole('textbox',{name:'Nombre legal o institucional'})).toHaveValue('Edición de segunda sesión');
  results.push('two_browser_sessions_explicit_conflict_resolution_and_reread');
  const delegated=await login('delegated',390);
  await expect(delegated.page.getByRole('button',{name:'Guardar',exact:true})).toBeEnabled();
  await delegated.page.getByRole('textbox',{name:'Nombre legal o institucional'}).fill('Administración delegada verificada');
  await delegated.page.getByRole('button',{name:'Guardar',exact:true}).click();
  await delegated.page.getByText('Los datos de la organización quedaron confirmados por el servidor.',{exact:true}).waitFor();
  await delegated.page.screenshot({path:'.vercel/profile-http-evidence/delegated-390.png',fullPage:true});
  results.push('tenant_scoped_administrator_can_save_without_global_role_escalation');
  const foreign=await login('acceptance-b',820);
  await expect(foreign.page.getByRole('textbox',{name:'Nombre legal o institucional'})).toHaveValue('acceptance-b');
  const foreignRead=await foreign.context.request.get(origin+'/api/admin/tenants/acceptance-a/config');
  assert.ok([403,404].includes(foreignRead.status()));
  results.push('other_organization_has_own_profile_and_cannot_read_foreign_config');
  const viewer=await login('viewer',320);
  await expect(viewer.page.getByRole('button',{name:'Guardar',exact:true})).toBeDisabled();
  await viewer.page.getByText('Podés consultar este perfil. Para modificarlo necesitás un permiso de administración en esta organización.',{exact:true}).waitFor();
  const viewerRead=await viewer.context.request.get(origin+'/api/admin/tenants/acceptance-a/config');
  assert.equal(viewerRead.status(),200);
  const readonly=(await viewerRead.json()).organization_profile;
  const forbidden=await viewer.context.request.put(origin+readonly.save_endpoint,{data:{
    expected_revision:readonly.revision, organization_profile:{nombre_empresa:'Forbidden HTTP write'}}});
  assert.equal(forbidden.status(),403);
  results.push('employee_readonly_ui_and_server_rejection');
  for(const [width,dark] of [[1440,false],[820,false],[390,true],[320,false]]) {
    await delegated.page.setViewportSize({width,height:900});
    await delegated.page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
    assert.equal(await delegated.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await delegated.page.screenshot({path:`.vercel/profile-http-evidence/profile-${width}.png`,fullPage:true});
  }
  results.push('actual_profile_responsive_1440_820_390_dark_320');
  assert.deepEqual(failures,[],'No uncaught application exceptions');
  await writeFile('.vercel/profile-http-evidence/result.json', JSON.stringify({
    full_spa:true, api_mocks:false, disposable_accounts:true, results},null,2));
  console.log(JSON.stringify({full_spa:true,api_mocks:false,results}));
} catch (error) {
  for (const [i,context] of (browser?.contexts()||[]).entries()) {
    for (const [j,page] of context.pages().entries()) {
      await page.screenshot({path:`.vercel/profile-http-evidence/failure-${i}-${j}.png`,fullPage:true}).catch(()=>{});
      await writeFile(`.vercel/profile-http-evidence/failure-${i}-${j}.txt`,
        (await page.locator('body').innerText().catch(()=>''))).catch(()=>{});
    }
  }
  console.error(error.message); process.exitCode=1;
} finally {
  await browser?.close(); await server.close();
}
