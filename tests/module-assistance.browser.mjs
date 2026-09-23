import {chromium, expect} from '@playwright/test';
import {createServer} from 'vite';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const copy=JSON.parse(await readFile(new URL('./fixtures/module-selection-assistance.json',import.meta.url),'utf8'));
const source=JSON.parse(await readFile(new URL('./fixtures/organization-modules.json',import.meta.url),'utf8')).full;
const label=id=>source.catalog.find(item=>item.id===id).label;
const server=await createServer({cacheDir:'.vercel/module-assistance-cache',server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;const results=[];
try{
  await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  await mkdir('.vercel/module-assistance-evidence',{recursive:true});
  browser=await chromium.launch(process.platform==='win32'?{channel:'chrome',headless:true}:{headless:true});
  for(const width of [1440,820,390,320]){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    const page=await context.newPage();const errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push(r.method());});
    await page.goto(origin+'/tests/e2e/fixtures/module-assistance.html');
    if(width===390)await page.evaluate(()=>document.documentElement.classList.add('dark'));
    const workspace=page.getByTestId('assisted-workspace');
    const payments=page.getByRole('checkbox',{name:label('payments')});
    await payments.focus();await page.keyboard.press('Space');
    let modal=page.getByRole('alertdialog');await expect(modal).toBeVisible();
    await expect(modal.getByTestId('module-dependency-impact')).toHaveText(label('catalog')+label('payments'));
    await expect(workspace).toHaveAttribute('data-changes','0');
    await modal.getByRole('button',{name:copy.cancel}).click();
    await expect(payments).not.toBeChecked();await expect(workspace).toHaveAttribute('data-changes','0');
    await payments.click();modal=page.getByRole('alertdialog');
    const bounds=await modal.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+1);
    await page.screenshot({path:`.vercel/module-assistance-evidence/assistance-${width}.png`,fullPage:true});
    const apply=modal.getByRole('button',{name:copy.apply_draft});await apply.focus();await page.keyboard.press('Enter');
    await expect(payments).toBeChecked();await expect(workspace).toHaveAttribute('data-changes','1');
    await page.getByRole('checkbox',{name:label('catalog')}).click();
    modal=page.getByRole('alertdialog');await expect(modal).toContainText(copy.remove_title);
    await modal.getByRole('button',{name:copy.apply_draft}).click();
    await expect(payments).not.toBeChecked();await expect(workspace).toHaveAttribute('data-changes','2');
    await expect(workspace).toHaveAttribute('data-selected',JSON.stringify(source.selected));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
    results.push({width,dark:width===390,explicitAddAndRemove:true,cancelPreservedDraft:true,keyboard:true,noApiRequests:true});
    await context.close();
  }
  console.log(JSON.stringify({realComponent:true,syntheticSnapshot:true,persistenceTested:false,results}));
  await writeFile('.vercel/module-assistance-evidence/results.json',JSON.stringify(results,null,2));
}finally{await browser?.close();await server.close();}
