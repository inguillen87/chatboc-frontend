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
