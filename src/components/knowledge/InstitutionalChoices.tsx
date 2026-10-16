import React,{useLayoutEffect,useRef,useState} from 'react';
import type {KnowledgeNode} from './institutionalAssistantContract';

export interface InstitutionalChoiceNavigation {more_options:string;previous_options:string;options_page:string}
const keys=['more_options','previous_options','options_page'] as const;
/** Navigation copy is supplied by the same backend as the canonical choices. */
export function readInstitutionalChoiceNavigation(value:unknown):InstitutionalChoiceNavigation|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const labels=value as Record<string,unknown>;
  if(!keys.every(key=>typeof labels[key]==='string'&&String(labels[key]).trim().length>0&&String(labels[key]).length<=200)||
    !String(labels.options_page).includes('{current}')||!String(labels.options_page).includes('{total}'))return null;
  return {more_options:labels.more_options as string,previous_options:labels.previous_options as string,options_page:labels.options_page as string};
}
export type InstitutionalChoice=KnowledgeNode['actions'][number];
/** Six canonical choices stay together; longer unions reserve room for two controls. */
export function institutionalChoicePages(actions:InstitutionalChoice[],navigation:InstitutionalChoiceNavigation|null):InstitutionalChoice[][] {
  if(actions.length<=6||!navigation)return [actions];
  return Array.from({length:Math.ceil(actions.length/4)},(_,index)=>actions.slice(index*4,index*4+4));
}
interface Props {
  actions:InstitutionalChoice[];navigation:InstitutionalChoiceNavigation|null;responseIdentity:unknown;
  disabled?:boolean;className:string;renderChoice:(action:InstitutionalChoice)=>React.ReactNode;
}
export function InstitutionalChoices({actions,navigation,responseIdentity,disabled=false,className,renderChoice}:Props) {
  const [selection,setSelection]=useState({identity:responseIdentity,page:0});
  const pages=institutionalChoicePages(actions,navigation);
  const page=selection.identity===responseIdentity?Math.min(selection.page,pages.length-1):0;
  const container=useRef<HTMLDivElement>(null),focusNext=useRef(false);
  useLayoutEffect(()=>{
    if(selection.identity!==responseIdentity){focusNext.current=false;setSelection({identity:responseIdentity,page:0});return;}
    if(!focusNext.current)return;focusNext.current=false;
    if(disabled)return;
    const first=container.current?.querySelector<HTMLButtonElement>('[data-choice-options] button');
    first?.focus({preventScroll:true});first?.scrollIntoView?.({block:'nearest',behavior:'auto'});
  },[selection,responseIdentity,disabled]);
  const changePage=(next:number)=>{if(disabled)return;focusNext.current=true;setSelection({identity:responseIdentity,page:next});};
  if(!actions.length)return null;
  return <div ref={container} className="institutional-choices">
    {navigation&&pages.length>1?<p role="status" aria-live="polite" aria-atomic="true" className="institutional-choices__status">
      {navigation.options_page.replaceAll('{current}',String(page+1)).replaceAll('{total}',String(pages.length))}
    </p>:null}
    <div className={className} data-choice-options>{pages[page].map(renderChoice)}
      {navigation&&page>0?<button type="button" disabled={disabled} data-choice-previous onClick={()=>changePage(page-1)}>{navigation.previous_options}</button>:null}
      {navigation&&page<pages.length-1?<button type="button" disabled={disabled} data-choice-more onClick={()=>changePage(page+1)}>{navigation.more_options}</button>:null}
    </div>
  </div>;
}
