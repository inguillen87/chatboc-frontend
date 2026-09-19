import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5197';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5197','--strictPort'],{stdio:'ignore'});
let browser;
try {
  let ready=false;
  for(let n=0;n<40;n++){
    if(server.exitCode!==null) throw new Error('test_server_exit');
    try { const r=await fetch(origin); if(r.ok){ready=true;break;} } catch {}
    await new Promise(r=>setTimeout(r,250));
  }
  assert.ok(ready,'loopback_server_ready');
  await mkdir('.vercel/profile-evidence',{recursive:true});
  browser=await chromium.launch(process.platform==='win32'?{channel:'chrome',headless:true}:{headless:true});
  const results=[];
  for(const [width,height,dark] of [[1440,1000,false],[820,1100,false],[390,844,true],[320,780,false]]){
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/tests/e2e/fixtures/organization-profile.html');
    if(dark) await page.evaluate(()=>document.documentElement.classList.add('dark'));
    await page.getByText('Perfil del colegio',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByRole('button',{name:'Guardar',exact:true}).click();
    assert.equal(await page.getByTestId('saved').innerText(),'1');
    await page.getByTestId('institution-profile-section-channels').click();
    await page.getByLabel('Tipo de prueba').selectOption('municipio');
    await page.getByText('Perfil del municipio',{exact:true}).waitFor();
    assert.match(await page.getByTestId('organization-profile-guidance').innerText(),/Ya existe un registro de WhatsApp/);
    await page.getByRole('button',{name:'Cambiar permiso'}).click();
    assert.equal(await page.getByRole('button',{name:'Guardar',exact:true}).isDisabled(),true);
    assert.equal(await page.getByLabel('Nombre de referencia').isDisabled(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const bounds=await page.getByTestId('institution-profile-workspace').evaluate(form=>{
      const title=form.querySelector('h2').getBoundingClientRect();
      return {scrollLeft:form.scrollLeft,titleLeft:title.left,titleRight:title.right};
    });
    assert.equal(bounds.scrollLeft,0,'the form must not scroll horizontally when its navigation scrolls');
    assert.ok(bounds.titleLeft>=0 && bounds.titleRight<=width,'organization title stays visible');
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:`.vercel/profile-evidence/profile-${width}.png`,fullPage:true});
    assert.deepEqual(errors,[]);
    results.push({width,height,dark,passed:true,synthetic:true,physical_device:false});
    await context.close();
  }
  await writeFile('.vercel/profile-evidence/results.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
} finally {
  if(browser) await browser.close();
  server.kill(); // Only the loopback test server spawned by this script.
}
