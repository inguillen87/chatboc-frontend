import React from 'react';
import {AlertTriangle,CheckCircle2,ListChecks,UserRound} from 'lucide-react';
import {TicketSlaClocks} from '../TicketSlaClocks';

interface Props {
  assigneeLabel?: string|null;
  sla?: unknown;
  nextSteps?: string[]|null;
}
const clean=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null;

export function CaseOperationalBar({assigneeLabel,sla,nextSteps}:Props){
  const assignee=clean(assigneeLabel);
  const nextStep=(nextSteps||[]).map(clean).find((value):value is string=>Boolean(value))||null;
  return <section className="case-operational-bar" aria-label="Control operativo del caso">
    <div className={`case-operational-item ${assignee?'':'needs-attention'}`}>
      <span className="case-operational-label"><UserRound size={15} aria-hidden="true"/>Responsable</span>
      <strong>{assignee||'Sin asignar'}</strong>
    </div>
    <div className="case-operational-item">
      <span className="case-operational-label"><CheckCircle2 size={15} aria-hidden="true"/>SLA</span>
      <TicketSlaClocks sla={sla} compact className="case-operational-sla"/>
    </div>
    <div className={`case-operational-item ${nextStep?'':'needs-attention'}`}>
      <span className="case-operational-label"><ListChecks size={15} aria-hidden="true"/>Próximo paso</span>
      <strong>{nextStep||'Sin próximo paso publicado'}</strong>
      {!nextStep?<span className="sr-only"><AlertTriangle size={13} aria-hidden="true"/>Revisá el contexto antes de responder.</span>:null}
    </div>
  </section>;
}
