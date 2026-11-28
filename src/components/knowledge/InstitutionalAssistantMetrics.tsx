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
  const resolution=data&&typeof data.resolution_rate==='number'?Math.round(data.resolution_rate*100):null;
  const detail=data&&data.ui.resolution_detail&&typeof data.interpreted==='number'
    ?data.ui.resolution_detail.replace('{answered}',()=>String(data.totals.answered)).replace('{interpreted}',()=>String(data.interpreted)):null;
  const feedback=data?.feedback??null;
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
          {resolution!==null&&data.ui.resolution_rate?<div className="institutional-assistant__metrics-resolution">
            <p className="institutional-assistant__metrics-resolution-label" id={`${panelId}-resolution`}>{data.ui.resolution_rate}</p>
            <p className="institutional-assistant__metrics-resolution-value">{resolution} %</p>
            <div role="meter" aria-labelledby={`${panelId}-resolution`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={resolution}
              aria-valuetext={`${resolution} %`} className="institutional-assistant__metrics-resolution-bar"><span style={{width:`${resolution}%`}}/></div>
            {detail?<p className="institutional-assistant__metrics-note">{detail}</p>:null}
          </div>:null}
          <dl className="institutional-assistant__metrics-totals">
            {QUESTION_OUTCOMES.map(outcome=><div key={outcome}><dt>{data.ui[outcome]}</dt><dd>{data.totals[outcome]}</dd></div>)}
            {data.uncovered_rate!==null?<div><dt>{data.ui.uncovered_rate}</dt><dd>{Math.round(data.uncovered_rate*100)} %</dd></div>:null}
          </dl>
          {table(data.ui.uncovered_by_node,data.uncovered_by_node,data.ui)}
          {table(data.ui.answered_by_node,data.answered_by_node,data.ui)}
        </>}
        {feedback?<section className="institutional-assistant__metrics-feedback" aria-labelledby={`${panelId}-feedback`}>
          <h3 id={`${panelId}-feedback`}>{data.ui.feedback_title}</h3><p>{data.ui.feedback_description}</p>
          {feedback.helpful+feedback.unhelpful===0?<p>{data.ui.feedback_empty}</p>:<>
            <dl className="institutional-assistant__metrics-totals">
              <div><dt>{data.ui.feedback_helpful}</dt><dd>{feedback.helpful}</dd></div>
              <div><dt>{data.ui.feedback_unhelpful}</dt><dd>{feedback.unhelpful}</dd></div>
              {feedback.helpful_rate!==null?<div><dt>{data.ui.feedback_rate}</dt><dd>{Math.round(feedback.helpful_rate*100)} %</dd></div>:null}
            </dl>
            {table(data.ui.feedback_by_node??'',feedback.unhelpful_by_node,data.ui)}
          </>}
        </section>:null}
        {data.truncated?<p className="institutional-assistant__metrics-note">{data.ui.truncated}</p>:null}
        <p className="institutional-assistant__metrics-note">{data.ui.privacy}</p>
      </>:null}
    </div>:null}
  </div>;
}
