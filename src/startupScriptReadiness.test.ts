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
