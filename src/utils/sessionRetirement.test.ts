import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {safeLocalStorage,safeSessionStorage} from './safeLocalStorage';
import {advanceChatbocSessionRevision,captureChatbocSessionRevision} from './chatbocSessionRevision';
import {retirementProof,retirementReceipt} from '../../tests/fixtures/session-retirement.synthetic';
import {captureSessionRetirement,clearSessionRetirementAuthority,dispatchSessionRetirement,registerSessionRetirement,validateSessionRetirementProof} from './sessionRetirement';
beforeEach(()=>{safeLocalStorage.clear();safeSessionStorage.clear();clearSessionRetirementAuthority();advanceChatbocSessionRevision();vi.stubGlobal('fetch',vi.fn());});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();clearSessionRetirementAuthority();});
const bootstrapPayload={contract_version:'chatboc.bootstrap.v1',status_code:503,ok:false,
 reason_code:'application_initializing',retryable:true,request_dispatched:false,action_hint:'retry_after'};
const initializing=(changes={},headers={},status=503)=>new Response(JSON.stringify({...bootstrapPayload,...changes}),{status,
 headers:{'Content-Type':'application/json','X-Chatboc-Bootstrap':'initializing','Retry-After':'0',...headers}});
// Keep native response parsing deterministic under fake timers without the clone's MessageChannel.
const timedInitializing=(headers={})=>{
 const response=initializing({},headers);
 vi.spyOn(response,'clone').mockImplementation(()=>initializing({},headers));
 return response;
};
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
  const operation=dispatchSessionRetirement(retirementProof());await vi.advanceTimersByTimeAsync(30_000);
  await expect(operation).resolves.toEqual({status:'uncertain',providerStatus:'unknown'});expect(fetch).toHaveBeenCalledOnce();
 });
 it('retries an exact undispatched startup response once using the original frozen proof and request id',async()=>{
  const authority=retirementProof();const requestId=vi.spyOn(crypto,'randomUUID');
  vi.mocked(fetch).mockImplementationOnce(async()=>{
   authority.proof='synthetic-changed-proof';authority.lineage_id='synthetic-changed-lineage';
   return initializing();
  }).mockResolvedValueOnce(new Response(JSON.stringify(retirementReceipt())));
  await expect(dispatchSessionRetirement(authority)).resolves.toEqual({status:'retired',providerStatus:'not_applicable'});
  expect(fetch).toHaveBeenCalledTimes(2);expect(requestId).toHaveBeenCalledOnce();
  const first=vi.mocked(fetch).mock.calls[0],second=vi.mocked(fetch).mock.calls[1];
  expect(first).toEqual(second);expect(first[0]).toBe('/api/v2/auth/sessions/retire');
  expect(JSON.parse(first[1]!.body as string)).toEqual({proof:'synthetic-proof-a',request_id:expect.any(String)});
  expect(first[1]).toMatchObject({method:'POST',credentials:'omit',cache:'no-store',redirect:'error',keepalive:true});
  expect(new Headers(first[1]!.headers).has('Authorization')).toBe(false);
  expect(new Headers(first[1]!.headers).has('X-Tenant')).toBe(false);
 });
 it.each([
  {request_dispatched:true},{request_dispatched:undefined},{request_dispatched:'false'},
  {retryable:false},{retryable:'true'},{contract_version:'other'},
  {reason_code:'global_writer_authority_control_database_unavailable'},
  {reason_code:'application_initialization_failed'},{status_code:500},{ok:true},{action_hint:'other'},
 ])('keeps uncertain startup-like responses single attempt %j',async patch=>{
  vi.mocked(fetch).mockResolvedValue(initializing(patch));
  await expect(dispatchSessionRetirement(retirementProof())).resolves.toEqual({status:'uncertain',providerStatus:'unknown'});
  expect(fetch).toHaveBeenCalledOnce();
 });
 it.each([
  initializing({}, {'X-Chatboc-Bootstrap':''}),initializing({}, {'Content-Type':'text/plain'}),
  initializing({}, {},502),new Response('{}',{status:503}),
  new Response('{',{status:503,headers:{'Content-Type':'application/json','X-Chatboc-Bootstrap':'initializing'}}),
 ])('does not replay ambiguous or malformed HTTP responses %#',async response=>{
  vi.mocked(fetch).mockResolvedValue(response);
  await expect(dispatchSessionRetirement(retirementProof())).resolves.toMatchObject({status:'uncertain'});
  expect(fetch).toHaveBeenCalledOnce();
 });
 it('keeps a lost response uncertain without retry',async()=>{
  vi.mocked(fetch).mockRejectedValue(new TypeError('synthetic network failure'));
  await expect(dispatchSessionRetirement(retirementProof())).resolves.toMatchObject({status:'uncertain'});
  expect(fetch).toHaveBeenCalledOnce();
 });
 it('does not send a seventh request after six explicit undispatched startup responses',async()=>{
  vi.useFakeTimers();vi.mocked(fetch).mockImplementation(async()=>timedInitializing());
  const operation=dispatchSessionRetirement(retirementProof());await vi.advanceTimersByTimeAsync(1250);
  await expect(operation).resolves.toMatchObject({status:'uncertain'});
  expect(fetch).toHaveBeenCalledTimes(6);
 });
 it('does not shorten a Retry-After beyond the bounded retry window',async()=>{
  vi.mocked(fetch).mockResolvedValue(initializing({}, {'Retry-After':'60'}));
  await expect(dispatchSessionRetirement(retirementProof())).resolves.toMatchObject({status:'uncertain'});
  expect(fetch).toHaveBeenCalledOnce();
 });
 it('does not retry when the server wait would exceed the original total budget',async()=>{
  vi.useFakeTimers();let respond!:(response:Response)=>void;
  vi.mocked(fetch).mockImplementation(()=>new Promise<Response>(resolve=>{respond=resolve;}));
  const operation=dispatchSessionRetirement(retirementProof());
  await vi.advanceTimersByTimeAsync(29_000);respond(timedInitializing({'Retry-After':'2'}));
  await expect(operation).resolves.toMatchObject({status:'uncertain'});expect(fetch).toHaveBeenCalledOnce();
 });
 it('aborts the retry at the original deadline instead of restarting its timeout',async()=>{
  vi.useFakeTimers();vi.mocked(fetch).mockResolvedValueOnce(timedInitializing({'Retry-After':'2'}))
   .mockImplementationOnce(()=>new Promise<Response>(()=>{}));
  const operation=dispatchSessionRetirement(retirementProof());await vi.advanceTimersByTimeAsync(2000);
  expect(fetch).toHaveBeenCalledTimes(2);expect(vi.mocked(fetch).mock.calls[1][1]!.signal!.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(27_999);
  expect(vi.mocked(fetch).mock.calls[1][1]!.signal!.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await expect(operation).resolves.toMatchObject({status:'uncertain'});
  expect(vi.mocked(fetch).mock.calls[1][1]!.signal!.aborted).toBe(true);expect(fetch).toHaveBeenCalledTimes(2);
 });
 it.each(['connection','receipt body'])('bounds a stalled %s even when it ignores abort',async stage=>{
  vi.useFakeTimers();const never=new Promise<never>(()=>{});
  if(stage==='connection')vi.mocked(fetch).mockReturnValue(never);
  else{
   const response=new Response('{}');vi.spyOn(response,'json').mockReturnValue(never);
   vi.mocked(fetch).mockResolvedValue(response);
  }
  const operation=dispatchSessionRetirement(retirementProof());await vi.advanceTimersByTimeAsync(30_000);
  await expect(operation).resolves.toMatchObject({status:'uncertain'});
  expect(vi.mocked(fetch).mock.calls[0][1]!.signal!.aborted).toBe(true);expect(fetch).toHaveBeenCalledOnce();
 });
 it('cannot retry a startup response that arrives after the operation timed out',async()=>{
  vi.useFakeTimers();let respond!:(response:Response)=>void;
  vi.mocked(fetch).mockImplementation(()=>new Promise<Response>(resolve=>{respond=resolve;}));
  const operation=dispatchSessionRetirement(retirementProof());await vi.advanceTimersByTimeAsync(30_000);
  await expect(operation).resolves.toMatchObject({status:'uncertain'});
  respond(initializing());await vi.advanceTimersByTimeAsync(5000);expect(fetch).toHaveBeenCalledOnce();
 });
});

