import React,{useEffect,useRef,useState} from 'react';
import {Download} from 'lucide-react';
import type {KnowledgeSource,KnowledgeWorkspace} from './institutionalAssistantContract';
import {knowledgeSourceReadMessage,readKnowledgeSource} from './institutionalAssistantSource';

/** A document the organization chose to hand out (a form, a guide), as opposed to a citation. */
export const isHandoutSource=(source:KnowledgeSource):boolean=>
  source.delivery?.publicly_accessible===true&&source.document_visibility!=='private'&&source.delivery.format!=='text';

interface Props {workspace:KnowledgeWorkspace;source:KnowledgeSource;mode:'admin'|'public';disabled?:boolean}

/** One tap: the original is read, checked against its published fingerprint and saved. */
export function InstitutionalDocumentDownload({workspace,source,mode,disabled=false}:Props) {
  const [state,setState]=useState<'idle'|'loading'|'done'>('idle');
  const [error,setError]=useState('');
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const download=async()=>{
    setState('loading');setError('');
    try{
      const document_=await readKnowledgeSource(workspace,source,mode,{isCurrent:()=>mounted.current});
      const url=URL.createObjectURL(document_.blob);
      const link=document.createElement('a');
      link.href=url;link.download=document_.filename;link.rel='noopener';
      document.body.appendChild(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
      if(mounted.current)setState('done');
    }catch(cause){
      if(mounted.current){setState('idle');setError(knowledgeSourceReadMessage(cause));}
    }
  };
  const size=source.delivery?.byte_size?` · ${Math.max(1,Math.round(source.delivery.byte_size/1024))} KB`:'';
  return <div className="institutional-assistant__handout">
    <button type="button" disabled={disabled||state==='loading'} onClick={download}>
      <Download size={20} aria-hidden="true"/>
      <span><strong>{state==='loading'?'Descargando…':'Descargar'}</strong> {source.title}
        <small>{source.delivery?.format==='pdf'?'PDF':'Imagen'}{size}</small></span>
    </button>
    <p role="status">{state==='done'?'Listo. Buscá el archivo en tus descargas.':error}</p>
  </div>;
}
