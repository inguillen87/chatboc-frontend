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
process.env.VITE_BACKEND_BOOTSTRAP_GATE_ENABLED = 'true';
const server = await createServer({cacheDir:'.vercel/profile-http-cache',
  server:{host:'127.0.0.1',port:0}, logLevel:'error'});
let browser;
const results=[];
const failures=[]; const requestPaths=[];
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
    page.on('request',r=>requestPaths.push(new URL(r.url()).pathname));
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
  await first.page.evaluate(()=>{
    Object.defineProperty(navigator,'onLine',{configurable:true,value:false});
    window.dispatchEvent(new Event('offline'));
  });
  await expect(first.page.getByText('Sin conexión',{exact:true})).toBeVisible();
  const resumed=first.page.waitForResponse(r=>new URL(r.url()).pathname==='/api/version');
  await first.page.evaluate(()=>{
    Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
    window.dispatchEvent(new Event('online'));
  });
  assert.equal((await resumed).status(),200);
  await expect(name).toHaveValue('Institución verificada por HTTP');
  await expect(first.page.getByText('El servicio volvió a responder',{exact:true})).toBeVisible();
  for(const width of [1440,820,390,320]) {
    await first.page.setViewportSize({width,height:900});
    await first.page.waitForTimeout(150);
    const header=await first.page.locator('.chatboc-brand-navbar').boundingBox();
    const banner=await first.page.getByTestId('runtime-recovery-bar').boundingBox();
    assert.ok(header && banner && banner.y >= header.y+header.height-1,'Status bar must not overlap fixed navbar');
    await expect(name).toHaveValue('Institución verificada por HTTP');
    await first.page.screenshot({path:`.vercel/profile-http-evidence/live-recovery-${width}.png`,fullPage:true});
  }
  await first.page.setViewportSize({width:1440,height:1000});
  await first.page.getByRole('button',{name:'Cerrar estado del servicio'}).click();
  results.push('reconnection_of_actual_spa_preserves_unsaved_profile');
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
  await second.context.close();
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
  await viewer.context.close();
  for(const [width,dark] of [[1440,false],[820,false],[390,true],[320,false]]) {
    await delegated.page.setViewportSize({width,height:900});
    await delegated.page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
    assert.equal(await delegated.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await delegated.page.screenshot({path:`.vercel/profile-http-evidence/profile-${width}.png`,fullPage:true});
  }
  results.push('actual_profile_responsive_1440_820_390_dark_320');
  await delegated.context.close();
  await first.page.goto(origin+'/implementacion?tenant_slug=acceptance-a');
  await expect(first.page.getByRole('heading',{name:'Puesta en marcha del municipio'})).toBeVisible();
  const stepNav=first.page.getByRole('navigation',{name:'Pasos de configuración'});
  await stepNav.getByRole('button',{name:/2 Canales y atención/}).click();
  await expect(first.page.getByRole('region',{name:'Detalle de Canales y atención'})).toBeVisible();
  for(const [width,dark] of [[1440,false],[820,false],[390,true],[320,false]]) {
    await first.page.setViewportSize({width,height:900});
    await first.page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
    assert.equal(await first.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await first.page.screenshot({path:`.vercel/profile-http-evidence/setup-${width}.png`,fullPage:true});
  }
  await first.page.setViewportSize({width:1440,height:1000});
  await stepNav.getByRole('button',{name:/1 Identidad del espacio/}).click();
  const identityAction=first.page.getByRole('region',{name:'Detalle de Identidad del espacio'}).getByRole('link');
  if(await identityAction.count()) {
    const href=await identityAction.getAttribute('href');
    assert.equal(new URL(href,origin).searchParams.get('tenant_slug'),'acceptance-a');
    await identityAction.click();await first.page.waitForURL(/tenant_slug=acceptance-a/);
  }
  assert.equal(requestPaths.some(path=>path.startsWith('/api/implementacion/')),false);
  results.push('real_organization_setup_server_steps_navigation_and_responsive_layout');
  await first.page.goto(origin+'/perfil?section=identity&tenant_slug=acceptance-a');
  const studio=first.page.getByTestId('brand-studio');await expect(studio).toBeVisible();
  await first.page.getByRole('checkbox',{name:'Usar mi paleta en el espacio'}).check();
  await first.page.getByRole('button',{name:'Violeta y coral',exact:true}).click();
  const pendingBrand=first.page.getByRole('group',{name:'Cambios de paleta',exact:true});
  await expect(pendingBrand.getByText('Activada',{exact:true})).toBeVisible();
  await expect(pendingBrand.getByText('Desactivada',{exact:true})).toBeVisible();
  await expect(first.page.getByTestId('brand-preview')).toHaveAttribute('data-brand-active','true');
  await first.page.getByRole('checkbox',{name:'Usar mi paleta en el espacio'}).uncheck();
  await expect(first.page.getByTestId('brand-preview')).toHaveAttribute('data-brand-active','false');
  assert.equal(await first.page.getByTestId('brand-preview').evaluate(el=>el.style.getPropertyValue('--sample-brand')),'');
  await first.page.getByRole('checkbox',{name:'Usar mi paleta en el espacio'}).check();
  const nativeClose=first.page.waitForEvent('dialog');
  const interruptedReload=first.page.reload({timeout:5000}).catch(()=>null);
  const warning=await nativeClose;assert.equal(warning.type(),'beforeunload');await warning.dismiss();
  await interruptedReload;
  await expect(first.page.getByLabel('Color principal',{exact:true})).toHaveValue('#6D28D9');
  await first.page.getByRole('button',{name:'Descartar borrador',exact:true}).click();
  await first.page.getByRole('button',{name:'Confirmar descarte',exact:true}).click();
  await expect(first.page.getByRole('button',{name:'Publicar paleta',exact:true})).toBeDisabled();
  await first.page.getByRole('checkbox',{name:'Usar mi paleta en el espacio'}).check();
  await first.page.getByRole('button',{name:'Violeta y coral',exact:true}).click();
  for(const [width,dark] of [[1440,false],[820,false],[390,true],[320,false]]) {
    await first.page.setViewportSize({width,height:900});
    await first.page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
    await pendingBrand.scrollIntoViewIfNeeded();
    assert.equal(await first.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await first.page.screenshot({path:`.vercel/profile-http-evidence/brand-comparison-${width}.png`});
    await first.page.getByRole('button',{name:'Publicar paleta',exact:true}).click();
    const dialog=first.page.getByRole('alertdialog');await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('opacity','1');
    await expect(dialog).toHaveCSS('animation-name','none');
    const confirmButton=dialog.getByRole('button',{name:'Confirmar publicación'});
    await expect.poll(()=>confirmButton.evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));})).toBe(true);
    const bounds=await dialog.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+1,'Dialog fits viewport');
    await expect(dialog.getByRole('group',{name:'Resumen de publicación'})).toBeVisible();
    await expect(dialog.getByRole('button',{name:'Confirmar publicación'})).toBeVisible();
    await first.page.screenshot({path:`.vercel/profile-http-evidence/brand-confirmation-${width}.png`});
    await dialog.getByRole('button',{name:'Seguir revisando'}).click();
    await expect(first.page.getByLabel('Color principal',{exact:true})).toHaveValue('#6D28D9');
  }
  await first.page.setViewportSize({width:1440,height:1000});
  results.push('brand_draft_discard_native_close_preview_and_comparison_four_widths');
  const brandWrite=first.page.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname.endsWith('/config'));
  await first.page.getByRole('button',{name:'Publicar paleta',exact:true}).click();
  await first.page.getByRole('button',{name:'Confirmar publicación',exact:true}).click();
  assert.equal((await brandWrite).status(),200);
  await first.page.getByText('La paleta quedó publicada y confirmada por el servidor.',{exact:true}).waitFor();
  await expect(first.page.getByTestId('institution-profile-workspace')).toHaveCSS('--org-brand','#6D28D9');
  await first.page.getByLabel('Color principal',{exact:true}).fill('#112233');
  await expect(first.page.getByText('La paleta quedó publicada y confirmada por el servidor.',{exact:true})).toHaveCount(0);
  await first.page.getByRole('button',{name:'Descartar borrador',exact:true}).click();
  await first.page.getByRole('button',{name:'Confirmar descarte',exact:true}).click();
  await first.page.reload();await expect(first.page.getByLabel('Color principal',{exact:true})).toHaveValue('#6D28D9');
  await expect(first.page.getByTestId('institution-profile-workspace')).toHaveCSS('--org-brand','#6D28D9');
  for(const [width,dark] of [[1440,false],[820,false],[390,true],[320,false]]) {
    await first.page.setViewportSize({width,height:1000});
    await first.page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
    await first.page.getByTestId('brand-studio').scrollIntoViewIfNeeded();
    assert.equal(await first.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await first.page.screenshot({path:`.vercel/profile-http-evidence/brand-${width}.png`,fullPage:true});
    await first.page.getByText('Vista previa · Sin publicar',{exact:true}).scrollIntoViewIfNeeded();
    await first.page.screenshot({path:`.vercel/profile-http-evidence/brand-preview-${width}.png`,fullPage:true});
  }
  await first.page.setViewportSize({width:1440,height:1100});
  await first.page.goto(origin+'/implementacion?tenant_slug=acceptance-a');
  await expect(first.page.getByTestId('organization-setup-workspace')).toHaveCSS('--org-brand','#6D28D9');
  await first.page.screenshot({path:'.vercel/profile-http-evidence/brand-setup.png',fullPage:true});
  await foreign.page.goto(origin+'/perfil?section=identity&tenant_slug=acceptance-b');
  await foreign.page.getByTestId('brand-studio').waitFor();
  await expect(foreign.page.getByRole('button',{name:'Publicar paleta',exact:true})).toBeDisabled();
  await expect(foreign.page.getByTestId('institution-profile-workspace')).not.toHaveCSS('--org-brand','#6D28D9');
  await first.page.goto(origin+'/perfil?section=identity&tenant_slug=acceptance-a');
  await first.page.getByTestId('brand-studio').waitFor();
  await first.page.getByText(/Historial de paleta/).click();
  await first.page.getByRole('button',{name:'Restaurar versión 0',exact:true}).click();
  await first.page.getByRole('button',{name:'Confirmar publicación',exact:true}).click();
  await first.page.getByText('La paleta quedó publicada y confirmada por el servidor.',{exact:true}).waitFor();
  await first.page.reload();await expect(first.page.getByRole('checkbox',{name:'Usar mi paleta en el espacio'})).not.toBeChecked();
  await expect(first.page.getByTestId('institution-profile-workspace')).not.toHaveCSS('--org-brand','#6D28D9');
  results.push('brand_publish_reload_setup_propagation_full_gate_and_restore');
  await first.page.goto(origin+'/implementacion?tenant_slug=acceptance-a');
  const openModules=()=>first.page.locator('summary').filter({hasText:'Elegí qué preparar en este espacio'}).click();
  await openModules();
  let modulePanel=first.page.getByTestId('organization-module-selector');
  await expect(modulePanel.getByRole('checkbox',{name:/^WhatsApp/})).toBeVisible();
  for(const name of [/^WhatsApp/,/^Encuestas/,/^Territorio/])await modulePanel.getByRole('checkbox',{name}).uncheck();
  await expect(modulePanel.getByRole('checkbox',{name:/^Cobros/})).toBeDisabled();
  await modulePanel.getByRole('checkbox',{name:/^Catálogo/}).check();await modulePanel.getByRole('checkbox',{name:/^Cobros/}).check();
  await expect(modulePanel.getByRole('checkbox',{name:/^Catálogo/})).toBeDisabled();
  await modulePanel.getByRole('button',{name:'Guardar selección',exact:true}).click();
  await first.page.getByRole('alertdialog').getByRole('button',{name:'Confirmar selección',exact:true}).click();
  await modulePanel.getByText('La selección quedó confirmada por el servidor.',{exact:true}).waitFor();
  await first.page.reload();await openModules();modulePanel=first.page.getByTestId('organization-module-selector');
  await expect(modulePanel.getByRole('checkbox',{name:/^Cobros/})).toBeChecked();
  await expect(modulePanel.getByRole('checkbox',{name:/^WhatsApp/})).not.toBeChecked();
  const selection=await first.context.request.get(origin+'/api/v2/tenants/acceptance-a/activation/channels');
  assert.deepEqual((await selection.json()).organization_setup.selected_modules,['catalog','payments']);
  for(const [width,dark] of [[1440,false],[820,false],[390,true],[320,false]]) {
    await first.page.setViewportSize({width,height:900});
    await first.page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
    await modulePanel.scrollIntoViewIfNeeded();
    assert.equal(await first.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await first.page.evaluate(()=>{document.activeElement?.blur?.();window.scrollTo({top:0,behavior:'instant'});});
    await first.page.screenshot({path:`.vercel/profile-http-evidence/modules-${width}.png`,fullPage:true});
  }
  results.push('module_selection_dependency_confirmation_persistence_and_setup_projection');
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
