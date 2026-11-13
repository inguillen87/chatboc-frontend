import {describe,expect,it} from 'vitest';
import {createStartupScriptTracker} from '../scripts/startupScriptReadiness.mjs';
import {HEAVY_STARTUP_CHUNK} from '../scripts/startupGraph.mjs';
const origin='http://127.0.0.1:9001';
const request=(path:string,type='script')=>({url:()=>origin+path,resourceType:()=>type});
const setup=()=>{let time=0;return {tracker:createStartupScriptTracker(origin,()=>time),at:(value:number)=>{time=value;}};};
describe('startup script readiness, independent from API polling',()=>{
 it('waits for all scripts and the full 500 ms settling interval',()=>{
  const {tracker,at}=setup(),first=request('/main.js'),second=request('/chunk.js');
  expect(tracker.isSettled()).toBe(false);tracker.started(first);tracker.started(second);
  at(1000);tracker.finished(first);at(2000);expect(tracker.isSettled()).toBe(false);
  tracker.finished(second);at(2499);expect(tracker.isSettled()).toBe(false);at(2500);expect(tracker.isSettled()).toBe(true);
 });
 it('does not wait for API requests or restart readiness when they finish',()=>{
  const {tracker,at}=setup(),script=request('/main.js'),poll=request('/api/heartbeat','fetch');
  tracker.started(script);tracker.started(poll);tracker.finished(script);at(500);
  expect(tracker.isSettled()).toBe(true);tracker.finished(poll);expect(tracker.isSettled()).toBe(true);
  expect(tracker.snapshot().observedPaths).toEqual(['/main.js']);
 });
 it('restarts the settling interval when a dynamic script begins',()=>{
  const {tracker,at}=setup(),first=request('/main.js'),second=request('/late.js');
  tracker.started(first);tracker.finished(first);at(500);expect(tracker.isSettled()).toBe(true);
  tracker.started(second);expect(tracker.isSettled()).toBe(false);at(900);tracker.finished(second);at(1399);expect(tracker.isSettled()).toBe(false);
  at(1400);expect(tracker.isSettled()).toBe(true);
 });
 it('retains script failures even after the queue has settled',()=>{
  const {tracker,at}=setup(),failed=request('/broken.js');tracker.started(failed);tracker.failed(failed);at(500);
  expect(tracker.snapshot()).toMatchObject({pendingScripts:0,failures:[{path:'/broken.js',reason:'request_failed'}]});
  const response=request('/missing.js');tracker.started(response);
  tracker.responded({request:()=>response,status:()=>404});tracker.finished(response);
  expect(tracker.snapshot().failures).toContainEqual({path:'/missing.js',status:404});
 });
 it('does not count blocked external requests as local startup assets',()=>{
  const {tracker}=setup(),external={url:()=>'https://blocked.example.invalid/lib.js',resourceType:()=>'script'};
  tracker.started(external);tracker.failed(external);
  expect(tracker.snapshot()).toEqual({pendingScripts:0,observedPaths:[],failures:[]});
  expect(tracker.isSettled()).toBe(false);
 });
 it('observes an unwanted heavy feature even before it has finished loading',()=>{
  const {tracker,at}=setup(),heavy=request('/assets/vendor-charts-x.js');tracker.started(heavy);at(30000);
  expect(tracker.snapshot().observedPaths.filter(path=>HEAVY_STARTUP_CHUNK.test(path.slice(1)))).toEqual(['/assets/vendor-charts-x.js']);
  expect(tracker.isSettled()).toBe(false);expect(tracker.snapshot().pendingScripts).toBe(1);
 });
 it('includes modulepreload fetches without treating unrelated assets as scripts',()=>{
  const {tracker,at}=setup(),module=request('/assets/dependency.js','other'),image=request('/assets/logo.svg','image');
  tracker.started(module);tracker.started(image);tracker.finished(module);at(500);
  expect(tracker.isSettled()).toBe(true);expect(tracker.snapshot().observedPaths).toEqual(['/assets/dependency.js']);
 });
});

type DiagnosticFrame={url:()=>string;page:()=>{mainFrame:()=>DiagnosticFrame|object}};
const diagnosticFrame=(url=origin+'/login',main=true):DiagnosticFrame=>{
 const value:DiagnosticFrame={url:()=>url,page:()=>({mainFrame:()=>main?value:{}})};return value;
};
const diagnosticRequest=(path='/chunk.js',options:{frame?:DiagnosticFrame;errorText?:string;resourceType?:string;overrides?:Record<string,unknown>}={})=>{
 const requestFrame=options.frame??diagnosticFrame();
 return {
 url:()=>origin+path,resourceType:()=>options.resourceType??'script',
 frame:()=>requestFrame,failure:()=>({errorText:options.errorText??'net::ERR_ABORTED'}),
 timing:()=>({startTime:1794600000000,domainLookupStart:-1,domainLookupEnd:-1,
  connectStart:-1,secureConnectionStart:-1,connectEnd:-1,requestStart:2,responseStart:4,responseEnd:9}),
 ...options.overrides,
 };
};
const diagnosticResponse=(req:unknown,status:number)=>({request:()=>req,status:()=>status});

