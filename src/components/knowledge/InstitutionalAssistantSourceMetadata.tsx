import React from 'react';
import type {KnowledgeSource} from './institutionalAssistantContract';
import {knowledgeSourceOriginalAllowed} from './institutionalAssistantContract';

const authorityLabels={official_norm:'Norma oficial',operational_document:'Documento operativo',project:'Proyecto',user_supplied_note:'Aporte recibido',unknown:'Tipo de fuente sin confirmar'};
const reviewLabels={unreviewed:'Revisión pendiente',reviewed:'Revisión editorial realizada',needs_review:'Necesita revisión',conflict:'Diferencias por revisar'};
const validityLabels={not_verified:'Vigencia no verificada',official_text_observed:'Texto oficial consultado',conflict:'Vigencia con diferencias por revisar',superseded:'Edición reemplazada'};
const formatLabels={pdf:'PDF',jpeg:'Imagen',text:'Texto extraído'};

/** Labels describe source evidence; editorial review never implies current law. */
export function KnowledgeSourceMetadata({source,compact=false,mode='admin'}:{source:KnowledgeSource;compact?:boolean;mode?:'admin'|'public'}){
 const format=source.format??source.delivery?.format;
 const originalAllowed=knowledgeSourceOriginalAllowed(source,mode);
 return <div className="institutional-assistant-source-metadata mt-2 min-w-0 space-y-2 text-sm leading-relaxed">
  <p className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
   <span>{authorityLabels[source.source_authority??'unknown']}</span>
   <span>{format?formatLabels[format]:'Formato sin confirmar'}</span>
  </p>
  <p>{reviewLabels[source.review_status??'unreviewed']} · {validityLabels[source.current_validity??'not_verified']}</p>
  <p className="text-muted-foreground">{source.printed_year?`Edición impresa: ${source.printed_year}`:'Edición impresa no informada'}</p>
  {!originalAllowed?<p>El texto se basa en fuentes del equipo. El documento original está reservado.</p>:null}
  {!compact?<details className="min-w-0">
   <summary className="flex min-h-11 cursor-pointer items-center underline underline-offset-4">Detalles de origen</summary>
   <dl className="space-y-2 rounded-lg bg-muted/40 p-3">
    <div><dt className="font-medium">Procedencia informada</dt><dd className="break-words">{source.provenance??'No informada'}</dd></div>
    {originalAllowed&&source.origin_url?<div><dt className="font-medium">Referencia de origen</dt><dd className="break-all">{source.origin_url}</dd></div>:null}
    <div><dt className="font-medium">Última modificación en origen</dt><dd>{source.modified_at?new Date(source.modified_at).toLocaleString('es-AR'):'No informada'}</dd></div>
    <div><dt className="font-medium">Revisión del documento</dt><dd className="break-all">{source.native_revision??'No informada'}</dd></div>
    {source.pagination==='logical_snapshot'?<div><dt className="font-medium">Contenido de referencia</dt><dd>{format==='text'?'Texto extraído del documento original; no es una copia del archivo nativo.':'Imagen de referencia; no representa una página de un PDF original.'}</dd></div>:null}
   </dl>
  </details>:null}
  <p className="text-xs text-muted-foreground">La revisión editorial no confirma la vigencia.</p>
 </div>;
}
