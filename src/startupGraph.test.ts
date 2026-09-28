import {describe,expect,it} from 'vitest';
import {staticChunkClosure,assertStartupReport,STARTUP_ENTRIES,HEAVY_STARTUP_CHUNK} from '../scripts/startupGraph.mjs';
const manifest={
  'index.html':{file:'assets/main-x.js',imports:['react','utils'],dynamicImports:['charts']},
  react:{file:'assets/vendor-react-x.js',imports:[]},
  utils:{file:'assets/utils-x.js',imports:['classnames']},
  classnames:{file:'assets/vendor-classnames-x.js',imports:[]},
  charts:{file:'assets/vendor-charts-x.js',imports:['react','classnames']},
};
const report=()=>({entries:STARTUP_ENTRIES.map(entry=>({entry,decodedBytes:100,files:[{file:'assets/main-x.js'}]})),precache:{count:20,decodedBytes:1000}});
describe('startup chunk boundaries',()=>{
 it('traverses static imports without preloading dynamic feature chunks',()=>{
  expect(staticChunkClosure(manifest,'index.html')).toEqual(['assets/main-x.js','assets/utils-x.js','assets/vendor-classnames-x.js','assets/vendor-react-x.js']);
 });
 it('reveals a chart dependency hidden behind a common helper',()=>{
  const broken={...manifest,utils:{...manifest.utils,imports:['charts']}};
  expect(staticChunkClosure(broken,'index.html')).toContain('assets/vendor-charts-x.js');
 });
 it('handles shared dependencies and cycles without double counting',()=>{
  const cyclic={...manifest,classnames:{...manifest.classnames,imports:['utils']}};
  expect(staticChunkClosure(cyclic,'index.html')).toHaveLength(4);
 });
 it.each(['absent','missing-dependency'])('rejects missing manifest edges %s',entry=>{
  expect(()=>staticChunkClosure({...manifest,'missing-dependency':{file:'assets/x.js',imports:['absent']}},entry)).toThrow();
 });
 it('rejects traversal and non-script assets',()=>{
  expect(()=>staticChunkClosure({'index.html':{file:'../secret.js'}},'index.html')).toThrow();
 });
 it('accepts a lazy feature architecture within the budgets',()=>expect(()=>assertStartupReport(report())).not.toThrow());
 it('rejects a heavyweight startup import in any entry',()=>{
  const value=report();value.entries[1].files.push({file:'assets/vendor-charts-x.js'});
  expect(()=>assertStartupReport(value)).toThrow(/Feature bundle/);
 });
 it('rejects excessive startup bytes instead of silently increasing the budget',()=>{
  const value=report();value.entries[0].decodedBytes=1600001;
  expect(()=>assertStartupReport(value)).toThrow(/budget/);
 });
 it.each(['charts','pdf','compression','xlsx','docx','canvas-export','maplibre','google-maps','flow'])('recognizes the deferred %s boundary',chunk=>{
  expect(HEAVY_STARTUP_CHUNK.test(`assets/vendor-${chunk}-x.js`)).toBe(true);
 });
 it('preserves the existing offline shell budget',()=>{
  const value=report();value.precache.count=80;
  expect(()=>assertStartupReport(value)).toThrow(/Offline/);
 });
});
