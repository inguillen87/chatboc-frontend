// Test-only startup measurement: API polling must not define JavaScript readiness.
// Keep the original 500 ms settling interval, scoped to same-origin script requests.
export function createStartupScriptTracker(origin, now=()=>performance.now()) {
 const pending=new Set(),paths=new Set(),failures=[];let lastActivity=now();
 const scriptPath=request=>{
  const url=new URL(request.url());
  return url.origin===origin&&(request.resourceType()==='script'||url.pathname.endsWith('.js'))?url.pathname:null;
 };
 const finished=request=>{if(pending.delete(request))lastActivity=now();};
 return {
  started(request){const path=scriptPath(request);if(path){pending.add(request);paths.add(path);lastActivity=now();}},
  finished,
  failed(request){if(pending.has(request)){failures.push({path:scriptPath(request),reason:'request_failed'});finished(request);}},
  responded(response){const path=scriptPath(response.request());if(path&&response.status()>=400)failures.push({path,status:response.status()});},
  isSettled(){return paths.size>0&&pending.size===0&&now()-lastActivity>=500;},
  snapshot(){return {pendingScripts:pending.size,observedPaths:[...paths],failures:[...failures]};},
 };
}
