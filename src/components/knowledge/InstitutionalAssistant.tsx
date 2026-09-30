import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUp,BookOpen,ChevronRight,FileText,Loader2,MessageSquare,Plus,Search,Type,X} from 'lucide-react';
import {askWorkspace,changeWorkspace,loadWorkspace,publicKnowledgeUrl,type KnowledgeWorkspace,type KnowledgeNode} from './institutionalAssistantContract';
import './institutionalAssistant.css';
interface Props {tenantSlug:string;sessionKey?:string;mode?:'admin'|'public'}
export default function InstitutionalAssistant(props:Props) {
  if(!props.tenantSlug||(props.mode!=='public'&&!props.sessionKey))return null;
  return <AssistantSession key={`${props.mode??'admin'}:${props.tenantSlug}:${props.sessionKey??'public'}`} {...props}/>;
}
function AssistantSession({tenantSlug,mode='admin'}:Props){
  const [workspace,setWorkspace]=useState<KnowledgeWorkspace|null>(null),[nodes,setNodes]=useState<KnowledgeNode[]>([]);
  const [lastUi,setLastUi]=useState<Record<string,string>|null>(null);
  const [question,setQuestion]=useState(''),[asked,setAsked]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  const [showSources,setShowSources]=useState(false),[large,setLarge]=useState(false),[uncovered,setUncovered]=useState(false);
  const [pending,setPending]=useState<{operation:'import'|'publish'|'retire';bundle?:unknown}|null>(null);
  const active=useRef(true),locked=useRef(false),heading=useRef<HTMLHeadingElement>(null),upload=useRef<HTMLInputElement>(null),serial=useRef(0);
  const current=nodes.at(-1)?.id??workspace?.knowledge?.start??'';
  const load=async()=>{
    const seq=++serial.current;locked.current=true;setBusy(true);setError(false);setNodes([]);setPending(null);
    try{const data=await loadWorkspace(tenantSlug,mode);if(active.current&&serial.current===seq){setWorkspace(data);setLastUi(data.ui);setNodes(data.knowledge?[data.knowledge.initial]:[]);setAsked('');setUncovered(false);}}
    catch{if(active.current&&serial.current===seq){setError(true);setWorkspace(null);}}
    finally{if(active.current&&serial.current===seq){setBusy(false);locked.current=false;}}
  };
  useEffect(()=>{active.current=true;void load();return()=>{active.current=false;serial.current++;};},[]);
  const navigate=async(id:string,text?:string)=>{
    if(!workspace||locked.current)return;const currentWorkspace=workspace;
    locked.current=true;setBusy(true);setError(false);setNodes([]);setUncovered(false);setShowSources(false);const seq=++serial.current;
    if(text){setAsked(text);setQuestion('');}else setAsked('');
    try{const response=await askWorkspace(currentWorkspace,mode,{node_id:id,...(text?{question:text}:{})});
      if(active.current&&serial.current===seq){setNodes(response.nodes);setUncovered(!response.nodes.length);requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));}}
    catch{if(active.current&&serial.current===seq){setError(true);setWorkspace(null);}}
    finally{if(active.current&&serial.current===seq){setBusy(false);locked.current=false;}}
  };
  const importFile=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];event.target.value='';if(!file||!workspace||locked.current)return;
    if(file.size>1_000_000){setError(true);return;}
    const seq=++serial.current;
    try{const bundle=JSON.parse(await file.text());if(active.current&&serial.current===seq)setPending({operation:'import',bundle});}catch{if(active.current)setError(true);}
  };
  const confirm=async()=>{
    if(!workspace||!pending||locked.current)return;
    const previous=workspace;locked.current=true;setBusy(true);setError(false);const op=pending;setPending(null);setNodes([]);const seq=++serial.current;
    try{const receipt=await changeWorkspace(previous,op.operation,op.bundle);if(!active.current||serial.current!==seq)return;const fresh=await loadWorkspace(tenantSlug,mode);
      if(receipt.revision!==fresh.revision||receipt.visibility!==fresh.visibility)throw new Error('knowledge_write_unconfirmed');
      if(active.current&&serial.current===seq){setWorkspace(fresh);setLastUi(fresh.ui);setNodes(fresh.knowledge?[fresh.knowledge.initial]:[]);setAsked('');setUncovered(false);}}
    catch{if(active.current&&serial.current===seq){setError(true);setWorkspace(null);}}
    finally{if(active.current&&serial.current===seq){setBusy(false);locked.current=false;}}
  };
  // Older installations without this API remain unchanged. Never supply fictitious content.
  if(!workspace)return error&&lastUi?<section className="institutional-assistant"><div className="institutional-assistant__notice" role="alert"><p>{lastUi.error}</p><button type="button" disabled={busy} onClick={()=>void load()}>{lastUi.retry}</button></div></section>:null;
  const ui=workspace.ui,knowledge=workspace.knowledge;
  const actions=nodes.flatMap(n=>n.actions).filter((a,i,list)=>list.findIndex(b=>b.target===a.target&&b.label===a.label)===i);
  return <section className={`institutional-assistant${large?' institutional-assistant--large':''}`} data-testid="institutional-assistant" aria-label={ui.heading}>
    <header className="institutional-assistant__header">
      <div className="institutional-assistant__identity"><div className="institutional-assistant__mark" aria-hidden="true">{workspace.tenant.name.slice(0,1)}</div>
        <div><p>{workspace.tenant.name}</p><h2>{ui.heading}</h2></div></div>
      <div className="institutional-assistant__utilities"><button type="button" aria-label={ui.large_text} aria-pressed={large} onClick={()=>setLarge(v=>!v)}><Type size={19}/></button>
        <button type="button" onClick={()=>setShowSources(v=>!v)} aria-label={ui.sources} aria-expanded={showSources}><BookOpen size={17}/><span>{ui.sources}</span></button></div>
    </header>
    <div className="institutional-assistant__body">
      <aside className="institutional-assistant__sidebar"><p className="institutional-assistant__eyebrow">{ui.topics}</p>
        <nav aria-label={ui.topics}>{knowledge?.topics.map(topic=><button type="button" key={topic.id} disabled={busy} aria-current={current===topic.id?'page':undefined} onClick={()=>navigate(topic.id)}><span>{topic.label}</span><ChevronRight size={15}/></button>)}</nav>
        {knowledge?<div className="institutional-assistant__version"><span>{ui.version} {knowledge.version}</span><span>{ui[workspace.visibility]??workspace.visibility}</span></div>:null}
        {workspace.can_edit?<div className="institutional-assistant__management"><input ref={upload} type="file" accept="application/json,.json" onChange={importFile} hidden/>
          <button type="button" disabled={busy} onClick={()=>upload.current?.click()}><Plus size={16}/>{ui.import}</button>
          {knowledge?<button type="button" disabled={busy||error} onClick={()=>setPending({operation:workspace.visibility==='public'?'retire':'publish'})}>{workspace.visibility==='public'?ui.retire:ui.publish}</button>:null}</div>:null}
      </aside>
      <div className="institutional-assistant__conversation">
        <div className="institutional-assistant__topline"><button type="button" disabled={busy||!knowledge} onClick={()=>knowledge&&navigate(knowledge.start)}><ArrowLeft size={15}/>{ui.home}</button><span>{ui.evidence}</span></div>
        <div className="institutional-assistant__reading" aria-busy={busy}>
          {asked?<div className="institutional-assistant__question"><MessageSquare size={16}/><p>{asked}</p></div>:null}
          {busy?<div className="institutional-assistant__loading" role="status"><Loader2 size={22} className="animate-spin"/><p>{ui.loading}</p></div>:null}
          {error?<div role="alert" className="institutional-assistant__notice"><p>{ui.error}</p><button type="button" disabled={busy} onClick={()=>void load()}>{ui.retry}</button></div>:null}
          {pending?<div className="institutional-assistant__confirmation" role="group" aria-label={ui.confirm}>
            <h3>{pending.operation==='import'?ui.import:pending.operation==='publish'?ui.publish:ui.retire}</h3><p>{pending.operation==='import'?ui.import_help:pending.operation==='publish'?ui.confirm_publish:ui.confirm_retire}</p>
            <div><button type="button" onClick={()=>setPending(null)}>{ui.cancel}</button><button type="button" className="institutional-assistant__primary" onClick={()=>void confirm()}>{ui.confirm}</button></div></div>:null}
          {!busy&&!error&&!pending&&!knowledge?<div className="institutional-assistant__empty"><BookOpen size={32}/><h3>{ui.empty}</h3><p>{ui.import_help}</p></div>:null}
          {uncovered&&!busy&&!error?<p>{ui.unknown}</p>:null}
          {!error&&!pending&&nodes.map((node,index)=><article key={node.id} className="institutional-assistant__answer">
            <h3 ref={index===0?heading:undefined} tabIndex={-1}>{node.title}</h3><div className="institutional-assistant__prose">{node.text.split(/\n\n+/).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div>
            {node.links.length>0?<div className="institutional-assistant__links">{node.links.map(link=><a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<ChevronRight size={15}/></a>)}</div>:null}
            <details className="institutional-assistant__citations"><summary><FileText size={15}/>{ui.source_details}</summary>
              {node.sources.map(source=><div key={source.id}><p>{source.title} <span>· {source.pages?.join(', ')}</span>{publicKnowledgeUrl(source.url)?<a href={publicKnowledgeUrl(source.url)!} target="_blank" rel="noopener noreferrer">{source.title}</a>:null}</p>{source.excerpts?.map((quote,i)=><blockquote key={i}><p>{quote.text}</p><cite>{source.title} · {quote.page??source.pages?.join(', ')}</cite></blockquote>)}</div>)}</details>
          </article>)}
          {!busy&&!error&&!pending&&actions.length>0?<div className="institutional-assistant__choices">{actions.map(action=><button type="button" key={`${action.target}:${action.label}`} onClick={()=>navigate(action.target)}><span>{action.label}</span><ChevronRight size={16}/></button>)}</div>:null}
        </div>
        {knowledge?<form className="institutional-assistant__composer" onSubmit={event=>{event.preventDefault();if(question.trim())void navigate(current,question.trim());}}>
          <label htmlFor={`knowledge-question-${tenantSlug}`}>{ui.question}</label><div><Search size={19}/><input id={`knowledge-question-${tenantSlug}`} type="text" autoComplete="off" maxLength={1800} value={question} onChange={e=>setQuestion(e.target.value)} placeholder={ui.placeholder} disabled={busy}/>
          <button type="submit" className="institutional-assistant__primary" disabled={busy||!question.trim()||error} aria-label={ui.send}><ArrowUp size={21}/></button></div></form>:null}
      </div>
    </div>
    {showSources?<aside className="institutional-assistant__sources" aria-label={ui.sources}><div><h3>{ui.sources}</h3><button type="button" aria-label={ui.close} onClick={()=>setShowSources(false)}><X size={19}/></button></div>
      {knowledge?.sources.map(source=><article key={source.id}><FileText size={20}/><p>{source.title}</p>{publicKnowledgeUrl(source.url)?<a href={publicKnowledgeUrl(source.url)!} target="_blank" rel="noopener noreferrer">{source.title}</a>:null}</article>)}</aside>:null}
  </section>;
}
