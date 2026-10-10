import React,{useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUp,BookOpen,ChevronRight,FileText,Loader2,MessageSquare,Plus,Search,Type} from 'lucide-react';
import {askWorkspace,changeWorkspace,loadWorkspace,knowledgeSourceExternalUrl,type KnowledgeWorkspace,type KnowledgeNode} from './institutionalAssistantContract';
import {KnowledgeSourceDialog,KnowledgeReviewDialog,type KnowledgeReview} from './InstitutionalAssistantDialogs';
import {KnowledgeSourceMetadata} from './InstitutionalAssistantSourceMetadata';
import {InstitutionalTextBlocks} from './InstitutionalTextBlocks';
import {InstitutionalResponseAudio} from './InstitutionalResponseAudio';
import {InstitutionalChoices,readInstitutionalChoiceNavigation} from './InstitutionalChoices';
import {institutionalChoiceLabel} from '@/features/chat/institutionalChatMessage';
import {captureChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
import {ViewState} from '@/components/app-shell/ViewState';
import {Button} from '@/components/ui/button';
import {safeInstitutionLogo,type PublishedTenantIdentity} from '@/utils/publishedTenantIdentity';
import './institutionalAssistant.css';
export interface PublicKnowledgeAvailability {tenantSlug:string;tenantId:number;revision:string}
interface Props {tenantSlug:string;sessionKey?:string;mode?:'admin'|'public';publicIdentity?:PublishedTenantIdentity|null;onPublicKnowledgeAvailability?:(value:PublicKnowledgeAvailability|null)=>void}
function InstitutionalIdentityMark({logo,name}:{logo:string|null;name:string}) {
  const [failed,setFailed]=useState(false);
  return <div className="institutional-assistant__mark" aria-hidden="true">
    {logo&&!failed?<img src={logo} alt="" onError={()=>setFailed(true)}/>:name.slice(0,1)}
  </div>;
}
export default function InstitutionalAssistant(props:Props) {
  if(!props.tenantSlug||(props.mode!=='public'&&!props.sessionKey))return null;
  return <AssistantSession key={`${props.mode??'admin'}:${props.tenantSlug}:${props.sessionKey??'public'}:${captureChatbocSessionRevision()}`} {...props}/>;
}
function AssistantSession({tenantSlug,mode='admin',publicIdentity,onPublicKnowledgeAvailability}:Props){
  const [workspace,setWorkspace]=useState<KnowledgeWorkspace|null>(null),[nodes,setNodes]=useState<KnowledgeNode[]>([]);
  const [lastUi,setLastUi]=useState<Record<string,string>|null>(null);
  const [question,setQuestion]=useState(''),[asked,setAsked]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  const [errorStatus,setErrorStatus]=useState<number|null>(null);
  const [failedAnswer,setFailedAnswer]=useState<{id:string;text?:string;revision:string|null;tenantId:number}|null>(null);
  const [showSources,setShowSources]=useState(false),[large,setLarge]=useState(false),[uncovered,setUncovered]=useState(false);
  const [highlightedSourceId,setHighlightedSourceId]=useState<string|null>(null);
  const [pending,setPending]=useState<KnowledgeReview|null>(null);
  const active=useRef(true),locked=useRef(false),heading=useRef<HTMLElement|null>(null),upload=useRef<HTMLInputElement>(null),serial=useRef(0);
  const questionId=useId();
  const pageHeading=useRef<HTMLHeadingElement>(null),reading=useRef<HTMLDivElement>(null);
  const sourcesTrigger=useRef<HTMLButtonElement>(null),reviewTrigger=useRef<HTMLElement|null>(null);
  const sourcesReturnFocus=useRef<HTMLElement|null>(null);
  const dialog=useRef<'sources'|'review'|null>(null),review=useRef<KnowledgeReview|null>(null);
  const returnToHeading=useRef(false),frame=useRef<number|null>(null);
  const recoveryFocus=useRef<number|null>(null);
  const published=mode==='public'&&workspace?.visibility==='public'&&workspace.can_edit===false&&workspace.tenant.slug===tenantSlug&&workspace.knowledge?workspace:null;
  const publishedTenantId=published?.tenant.id??null,publishedRevision=published?.revision??null;
  useEffect(()=>{
    if(mode!=='public')return;
    onPublicKnowledgeAvailability?.(publishedTenantId&&publishedRevision?{tenantSlug,tenantId:publishedTenantId,revision:publishedRevision}:null);
  },[mode,tenantSlug,publishedTenantId,publishedRevision,onPublicKnowledgeAvailability]);
  const focusResult=(seq:number)=>{
    if(frame.current!==null)cancelAnimationFrame(frame.current);
    frame.current=requestAnimationFrame(()=>{
      if(!active.current||serial.current!==seq||dialog.current)return;
      if(reading.current)reading.current.scrollTop=0;
      heading.current?.focus({preventScroll:true});
      heading.current?.scrollIntoView?.({block:'nearest',behavior:'auto'});
    });
  };
  const restoreReviewFocus=()=>{
    if(!active.current)return;
    const target=!returnToHeading.current&&reviewTrigger.current?.isConnected?reviewTrigger.current:pageHeading.current;
    target?.focus({preventScroll:true});
  };
  const cancelReview=()=>{review.current=null;dialog.current=null;setPending(null);};
  const openReview=(value:KnowledgeReview,origin:HTMLElement)=>{
    if(!workspace?.can_edit||mode!=='admin'||locked.current||dialog.current)return;
    returnToHeading.current=false;reviewTrigger.current=origin;review.current=value;dialog.current='review';setPending(value);
  };
  const changeSources=(open:boolean)=>{
    if(open&&(locked.current||dialog.current))return;
    dialog.current=open?'sources':null;setShowSources(open);
  };
  const current=nodes.at(-1)?.id??workspace?.knowledge?.start??'';
  const load=async(recovery=false)=>{
    if(recovery&&(!active.current||locked.current||dialog.current))return;
    recoveryFocus.current=null;
    const seq=++serial.current;locked.current=true;setBusy(true);setError(false);setErrorStatus(null);setFailedAnswer(null);setNodes([]);setPending(null);review.current=null;dialog.current=null;setShowSources(false);
    try{const data=await loadWorkspace(tenantSlug,mode);if(active.current&&serial.current===seq){if(recovery)recoveryFocus.current=seq;setWorkspace(data);setLastUi(data.ui);setNodes(data.knowledge?[data.knowledge.initial]:[]);setAsked('');setUncovered(false);}}
    catch(cause){if(active.current&&serial.current===seq){setError(true);setWorkspace(null);const status=cause&&typeof cause==='object'&&'status' in cause?cause.status:null;setErrorStatus(status===401||status===403?status:null);}}
    finally{if(active.current&&serial.current===seq){setBusy(false);locked.current=false;}}
  };
  useLayoutEffect(()=>{
    const seq=recoveryFocus.current;if(seq===null||busy)return;
    recoveryFocus.current=null;
    if(!workspace||!active.current||serial.current!==seq||dialog.current)return;
    if(frame.current!==null)cancelAnimationFrame(frame.current);
    frame.current=requestAnimationFrame(()=>{
      if(!active.current||serial.current!==seq||dialog.current)return;
      const target=heading.current?.isConnected?heading.current:pageHeading.current;
      if(!target?.isConnected)return;
      if(reading.current)reading.current.scrollTop=0;
      target.focus({preventScroll:true});target.scrollIntoView?.({block:'nearest',behavior:'auto'});
    });
  },[busy,workspace,nodes]);
  useEffect(()=>{active.current=true;void load();return()=>{active.current=false;serial.current++;if(frame.current!==null)cancelAnimationFrame(frame.current);};},[]);
  const navigate=async(id:string,text?:string)=>{
    if(!workspace||locked.current||dialog.current)return;const currentWorkspace=workspace;
    locked.current=true;setBusy(true);setError(false);setFailedAnswer(null);setShowSources(false);const seq=++serial.current;
    try{const response=await askWorkspace(currentWorkspace,mode,{node_id:id,...(text?{question:text}:{})});
      if(active.current&&serial.current===seq){setNodes(response.nodes);setAsked(text??'');if(text)setQuestion('');setUncovered(!response.nodes.length);focusResult(seq);}}
    catch(cause){if(active.current&&serial.current===seq){
      setError(true);
      const status=cause&&typeof cause==='object'&&'status' in cause?cause.status:null;
      if(status===503)setFailedAnswer({id,text,revision:currentWorkspace.revision,tenantId:currentWorkspace.tenant.id});
      else {setWorkspace(null);setNodes([]);setFailedAnswer(null);}
      focusResult(seq);
    }}
    finally{if(active.current&&serial.current===seq){setBusy(false);locked.current=false;}}
  };
  const retryAnswer=()=>{
    if(failedAnswer&&workspace&&failedAnswer.revision===workspace.revision&&failedAnswer.tenantId===workspace.tenant.id)
      void navigate(failedAnswer.id,failedAnswer.text);
    else void load(true);
  };
  const importFile=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];event.target.value='';
    if(!file||!workspace?.can_edit||mode!=='admin'||locked.current||dialog.current)return;
    if(file.size>1_000_000){setFailedAnswer(null);setError(true);return;}
    const seq=++serial.current;locked.current=true;setBusy(true);setError(false);setFailedAnswer(null);
    try{
      const bundle=JSON.parse(await file.text());
      if(active.current&&serial.current===seq){
        const value:KnowledgeReview={operation:'import',bundle,filename:file.name};
        returnToHeading.current=false;review.current=value;dialog.current='review';setPending(value);
      }
    }catch{if(active.current&&serial.current===seq){setError(true);focusResult(seq);}}
    finally{if(active.current&&serial.current===seq){setBusy(false);locked.current=false;}}
  };
  const confirm=async()=>{
    if(!workspace?.can_edit||mode!=='admin'||!review.current||locked.current)return;
    const previous=workspace;locked.current=true;setBusy(true);setError(false);setFailedAnswer(null);const op=review.current;returnToHeading.current=true;review.current=null;dialog.current=null;setPending(null);setNodes([]);const seq=++serial.current;
    try{const receipt=await changeWorkspace(previous,op.operation,op.bundle);if(!active.current||serial.current!==seq)return;const fresh=await loadWorkspace(tenantSlug,mode);
      if(receipt.revision!==fresh.revision||receipt.visibility!==fresh.visibility)throw new Error('knowledge_write_unconfirmed');
      if(active.current&&serial.current===seq){setWorkspace(fresh);setLastUi(fresh.ui);setNodes(fresh.knowledge?[fresh.knowledge.initial]:[]);setAsked('');setUncovered(false);}}
    catch{if(active.current&&serial.current===seq){setError(true);setWorkspace(null);focusResult(seq);}}
    finally{if(active.current&&serial.current===seq){setBusy(false);locked.current=false;}}
  };
  if(!workspace){
    if(error&&lastUi)return <section className="institutional-assistant"><div className="institutional-assistant__notice" ref={element=>{heading.current=element;}} role="alert" tabIndex={-1}><p>{lastUi.error}</p><button type="button" disabled={busy} onClick={()=>void load(true)}>{lastUi.retry}</button></div></section>;
    if(error)return <div role="alert"><ViewState status={errorStatus?'denied':'error'} title={errorStatus?'No tenés acceso al conocimiento de esta organización':'No pudimos cargar el conocimiento'}
      action={<Button variant="outline" disabled={busy} onClick={()=>void load(true)}>Reintentar</Button>}/></div>;
    return <div role="status"><ViewState status="loading" title="Cargando conocimiento"/></div>;
  }
  const ui=workspace.ui,knowledge=workspace.knowledge;
  const publicLogo=mode==='public'&&publicIdentity?.tenantId===workspace.tenant.id&&publicIdentity.tenantSlug===workspace.tenant.slug
    ?safeInstitutionLogo(publicIdentity.logoUrl):null;
  const actions=nodes.flatMap(n=>n.actions).filter((a,i,list)=>list.findIndex(b=>b.target===a.target&&b.label===a.label)===i);
  const topicNavigation=<nav aria-label={ui.topics}>{knowledge?.topics.map(topic=><button type="button" key={topic.id} disabled={busy||Boolean(pending)} aria-current={current===topic.id?'page':undefined} onClick={()=>navigate(topic.id)}><span>{topic.label}</span><ChevronRight size={15}/></button>)}</nav>;
  return <section className={`institutional-assistant${mode==='public'?' institutional-assistant--public':''}${large?' institutional-assistant--large':''}`} data-testid="institutional-assistant" aria-label={ui.heading}>
    <header className="institutional-assistant__header">
      <div className="institutional-assistant__identity"><InstitutionalIdentityMark key={`${workspace.tenant.id}:${publicLogo??''}`} logo={publicLogo} name={workspace.tenant.name}/>
        <div><p>{workspace.tenant.name}</p><h2 ref={pageHeading} tabIndex={-1}>{ui.heading}</h2></div></div>
      <div className="institutional-assistant__utilities"><button type="button" aria-label={ui.large_text} aria-pressed={large} onClick={()=>setLarge(v=>!v)}><Type size={19}/></button>
        <button ref={sourcesTrigger} type="button" disabled={busy||!knowledge||Boolean(pending)} onClick={event=>{sourcesReturnFocus.current=event.currentTarget;setHighlightedSourceId(null);changeSources(true);}} aria-label={ui.sources} aria-haspopup="dialog" aria-expanded={showSources}><BookOpen size={17}/><span>{ui.sources}</span></button></div>
    </header>
    <div className="institutional-assistant__body">
      {mode==='admin'?<aside className="institutional-assistant__sidebar"><p className="institutional-assistant__eyebrow">{ui.topics}</p>
        {topicNavigation}
        {knowledge?<div className="institutional-assistant__version"><span>{ui.version} {knowledge.version}</span><span>{ui[workspace.visibility]??workspace.visibility}</span></div>:null}
        {workspace.can_edit?<div className="institutional-assistant__management"><input ref={upload} type="file" accept="application/json,.json" onChange={importFile} hidden/>
          <button type="button" disabled={busy} onClick={event=>{reviewTrigger.current=event.currentTarget;upload.current?.click();}}><Plus size={16}/>{ui.import}</button>
          {knowledge?<button type="button" disabled={busy||error||Boolean(pending)} onClick={event=>openReview({operation:workspace.visibility==='public'?'retire':'publish'},event.currentTarget)}>{workspace.visibility==='public'?ui.retire:ui.publish}</button>:null}</div>:null}
      </aside>:null}
      <div className="institutional-assistant__conversation">
        <div className="institutional-assistant__topline"><button type="button" disabled={busy||!knowledge||Boolean(pending)} onClick={()=>knowledge&&navigate(knowledge.start)}><ArrowLeft size={15}/>{ui.home}</button><span>{ui.evidence}</span></div>
        {mode==='public'&&knowledge&&current!==knowledge.start&&nodes.length>0?<details key={current} className="institutional-assistant__topic-index"><summary>{ui.topics}</summary>{topicNavigation}</details>:null}
        <div ref={reading} className="institutional-assistant__reading" aria-label={ui.answer} role="region" tabIndex={0} aria-busy={busy}>
          {asked?<div className="institutional-assistant__question"><MessageSquare size={16}/><p>{asked}</p></div>:null}
          {busy?<div className="institutional-assistant__loading" role="status"><Loader2 size={22} className="animate-spin"/><p>{ui.loading}</p></div>:null}
          {error?<div ref={element=>{heading.current=element;}} tabIndex={-1} role="alert" className="institutional-assistant__notice"><p>{ui.error}</p><button type="button" disabled={busy} onClick={retryAnswer}>{ui.retry}</button></div>:null}
          {!busy&&!error&&!pending&&!knowledge?<div className="institutional-assistant__empty"><BookOpen size={32}/><h3>{ui.empty}</h3><p>{ui.import_help}</p></div>:null}
          {uncovered&&!busy&&!error?<p ref={element=>{heading.current=element;}} tabIndex={-1} role="status" className="institutional-assistant__uncovered">{ui.unknown}</p>:null}
          {(!error||failedAnswer)&&nodes.map((node,index)=><article key={node.id} className="institutional-assistant__answer">
            <h3 ref={index===0&&!error?element=>{heading.current=element;}:undefined} tabIndex={-1}>{node.title}</h3><div className="institutional-assistant__prose"><InstitutionalTextBlocks text={node.text}/></div>
            {node.links.length>0?<div className="institutional-assistant__links">{node.links.map(link=><a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<ChevronRight size={15}/></a>)}</div>:null}
            <details className="institutional-assistant__citations"><summary><FileText size={15}/>{ui.source_details}</summary>
              {node.sources.map(source=><div key={source.id}><p>{source.title} {source.pagination!=='logical_snapshot'?<span>· {source.pages?.join(', ')}</span>:null}{knowledgeSourceExternalUrl(source,mode)?<a href={knowledgeSourceExternalUrl(source,mode)!} target="_blank" rel="noopener noreferrer">{source.title}</a>:null}</p>
               <KnowledgeSourceMetadata source={source} compact mode={mode}/>
               <button type="button" disabled={busy||Boolean(pending)} onClick={event=>{sourcesReturnFocus.current=event.currentTarget;setHighlightedSourceId(source.id);changeSources(true);}} aria-haspopup="dialog">Ver fuente<span className="sr-only">: {source.title}</span></button>
               {source.excerpts?.map((quote,i)=><blockquote key={i}><p>{quote.text}</p><cite>{source.title}{source.pagination!=='logical_snapshot'?` · ${quote.page??source.pages?.join(', ')}`:''}</cite></blockquote>)}</div>)}</details>
          </article>)}
          {mode==='public'&&!busy&&!error&&!showSources&&workspace.audio_reading&&workspace.revision&&nodes.length>0?
            <InstitutionalResponseAudio scope={{tenant:workspace.tenant,revision:workspace.revision,nodeIds:nodes.map(node=>node.id)}} copy={workspace.audio_reading}/>:null}
          {!busy&&!error?<InstitutionalChoices actions={actions} navigation={readInstitutionalChoiceNavigation(ui)} responseIdentity={nodes}
            disabled={Boolean(pending)||showSources} className="institutional-assistant__choices"
            renderChoice={action=>{
              const label=institutionalChoiceLabel(action.label);
              return <button type="button" key={`${action.target}:${action.label}`} disabled={Boolean(pending)} onClick={()=>navigate(action.target)}>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="inline-flex min-w-[1.5em] shrink-0 justify-center font-semibold tabular-nums">{action.code}</span>
                  {label.emoji?<span aria-hidden="true" className="shrink-0">{label.emoji}</span>:null}<span>{label.words}</span>
                </span><ChevronRight size={16} aria-hidden="true"/>
              </button>;
            }}/>:null}
        </div>
        {knowledge?<form className="institutional-assistant__composer" onSubmit={event=>{event.preventDefault();if(question.trim())void navigate(current,question.trim());}}>
          <label htmlFor={`knowledge-question-${questionId}`}>{ui.question}</label><div><Search size={19}/><textarea id={`knowledge-question-${questionId}`} rows={2} autoComplete="off" maxLength={1800} value={question}
            onChange={event=>{setQuestion(event.target.value);if(failedAnswer){setFailedAnswer(null);setError(false);}}} placeholder={ui.placeholder} disabled={busy||Boolean(pending)}
            onKeyDown={event=>{
              if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&event.nativeEvent.keyCode!==229){
                event.preventDefault();if(question.trim())void navigate(current,question.trim());
              }
            }}/>

          <button type="submit" className="institutional-assistant__primary" disabled={busy||!question.trim()||error||Boolean(pending)} aria-label={ui.send}><ArrowUp size={21}/></button></div></form>:null}
      </div>
    </div>
    <KnowledgeSourceDialog key={`${workspace.tenant.id}:${workspace.revision}`} workspace={workspace} open={showSources} onOpenChange={changeSources} mode={mode} highlightedSourceId={highlightedSourceId} largeText={large}
      restoreFocus={()=>{const target=sourcesReturnFocus.current?.isConnected?sourcesReturnFocus.current:sourcesTrigger.current;if(active.current&&target?.isConnected)target.focus({preventScroll:true});}}/>
    <KnowledgeReviewDialog workspace={workspace} pending={pending} onCancel={cancelReview} onConfirm={()=>void confirm()} restoreFocus={restoreReviewFocus} largeText={large}/>
  </section>;
}
