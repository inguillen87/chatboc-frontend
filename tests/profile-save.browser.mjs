import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5198';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5198','--strictPort'],{stdio:'ignore'});
let browser;
try {
  let ready=false;
  for(let n=0;n<40;n++){
    if(server.exitCode!==null) throw new Error('test_server_exit');
    try { const r=await fetch(origin); if(r.ok){ready=true;break;} } catch {}
    await new Promise(r=>setTimeout(r,250));
  }
  assert.ok(ready,'loopback_server_ready');
  await mkdir('.vercel/profile-save-evidence',{recursive:true});
  browser=await chromium.launch(process.platform==='win32'?{channel:'chrome',headless:true}:{headless:true});
  const results=[];
  for(const [width,height,dark] of [[1440,1000,false],[820,1100,false],[390,844,true],[320,780,false]]){
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/tests/e2e/fixtures/profile-version-review.html');
    if(dark) await page.evaluate(()=>document.documentElement.classList.add('dark'));
    await page.getByRole('heading',{name:'Revisá los cambios antes de continuar'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Usar selección y seguir editando'}).isDisabled(),true);
    const group=page.getByRole('group',{name:'Nombre de la organización'});
    await group.getByRole('radio',{name:/Versión guardada/}).check();
    const action=page.getByRole('button',{name:'Usar selección y seguir editando'});
    await action.focus(); await page.keyboard.press('Enter');
    await page.getByRole('heading',{name:'Selección preparada, todavía sin guardar'}).waitFor();
    assert.match(await page.getByRole('status',{name:'Resultado de revisión'}).innerText(),/Nombre guardado por otra persona/);
    assert.match(await page.getByRole('status',{name:'Resultado de revisión'}).innerText(),/Ciudad actualizada/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.ok((await action.boundingBox()).height>=44,'touch target height');
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:`.vercel/profile-save-evidence/profile-${width}.png`,fullPage:true});
    assert.deepEqual(errors,[]);
    results.push({width,height,dark,passed:true,synthetic:true,physical_device:false});
    await context.close();
  }
  await writeFile('.vercel/profile-save-evidence/results.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
} finally {
  if(browser) await browser.close();
  server.kill(); // Only the loopback test server spawned by this script.
}
