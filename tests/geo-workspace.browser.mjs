import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder='.vercel/geo-evidence';
const transport=path.resolve('tests/e2e/fixtures/geo-workspace.transport.ts');
const map=path.resolve('tests/e2e/fixtures/geo-workspace.map.tsx');
const server=await createServer({configFile:false,plugins:[react()],cacheDir:'.vercel/geo-browser-cache',optimizeDeps:{entries:['tests/e2e/fixtures/geo-workspace.html']},resolve:{alias:[{find:/^@\/(utils\/api|context\/TenantContext)$/,replacement:transport},{find:'@/components/LazyMapLibreMap',replacement:map},{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;const results=[];
const points=[{id:1,lat:-33.086,lng:-68.471,categoria:'agua',estado:'abierto',severidad:'alta',canal:'whatsapp',distrito:'centro',weight:2},{id:2,lat:-33.087,lng:-68.473,categoria:'luz',estado:'cerrado',severidad:'baja',canal:'web',distrito:'sur',weight:1}];
try{
 await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 await mkdir(folder,{recursive:true});browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
 for(const [width,height,dark] of [[1440,1100,false],[390,844,true],[320,740,false]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  const requests=[],writes=[],errors=[];let mode='points',denied=false;
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==origin)return route.abort();
   if(url.pathname==='/qa-map-style.json')return route.fulfill({json:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':dark?'#182633':'#edf1f5'}}]}});
   if(!url.pathname.startsWith('/api/'))return route.continue();
   if(request.method()!=='GET'){writes.push(url.pathname);return route.fulfill({status:405,json:{error:'Read-only fixture'}});}
   requests.push({path:url.pathname,category:url.searchParams.get('categoria'),tenant:request.headers()['x-qa-tenant']});
   if(denied)return route.fulfill({status:403,json:{error:'Synthetic access denied'}});
   if(url.pathname!=='/api/v2/analytics/operations/heatmap')return route.fulfill({status:404,json:{error:'Unexpected endpoint'}});
   const category=url.searchParams.get('categoria');
   return route.fulfill({json:{contract_version:'operations.heatmap.v1',request_id:'qa-geographic',tenant_id:7,tenant_slug:'geo-qa',
    points:category?points.filter(point=>point.categoria===category):points,
    cells:mode==='aggregate'?[{cell_id:'zone-qa',label:'Zona agregada de prueba',centroid_lat:-54.8,centroid_lon:-68.3,count:20}]:[],
    metadata:{synthetic:true,raw_points_redacted:mode==='aggregate'},
    location_quality:{with_coordinates:1,without_coordinates:199,total:200,coverage_pct:.5},
    segments_filters_applied:category?{categoria:category}:{},
    segments:{categoria:[{key:'agua',label:'Agua potable',count:5},{key:'luz',label:'Luminarias',count:2}],canal:[{key:'whatsapp',label:'WhatsApp',count:4},{key:'web',label:'Web',count:3}]},
    geo_layers:{style_url:origin+'/qa-map-style.json',layers:{heatmap:{id:'qa-heat'},points:{id:'qa-points'}}},
    ui:{labels:{title:'Mapa territorial de prueba',description:'Información sintética para validar la interacción y el alcance geográfico.'},layer_labels:{heatmap:'Densidad',points:'Puntos'}}
   }});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto(`${origin}/tests/e2e/fixtures/geo-workspace.html`);
   if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
   await expect(page.getByText('Mapa territorial de prueba')).toBeVisible();
   await expect(page.getByTestId('geography-observed')).toHaveAttribute('data-count','2');
   await expect(page.locator('.maplibregl-canvas')).toBeVisible();
   await expect(page.getByText('0,5%',{exact:true})).toBeVisible();
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(size.scroll<=size.width+1,'Horizontal overflow');
   assert.equal(await page.locator('.geo-metric').first().evaluate(element=>getComputedStyle(element).animationName),'none');
   const axe=await new AxeBuilder({page}).include('.geo-workspace').withTags(['wcag2a','wcag2aa']).analyze();
   await writeFile(`${folder}/geo-${width}-axe.json`,JSON.stringify(axe.violations,null,2));
   const serious=axe.violations.filter(issue=>['critical','serious'].includes(issue.impact));
   assert.deepEqual(serious.map(issue=>({id:issue.id,nodes:issue.nodes.map(node=>node.target)})),[]);
   await page.screenshot({path:`${folder}/geo-${width}-workspace.png`,fullPage:true});
   await page.getByLabel('Estado visible',{exact:true}).selectOption('abierto');
   await page.getByLabel('Severidad visible',{exact:true}).selectOption('baja');
   await expect(page.getByText('Sin coincidencias geográficas')).toBeVisible();
   await expect(page.getByTestId('geography-observed')).toHaveCount(0);assert.equal(requests.length,1);
   await page.getByLabel('Categoría',{exact:true}).selectOption('agua');assert.equal(requests.length,1);
   await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
   await expect(page.getByTestId('geography-observed')).toHaveAttribute('data-count','1');
   assert.equal(requests.length,2);assert.equal(requests[1].category,'agua');assert.equal(requests[1].tenant,'geo-qa');
   const bar=page.getByRole('button',{name:'Categoría: Luminarias, 2 registros informados'});
   await bar.focus();await bar.press('Enter');
   await expect(page.getByLabel('Categoría',{exact:true})).toHaveValue('luz');
   await expect(page.getByTestId('geography-observed')).toHaveAttribute('data-count','1');assert.equal(requests.length,3);assert.equal(requests[2].category,'luz');
   mode='aggregate';await page.getByRole('button',{name:'Actualizar mapa',exact:true}).click();
   await expect(page.getByTestId('geography-observed')).toHaveAttribute('data-redacted','true');
   await expect(page.getByTestId('geography-observed')).toHaveAttribute('data-lat','-54.8');
   await page.screenshot({path:`${folder}/geo-${width}-aggregates.png`,fullPage:true});
   denied=true;await page.getByRole('button',{name:'Actualizar mapa',exact:true}).click();
   await expect(page.getByText('No se pudo verificar el mapa',{exact:true})).toBeVisible();
   await expect(page.getByTestId('geography-observed')).toHaveCount(0);
   await expect(page.getByRole('button',{name:'Categoría: Luminarias, 2 registros informados'})).toHaveCount(0);
   assert.equal(requests.length,5);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
   results.push({width,height,dark,passed:true,requests:requests.length,mutations:writes.length,seriousViolations:serious.length});
  }catch(error){await page.screenshot({path:`${folder}/geo-${width}-failure.png`,fullPage:true}).catch(()=>{});results.push({width,height,dark,passed:false,reason:error.message,errors,requests});}
  finally{await context.close();}
 }
 const report={syntheticData:true,syntheticBasemap:true,productionBackend:false,realAuthentication:false,realAnalyticsService:true,realMapLibreRenderer:true,results};
 await writeFile(`${folder}/browser-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.ok(results.every(result=>result.passed),'Geographic browser validation failed');
}finally{await browser?.close();await server.close();}
