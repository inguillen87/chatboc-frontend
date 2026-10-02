import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {safeLocalStorage,safeSessionStorage} from './safeLocalStorage';
import {advanceChatbocSessionRevision,captureChatbocSessionRevision} from './chatbocSessionRevision';
import {retirementProof,retirementReceipt} from '../../tests/fixtures/session-retirement.synthetic';
import {captureSessionRetirement,clearSessionRetirementAuthority,dispatchSessionRetirement,registerSessionRetirement,validateSessionRetirementProof} from './sessionRetirement';
beforeEach(()=>{safeLocalStorage.clear();safeSessionStorage.clear();clearSessionRetirementAuthority();advanceChatbocSessionRevision();vi.stubGlobal('fetch',vi.fn());});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();clearSessionRetirementAuthority();});
describe('server proof binding and dedicated retirement dispatcher',()=>{
 it.each([{actor_id:'other'}, {provider:'clerk',clerk_session_id:'other'}, {expires_at:'2020-01-01T00:00:00Z'}, {proof:''}, {clerk_session_id:'foreign'}])('rejects incompatible proof %j',patch=>{
  expect(validateSessionRetirementProof(retirementProof(patch as any),{actorId:'7',provider:'native'})).toBeNull();expect(fetch).not.toHaveBeenCalled();
 });
 it('cannot replace B retirement authority with a late A registration',()=>{
  const revisionA=captureChatbocSessionRevision();advanceChatbocSessionRevision();
  expect(registerSessionRetirement(retirementProof({actor_id:'8',lineage_id:'synthetic-b'}),{actorId:'8',provider:'native'})).toBe(true);
  expect(registerSessionRetirement(retirementProof(),{actorId:'7',provider:'native'},revisionA)).toBe(false);
  expect(captureSessionRetirement('7')).toBeNull();expect(captureSessionRetirement('8')?.lineage_id).toBe('synthetic-b');
  expect(safeSessionStorage.getItem('chatbocRetiredSessions.v1')??'').not.toContain('synthetic-proof');expect(safeLocalStorage.getItem('user')).toBeNull();
 });
 it.each(['retired','already_retired'])('accepts only a matching local server receipt (%s)',async status=>{
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(retirementReceipt({status}))));
  await expect(dispatchSessionRetirement(retirementProof())).resolves.toEqual({status,providerStatus:'not_applicable'});expect(fetch).toHaveBeenCalledOnce();
 });
 it.each([{lineage_id:'synthetic-b'},{local_revoked:false},{status:'pending'},{provider_revocation:{status:'invented'}}])('does not fabricate server completion for incompatible receipt %j',async patch=>{
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(retirementReceipt(patch))));
  await expect(dispatchSessionRetirement(retirementProof())).resolves.toEqual({status:'uncertain',providerStatus:'unknown'});expect(fetch).toHaveBeenCalledOnce();
 });
 it('keeps unconfirmed provider revocation separate from local revocation',async()=>{
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(retirementReceipt({provider_revocation:{status:'pending'}}))));
  await expect(dispatchSessionRetirement(retirementProof())).resolves.toEqual({status:'retired',providerStatus:'pending'});
 });
 it('times out once without replaying or claiming remote success',async()=>{
  vi.useFakeTimers();vi.mocked(fetch).mockImplementation((_url,init)=>new Promise((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')))));
  const operation=dispatchSessionRetirement(retirementProof());await vi.advanceTimersByTimeAsync(10_000);
  await expect(operation).resolves.toEqual({status:'uncertain',providerStatus:'unknown'});expect(fetch).toHaveBeenCalledOnce();
 });
});
