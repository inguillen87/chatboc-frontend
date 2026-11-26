import React,{useEffect,useId,useRef,useState} from 'react';
import {ListChecks} from 'lucide-react';
import {askWorkspace,isKnowledgeSourceNavigation,type KnowledgeWorkspace} from './institutionalAssistantContract';

export const BATTERY_MAX_QUESTIONS=25;
const MAX_QUESTION_LENGTH=300;
type Outcome='pending'|'answered'|'uncovered'|'sources'|'failed';
interface Row {question:string;outcome:Outcome;topic:string|null}

/** One question per line: trimmed, without repeats, bounded in length and count. */
export function readBatteryQuestions(value:string):string[] {
  const seen=new Set<string>(),questions:string[]=[];
  for(const line of value.split(/\r?\n/)){
    const question=line.trim().slice(0,MAX_QUESTION_LENGTH),key=question.toLocaleLowerCase('es');
    if(!question||seen.has(key))continue;
    seen.add(key);questions.push(question);
    if(questions.length===BATTERY_MAX_QUESTIONS)break;
  }
  return questions;
}

/**
 * Administration-only check of a batch of questions against the current version.
 * It uses the private answer route, which records no metric. What is typed stays
 * in this component and is dropped when the organization or version changes.
 */
export function KnowledgeTestBatteryPanel({workspace,gapMs=2200}:{workspace:KnowledgeWorkspace;gapMs?:number}){
  const ui=workspace.ui,panelId=useId(),inputId=useId();
  const [open,setOpen]=useState(false),[text,setText]=useState(''),[rows,setRows]=useState<Row[]>([]),[running,setRunning]=useState(false);
  const run=useRef(0);
  const scope=`${workspace.tenant.id}:${workspace.tenant.slug}:${workspace.revision??''}`;
  useEffect(()=>{run.current+=1;setOpen(false);setText('');setRows([]);setRunning(false);return()=>{run.current+=1;};},[scope]);
  const start=workspace.knowledge?.start;
  if(!start||!workspace.revision)return null;
  const questions=readBatteryQuestions(text);
  const stop=()=>{run.current+=1;setRunning(false);};
  const begin=async()=>{
    const id=run.current+=1,batch=questions;
    setRows(batch.map(question=>({question,outcome:'pending',topic:null})));setRunning(true);
    for(let index=0;index<batch.length;index+=1){
      if(index>0&&gapMs>0)await new Promise(resolve=>setTimeout(resolve,gapMs));
      if(run.current!==id)return;
      let outcome:Outcome='failed',topic:string|null=null;
      try{
        const answer=await askWorkspace(workspace,'admin',{node_id:start,question:batch[index]});
        if(isKnowledgeSourceNavigation(answer))outcome='sources';
        else if(answer.nodes.length){outcome='answered';topic=answer.nodes.map(node=>node.title).join(', ');}
        else outcome='uncovered';
      }catch{outcome='failed';}
      if(run.current!==id)return;
      setRows(current=>current.map((row,position)=>position===index?{...row,outcome,topic}:row));
    }
    if(run.current===id)setRunning(false);
  };
  const done=rows.filter(row=>row.outcome!=='pending').length,answered=rows.filter(row=>row.outcome==='answered').length;
  const summary=rows.length?ui.test_battery_summary.replace('{answered}',()=>String(answered)).replace('{total}',()=>String(done)):'';
  return <div className="institutional-assistant__metrics">
    <button type="button" aria-expanded={open} aria-controls={panelId} onClick={()=>setOpen(value=>!value)}><ListChecks size={17} aria-hidden="true"/>{ui.test_battery}</button>
    {open?<div id={panelId} className="institutional-assistant__metrics-panel institutional-assistant__battery">
      <p>{ui.test_battery_description}</p>
      <div className="institutional-assistant__battery-field">
        <label htmlFor={inputId}>{ui.test_battery_input}</label>
        <textarea id={inputId} rows={6} value={text} disabled={running} onChange={event=>setText(event.target.value)}/>
        <p className="institutional-assistant__metrics-note">{ui.test_battery_limit.replace('{max}',()=>String(BATTERY_MAX_QUESTIONS))}</p>
      </div>
      <div className="institutional-assistant__battery-actions">
        {running?<button type="button" onClick={stop}>{ui.test_battery_stop}</button>
          :<button type="button" onClick={()=>void begin()} disabled={!questions.length}>{ui.test_battery_run}</button>}
        <p role="status" className="institutional-assistant__battery-summary">{summary}</p>
      </div>
      {rows.length?<table>
        <thead><tr><th scope="col">{ui.test_battery_question}</th><th scope="col">{ui.test_battery_result}</th><th scope="col">{ui.test_battery_topic}</th></tr></thead>
        <tbody>{rows.map((row,index)=><tr key={`${index}:${row.question}`} data-outcome={row.outcome}>
          <th scope="row">{row.question}</th><td>{ui[`test_battery_${row.outcome}`]}</td><td>{row.topic??'—'}</td></tr>)}</tbody>
      </table>:null}
    </div>:null}
  </div>;
}
