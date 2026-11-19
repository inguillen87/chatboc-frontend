import React,{useEffect,useId,useRef,useState} from 'react';
import {BarChart3} from 'lucide-react';
import type {KnowledgeWorkspace} from './institutionalAssistantContract';
import {loadQuestionMetrics,QUESTION_OUTCOMES,type KnowledgeQuestionMetrics,type QuestionNodeCount} from './institutionalQuestionMetricsContract';

/** Administration-only panel. Every label comes from the server; nothing is requested until it is opened. */
export function KnowledgeQuestionMetricsPanel({workspace,label}:{workspace:KnowledgeWorkspace;label:string}){
  const [open,setOpen]=useState(false);
  const [state,setState]=useState<{status:'idle'|'loading'|'error'}|{status:'ready';data:KnowledgeQuestionMetrics}>({status:'idle'});
  const request=useRef<AbortController|null>(null),panelId=useId(),ui=workspace.ui;
  const scope=`${workspace.tenant.id}:${workspace.tenant.slug}:${workspace.revision??''}`;
  // Another organization or revision never shows the previous one's numbers.
  useEffect(()=>{setOpen(false);setState({status:'idle'});return()=>{request.current?.abort();request.current=null;};},[scope]);
  const toggle=()=>{
    const next=!open;setOpen(next);
    if(!next||state.status==='loading'||state.status==='ready')return;
    request.current?.abort();const controller=new AbortController();request.current=controller;
    setState({status:'loading'});
    loadQuestionMetrics(workspace,{signal:controller.signal})
      .then(data=>{if(request.current===controller)setState({status:'ready',data});})
      .catch(()=>{if(request.current===controller)setState({status:'error'});});
  };
  const data=state.status==='ready'?state.data:null;
  const total=data?QUESTION_OUTCOMES.reduce((sum,outcome)=>sum+data.totals[outcome],0):0;
  const table=(title:string,rows:QuestionNodeCount[],copy:KnowledgeQuestionMetrics['ui'])=>rows.length?<section aria-label={title}>
    <h4>{title}</h4>
    <table><thead><tr><th scope="col">{copy.node}</th><th scope="col">{copy.count}</th></tr></thead>
      <tbody>{rows.map(row=><tr key={row.node_id}><th scope="row">{row.title??copy.retired_node}</th><td>{row.count}</td></tr>)}</tbody></table>
  </section>:null;
  return <div className="institutional-assistant__metrics">
    <button type="button" aria-expanded={open} aria-controls={panelId} onClick={toggle}><BarChart3 size={17} aria-hidden="true"/>{label}</button>
    {open?<div id={panelId} className="institutional-assistant__metrics-panel">
      {state.status==='loading'?<p role="status">{ui.loading}</p>:null}
      {state.status==='error'?<p role="alert">{ui.error}</p>:null}
      {data?<>
        <div><h3>{data.ui.title}</h3><p>{data.ui.description}</p>
          <p className="institutional-assistant__metrics-note">{data.ui.period.replace('{days}',()=>String(data.days))}</p></div>
        {total===0?<p>{data.ui.empty}</p>:<>
          <dl className="institutional-assistant__metrics-totals">
            {QUESTION_OUTCOMES.map(outcome=><div key={outcome}><dt>{data.ui[outcome]}</dt><dd>{data.totals[outcome]}</dd></div>)}
            {data.uncovered_rate!==null?<div><dt>{data.ui.uncovered_rate}</dt><dd>{Math.round(data.uncovered_rate*100)} %</dd></div>:null}
          </dl>
          {table(data.ui.uncovered_by_node,data.uncovered_by_node,data.ui)}
          {table(data.ui.answered_by_node,data.answered_by_node,data.ui)}
        </>}
        {data.truncated?<p className="institutional-assistant__metrics-note">{data.ui.truncated}</p>:null}
        <p className="institutional-assistant__metrics-note">{data.ui.privacy}</p>
      </>:null}
    </div>:null}
  </div>;
}
