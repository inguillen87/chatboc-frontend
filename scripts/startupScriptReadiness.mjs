// Test-only startup measurement: API polling must not define JavaScript readiness.
// Keep the original 500 ms settling interval, scoped to same-origin script requests.
export function createStartupScriptTracker(origin, now=()=>performance.now()) {
 const pending=new Set(),paths=new Set(),failures=[];let lastActivity=now();
 const requests=new Map(),frames=new WeakMap(),omittedRequests=new WeakSet();let nextRequest=0,nextFrame=0;
 const limits={maxRequests:80,maxEventsPerRequest:8,maxStringLength:512};
 const truncation={omittedRequests:0,omittedEvents:0,truncatedStrings:0};
 const bounded=value=>{if(value.length<=limits.maxStringLength)return value;truncation.truncatedStrings++;return value.slice(0,limits.maxStringLength);};
 const scriptPath=request=>{
  const url=new URL(request.url());
  return url.origin===origin&&(request.resourceType()==='script'||url.pathname.endsWith('.js'))?url.pathname:null;
 };
 const safeUrl=value=>{
  try {
   const url=new URL(value);
   return {protocol:bounded(url.protocol),origin:['http:','https:'].includes(url.protocol)?bounded(url.origin):null,
    path:['http:','https:'].includes(url.protocol)?bounded(url.pathname):null};
  } catch {return null;}
 };
 const safeErrorText=value=>{
  // Chromium supplies a network error code. Do not retain arbitrary text or URLs.
  const code=value.match(/^net::ERR_[A-Z0-9_]+\b/)?.[0];
  return code?{errorText:bounded(code),errorTextFormat:'observed-chromium-network-code',errorTextRedacted:code!==value}
   :{errorText:null,unavailable:'request.failure() text redacted: no Chromium network code'};
 };
 const frameDetails=request=>{
  let frame;
  try {frame=request.frame();if(!frame||(typeof frame!=='object'&&typeof frame!=='function'))throw new Error();}
  catch {return {available:false,reason:'request.frame() unavailable'};}
  if(!frames.has(frame))frames.set(frame,`frame-${++nextFrame}`);
  let isMainFrame=null,url=null;const unavailable=[];
  try {isMainFrame=frame===frame.page().mainFrame();}
  catch {unavailable.push('main frame comparison unavailable');}
  try {url=safeUrl(frame.url());if(!url)unavailable.push('frame URL unavailable');}
  catch {unavailable.push('frame URL unavailable');}
  return {available:true,frameId:frames.get(frame),isMainFrame,url,unavailable};
 };
 const timingDetails=request=>{
  try {
   const raw=request.timing(),values={};
   for(const field of ['startTime','domainLookupStart','domainLookupEnd','connectStart',
    'secureConnectionStart','connectEnd','requestStart','responseStart','responseEnd']){
    if(typeof raw?.[field]==='number'&&Number.isFinite(raw[field]))values[field]=raw[field];
   }
   return Object.keys(values).length?{values}:{unavailable:'request.timing() has no finite fields'};
  } catch {return {unavailable:'request.timing() unavailable'};}
 };
 const failureDetails=request=>{
  try {
   const value=request.failure();
   return typeof value?.errorText==='string'&&value.errorText
    ?safeErrorText(value.errorText)
    :{errorText:null,unavailable:'request.failure() has no error text'};
  } catch {return {errorText:null,unavailable:'request.failure() unavailable'};}
 };
 const observe=(request,path,type,at,extra={})=>{
  if(omittedRequests.has(request)){truncation.omittedEvents++;return;}
  let record=requests.get(request);
  if(!record){
   if(requests.size>=limits.maxRequests){omittedRequests.add(request);truncation.omittedRequests++;truncation.omittedEvents++;return;}
   let resourceType=null;
   try {resourceType=request.resourceType();}catch {/* Optional diagnostic only. */}
   record={requestId:`request-${++nextRequest}`,path:typeof path==='string'?bounded(path):null,
    resourceType:typeof resourceType==='string'?bounded(resourceType):null,startedAtMs:null,events:[],omittedEvents:0};
   requests.set(request,record);
  }
  if(type==='started'&&record.startedAtMs===null)record.startedAtMs=at;
  if(record.events.length>=limits.maxEventsPerRequest){record.omittedEvents++;truncation.omittedEvents++;return;}
  record.events.push({type,atMs:at,elapsedMs:record.startedAtMs===null?null:at-record.startedAtMs,
   frame:frameDetails(request),timing:timingDetails(request),...extra});
 };
 const finish=(request,type)=>{
  if(!pending.delete(request))return;
  const at=now();lastActivity=at;
  const path=requests.get(request)?.path??scriptPath(request);
  observe(request,path,type,at,type==='failed'?failureDetails(request):{});
 };
 const finished=request=>finish(request,'finished');
 return {
  started(request){const path=scriptPath(request);if(path){pending.add(request);paths.add(path);const at=now();lastActivity=at;observe(request,path,'started',at);}},
  finished,
  failed(request){if(pending.has(request)){failures.push({path:scriptPath(request),reason:'request_failed'});finish(request,'failed');}},
  responded(response){const request=response.request(),path=scriptPath(request);if(path){const status=response.status();if(status>=400)failures.push({path,status});observe(request,path,'response',now(),{status,ok:status>=200&&status<300});}},
  isSettled(){return paths.size>0&&pending.size===0&&now()-lastActivity>=500;},
  snapshot(){return {pendingScripts:pending.size,observedPaths:[...paths],failures:[...failures]};},
  diagnostics(){return {requests:structuredClone([...requests.values()]),limits:{...limits},truncation:{...truncation}};},
 };
}
