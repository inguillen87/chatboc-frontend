import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder='.vercel/inbox-evidence';
const replacement=path.resolve('tests/e2e/fixtures/inbox-workspace.transport.ts');
const server=await createServer({configFile:false,plugins:[react()],cacheDir:'.vercel/inbox-browser-cache',optimizeDeps:{entries:['tests/e2e/fixtures/inbox-workspace.html']},resolve:{alias:[{find:/^@\/(api\/v2\/client|context\/(?:TenantContext|CapabilitiesContext)|hooks\/useUser)$/,replacement},{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser; const results=[];
const fixture=(tenant,id=12)=>({id:`municipio:${id}`,ticket_id:id,source_model:'MunicipioTicket',tenant_slug:tenant,title:id===12?'Luminaria sin servicio':'Consulta de atención',description:'Datos sintéticos para validar la bandeja.',status:'nuevo',channel:id===12?'whatsapp':'web',last_message_at:'2026-09-23T12:00:00Z',unread_count:id===12?2:0,assignee:id===12?null:{id:7,name:'Operador de prueba'},allowed_actions:[{id:'reply',label:'Responder',endpoint:'/api/v2/inbox/omnichannel/actions',requires:['body','client_message_id_or_idempotency_key'],payload:{source_model:'MunicipioTicket',legacy_id:id}}],attachments:[],timeline:[{id:'incoming-'+id,type:'message_created',timestamp:'2026-09-23T12:00:00Z',actor:{type:'user',name:'Contacto de prueba'},payload:{content:'Solicito atención sobre este caso. Mensaje sintético para pruebas.'}}]});
try {
  await server.listen(); const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  await mkdir(folder,{recursive:true}); browser=await chromium.launch({headless:true});
  for(const [width,height,dark] of [[1440,1000,false],[390,844,true],[320,740,false]]) {
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    const reads=[],writes=[],errors=[]; let denyDetail=false,ownershipMode='none',claimed=false;
    const detailFixture=(tenant,id=12)=>{
      const item=fixture(tenant,id);
      delete item.tenant_slug; // Real legacy tickets obtain tenant identity from the verified response envelope.
      if(id===12 && ownershipMode!=='none')item.allowed_actions.push({id:'claim',label:'Atender este caso',disabled:ownershipMode==='disabled'});
      if(id===12 && claimed)item.assignee={id:999,name:'Operador de prueba asignado'};
      return item;
    };
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin!==origin)return route.abort();
      if(!url.pathname.startsWith('/api/'))return route.continue();
      const tenant=request.headers()['x-qa-tenant'];
      if(request.method()==='GET') {
        reads.push({path:url.pathname,tenant});
        if(url.pathname==='/api/v2/inbox/omnichannel')return route.fulfill({json:{tenant_slug:tenant,items:[detailFixture(tenant),detailFixture(tenant,13)],summary:{}}});
        if(url.pathname.endsWith('/employee-routing'))return route.fulfill({json:{contract_version:'employee.routing.v1',employees:[{id:999,name:'Operador de prueba asignado',scope:{categorias:['luminarias']}}],queues:{open:[{source_model:'MunicipioTicket',id:12,category:'luminarias',assignee_id:claimed?999:null}],unassigned:[]},recommendations:[]}});
        if(url.pathname.startsWith('/api/v2/inbox/omnichannel/'))return denyDetail?route.fulfill({status:403,json:{error:'Synthetic denied'}}):route.fulfill({json:{tenant:{slug:tenant},item:detailFixture(tenant,decodeURIComponent(url.pathname).endsWith(':13')?13:12)}});
      }
      if(request.method()==='POST'&&url.pathname.endsWith('/actions')) {
        const body=request.postDataJSON(); writes.push({path:url.pathname,tenant,body,idempotency:request.headers()['idempotency-key']});
        if(body.action==='claim'){
          claimed=true;
          return route.fulfill({json:{tenant_slug:tenant,action:'claim',ticket:detailFixture(tenant)}});
        }
        return route.fulfill({json:{tenant_slug:tenant,action:'reply',ticket:detailFixture(tenant),delivery:{mode:'timeline_only',status:'recorded',operator_message:'Respuesta sintética registrada solo en CRM.'}}});
      }
      return route.fulfill({status:404,json:{error:'Unexpected synthetic endpoint'}});
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    try {
      await page.goto(`${origin}/tests/e2e/fixtures/inbox-workspace.html`);
      if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
      const first=page.getByRole('button',{name:'Abrir conversación: Luminaria sin servicio'});
      await expect(first).toBeVisible();await expect(first).toBeEnabled();
      const measure=()=>page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
      const initial=await measure();assert.ok(initial.scroll<=initial.width+1,'List overflow');
      const beforeFilter=reads.filter(read=>read.path==='/api/v2/inbox/omnichannel').length;
      await page.getByRole('button',{name:'Con mensajes sin leer'}).click();
      await expect(page.getByRole('button',{name:'Abrir conversación: Consulta de atención'})).toHaveCount(0);
      assert.equal(reads.filter(read=>read.path==='/api/v2/inbox/omnichannel').length,beforeFilter);
      await page.getByRole('button',{name:'Limpiar filtros'}).click();
      await page.screenshot({path:`${folder}/inbox-${width}-list.png`,fullPage:true});
      await first.focus();await first.press('Enter');
      const editor=page.getByRole('textbox',{name:'Respuesta al contacto'});
      await expect(editor).toBeVisible();await editor.fill('Borrador de seguimiento');
      if(width<1024)await page.getByRole('button',{name:'Volver a conversaciones'}).click();
      await page.getByRole('button',{name:'Abrir conversación: Consulta de atención'}).click();
      const confirm=page.getByRole('alertdialog');await expect(confirm).toBeVisible();
      await confirm.getByRole('button',{name:'Seguir editando'}).click();
      if(width<1024)await first.click();
      await expect(editor).toHaveValue('Borrador de seguimiento');assert.equal(writes.length,0);
      await page.locator('.inbox-case-context > summary').click(); await expect(page.getByRole('region',{name:'Relojes de nivel de servicio'})).toBeVisible();
      const axe=await new AxeBuilder({page}).include('.inbox-workspace').withTags(['wcag2a','wcag2aa']).analyze();
      await writeFile(`${folder}/inbox-${width}-axe.json`,JSON.stringify(axe.violations,null,2));
      const serious=axe.violations.filter(issue=>['critical','serious'].includes(issue.impact));
      assert.deepEqual(serious.map(issue=>({id:issue.id,nodes:issue.nodes.map(node=>node.target)})),[]);
      assert.equal(await page.locator('.inbox-workspace-body').evaluate(element=>getComputedStyle(element).animationName),'none');
      const conversation=await measure();assert.ok(conversation.scroll<=conversation.width+1,'Conversation overflow');
      await page.locator('.inbox-case-context > summary').click();
      await page.getByRole('button',{name:'Enviar mensaje'}).click();
      await expect(page.getByTestId('omnichannel-delivery-status')).toContainText('Guardado solo en CRM');
      await expect(editor).toHaveValue('');assert.equal(writes.length,1);assert.equal(writes[0].tenant,'qa-a');
      assert.ok(writes[0].idempotency,'Stable reply identity is required');
      await expect(page.getByText('Solicito atención sobre este caso. Mensaje sintético para pruebas.')).toBeVisible();
      await page.screenshot({path:`${folder}/inbox-${width}-conversation.png`,fullPage:true});
      // Exercise the actual assignment component with no TicketProvider or hook mock.
      await expect(page.locator('.inbox-assignment-control')).toHaveCount(0);
      ownershipMode='claim';await page.evaluate(()=>window.__qaRefreshInboxDetail());
      const ownership=page.locator('.inbox-assignment-control');
      await expect(ownership.locator('summary')).toHaveText('Atender este caso');
      const historyBounds=await page.getByRole('region',{name:'Historial y contexto del caso'}).boundingBox();
      assert.ok(historyBounds && historyBounds.height>=100,'History must retain usable height after a reply');
      if(width<720){
        const bar=page.getByRole('region',{name:'Control operativo del caso'});
        await bar.focus();await bar.press('ArrowRight');
        await expect.poll(()=>bar.evaluate(element=>element.scrollLeft)).toBeGreaterThan(0);
      }
      await ownership.locator('summary').click();
      const claimButton=ownership.getByRole('button',{name:'Atender este caso'});
      await expect(claimButton).toBeEnabled();
      await expect(ownership.getByRole('combobox')).toHaveCount(0);
      const ownershipAxe=await new AxeBuilder({page}).include('.inbox-assignment-control').withTags(['wcag2a','wcag2aa']).analyze();
      await writeFile(`${folder}/assignment-${width}-axe.json`,JSON.stringify(ownershipAxe.violations,null,2));
      assert.deepEqual(ownershipAxe.violations.filter(issue=>['critical','serious'].includes(issue.impact)).map(issue=>issue.id),[]);
      await page.screenshot({path:`${folder}/assignment-${width}.png`,fullPage:true});
      await claimButton.click();
      await expect(ownership.getByRole('button',{name:'Asignado a mí'})).toBeVisible();
      await expect(page.getByRole('region',{name:'Control operativo del caso'})).toContainText('Operador de prueba asignado');
      assert.equal(writes.filter(write=>write.body.action==='claim').length,1);
      const claimWrite=writes.find(write=>write.body.action==='claim');
      assert.equal(claimWrite.tenant,'qa-a');
      assert.equal(claimWrite.body.source_model,'MunicipioTicket');
      assert.equal(claimWrite.body.ticket_id,12);
      ownershipMode='disabled';await page.evaluate(()=>window.__qaRefreshInboxDetail());
      await expect(ownership).toHaveCount(0);
      await expect(editor).toBeVisible();
      assert.equal(writes.length,2);
      denyDetail=true;await page.evaluate(()=>window.__qaRefreshInboxDetail());
      await expect(page.getByText('Conversación no disponible')).toBeVisible();await expect(editor).toHaveCount(0);
      assert.equal(writes.length,2);assert.deepEqual(errors,[]);
      results.push({width,height,dark,passed:true,listReads:beforeFilter,replyRequests:writes.filter(write=>write.body.action==='reply').length,assignmentRequests:writes.filter(write=>write.body.action==='claim').length,withoutTicketProvider:true,ownershipRevocation:true,seriousAccessibilityViolations:serious.length});
    } catch(error) {
      await page.screenshot({path:`${folder}/inbox-${width}-failure.png`,fullPage:true}).catch(()=>{});
      results.push({width,height,dark,passed:false,reason:error.message,errors,writes});
    } finally { await context.close(); }
  }
  const report={syntheticData:true,productionBackend:false,realAuthentication:false,realApiNormalizers:true,realReplyIdentity:true,results};
  await writeFile(`${folder}/browser-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  assert.ok(results.every(result=>result.passed),'Inbox browser regression failed');
} finally { await browser?.close();await server.close(); }