describe('startup request diagnostics preserve strict readiness and failure history',()=>{
 it('keeps a failed Request when another Request for the same URL succeeds',()=>{
  const {tracker,at}=setup(),failed=diagnosticRequest(),succeeded=diagnosticRequest();
  tracker.started(failed);at(10);tracker.started(succeeded);at(20);tracker.failed(failed);
  at(30);tracker.responded(diagnosticResponse(succeeded,200));at(40);tracker.finished(succeeded);at(540);
  expect(tracker.snapshot()).toEqual({pendingScripts:0,observedPaths:['/chunk.js'],failures:[{path:'/chunk.js',reason:'request_failed'}]});
  expect(tracker.isSettled()).toBe(true);
  const records=tracker.diagnostics().requests;
  expect(records).toHaveLength(2);expect(records[0].requestId).not.toBe(records[1].requestId);
  expect(records[0].events.at(-1)).toMatchObject({type:'failed',errorText:'net::ERR_ABORTED',elapsedMs:20});
  expect(records[1].events.map((event:{type:string})=>event.type)).toEqual(['started','response','finished']);
  expect(records[1].events[1]).toMatchObject({status:200,ok:true});
  expect(records[1].events.at(-1).elapsedMs).toBe(30);
 });
 it('retains a later cancellation after an earlier successful response for the same URL',()=>{
  const {tracker}=setup(),first=diagnosticRequest(),second=diagnosticRequest();
  tracker.started(first);tracker.responded(diagnosticResponse(first,200));tracker.finished(first);
  tracker.started(second);tracker.failed(second);
  expect(tracker.snapshot().failures).toEqual([{path:'/chunk.js',reason:'request_failed'}]);
  expect(tracker.diagnostics().requests[1].events.at(-1).errorText).toBe('net::ERR_ABORTED');
 });
 it('preserves HTTP failure entries exactly while recording successful responses separately',()=>{
  const {tracker}=setup(),missing=diagnosticRequest('/missing.js'),later=diagnosticRequest('/missing.js');
  tracker.started(missing);tracker.responded(diagnosticResponse(missing,404));tracker.finished(missing);
  tracker.started(later);tracker.responded(diagnosticResponse(later,200));tracker.finished(later);
  expect(tracker.snapshot().failures).toEqual([{path:'/missing.js',status:404}]);
  const records=tracker.diagnostics().requests;
  expect(records[0].events[1]).toMatchObject({status:404,ok:false});
  expect(records[1].events[1]).toMatchObject({status:200,ok:true});
 });
 it('describes missing, throwing and null optional metadata without suppressing load failure',()=>{
  for(const overrides of [
   {frame:undefined,timing:undefined,failure:undefined},
   {frame:()=>{throw new Error('unavailable');},timing:()=>{throw new Error('unavailable');},failure:()=>{throw new Error('unavailable');}},
   {frame:()=>null,timing:()=>null,failure:()=>null},
  ]){
   const {tracker}=setup(),req=diagnosticRequest('/broken.js',{overrides});tracker.started(req);tracker.failed(req);
   expect(tracker.snapshot().failures).toEqual([{path:'/broken.js',reason:'request_failed'}]);
   const event=tracker.diagnostics().requests[0].events.at(-1);
   expect(event.frame).toMatchObject({available:false});expect(event.frame.reason).toMatch(/unavailable/);
   expect(event.timing.unavailable).toMatch(/unavailable|no finite fields/);
   expect(event.errorText).toBeNull();expect(event.unavailable).toMatch(/unavailable|no error text/);
  }
 });
 it('redacts URL queries, fragments and credentials, and never reads headers or bodies',()=>{
  const {tracker}=setup(),req=diagnosticRequest('/chunk.js?token=REQUEST_SECRET#REQUEST_FRAGMENT',{
   frame:diagnosticFrame('https://user:FRAME_PASSWORD@client.invalid/login?pin=FRAME_SECRET#FRAME_FRAGMENT'),
   errorText:'net::ERR_FAILED https://user:ERROR_PASSWORD@client.invalid/chunk.js?token=ERROR_SECRET#ERROR_FRAGMENT',
   overrides:{headers:()=>{throw new Error('must not read headers');},postData:()=>{throw new Error('must not read bodies');}},
  });
  tracker.started(req);tracker.failed(req);
  const records=tracker.diagnostics().requests,serialized=JSON.stringify({snapshot:tracker.snapshot(),diagnostics:tracker.diagnostics()});
  for(const secret of ['REQUEST_SECRET','REQUEST_FRAGMENT','FRAME_PASSWORD','FRAME_SECRET','FRAME_FRAGMENT','ERROR_PASSWORD','ERROR_SECRET','ERROR_FRAGMENT'])expect(serialized).not.toContain(secret);
  expect(records[0].path).toBe('/chunk.js');
  expect(records[0].events[0].frame.url).toEqual({protocol:'https:',origin:'https://client.invalid',path:'/login'});
  expect(records[0].events.at(-1)).toMatchObject({errorText:'net::ERR_FAILED',errorTextRedacted:true});
  const data=diagnosticRequest('/next.js',{frame:diagnosticFrame('data:text/html,PRIVATE_FRAME_CONTENT')});
  tracker.started(data);tracker.finished(data);expect(JSON.stringify(tracker.diagnostics())).not.toContain('PRIVATE_FRAME_CONTENT');
  for(const [errorText,expected] of [
   ['net::ERR_FAILED /chunk.js?token=RELATIVE_SECRET#RELATIVE_FRAGMENT','net::ERR_FAILED'],
   ['net::ERR_FAILED //user:PROTOCOL_PASSWORD@client.invalid/chunk.js?token=PROTOCOL_SECRET#PROTOCOL_FRAGMENT','net::ERR_FAILED'],
   ['net::ERR_FAILED chunk.js?token=BARE_SECRET#BARE_FRAGMENT','net::ERR_FAILED'],
   ['file:///C:/PRIVATE_USER/private.js?token=PRIVATE_FILE#PRIVATE_FRAGMENT',null],
   ['data:text/html,PRIVATE_DATA_CONTENT',null],
   ['blob:https://client.invalid/PRIVATE_BLOB_ID',null],
   ['https://private.invalid/a?token=net::ERR_SECRET_VALUE#PRIVATE_FRAGMENT',null],
   ['network details unavailable',null],
  ]){
   const next=setup().tracker,relative=diagnosticRequest('/relative.js',{errorText});
   next.started(relative);next.failed(relative);
   expect(next.diagnostics().requests[0].events.at(-1).errorText).toBe(expected);
   if(expected===null)expect(next.diagnostics().requests[0].events.at(-1).unavailable).toMatch(/redacted/);
  }
 });
 it('distinguishes main and child frame identity and preserves network timing -1 values',()=>{
  const {tracker}=setup(),main=diagnosticFrame(),child=diagnosticFrame(origin+'/child',false);
  const first=diagnosticRequest('/main.js',{frame:main}),second=diagnosticRequest('/child.js',{frame:child});
  tracker.started(first);tracker.started(second);tracker.failed(second);tracker.finished(first);
  const records=tracker.diagnostics().requests;
  expect(records[0].resourceType).toBe('script');expect(records[0].events[0].frame.isMainFrame).toBe(true);
  expect(records[1].events[0].frame.isMainFrame).toBe(false);
  expect(records[0].events[0].frame.frameId).not.toBe(records[1].events[0].frame.frameId);
  expect(records[1].events[0].frame.frameId).toBe(records[1].events.at(-1).frame.frameId);
  expect(records[1].events.at(-1).timing.values).toMatchObject({startTime:1794600000000,domainLookupStart:-1,responseEnd:9});
 });
 it('returns independent diagnostic snapshots that cannot mutate retained evidence',()=>{
  const {tracker}=setup(),req=diagnosticRequest();tracker.started(req);tracker.failed(req);
  const first=tracker.diagnostics().requests[0];first.events[1].errorText='changed';
  first.events[0].timing.values.startTime=0;first.events[0].frame.url.path='/changed';
  const next=tracker.diagnostics().requests[0];
  expect(next.events[1].errorText).toBe('net::ERR_ABORTED');
  expect(next.events[0].timing.values.startTime).toBe(1794600000000);
  expect(next.events[0].frame.url.path).toBe('/login');
 });
 it('does not restart the existing quiet interval when only response diagnostics arrive',()=>{
  const {tracker,at}=setup(),first=diagnosticRequest('/main.js');tracker.started(first);tracker.finished(first);
  at(499);tracker.responded(diagnosticResponse(first,200));expect(tracker.isSettled()).toBe(false);
  at(500);expect(tracker.isSettled()).toBe(true);
  const late=diagnosticRequest('/late.js');tracker.started(late);expect(tracker.isSettled()).toBe(false);
  at(800);tracker.finished(late);at(1299);expect(tracker.isSettled()).toBe(false);at(1300);expect(tracker.isSettled()).toBe(true);
 });
 it('keeps external and non-script API failures outside both readiness and diagnostics',()=>{
  const {tracker}=setup(),api=diagnosticRequest('/api/poll',{resourceType:'fetch'});
  const external=diagnosticRequest('/lib.js',{overrides:{url:()=>'https://external.invalid/lib.js?token=EXTERNAL_SECRET'}});
  tracker.started(api);tracker.started(external);tracker.failed(api);tracker.failed(external);
  expect(tracker.snapshot()).toEqual({pendingScripts:0,observedPaths:[],failures:[]});
  expect(tracker.diagnostics().requests).toEqual([]);expect(tracker.isSettled()).toBe(false);
 });
 it('retains modulepreload resource types without counting unrelated images',()=>{
  const {tracker,at}=setup(),module=diagnosticRequest('/module.js',{resourceType:'other'}),image=diagnosticRequest('/logo.svg',{resourceType:'image'});
  tracker.started(module);tracker.started(image);tracker.finished(module);at(500);
  expect(tracker.isSettled()).toBe(true);expect(tracker.snapshot().observedPaths).toEqual(['/module.js']);
  expect(tracker.diagnostics().requests[0].resourceType).toBe('other');
 });
 it('caps added request details explicitly without truncating pending or legacy failures',()=>{
  const {tracker,at}=setup(),requests=Array.from({length:100},(_,index)=>diagnosticRequest(`/chunk-${index}.js`));
  for(const req of requests)tracker.started(req);
  expect(tracker.snapshot().pendingScripts).toBe(100);
  for(const req of requests)tracker.failed(req);
  const snapshot=tracker.snapshot(),diagnostics=tracker.diagnostics();
  expect(snapshot.pendingScripts).toBe(0);expect(snapshot.failures).toHaveLength(100);
  expect(snapshot.observedPaths).toHaveLength(100);
  expect(diagnostics.requests).toHaveLength(diagnostics.limits.maxRequests);
  expect(diagnostics.truncation.omittedRequests).toBe(100-diagnostics.limits.maxRequests);
  expect(diagnostics.truncation.omittedEvents).toBeGreaterThan(0);
  at(499);expect(tracker.isSettled()).toBe(false);at(500);expect(tracker.isSettled()).toBe(true);
 });
 it('caps event and string details with counters while retaining HTTP and load failure gates',()=>{
  const {tracker}=setup(),req=diagnosticRequest('/chunk.js',{
   errorText:'net::ERR_FAILED '+'x'.repeat(480)+' https://user:LONG_PASSWORD@client.invalid/chunk.js?token=LONG_SECRET#LONG_FRAGMENT',
   frame:diagnosticFrame('https://client.invalid/'+'x'.repeat(600)+'?token=LONG_FRAME_SECRET#LONG_FRAME_FRAGMENT'),
  });
  tracker.started(req);tracker.failed(req);
  const bounded=tracker.diagnostics();
  expect(bounded.requests[0].events.at(-1).errorText.length).toBeLessThanOrEqual(bounded.limits.maxStringLength);
  expect(bounded.truncation.truncatedStrings).toBeGreaterThan(0);
  expect(JSON.stringify(bounded)).not.toMatch(/LONG_PASSWORD|LONG_SECRET|LONG_FRAGMENT|LONG_FRAME_SECRET|LONG_FRAME_FRAGMENT/);
  expect(bounded.requests[0].events.at(-1).errorText).toBe('net::ERR_FAILED');
  expect(bounded.requests[0].events.at(-1).frame.url.path.length).toBeLessThanOrEqual(bounded.limits.maxStringLength);
  const repeated=diagnosticRequest('/repeated.js');tracker.started(repeated);
  for(let index=0;index<20;index++)tracker.responded(diagnosticResponse(repeated,index===19?404:200));
  tracker.failed(repeated);
  const final=tracker.diagnostics();
  expect(final.requests[1].events).toHaveLength(final.limits.maxEventsPerRequest);
  expect(final.requests[1].omittedEvents).toBeGreaterThan(0);
  expect(final.truncation.omittedEvents).toBeGreaterThan(0);
  expect(tracker.snapshot().failures).toEqual([
   {path:'/chunk.js',reason:'request_failed'},{path:'/repeated.js',status:404},{path:'/repeated.js',reason:'request_failed'},
  ]);
 });
});