describe('R15 bounded undispatched retirement continuity',()=>{
 it('honors three consecutive undispatched Retry-After waits then accepts the fourth response with frozen A proof and request id',async()=>{
  vi.useFakeTimers();const authority=retirementProof();const requestId=vi.spyOn(crypto,'randomUUID');
  vi.mocked(fetch).mockImplementationOnce(async()=>{
   authority.proof='synthetic-new-proof';authority.lineage_id='synthetic-new-lineage';
   return timedInitializing({'Retry-After':'2'});
  }).mockResolvedValueOnce(timedInitializing({'Retry-After':'2'}))
   .mockResolvedValueOnce(timedInitializing({'Retry-After':'2'}))
   .mockResolvedValueOnce(new Response(JSON.stringify(retirementReceipt())));
  const operation=dispatchSessionRetirement(authority);
  await vi.advanceTimersByTimeAsync(1999);expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);expect(fetch).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(3999);expect(fetch).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(1);
  await expect(operation).resolves.toEqual({status:'retired',providerStatus:'not_applicable'});
  expect(fetch).toHaveBeenCalledTimes(4);expect(requestId).toHaveBeenCalledOnce();
  const calls=vi.mocked(fetch).mock.calls;
  for(const call of calls)expect(call).toEqual(calls[0]);
  expect(JSON.parse(calls[0][1]!.body as string)).toEqual({proof:'synthetic-proof-a',request_id:expect.any(String)});
  expect(calls[0][0]).toBe('/api/v2/auth/sessions/retire');
  expect(calls[0][1]).toMatchObject({credentials:'omit',cache:'no-store',redirect:'error',keepalive:true});
 });
 it('can accept the sixth response while honoring every five-second server wait within the original budget',async()=>{
  vi.useFakeTimers();vi.mocked(fetch).mockImplementation(async()=>timedInitializing({'Retry-After':'5'}));
  for(let i=0;i<5;i+=1)vi.mocked(fetch).mockResolvedValueOnce(timedInitializing({'Retry-After':'5'}));
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(retirementReceipt())));
  const operation=dispatchSessionRetirement(retirementProof());
  await vi.advanceTimersByTimeAsync(24_999);expect(fetch).toHaveBeenCalledTimes(5);
  await vi.advanceTimersByTimeAsync(1);
  await expect(operation).resolves.toMatchObject({status:'retired'});expect(fetch).toHaveBeenCalledTimes(6);
  expect(vi.mocked(fetch).mock.calls[5][1]!.signal!.aborted).toBe(false);
 });
 it.each(['network','abort','denied','ambiguous503'])('does not replay %s after an earlier confirmed undispatched response',async outcome=>{
  vi.useFakeTimers();vi.mocked(fetch).mockResolvedValueOnce(timedInitializing());
  if(outcome==='network')vi.mocked(fetch).mockRejectedValueOnce(new TypeError('synthetic network failure'));
  else if(outcome==='abort')vi.mocked(fetch).mockRejectedValueOnce(new DOMException('synthetic abort','AbortError'));
  else vi.mocked(fetch).mockResolvedValueOnce(new Response('{}',{status:outcome==='denied'?403:503}));
  const operation=dispatchSessionRetirement(retirementProof());await vi.advanceTimersByTimeAsync(250);
  await expect(operation).resolves.toEqual({status:'uncertain',providerStatus:'unknown'});
  await vi.advanceTimersByTimeAsync(30_000);expect(fetch).toHaveBeenCalledTimes(2);
 });
});
