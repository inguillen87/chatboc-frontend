// @vitest-environment node
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {resolvePreviewBackend,QA_BACKEND} from './previewBackendTarget.mjs';
import {runVercelPreviewRewriteGuard} from './guardVercelPreviewRewrites.mjs';
const ORIGIN='https://chatboc-backend-candidate-marcelos-projects-c26aa499.vercel.app', SHA='b'.repeat(40);
const ENV={VERCEL_ENV:'preview',CHATBOC_VERCEL_EFFECTIVE_CONFIG:'.vercel/qa/vercel.preview.json',
 CHATBOC_VERCEL_PREBUILT_LOCAL_CONFIG_BOUND:'1',CHATBOC_PREVIEW_BACKEND_ORIGIN:ORIGIN,VITE_EXPECTED_BACKEND_REVISION:SHA};
const config=()=>JSON.parse(readFileSync(resolve(process.cwd(),'vercel.json'),'utf8').replaceAll('https://api.chatboc.ar',ORIGIN));
const run=(environment,body=config())=>runVercelPreviewRewriteGuard({environment,readTextFile:()=>JSON.stringify(body),writeLine:()=>{}});
describe('explicit paired backend target',()=>{
 it('preserves the unpinned QA default',()=>expect(resolvePreviewBackend({})).toEqual({origin:QA_BACKEND,revision:null}));
 it('accepts a known candidate only with an exact revision',()=>expect(resolvePreviewBackend(ENV)).toEqual({origin:ORIGIN,revision:SHA}));
 it('keeps all eight audited routes and the bound config restriction',()=>expect(run(ENV).preview_backend_rewrites).toBe(8));
 it('rejects an undeclared candidate',()=>expect(()=>run({...ENV,CHATBOC_PREVIEW_BACKEND_ORIGIN:undefined,VITE_EXPECTED_BACKEND_REVISION:undefined})).toThrow());
 it('rejects one route still pointing at the stable backend',()=>{
   const body=config();body.rewrites[0].destination=QA_BACKEND+'/ask/$1';expect(()=>run(ENV,body)).toThrow();
 });
 it('does not allow arbitrary suffixes or removed route constraints',()=>{
   const body=config();body.rewrites[0].destination=ORIGIN+'/wrong/$1';expect(()=>run(ENV,body)).toThrow();
 });
 it('requires prebuilt binding even for a correctly pinned target',()=>expect(()=>run({...ENV,CHATBOC_VERCEL_PREBUILT_LOCAL_CONFIG_BOUND:'0'})).toThrow());
 it('never routes Preview to production',()=>expect(()=>run(ENV,JSON.parse(readFileSync(resolve(process.cwd(),'vercel.json'),'utf8')))).toThrow());
 it.each([ORIGIN+'/',ORIGIN+'/api',ORIGIN+'?x=1',ORIGIN+'#x',ORIGIN+':443',ORIGIN.replace('https://','https://u:p@'),
 'https://api.chatboc.ar','https://other.vercel.app','http://127.0.0.1',ORIGIN+'.evil.test'])('rejects an unsafe origin %s',origin=>{
   expect(()=>resolvePreviewBackend({...ENV,CHATBOC_PREVIEW_BACKEND_ORIGIN:origin})).toThrow();
 });
 it.each([undefined,'','main','a'.repeat(39),'A'.repeat(40)])('requires a valid candidate SHA %s',revision=>{
   expect(()=>resolvePreviewBackend({...ENV,VITE_EXPECTED_BACKEND_REVISION:revision})).toThrow();
 });
});
