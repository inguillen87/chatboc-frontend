import React,{useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUp,BookOpen,ChevronRight,FileText,Loader2,MessageSquare,Plus,Printer,Search,Share2,Type} from 'lucide-react';
import {askWorkspace,changeWorkspace,loadWorkspace,knowledgeSourceExternalUrl,isKnowledgeSourceNavigation,readKnowledgeAcronyms,type KnowledgeWorkspace,type KnowledgeNode,type KnowledgeSourceNavigationAnswer} from './institutionalAssistantContract';
import {KnowledgeSourceDialog,KnowledgeReviewDialog,type KnowledgeReview} from './InstitutionalAssistantDialogs';
import {KnowledgeSourceMetadata} from './InstitutionalAssistantSourceMetadata';
import {KnowledgeQuestionMetricsPanel} from './InstitutionalAssistantMetrics';
import {KnowledgeTestBatteryPanel} from './InstitutionalAssistantBattery';
import {InstitutionalAcronyms,InstitutionalNoAnswerFallback,InstitutionalTextBlocks,buildInstitutionalPortalUrl,buildInstitutionalWhatsAppUrl,formatInstitutionalPrintDate,openInstitutionalWhatsAppShare,readInstitutionalLargeText,rememberInstitutionalLargeText,resolveInstitutionalNoAnswerLabels,resolveInstitutionalShareLabels} from './InstitutionalTextBlocks';
import {InstitutionalResponseAudio} from './InstitutionalResponseAudio';
import {InstitutionalEasyRead} from './InstitutionalEasyRead';
import {InstitutionalChoices,readInstitutionalChoiceNavigation} from './InstitutionalChoices';
import {institutionalChoiceLabel,institutionalInitialMenuContext,institutionalPresentationMode,type InstitutionalPresentationMode} from '@/features/chat/institutionalChatMessage';
import {captureChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
import {ViewState} from '@/components/app-shell/ViewState';
import {Button} from '@/components/ui/button';
import {safeInstitutionLogo,type PublishedTenantIdentity} from '@/utils/publishedTenantIdentity';
import {TENANT_READ_ALOUD_TARGET_ID,useTenantAccessibility} from '@/components/tenant/TenantAccessibilityBar';
import './institutionalAssistant.css';
export interface PublicKnowledgeAvailability {tenantSlug:string;tenantId:number;revision:string}
export type PublicKnowledgeLoadState='loading'|'published'|'unavailable'|'error';
interface Props {tenantSlug:string;sessionKey?:string;mode?:'admin'|'public';publicIdentity?:PublishedTenantIdentity|null;publicLayout?:'reader'|'services';onPublicKnowledgeAvailability?:(value:PublicKnowledgeAvailability|null)=>void;onPublicKnowledgeState?:(value:PublicKnowledgeLoadState)=>void}
function InstitutionalIdentityMark({logo,name}:{logo:string|null;name:string}) {
  const [failed,setFailed]=useState(false);
  return <div className="institutional-assistant__mark" aria-hidden="true">
    {logo&&!failed?<img src={logo} alt="" onError={()=>setFailed(true)}/>:name.slice(0,1)}
  </div>;
}
const BATTERY_UI_KEYS=['test_battery','test_battery_description','test_battery_input','test_battery_limit','test_battery_run','test_battery_stop',
  'test_battery_summary','test_battery_question','test_battery_result','test_battery_topic','test_battery_answered','test_battery_uncovered',
  'test_battery_sources','test_battery_failed','test_battery_pending'] as const;
export default function InstitutionalAssistant(props:Props) {
  if(!props.tenantSlug||(props.mode!=='public'&&!props.sessionKey))return null;
  return <AssistantSession key={`${props.mode??'admin'}:${props.tenantSlug}:${props.sessionKey??'public'}:${captureChatbocSessionRevision()}`} {...props}/>;
}
function AssistantSession({tenantSlug,mode='admin',publicIdentity,publicLayout='reader',onPublicKnowledgeAvailability,onPublicKnowledgeState}:Props){
  const tenantAccessibility=useTenantAccessibility();
  const servicesLayout=mode==='public'&&publicLayout==='services';
  const [workspace,setWorkspace]=useState<KnowledgeWorkspace|null>(null),[nodes,setNodes]=useState<KnowledgeNode[]>([]);
  // A typed «explicámelo más simple» opens the easy-read version of that answer.
  const [easyReadRequest,setEasyReadRequest]=useState<{nodeId:string;token:number}|null>(null);
  // Canonical nodes that stay the conversation topic while an uncovered question is shown.
  const [topic,setTopic]=useState<KnowledgeNode[]>([]);
  const [lastUi,setLastUi]=useState<Record<string,string>|null>(null);
  const [presentation,setPresentation]=useState<InstitutionalPresentationMode>('answer');
  const [question,setQuestion]=useState(''),[asked,setAsked]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  const [errorStatus,setErrorStatus]=useState<number|null>(null);
  const [failedAnswer,setFailedAnswer]=useState<{id:string;text?:string;revision:string|null;tenantId:number}|null>(null);
  const [showSources,setShowSources]=useState(false),[localLarge,setLocalLarge]=useState(readInstitutionalLargeText),[uncovered,setUncovered]=useState(false);
  const [sourceNavigation,setSourceNavigation]=useState<(KnowledgeSourceNavigationAnswer&{originNodeId:string})|null>(null);
  const [highlightedSourceId,setHighlightedSourceId]=useState<string|null>(null);
  const [pending,setPending]=useState<KnowledgeReview|null>(null);
  const [printDate,setPrintDate]=useState<Date>(()=>new Date());
  const active=useRef(true),locked=useRef(false),heading=useRef<HTMLElement|null>(null),upload=useRef<HTMLInputElement>(null),serial=useRef(0);
  const questionId=useId();
  const assistantRoot=useRef<HTMLElement>(null),printTimeRef=useRef<HTMLTimeElement>(null),printOpenedDetails=useRef<HTMLDetailsElement[]>([]);
  const composerInput=useRef<HTMLTextAreaElement>(null);
  const pageHeading=useRef<HTMLHeadingElement>(null),reading=useRef<HTMLDivElement>(null);
  const sourcesTrigger=useRef<HTMLButtonElement>(null),reviewTrigger=useRef<HTMLElement|null>(null);
  const sourcesReturnFocus=useRef<HTMLElement|null>(null);
  const dialog=useRef<'sources'|'review'|null>(null),review=useRef<KnowledgeReview|null>(null);
  const returnToHeading=useRef(false),frame=useRef<number|null>(null);
  const recoveryFocus=useRef<number|null>(null);
  const requestFocus=useRef<{seq:number;origin:HTMLElement;owned:boolean;moved:boolean;disabledBlur:boolean;choiceRetiring:boolean;reviewCloseBlur:boolean;transferredPage:HTMLElement|null;retiringPageOrigin:boolean;review:boolean;completed:boolean}|null>(null);
  const large=servicesLayout&&tenantAccessibility?tenantAccessibility.largeText:localLarge;
  const setReadAloudAvailable=tenantAccessibility?.setReadAloudAvailable;
  useEffect(()=>{
    if(!servicesLayout||!setReadAloudAvailable)return;
    setReadAloudAvailable(Boolean(!busy&&!error&&!showSources&&workspace?.audio_reading&&workspace.revision&&nodes.length>0));
    return()=>setReadAloudAvailable(false);
  },[busy,error,nodes.length,servicesLayout,setReadAloudAvailable,showSources,workspace?.audio_reading,workspace?.revision]);
  const published=mode==='public'&&workspace?.visibility==='public'&&workspace.can_edit===false&&workspace.tenant.slug===tenantSlug&&workspace.knowledge?workspace:null;
  const publishedTenantId=published?.tenant.id??null,publishedRevision=published?.revision??null;
  useEffect(()=>{
    if(mode!=='public')return;
    onPublicKnowledgeAvailability?.(publishedTenantId&&publishedRevision?{tenantSlug,tenantId:publishedTenantId,revision:publishedRevision}:null);
  },[mode,tenantSlug,publishedTenantId,publishedRevision,onPublicKnowledgeAvailability]);
  // While this published reader is the page's content, the floating widget keeps
  // its launcher but does not raise an unsolicited greeting over the reading area.
  // The widget reads this attribute and event (ChatWidgetInner); a shared module
  // would add a chunk to the offline shell, so the page itself carries the signal.
  useEffect(()=>{
    if(mode!=='public'||!publishedTenantId||!publishedRevision)return;
    const root=document.documentElement,announce=()=>window.dispatchEvent(new Event('chatboc:embedded-institutional-reader'));
    root.dataset.embeddedInstitutionalReader=String(Number(root.dataset.embeddedInstitutionalReader??0)+1);announce();
    return()=>{
      const left=Number(root.dataset.embeddedInstitutionalReader??1)-1;
      if(left>0)root.dataset.embeddedInstitutionalReader=String(left);else delete root.dataset.embeddedInstitutionalReader;
      announce();
    };
  },[mode,publishedTenantId,publishedRevision]);
  const captureRequestFocus=(seq:number,origin:HTMLElement|null,fromReview=false)=>{
    if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}
    const focused=document.activeElement;
    requestFocus.current=origin?.isConnected?{seq,origin,owned:focused===origin||focused===document.body,moved:false,disabledBlur:false,choiceRetiring:false,reviewCloseBlur:false,transferredPage:null,retiringPageOrigin:false,review:fromReview,completed:false}:null;
  };
  const focusResult=(seq:number,fallbackToPage=false)=>{
    if(frame.current!==null)cancelAnimationFrame(frame.current);
    frame.current=requestAnimationFrame(()=>{
      if(!active.current||serial.current!==seq||dialog.current)return;
      const request=requestFocus.current;requestFocus.current=null;frame.current=null;
      if(!request||request.seq!==seq||!request.owned||request.moved)return;
      const focused=document.activeElement;
      if(focused!==request.origin&&(focused!==document.body||(request.origin.isConnected&&!request.disabledBlur&&!request.reviewCloseBlur&&!request.retiringPageOrigin)))return;
      const target=heading.current?.isConnected?heading.current:fallbackToPage?pageHeading.current:null;
      if(!target?.isConnected)return;
      if(reading.current)reading.current.scrollTop=0;
      target.focus({preventScroll:true});target.scrollIntoView?.({block:'nearest',behavior:'auto'});
    });
  };
  const restoreReviewFocus=()=>{
    if(!active.current)return;
    const target=!returnToHeading.current&&reviewTrigger.current?.isConnected?reviewTrigger.current:pageHeading.current;
    const request=requestFocus.current;
    if(returnToHeading.current){
      if(!request?.review||request.seq!==serial.current)return;
      request.review=false;
      if(request.completed)requestFocus.current=null;
      const focused=document.activeElement;
      if(!request.owned||request.moved||(focused!==request.origin&&(focused!==document.body||(request.origin.isConnected&&!request.reviewCloseBlur))))return;
      // Closing our confirmation dialog transfers its owned focus; it is not
      // the user voluntarily moving to another task during the pending write.
      if(target?.isConnected){request.origin=target;if(target===pageHeading.current)request.transferredPage=target;}
    }
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
  const cleanupPrintState=()=>{
    const root=assistantRoot.current;
    if(root){
      delete root.dataset.printingNode;
      for(const article of root.querySelectorAll<HTMLElement>('article[data-print-target]'))delete article.dataset.printTarget;
    }
    for(const item of printOpenedDetails.current.splice(0))item.open=false;
  };
  const syncPrintTimestamp=()=>{
    const now=new Date();
    if(printTimeRef.current){
      printTimeRef.current.dateTime=now.toISOString();
      printTimeRef.current.textContent=formatInstitutionalPrintDate(now);
    }
    setPrintDate(now);
  };
  const preparePrintState=(targetNodeId?:string)=>{
    cleanupPrintState();
    syncPrintTimestamp();
    const root=assistantRoot.current;
    if(!root)return;
    const articles:HTMLElement[]=Array.from(root.querySelectorAll<HTMLElement>('article.institutional-assistant__answer'));
    if(targetNodeId){
      root.dataset.printingNode=targetNodeId;
      for(const article of articles){
        if(article.dataset.nodeId===targetNodeId)article.dataset.printTarget='true';
      }
    }
    const targetArticles=targetNodeId?articles.filter(article=>article.dataset.nodeId===targetNodeId):articles;
    for(const article of targetArticles){
      const citations:HTMLDetailsElement[]=Array.from(article.querySelectorAll<HTMLDetailsElement>('details.institutional-assistant__citations'));
      for(const details of citations){
        if(!details.open){
          details.open=true;
          printOpenedDetails.current.push(details);
        }
      }
    }
  };
  const printNode=(nodeId:string)=>{
    preparePrintState(nodeId);
    window.print();
  };
  useEffect(()=>{
    const onBeforePrint=()=>{
      syncPrintTimestamp();
      if(!assistantRoot.current?.dataset.printingNode)preparePrintState();
    };
    const onAfterPrint=()=>{cleanupPrintState();};
    window.addEventListener('beforeprint',onBeforePrint);
    window.addEventListener('afterprint',onAfterPrint);
    return()=>{
      window.removeEventListener('beforeprint',onBeforePrint);
      window.removeEventListener('afterprint',onAfterPrint);
      cleanupPrintState();
    };
  },[]);
  const current=nodes.at(-1)?.id??topic.at(-1)?.id??sourceNavigation?.originNodeId??workspace?.knowledge?.start??'';
  const load=async(recovery=false,origin:HTMLElement|null=null)=>{
    if(recovery&&(!active.current||locked.current||dialog.current))return;
    cleanupPrintState();
    recoveryFocus.current=null;setSourceNavigation(null);if(mode==='public')onPublicKnowledgeState?.('loading');
    const seq=++serial.current;captureRequestFocus(seq,recovery?origin:null);locked.current=true;setBusy(true);setError(false);setErrorStatus(null);setFailedAnswer(null);setNodes([]);setTopic([]);setPresentation('answer');setPending(null);review.current=null;dialog.current=null;setShowSources(false);
    try{const data=await loadWorkspace(tenantSlug,mode);if(active.current&&serial.current===seq){
      let initialNodes=data.knowledge?[data.knowledge.initial]:[];
      let initialPresentation:InstitutionalPresentationMode=mode==='public'&&data.knowledge&&data.revision
        ?institutionalPresentationMode({tenant:data.tenant,revision:data.revision,nodes:[data.knowledge.initial]},institutionalInitialMenuContext(data,tenantSlug)):'answer';
      const requestedNode=mode==='public'&&data.knowledge&&data.revision&&typeof window!=='undefined'
        ?new URLSearchParams(window.location.search).get('tema')?.trim()??'':'';
      if(requestedNode&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/.test(requestedNode)&&requestedNode!==data.knowledge!.start){
        try{
          const deepAnswer=await askWorkspace(data,'public',{node_id:requestedNode});
          if(active.current&&serial.current===seq&&!isKnowledgeSourceNavigation(deepAnswer)&&deepAnswer.nodes.length>0){
            initialNodes=deepAnswer.nodes;
            initialPresentation='answer';
          }
        }catch{
          // Invalid or retired node in shared URL falls back to the published start menu.
        }
      }
      if(active.current&&serial.current===seq){
        if(recovery)recoveryFocus.current=seq;
        if(mode==='public')onPublicKnowledgeState?.(
          data.visibility==='public'&&data.can_edit===false&&data.tenant.slug===tenantSlug&&Boolean(data.knowledge)
            ?'published':'unavailable',
        );
        setWorkspace(data);setLastUi(data.ui);setNodes(initialNodes);setPresentation(initialPresentation);setAsked('');setUncovered(false);
      }
    }}
    catch(cause){if(active.current&&serial.current===seq){setError(true);setWorkspace(null);const status=cause&&typeof cause==='object'&&'status' in cause?cause.status:null;if(mode==='public')onPublicKnowledgeState?.(status===404?'unavailable':'error');setErrorStatus(status===401||status===403?status:null);}}
    finally{if(active.current&&serial.current===seq){setBusy(false);locked.current=false;}}
  };
  useLayoutEffect(()=>{
    const seq=recoveryFocus.current;if(seq===null||busy)return;
    recoveryFocus.current=null;
    if(!workspace||!active.current||serial.current!==seq||dialog.current)return;
    focusResult(seq,true);
  },[busy,workspace,nodes]);
  useEffect(()=>{
    const trackFocus=(event:FocusEvent)=>{
      const request=requestFocus.current;
      if(request&&event.target!==request.origin&&event.target!==document.body)request.moved=true;
    };
    const trackBlur=(event:FocusEvent)=>{
      const request=requestFocus.current;
      if(!request||event.target!==request.origin||!request.origin.isConnected)return;
      // Chromium blurs a retained form control when our pending request disables
      // it. Record that exact transition; BODY alone never establishes ownership.
      if(request.owned&&!request.moved&&(event.relatedTarget===null||event.relatedTarget===document.body)){
        if(request.origin.matches(':disabled')){request.disabledBlur=true;return;}
        // React cleared this exact focused choice ref before Chromium blurs
        // its still-connected outgoing control during the busy render.
        if(request.choiceRetiring&&document.activeElement===document.body)return;
        // Our confirmation closes a portalled dialog while its enabled control
        // can still be connected during the closing animation.
        if(request.review&&returnToHeading.current&&dialog.current===null){request.reviewCloseBlur=true;return;}
        // The rejected write replaces our heading with an alert. React clears
        // its ref before Chromium blurs the still-connected outgoing element.
        if(request.retiringPageOrigin&&request.transferredPage===request.origin&&pageHeading.current!==request.origin)return;
      }
      request.moved=true;
    };
    const trackNavigation=()=>{const request=requestFocus.current;if(request&&!request.review)request.moved=true;};
    const trackKeyboard=(event:KeyboardEvent)=>{
      if(['Tab','Escape','PageDown','PageUp','Home','End','ArrowDown','ArrowUp'].includes(event.key))trackNavigation();
    };
    document.addEventListener('focusin',trackFocus);document.addEventListener('focusout',trackBlur);active.current=true;void load();
    document.addEventListener('pointerdown',trackNavigation,true);document.addEventListener('wheel',trackNavigation,{capture:true,passive:true});document.addEventListener('keydown',trackKeyboard,true);
    return()=>{active.current=false;serial.current++;requestFocus.current=null;document.removeEventListener('focusin',trackFocus);document.removeEventListener('focusout',trackBlur);document.removeEventListener('pointerdown',trackNavigation,true);document.removeEventListener('wheel',trackNavigation,true);document.removeEventListener('keydown',trackKeyboard,true);if(frame.current!==null)cancelAnimationFrame(frame.current);};
  },[]);
  const navigate=async(id:string,text?:string,origin:HTMLElement|null=null,requestedPresentation:InstitutionalPresentationMode='answer')=>{
    if(!workspace||locked.current||dialog.current)return;const currentWorkspace=workspace;
    cleanupPrintState();
    locked.current=true;setBusy(true);setError(false);setFailedAnswer(null);setShowSources(false);setSourceNavigation(null);const seq=++serial.current;captureRequestFocus(seq,origin);
    try{const response=await askWorkspace(currentWorkspace,mode,{node_id:id,...(text?{question:text}:{})});
      if(active.current&&serial.current===seq){
        // An uncovered question, or the source catalog opened from it, keeps the topic.
        const keepsTopic=isKnowledgeSourceNavigation(response)||Boolean(text)&&!response.nodes.length;
        setTopic(keepsTopic?(nodes.length?nodes:topic):[]);setNodes(response.nodes);
        setEasyReadRequest(!isKnowledgeSourceNavigation(response)&&response.easy_read_requested===true&&response.nodes.length===1
          ?{nodeId:response.nodes[0].id,token:seq}:null);
        // A typed menu command is exact navigation (no selection was performed):
        // returning to the published start restores the same layout as Home.
        const typedNavigation=Boolean(text)&&!isKnowledgeSourceNavigation(response)&&(response as {selection_performed?:unknown}).selection_performed===false;
        const nextPresentation=(requestedPresentation==='initial-menu'||typedNavigation)&&mode==='public'?institutionalPresentationMode(response,institutionalInitialMenuContext(currentWorkspace,tenantSlug)):'answer';
        setPresentation(nextPresentation);
        setSourceNavigation(isKnowledgeSourceNavigation(response)?{...response,originNodeId:id}:null);
        setAsked(typedNavigation&&nextPresentation==='initial-menu'?'':text??'');if(text)setQuestion('');setUncovered(!isKnowledgeSourceNavigation(response)&&!response.nodes.length);focusResult(seq);}}
    catch(cause){if(active.current&&serial.current===seq){
      setError(true);
      const status=cause&&typeof cause==='object'&&'status' in cause?cause.status:null;
      if(status===503)setFailedAnswer({id,text,revision:currentWorkspace.revision,tenantId:currentWorkspace.tenant.id});
      else {setWorkspace(null);setNodes([]);setTopic([]);setFailedAnswer(null);}
      focusResult(seq);
    }}
    finally{if(active.current&&serial.current===seq){setBusy(false);locked.current=false;}}
  };
  const retryAnswer=(event:React.MouseEvent<HTMLButtonElement>)=>{
    if(failedAnswer&&workspace&&failedAnswer.revision===workspace.revision&&failedAnswer.tenantId===workspace.tenant.id)
      void navigate(failedAnswer.id,failedAnswer.text,event.currentTarget);
    else void load(true,event.currentTarget);
  };
  const importFile=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];event.target.value='';
    if(!file||!workspace?.can_edit||mode!=='admin'||locked.current||dialog.current)return;
    if(file.size>1_000_000){setFailedAnswer(null);setError(true);return;}
    const seq=++serial.current;captureRequestFocus(seq,reviewTrigger.current);locked.current=true;setBusy(true);setError(false);setFailedAnswer(null);
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
    const previous=workspace;locked.current=true;setBusy(true);setError(false);setFailedAnswer(null);setSourceNavigation(null);const op=review.current;returnToHeading.current=true;review.current=null;dialog.current=null;setPending(null);setNodes([]);setTopic([]);const seq=++serial.current;
    const focused=document.activeElement;
    captureRequestFocus(seq,focused instanceof HTMLElement&&focused.closest('.institutional-assistant-dialog--review')?focused:null,true);
    try{const receipt=await changeWorkspace(previous,op.operation,op.bundle);if(!active.current||serial.current!==seq)return;const fresh=await loadWorkspace(tenantSlug,mode);
      if(receipt.revision!==fresh.revision||receipt.visibility!==fresh.visibility)throw new Error('knowledge_write_unconfirmed');
      if(active.current&&serial.current===seq){
        setWorkspace(fresh);setLastUi(fresh.ui);setNodes(fresh.knowledge?[fresh.knowledge.initial]:[]);setAsked('');setUncovered(false);
        const request=requestFocus.current;
        if(request?.seq===seq){request.completed=true;if(!request.review)requestFocus.current=null;}
      }}
    catch{if(active.current&&serial.current===seq){
      const request=requestFocus.current;
      if(request?.seq===seq&&request.transferredPage===request.origin&&request.origin===pageHeading.current)request.retiringPageOrigin=true;
      setError(true);setWorkspace(null);focusResult(seq);
    }}
    finally{if(active.current&&serial.current===seq){setBusy(false);locked.current=false;}}
  };
  if(!workspace){
    if(error&&lastUi)return <section className="institutional-assistant"><div className="institutional-assistant__notice" ref={element=>{heading.current=element;}} role="alert" tabIndex={-1}><p>{lastUi.error}</p><button type="button" disabled={busy} onClick={event=>void load(true,event.currentTarget)}>{lastUi.retry}</button></div></section>;
    if(error)return <div role="alert"><ViewState status={errorStatus?'denied':'error'} title={errorStatus?'No tenés acceso al conocimiento de esta organización':'No pudimos cargar el conocimiento'}
      action={<Button variant="outline" disabled={busy} onClick={event=>void load(true,event.currentTarget)}>Reintentar</Button>}/></div>;
    return <div role="status"><ViewState status="loading" title="Cargando conocimiento"/></div>;
  }
  const ui=workspace.ui,knowledge=workspace.knowledge;
  const shareLabels=resolveInstitutionalShareLabels(ui);
  const noAnswerLabels=resolveInstitutionalNoAnswerLabels(ui);
  const publicLogo=mode==='public'&&publicIdentity?.tenantId===workspace.tenant.id&&publicIdentity.tenantSlug===workspace.tenant.slug
    ?safeInstitutionLogo(publicIdentity.logoUrl):null;
  const context=nodes.length?nodes:uncovered?topic:[];
  // The notice names the topic only for a single topic node, with wording sent by the server.
  const topicNode=!nodes.length&&knowledge&&topic.length===1&&topic[0].id!==knowledge.start?topic[0]:null;
  const topicNotice=topicNode?ui[topicNode.actions.length?'unknown_in_topic':'unknown_in_topic_no_options']:undefined;
  const uncoveredText=topicNode&&typeof topicNotice==='string'&&topicNotice.includes('{title}')
    ?topicNotice.replace('{title}',()=>topicNode.title):ui.unknown;
  const showNoAnswerFallback=Boolean(uncovered&&!busy&&!error&&knowledge&&workspace.visibility==='public');
  const initialMenuActions=knowledge?.initial.actions??[];
  const initialActionKeys=new Set(initialMenuActions.map(action=>`${action.target}\0${action.label}`));
  const actions=(showNoAnswerFallback
    ?(topicNode?topicNode.actions.filter(action=>!initialActionKeys.has(`${action.target}\0${action.label}`)):[])
    :context.flatMap(n=>n.actions)
  ).filter((a,i,list)=>list.findIndex(b=>b.target===a.target&&b.label===a.label)===i);
  const focusComposer=()=>{
    const input=composerInput.current;
    if(!input?.isConnected)return;
    input.focus();
    input.scrollIntoView?.({block:'nearest',behavior:'auto'});
  };
  const initialMenu=presentation==='initial-menu';
  const choices=!busy&&!error?<InstitutionalChoices actions={actions} navigation={readInstitutionalChoiceNavigation(ui)} responseIdentity={context}
    disabled={Boolean(pending)||showSources} className="institutional-assistant__choices"
    renderChoice={action=>{
      const label=institutionalChoiceLabel(action.label);
      let renderedChoice:HTMLButtonElement|null=null;
      return <button type="button" key={`${action.target}:${action.label}`} disabled={Boolean(pending)} ref={element=>{
        const request=requestFocus.current;
        if(!element&&request?.origin===renderedChoice&&request.seq===serial.current&&request.owned&&!request.moved&&document.activeElement===renderedChoice)request.choiceRetiring=true;
        if(element&&request?.origin===element)request.choiceRetiring=false;
        renderedChoice=element;
      }} onClick={event=>navigate(action.target,undefined,event.currentTarget)}>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="inline-flex min-w-[1.5em] shrink-0 justify-center font-semibold tabular-nums">{action.code}</span>
          {' '}{label.emoji?<><span aria-hidden="true" className="shrink-0">{label.emoji}</span>{' '}</>:null}<span>{label.words}</span>
        </span><ChevronRight size={16} aria-hidden="true"/>
      </button>;
    }}/>:null;
  const topicNavigation=<nav aria-label={ui.topics}>{knowledge?.topics.map(item=><button type="button" key={item.id} disabled={busy||Boolean(pending)} aria-current={current===item.id?'page':undefined} onClick={event=>navigate(item.id,undefined,event.currentTarget)}><span>{item.label}</span><ChevronRight size={15} aria-hidden="true"/></button>)}</nav>;
  const composer=knowledge?<form className="institutional-assistant__composer" onSubmit={event=>{
    event.preventDefault();const submitter=(event.nativeEvent as SubmitEvent).submitter;
    const input=composerInput.current??event.currentTarget.querySelector('textarea');
    const origin=(submitter instanceof HTMLElement&&document.activeElement===submitter)?submitter
      :document.activeElement===input?input:submitter instanceof HTMLElement?submitter:null;
    if(question.trim())void navigate(current,question.trim(),origin);
  }}>
    <label htmlFor={`knowledge-question-${questionId}`}>{ui.question}</label><div><Search size={19} aria-hidden="true"/><textarea ref={composerInput} id={`knowledge-question-${questionId}`} rows={2} autoComplete="off" maxLength={1800} value={question}
      onChange={event=>{setQuestion(event.target.value);if(failedAnswer){setFailedAnswer(null);setError(false);}}} placeholder={ui.placeholder} disabled={busy||Boolean(pending)}
      onKeyDown={event=>{
        if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&event.nativeEvent.keyCode!==229){
          event.preventDefault();if(question.trim())void navigate(current,question.trim(),event.currentTarget);
        }
      }}/>

    <button type="submit" className="institutional-assistant__primary" disabled={busy||!question.trim()||error||Boolean(pending)} aria-label={ui.send}><ArrowUp size={21} aria-hidden="true"/>{servicesLayout?<span>{ui.send}</span>:null}</button></div></form>:null;
  return <section ref={assistantRoot} className={`institutional-assistant${mode==='public'?' institutional-assistant--public':''}${servicesLayout?' institutional-assistant--services':''}${large?' institutional-assistant--large':''}${initialMenu?' institutional-assistant--initial-menu':''}`} data-testid="institutional-assistant" data-institutional-presentation={presentation} aria-label={ui.heading}>
    <header className="institutional-assistant__header">
      <div className="institutional-assistant__identity">{!servicesLayout?<InstitutionalIdentityMark key={`${workspace.tenant.id}:${publicLogo??''}`} logo={publicLogo} name={workspace.tenant.name}/>:null}
        <div>{!servicesLayout?<p>{workspace.tenant.name}</p>:null}<h2 ref={pageHeading} tabIndex={-1}>{ui.heading}</h2></div></div>
      <div className="institutional-assistant__utilities">{!servicesLayout?<button type="button" aria-label={ui.large_text} aria-pressed={large} onClick={()=>{rememberInstitutionalLargeText(!large);setLocalLarge(!large);}}><Type size={19} aria-hidden="true"/><span>{ui.large_text}</span></button>:null}
        <button ref={sourcesTrigger} type="button" disabled={busy||!knowledge||Boolean(pending)} onClick={event=>{sourcesReturnFocus.current=event.currentTarget;setHighlightedSourceId(null);changeSources(true);}} aria-label={ui.sources} aria-haspopup="dialog" aria-expanded={showSources}><BookOpen size={17} aria-hidden="true"/><span>{ui.sources}</span></button></div>
    </header>
    <div className="institutional-assistant__body">
      {mode==='admin'?<aside className="institutional-assistant__sidebar"><p className="institutional-assistant__eyebrow">{ui.topics}</p>
        {topicNavigation}
        {knowledge?<div className="institutional-assistant__version"><span>{ui.version} {knowledge.version}</span><span>{ui[workspace.visibility]??workspace.visibility}</span></div>:null}
        {workspace.can_edit?<div className="institutional-assistant__management"><input ref={upload} type="file" accept="application/json,.json" onChange={importFile} hidden/>
          <button type="button" disabled={busy} onClick={event=>{reviewTrigger.current=event.currentTarget;upload.current?.click();}}><Plus size={16} aria-hidden="true"/>{ui.import}</button>
          {knowledge?<button type="button" disabled={busy||error||Boolean(pending)} onClick={event=>openReview({operation:workspace.visibility==='public'?'retire':'publish'},event.currentTarget)}>{workspace.visibility==='public'?ui.retire:ui.publish}</button>:null}</div>:null}
      </aside>:null}
      <div className="institutional-assistant__conversation">
        <div className="institutional-assistant__topline"><button type="button" disabled={busy||!knowledge||Boolean(pending)} onClick={event=>knowledge&&navigate(knowledge.start,undefined,event.currentTarget,mode==='public'?'initial-menu':'answer')}><ArrowLeft size={15} aria-hidden="true"/>{ui.home}</button><span>{ui.evidence}</span></div>
        {servicesLayout&&initialMenu?composer:null}
        {mode==='public'&&knowledge&&current!==knowledge.start&&context.length>0?<details key={current} className="institutional-assistant__topic-index"><summary>{ui.topics}</summary>{topicNavigation}</details>:null}
        <div ref={reading} className="institutional-assistant__reading" aria-label={ui.answer} role="region" tabIndex={0} aria-busy={busy}>
          {asked?<div className="institutional-assistant__question"><MessageSquare size={16} aria-hidden="true"/><p>{asked}</p></div>:null}
          {busy?<div className="institutional-assistant__loading" role="status"><Loader2 size={22} className="animate-spin" aria-hidden="true"/><p>{ui.loading}</p></div>:null}
          {error?<div ref={element=>{heading.current=element;}} tabIndex={-1} role="alert" className="institutional-assistant__notice"><p>{ui.error}</p><button type="button" disabled={busy} onClick={retryAnswer}>{ui.retry}</button></div>:null}
          {!busy&&!error&&!pending&&!knowledge?<div className="institutional-assistant__empty"><BookOpen size={32} aria-hidden="true"/><h3>{ui.empty}</h3><p>{ui.import_help}</p></div>:null}
          {uncovered&&!busy&&!error?<p ref={element=>{heading.current=element;}} tabIndex={-1} role="status" className="institutional-assistant__uncovered">{uncoveredText}</p>:null}
          {showNoAnswerFallback?<InstitutionalNoAnswerFallback
            actions={initialMenuActions}
            labels={noAnswerLabels}
            formatChoiceLabel={institutionalChoiceLabel}
            onSelectAction={(action,origin)=>{void navigate(action.target,undefined,origin);}}
            onRewriteQuestion={focusComposer}
            disabled={Boolean(pending)||showSources}
            announcePolite
            showChevron
          />:null}
          {sourceNavigation&&!busy&&!error?<section aria-label={ui.sources} className="institutional-assistant__answer">
            <h3 ref={element=>{heading.current=element;}} tabIndex={-1}>{ui.sources}</h3>
            <p role="status">{sourceNavigation.text}</p>
            <button type="button" className="institutional-assistant__primary" disabled={Boolean(pending)} aria-haspopup="dialog" aria-expanded={showSources}
              onClick={event=>{sourcesReturnFocus.current=event.currentTarget;setHighlightedSourceId(null);changeSources(true);}}><BookOpen size={17} aria-hidden="true"/>{ui.sources}</button>
          </section>:null}
          {(!error||failedAnswer)&&nodes.map((node,index)=>{
            const nodeAcronyms=readKnowledgeAcronyms(node.acronyms);
            const isOpenedAnswer=Boolean(knowledge&&node.id!==knowledge.start);
            const whatsappUrl=isOpenedAnswer?buildInstitutionalWhatsAppUrl({
              title:node.title,
              text:node.text,
              acronyms:nodeAcronyms,
              acronymsLabel:ui.acronyms,
              links:node.links,
              portalUrl:buildInstitutionalPortalUrl(workspace.tenant.slug,node.id),
            }):'';
            return <article key={node.id} data-node-id={node.id} className="institutional-assistant__answer">
            <h3 ref={index===0&&!error?element=>{heading.current=element;}:undefined} tabIndex={-1}>{node.title}</h3>
            {initialMenu&&index===0?<section className="institutional-assistant__topics" aria-labelledby={`knowledge-topics-${questionId}`}><h4 id={`knowledge-topics-${questionId}`}>{ui.topics}</h4>{choices}</section>:null}
            <div className="institutional-assistant__prose"><InstitutionalTextBlocks text={node.text}/></div>
            <InstitutionalAcronyms items={nodeAcronyms} label={ui.acronyms}/>
            {mode==='public'&&workspace.easy_read&&workspace.revision&&knowledge&&node.id!==knowledge.start?
              <InstitutionalEasyRead scope={{tenant:workspace.tenant,revision:workspace.revision,nodeId:node.id}} copy={workspace.easy_read}
                autoOpenToken={easyReadRequest?.nodeId===node.id?easyReadRequest.token:null}/>:null}
            {isOpenedAnswer?
              <div className="institutional-answer-actions" role="group" aria-label={ui.answer}>
                <button type="button" className="institutional-answer-actions__button" data-action="share-whatsapp" data-whatsapp-url={whatsappUrl}
                  onClick={()=>openInstitutionalWhatsAppShare(whatsappUrl)}>
                  <Share2 size={17} aria-hidden="true"/><span>{shareLabels.whatsapp}</span>
                </button>
                <button type="button" className="institutional-answer-actions__button" data-action="print-answer"
                  onClick={()=>printNode(node.id)}>
                  <Printer size={17} aria-hidden="true"/><span>{shareLabels.print}</span>
                </button>
              </div>:null}
            {node.links.length>0?<div className="institutional-assistant__links">{node.links.map(link=><a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<ChevronRight size={15} aria-hidden="true"/></a>)}</div>:null}
            <details className="institutional-assistant__citations"><summary><FileText size={15} aria-hidden="true"/>{ui.source_details}</summary>
              {node.sources.map(source=><div key={source.id}><p>{source.title} {source.pagination!=='logical_snapshot'?<span>· {source.pages?.join(', ')}</span>:null}{knowledgeSourceExternalUrl(source,mode)?<a href={knowledgeSourceExternalUrl(source,mode)!} target="_blank" rel="noopener noreferrer">{source.title}</a>:null}</p>
               <KnowledgeSourceMetadata source={source} compact mode={mode}/>
               <button type="button" disabled={busy||Boolean(pending)} onClick={event=>{sourcesReturnFocus.current=event.currentTarget;setHighlightedSourceId(source.id);changeSources(true);}} aria-haspopup="dialog">Ver fuente<span className="sr-only">: {source.title}</span></button>
               {source.excerpts?.map((quote,i)=><blockquote key={i}><p>{quote.text}</p><cite>{source.title}{source.pagination!=='logical_snapshot'?` · ${quote.page??source.pages?.join(', ')}`:''}</cite></blockquote>)}</div>)}</details>
          </article>;})}
          {mode==='public'&&!busy&&!error&&!showSources&&workspace.audio_reading&&workspace.revision&&nodes.length>0?
            <div id={servicesLayout?TENANT_READ_ALOUD_TARGET_ID:undefined}><InstitutionalResponseAudio scope={{tenant:workspace.tenant,revision:workspace.revision,nodeIds:nodes.map(node=>node.id)}} copy={workspace.audio_reading} fallbackText={nodes.map(node=>`${node.title}. ${node.text}`).join('\n\n')}/></div>:null}
          {!initialMenu?choices:null}
          {nodes.length>0?<footer className="institutional-assistant__print-footer" aria-hidden="true">
            <p className="institutional-assistant__print-date">Fecha de impresión: <time ref={printTimeRef} dateTime={printDate.toISOString()}>{formatInstitutionalPrintDate(printDate)}</time></p>
            <p className="institutional-assistant__print-disclaimer">{shareLabels.disclaimer}</p>
          </footer>:null}
        </div>
        {!servicesLayout||!initialMenu?composer:null}
      </div>
    </div>
    {mode==='admin'&&BATTERY_UI_KEYS.every(key=>typeof ui[key]==='string'&&ui[key].trim())?<KnowledgeTestBatteryPanel workspace={workspace}/>:null}
    {mode==='admin'&&typeof ui.question_metrics==='string'&&ui.question_metrics.trim()?<KnowledgeQuestionMetricsPanel workspace={workspace} label={ui.question_metrics}/>:null}
    <KnowledgeSourceDialog key={`${workspace.tenant.id}:${workspace.revision}`} workspace={workspace} open={showSources} onOpenChange={changeSources} mode={mode} highlightedSourceId={highlightedSourceId} largeText={large}
      restoreFocus={()=>{const target=sourcesReturnFocus.current?.isConnected?sourcesReturnFocus.current:sourcesTrigger.current;if(active.current&&target?.isConnected)target.focus({preventScroll:true});}}/>
    <KnowledgeReviewDialog workspace={workspace} pending={pending} onCancel={cancelReview} onConfirm={()=>void confirm()} restoreFocus={restoreReviewFocus} largeText={large}/>
  </section>;
}
