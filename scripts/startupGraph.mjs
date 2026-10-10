import {readFile,stat,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

export const STARTUP_ENTRIES=['index.html','portal/index.html','iframe.html','demo/institucional/tdf-discapacidad/index.html'];
export const HEAVY_STARTUP_CHUNK=/^assets\/vendor-(?:charts|pdf|compression|xlsx|docx|canvas-export|maplibre|google-maps|flow)-/;
export const STARTUP_BUDGETS={'index.html':1600000,'portal/index.html':1100000,'iframe.html':550000,'demo/institucional/tdf-discapacidad/index.html':420000};

export function staticChunkClosure(manifest,entry){
  const visited=new Set(),files=[];
  const visit=key=>{
    if(visited.has(key))return;
    const chunk=manifest[key];
    if(!chunk||typeof chunk.file!=='string'||!Array.isArray(chunk.imports??[]))throw new Error(`Invalid build manifest entry: ${key}`);
    if(!/^assets\/[^/]+\.js$/.test(chunk.file))throw new Error(`Unsafe build asset: ${chunk.file}`);
    visited.add(key);files.push(chunk.file);
    for(const dependency of chunk.imports??[])visit(dependency);
  };
  visit(entry);return [...new Set(files)].sort();
}

export function assertStartupReport(report){
  for(const [entry,budget] of Object.entries(STARTUP_BUDGETS)){
    const row=report.entries.find(item=>item.entry===entry);
    if(!row)throw new Error(`Missing startup entry: ${entry}`);
    const heavy=row.files.filter(file=>HEAVY_STARTUP_CHUNK.test(file.file));
    if(heavy.length)throw new Error(`Feature bundle in startup ${entry}: ${heavy.map(item=>item.file).join(', ')}`);
    if(row.decodedBytes>budget)throw new Error(`Startup budget exceeded ${entry}: ${row.decodedBytes} > ${budget}`);
  }
  if(report.precache.count>=80||report.precache.decodedBytes>=4*1024*1024)throw new Error('Offline shell exceeded its existing budget');
}

export async function inspectStartup(directory='dist'){
  const manifest=JSON.parse(await readFile(path.join(directory,'.vite/manifest.json'),'utf8'));
  const entries=[];
  for(const entry of STARTUP_ENTRIES){
    const files=[];
    for(const file of staticChunkClosure(manifest,entry)){
      const bytes=await readFile(path.join(directory,file));
      files.push({file,decodedBytes:bytes.length,gzipBytes:gzipSync(bytes,{level:9}).length});
    }
    entries.push({entry,chunks:files.length,decodedBytes:files.reduce((sum,item)=>sum+item.decodedBytes,0),gzipBytes:files.reduce((sum,item)=>sum+item.gzipBytes,0),files});
  }
  const worker=await readFile(path.join(directory,'sw.js'),'utf8');
  const urls=[...worker.matchAll(/\{url:"([^"]+)"/g)].map(match=>match[1]);
  if(new Set(urls).size!==urls.length)throw new Error('Duplicate offline precache assets');
  let decodedBytes=0;
  for(const url of urls){
    const asset=url.split(/[?#]/,1)[0];
    const absolute=path.resolve(directory,asset);
    if(!absolute.startsWith(path.resolve(directory)+path.sep))throw new Error('Unsafe offline asset');
    decodedBytes+=(await stat(absolute)).size;
  }
  return {entries,precache:{count:urls.length,decodedBytes},measurement:'Uncompressed build bytes and reproducible gzip estimates, not network latency'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [directory='dist',output='.vercel/startup-evidence/graph.json',mode='check']=process.argv.slice(2);
  const report=await inspectStartup(directory);
  await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({entries:report.entries.map(({files,...rest})=>rest),precache:report.precache}));
  if(mode==='check')assertStartupReport(report);
}
