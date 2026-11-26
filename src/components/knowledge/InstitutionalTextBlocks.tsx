import React from 'react';
import type {KnowledgeAcronym} from './institutionalAssistantContract';

type TextBlock =
  | {kind:'paragraph'; text:string}
  | {kind:'unordered'; items:{text:string}[]}
  | {kind:'ordered'; items:{text:string; number:number}[]};

/** Recognize explicit list markers without interpreting HTML, links or Markdown. */
function textBlocks(text:string):TextBlock[] {
  const blocks:TextBlock[]=[];
  let current:TextBlock|null=null;
  const flush=()=>{if(current)blocks.push(current);current=null;};
  for(const line of text.split(/\r?\n/)){
    if(!line.trim()){flush();continue;}
    const bullet=/^[•*-][\t ]+(.+)$/.exec(line);
    const ordered=/^([1-9]\d{0,5})[.)][\t ]+(.+)$/.exec(line);
    if(bullet){
      if(current?.kind!=='unordered'){flush();current={kind:'unordered',items:[]};}
      current.items.push({text:bullet[1]});
    }else if(ordered){
      if(current?.kind!=='ordered'){flush();current={kind:'ordered',items:[]};}
      current.items.push({text:ordered[2],number:Number(ordered[1])});
    }else if(current&&current.kind!=='paragraph'&&/^[\t ]+\S/.test(line)){
      // A visibly indented continuation belongs to the preceding list item.
      current.items[current.items.length-1].text+='\n'+line;
    }else{
      if(current?.kind!=='paragraph'){flush();current={kind:'paragraph',text:line};}
      else current.text+='\n'+line;
    }
  }
  flush();
  return blocks;
}

/** Both institutional surfaces retain backend copy and render it as safe text. */
const LARGE_TEXT_KEY='chatboc.institutional-large-text';
/** Last «texto ampliado» choice of this viewer, remembered in this browser.
 * Each assistant or answer still toggles on its own; new ones start from it. */
export function readInstitutionalLargeText():boolean {
  try{return window.localStorage.getItem(LARGE_TEXT_KEY)==='1';}catch{return false;}
}
export function rememberInstitutionalLargeText(value:boolean) {
  try{if(value)window.localStorage.setItem(LARGE_TEXT_KEY,'1');else window.localStorage.removeItem(LARGE_TEXT_KEY);}
  catch{/* the choice still applies on this page */}
}
export function InstitutionalTextBlocks({text}:{text:string}) {
  return <>{textBlocks(text).map((block,index)=>{
    if(block.kind==='paragraph')return <p key={index}>{block.text}</p>;
    const items=block.items.map((item,itemIndex)=><li key={itemIndex}
      {...('number' in item?{value:item.number}:{})} className="whitespace-pre-line break-words">{item.text}</li>);
    return block.kind==='ordered'
      ?<ol key={index} start={block.items[0].number} className="mb-[15px] list-decimal space-y-2 pl-6">{items}</ol>
      :<ul key={index} className="mb-[15px] list-disc space-y-2 pl-6">{items}</ul>;
  })}</>;
}

/**
 * Acronyms of an answer with the meaning the organization published. The
 * label comes from the backend; without it, or without acronyms, nothing renders.
 */
export function InstitutionalAcronyms({items,label}:{items:KnowledgeAcronym[];label?:string|null}) {
  const title=label?.trim();
  if(!items.length||!title)return null;
  return <div className="institutional-acronyms" role="group" aria-label={title} data-testid="institutional-acronyms">
    <p className="institutional-acronyms__label" aria-hidden="true">{title}</p>
    <dl>{items.map(item=><div key={item.acronym}><dt><abbr title={item.expansion}>{item.acronym}</abbr></dt><dd>{item.expansion}</dd></div>)}</dl>
  </div>;
}

export const MAX_INSTITUTIONAL_WHATSAPP_CHARS=3500;
export const DEFAULT_WHATSAPP_SHARE_LABEL='Enviar por WhatsApp';
export const DEFAULT_PRINT_ANSWER_LABEL='Imprimir o guardar en PDF';
export const DEFAULT_PRINT_DISCLAIMER='Información orientativa. Confirmá los requisitos con el organismo';

const nonEmptyUi=(ui:Record<string,string|undefined>|null|undefined,keys:readonly string[]):string|null=>{
  if(!ui)return null;
  for(const key of keys){
    const value=ui[key];
    if(typeof value==='string'&&value.trim().length>0)return value.trim();
  }
  return null;
};

export function resolveInstitutionalShareLabels(ui?:Record<string,string|undefined>|null) {
  return {
    whatsapp:nonEmptyUi(ui,['share_whatsapp','whatsapp_share','send_whatsapp'])??DEFAULT_WHATSAPP_SHARE_LABEL,
    print:nonEmptyUi(ui,['print_answer','print','print_or_pdf'])??DEFAULT_PRINT_ANSWER_LABEL,
    disclaimer:nonEmptyUi(ui,['print_disclaimer','orientative_notice','disclaimer'])??DEFAULT_PRINT_DISCLAIMER,
  };
}

