// Current production component with synthetic form data; no customer session or API calls.
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const label=process.env.PROFILE_EVIDENCE_LABEL||'final';
const folder=`.vercel/profile-production-${label}`;
const server=await createServer({cacheDir:'.vercel/prod-profile-cache',server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;const results=[];
try{
  await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  await mkdir(folder,{recursive:true});
  browser=await chromium.launch(process.platform==='win32'?{channel:'chrome',headless:true}:{headless:true});
  for(const [width,height,dark] of [[1440,1000,false],[820,1000,false],[390,844,true],[320,640,false]]){
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(origin+'/tests/e2e/fixtures/production-profile.html');
      if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
      const form=page.getByTestId('institution-profile-workspace');
      const input=page.getByRole('textbox',{name:'Campo de prueba'});
      await input.fill('Texto conservado al navegar');
      await page.getByTestId('institution-profile-section-plan-security').click();
      await page.screenshot({path:`${folder}/profile-${width}.png`,fullPage:true});
      const bounds=await page.getByRole('heading',{name:'Organización de evaluación multidispositivo'}).boundingBox();
      const metrics=await form.evaluate(el=>({left:el.scrollLeft,width:el.clientWidth,scroll:el.scrollWidth}));
      assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+1,`Profile heading outside viewport: ${JSON.stringify({bounds,metrics})}`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.ok(metrics.left===0&&metrics.scroll<=metrics.width+1,'Form must not be scrolled horizontally');
      await expect(input).toHaveValue('Texto conservado al navegar');
      const last=page.getByTestId('institution-profile-section-general');await last.focus();await page.keyboard.press('Enter');
      await expect(last).toHaveAttribute('aria-current','page');
      await page.getByTestId('fixture-end').scrollIntoViewIfNeeded();
      const save=page.getByRole('button',{name:'Guardar',exact:true});
      await save.click();await expect(page.getByTestId('fixture-submits')).toHaveText('1');
      assert.deepEqual(errors,[]);results.push({width,height,dark,passed:true});
      await page.goto(origin+'/tests/e2e/fixtures/production-profile.html?readonly=1');
      await expect(page.getByRole('button',{name:'Guardar',exact:true})).toBeDisabled();
      await expect(page.getByRole('textbox',{name:'Campo de prueba'})).toBeDisabled();
    }catch(error){results.push({width,height,dark,passed:false,reason:error.message});}
    await context.close();
  }
  await writeFile(`${folder}/results.json`,JSON.stringify({syntheticData:true,results},null,2));
  console.log(JSON.stringify({syntheticData:true,results}));
  assert.ok(results.every(r=>r.passed),'One or more profile viewport checks failed');
}finally{await browser?.close();await server.close();}
