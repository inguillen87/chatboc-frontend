import React from 'react';
import { apiFetch } from '@/utils/api';
import { readPrivateGuide, type GuideAccess, type PrivateGuide } from '@/utils/privateConversationGuide';
import './privateConversationGuide.css';

export default function PrivateConversationGuide({access,sessionKey}:{access:GuideAccess|null;sessionKey:string}) {
  return access&&sessionKey ? <Guide key={JSON.stringify([sessionKey,access])} access={access}/> : null;
}
function Guide({access:input}:{access:GuideAccess}) {
  const access=React.useRef(input).current;
  const [open,setOpen]=React.useState(false);
  return <details className="private-guide" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>{access.ui.open}</summary>
    {open ? <GuideReader access={access}/> : null}
  </details>;
}
function GuideReader({access}:{access:GuideAccess}) {
  const [guide,setGuide]=React.useState<PrivateGuide|null>(null);
  const [pending,setPending]=React.useState(false),[failed,setFailed]=React.useState(false);
  const mounted=React.useRef(false),busy=React.useRef(false),generation=React.useRef(0);
  const fingerprint=React.useRef<string|null>(null),timer=React.useRef<ReturnType<typeof setTimeout>>();
  const heading=React.useRef<HTMLHeadingElement>(null);
  React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;busy.current=false;++generation.current;clearTimeout(timer.current);};},[]);
  React.useEffect(()=>{if(guide)heading.current?.focus();},[guide]);
  const choose=React.useCallback(async(node:string,selection?:string,expectedNode=node)=>{
    if(!mounted.current||busy.current)return;
    busy.current=true;const current=++generation.current;
    setPending(true);setFailed(false);setGuide(null);
    const params=new URLSearchParams({node});if(selection!==undefined)params.set('selection',selection);
    let requestTimer:ReturnType<typeof setTimeout>|undefined;
    try {
      const response=await Promise.race([
        apiFetch<unknown>(`${access.endpoint}?${params}`,{tenantSlug:access.tenant.slug,persistTenantSlug:false,cache:'no-store'}),
        new Promise<never>((_,reject)=>{requestTimer=setTimeout(()=>reject(new Error()),15000);timer.current=requestTimer;}),
      ]);
      if(!mounted.current||current!==generation.current)return;
      const parsed=readPrivateGuide(response,access,expectedNode);
      if(!parsed)throw new Error();
      const version=JSON.stringify([parsed.guide_sha256,parsed.source]);
      if(fingerprint.current!==null&&fingerprint.current!==version)throw new Error();
      fingerprint.current=version;setGuide(parsed);
    }catch{if(mounted.current&&current===generation.current)setFailed(true);}
    finally{clearTimeout(requestTimer);if(timer.current===requestTimer)timer.current=undefined;if(mounted.current&&current===generation.current){busy.current=false;setPending(false);}}
  },[access]);
  React.useEffect(()=>{void choose('start');},[choose]);
  const ui=guide?.ui??access.ui;
  return <section className="private-guide-reader" aria-label={access.ui.heading}>
    <h3>{access.ui.heading}</h3><p>{access.ui.description}</p>
    <div className="private-guide-toolbar">
      <button type="button" disabled={pending} onClick={()=>void choose('start')}>{ui.start}</button>
      <button type="button" disabled={pending} onClick={()=>void choose('main')}>{ui.back_to_menu}</button>
    </div>
    {pending?<p role="status">{access.ui.loading}</p>:null}
    {failed?<p role="alert">{access.ui.error}</p>:null}
    {guide?<article data-testid="private-guide-node" data-node={guide.menu.id}>
      <h4 ref={heading} tabIndex={-1}>{guide.menu.title}</h4>
      <p className="private-guide-message">{guide.menu.text}</p>
      <div className="private-guide-options">{guide.menu.actions.map(action=><button type="button" key={action.code}
        disabled={pending} onClick={()=>void choose(guide.menu.id,action.code,action.target)}>
        <span aria-hidden="true">{action.code}</span><span>{action.label}</span>
      </button>)}</div>
      <div className="private-guide-source">
        <strong>{ui.source_label}</strong><p>{guide.source.label}</p>
        <p>{guide.menu.source_pages.join(' · ')}</p><p>{guide.source.approval_status}</p>
        <code>{guide.source.sha256}</code>
      </div>
    </article>:null}
  </section>;
}
