import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const fixtures = JSON.parse(await readFile(new URL('./fixtures.json', import.meta.url), 'utf8'));
const server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false } });
await server.listen();
const address = server.httpServer.address();
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'chrome', headless: true } : { headless: true });
await mkdir('.vercel/evidence/whatsapp-setup', { recursive: true });
const results = [];
try {
  for (const [name,width,height,dark] of [['desktop',1440,1000,false],['tablet',820,1180,false],['mobile',390,844,true],['small',320,780,false]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', colorScheme: dark ? 'dark' : 'light' });
    const page = await context.newPage(); const errors = []; const writes = []; let denied = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        if (request.method() !== 'GET') writes.push(url.pathname);
        if (url.pathname.endsWith('/whatsapp/tech-provider')) {
          const slug = url.pathname.split('/tenants/')[1]?.split('/')[0];
          return route.fulfill({status: denied ? 403 : 200, contentType:'application/json', body: JSON.stringify(denied ? { error: 'forbidden' } : { contract: fixtures[slug] })});
        }
        return route.fulfill({status: 403, contentType:'application/json', body:'{"error":"not_configured"}'});
      }
      if (url.origin !== origin) return route.abort();
      return route.continue();
    });
    await page.goto(origin+'/tests/whatsapp-onboarding/index.html');
    if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.getByRole('heading',{name:'Continuá con tu conexión existente'}).waitFor();
    assert.equal(await page.getByRole('link',{name:/Perfil del municipio/}).count(),1);
    assert.equal(await page.getByRole('button',{name:'Preparar activación',exact:true}).isEnabled(),false);
    assert.equal(await page.getByRole('button',{name:'Registrar sender',exact:true}).isEnabled(),false);
    assert.equal(await page.getByRole('button',{name:'Revisar conexión existente',exact:true}).isEnabled(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`.vercel/evidence/whatsapp-setup/${name}.png`,fullPage:true});
    await page.getByRole('button',{name:'Cambiar organización de prueba'}).click();
    await page.getByRole('link',{name:/Perfil de la empresa/}).waitFor();
    assert.equal(await page.locator('a[href*="qa-municipio"]').count(),0);
    denied=true;
    await page.getByRole('button',{name:'Actualizar',exact:true}).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByTestId('whatsapp-organization-context').count(),0);
    assert.deepEqual(writes,[]); assert.deepEqual(errors,[]);
    results.push({name,width,height,passed:true,existing_connection_preserved:true,tenant_switch:true,denied_read_clears:true,provider_writes:0});
    await context.close();
  }
  const report={synthetic:true,physical_devices:false,tests:results};
  await writeFile('.vercel/evidence/whatsapp-setup/results.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); await server.close(); }
