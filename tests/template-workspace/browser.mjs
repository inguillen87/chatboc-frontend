import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = 'http://127.0.0.1:5193';
const states = ['local_draft', 'approved', 'approval_pending', 'rejected', 'stale'];
const catalog = (scope) => ({ contract_version: 'whatsapp.template_pack.catalog.v1', catalog_version: 'QA',
  tenant: { id: scope === 'qa-government' ? 1 : 2, slug: scope },
  capabilities: { read: true, materialize_local_draft: true },
  endpoints: { materialize_template: '/api/admin/whatsapp/template-packs/{vertical}/drafts' },
  frontend_contract: { copy: { title: `Plantillas ${scope}`, description: 'Ejemplos para revisar el diseño. Sin conexiones ni destinatarios reales.', provider_notice: 'No se realizan llamadas a Meta o Twilio.', materialize: 'Crear borradores locales', materialized: 'Borradores locales creados' },
    lifecycle_labels: { local_draft: 'Borrador local', approved: 'Aprobada', approval_pending: 'Aprobación pendiente', rejected: 'Rechazada', stale: 'Estado vencido' },
    blocker_labels: { approval_required: 'Revisá el contenido y la aprobación antes de enviar.' } },
  packs: ['municipio', 'empresa', 'colegio'].map((vertical) => ({ vertical, pack_id: `${vertical}_qa`, pack_version: '1.0.0', label: {municipio:'Gobierno',empresa:'Empresa',colegio:'Educación'}[vertical],
    templates: states.map((state, index) => ({ name: `${vertical}_${index}`, intent_label: ['Confirmación','Seguimiento','Turno','Pago','Derivación'][index], materialized: false,
      lifecycle: { state, production_send_allowed: state === 'approved' }, blockers: state === 'approved' ? [] : ['approval_required'],
      preview: { body: `${scope} · ${vertical}: actualización de ejemplo ${index + 1}. Este texto no describe un caso real.`, cta: { text:'Ver seguimiento',url:'https://example.test/consulta/QA-100' } } })) })) });
const browser = await chromium.launch(process.platform === 'win32' ? {channel:'chrome',headless:true} : {headless:true});
const results = []; await mkdir('.vercel/template-evidence', {recursive:true});
try {
  for (const [width,height,dark] of [[1440,1100,false],[820,1180,false],[390,844,true],[320,780,false]]) {
    const context = await browser.newContext({ viewport:{width,height}, reducedMotion:'reduce' });
    await context.addInitScript((dark) => { if (dark) document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('dark')); }, dark);
    const page = await context.newPage(); let revoked = false; let writes = 0; const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', async (route) => {
      const request = route.request(); const url = new URL(request.url());
      if (url.pathname.includes('/whatsapp/template-packs')) {
        const scope = request.headers()['x-tenant'] || request.headers()['x-tenant-slug'] || 'qa-government';
        if (revoked) return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{message:'Acceso de prueba revocado'}})});
        const data = catalog(scope);
        if (request.method() === 'POST') {
          writes++; const vertical = url.pathname.split('/').at(-2); const pack = data.packs.find((item) => item.vertical === vertical);
          pack.templates.forEach((item) => { item.materialized = true; });
          return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,provider_calls_performed:false,tenant:data.tenant,pack})});
        }
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
      }
      if (url.origin === origin) return route.continue();
      return route.abort(); // No requests to a real provider or customer backend.
    });
    await page.goto(`${origin}/tests/template-workspace/index.html`);
    await page.getByRole('heading',{name:'Plantillas qa-government',exact:true}).waitFor();
    assert.equal(await page.locator('article').count(),5);
    await page.getByLabel('Conjunto de plantillas').selectOption('empresa');
    await page.getByLabel('Estado de plantilla').selectOption('approval_pending');
    assert.equal(await page.locator('article').count(),1);
    await page.getByLabel('Estado de plantilla').selectOption('all');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.screenshot({path:`.vercel/template-evidence/workspace-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Crear borradores locales',exact:true}).click();
    await page.getByRole('button',{name:'Borradores locales creados',exact:true}).waitFor();
    assert.equal(writes,1);
    await page.getByRole('button',{name:'Cambiar organización de prueba'}).click();
    await page.getByRole('heading',{name:'Plantillas qa-company',exact:true}).waitFor();
    assert.equal(await page.getByLabel('Conjunto de plantillas').inputValue(),'municipio');
    assert.equal(await page.getByText('Plantillas qa-government',{exact:true}).count(),0);
    revoked = true;
    await page.getByRole('button',{name:'Actualizar',exact:true}).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.locator('article').count(),0);
    assert.equal(await page.getByRole('button',{name:'Crear borradores locales',exact:true}).count(),0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    assert.deepEqual(errors,[]);
    results.push({width,height,dark,synthetic:true,selectedPack:true,lifecycleFilter:true,oneWrite:true,tenantSwitch:true,revokedAccessCleared:true,horizontalOverflow:false});
    await context.close();
  }
  await writeFile('.vercel/template-evidence/results.json',JSON.stringify({physicalDevices:false,results},null,2));
  console.log(JSON.stringify({physicalDevices:false,results},null,2));
} finally { await browser.close(); }