/** Convert response text to clean plain text without Markdown syntax. */
export function stripMarkdownToPlainText(text:string):string {
  return text
    .replace(/\r\n?/g,'\n')
    .replace(/```[^\n]*\n([\s\S]*?)```/g,'$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g,'$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,(_,label:string,url:string)=>
      label.trim()===url.trim()?url.trim():`${label.trim()} (${url.trim()})`)
    .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
    .replace(/`([^`]+)`/g,'$1')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm,'')
    .replace(/^[ \t]*>[ \t]?/gm,'')
    .replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gm,'')
    .replace(/\*\*([^*]+)\*\*/g,'$1')
    .replace(/(^|[\s([{"'¡¿])__([^_]+)__(?=$|[\s.,;:!?)\]}"'])/g,'$1$2')
    .replace(/(^|[\s([{"'¡¿])\*([^*\n]+)\*(?=$|[\s.,;:!?)\]}"'])/g,'$1$2')
    .replace(/(^|[\s([{"'¡¿])_([^_\n]+)_(?=$|[\s.,;:!?)\]}"'])/g,'$1$2')
    .replace(/~~([^~]+)~~/g,'$1')
    .replace(/^[ \t]*[-*][ \t]+/gm,'• ')
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

const VALID_NODE_ID=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/;
const PLATFORM_HOST=/(?:^|\.)(?:chatboc\.ar|vercel\.app|localhost|127\.0\.0\.1)$/i;

/** Build the public portal link for a tenant answer (with node query when available). */
export function buildInstitutionalPortalUrl(tenantSlug:string,nodeId?:string|null,currentHref?:string):string {
  const slug=tenantSlug.trim();
  const href=currentHref??(typeof window!=='undefined'?window.location.href:'');
  let origin='https://www.chatboc.ar';
  let basePath=slug?`/t/${encodeURIComponent(slug)}`:'/';
  try {
    if(href){
      const parsed=new URL(href);
      if(parsed.protocol==='http:'||parsed.protocol==='https:'){
        origin=parsed.origin;
        const normalizedPath=parsed.pathname.replace(/\/+$/,'')||'/';
        const tenantPath=slug?`/t/${encodeURIComponent(slug)}`:'';
        if(tenantPath&&normalizedPath.toLowerCase()===tenantPath.toLowerCase()){
          basePath=normalizedPath;
        }else if(normalizedPath==='/'&&!PLATFORM_HOST.test(parsed.hostname)){
          basePath='/';
        }
      }
    }
  }catch{
    // Keep canonical fallback URL when current location cannot be parsed.
  }
  const url=new URL(basePath,origin);
  const cleanNode=typeof nodeId==='string'?nodeId.trim():'';
  if(cleanNode&&VALID_NODE_ID.test(cleanNode))url.searchParams.set('tema',cleanNode);
  return url.href;
}

export interface InstitutionalWhatsAppShareInput {
  title:string;
  text:string;
  acronyms?:KnowledgeAcronym[];
  acronymsLabel?:string|null;
  links?:Array<{label:string;url:string}>;
  portalUrl?:string|null;
  maxLength?:number;
}

const sliceWithoutBrokenSurrogate=(value:string,length:number):string=>{
  if(length<=0)return '';
  let sliced=value.slice(0,length);
  const last=sliced.charCodeAt(sliced.length-1);
  if(last>=0xd800&&last<=0xdbff)sliced=sliced.slice(0,-1);
  return sliced;
};

/** Compose plain-text WhatsApp message, truncating body with «…» while preserving portal URL. */
export function buildInstitutionalWhatsAppText(input:InstitutionalWhatsAppShareInput):string {
  const maxLength=Math.max(1,input.maxLength??MAX_INSTITUTIONAL_WHATSAPP_CHARS);
  const parts:string[]=[];
  const title=stripMarkdownToPlainText(input.title);
  if(title)parts.push(title);
  const bodyText=stripMarkdownToPlainText(input.text);
  if(bodyText)parts.push(bodyText);
  const acronyms=(input.acronyms??[]).filter(item=>item.acronym.trim()&&item.expansion.trim());
  if(acronyms.length){
    const label=input.acronymsLabel?.trim()||'Siglas';
    parts.push(`${label}:\n${acronyms.map(item=>`• ${item.acronym.trim()}: ${item.expansion.trim()}`).join('\n')}`);
  }
  const links=(input.links??[]).filter(link=>link.label.trim()&&link.url.trim());
  if(links.length){
    parts.push(`Enlaces de referencia:\n${links.map(link=>`• ${stripMarkdownToPlainText(link.label)}: ${link.url.trim()}`).join('\n')}`);
  }
  const body=parts.join('\n\n');
  const portalUrl=input.portalUrl?.trim()||'';
  const footer=portalUrl?`Ver en el portal: ${portalUrl}`:'';
  const combined=footer?(body?`${body}\n\n${footer}`:footer):body;
  if(combined.length<=maxLength)return combined;
  if(!footer){
    return `${sliceWithoutBrokenSurrogate(body,maxLength-1).trimEnd()}…`;
  }
  const suffix=`\n\n${footer}`;
  const available=maxLength-suffix.length-1;
  if(available<=0)return footer;
  const truncated=sliceWithoutBrokenSurrogate(body,available).trimEnd();
  return `${truncated}…${suffix}`;
}

export function buildInstitutionalWhatsAppUrl(input:InstitutionalWhatsAppShareInput):string {
  return `https://wa.me/?text=${encodeURIComponent(buildInstitutionalWhatsAppText(input))}`;
}

export function openInstitutionalWhatsAppShare(url:string):void {
  if(typeof window==='undefined'||!url.startsWith('https://wa.me/?text='))return;
  const opened=window.open(url,'_blank','noopener,noreferrer');
  if(opened)opened.opener=null;
}

export function formatInstitutionalPrintDate(date=new Date()):string {
  try {
    return new Intl.DateTimeFormat('es-AR',{dateStyle:'long',timeStyle:'short'}).format(date);
  }catch{
    return date.toLocaleString('es-AR');
  }
}
