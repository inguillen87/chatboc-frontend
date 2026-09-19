import React from 'react';
import { CheckCircle2, ChevronRight, CircleDashed, Lock, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { OrganizationSetupJourney } from '@/utils/organizationSetupJourney';
import { buildTenantJourneyHref } from './TenantLaunchJourney';
import styles from './OrganizationSetupWorkspace.module.css';
const states={ready:{label:'Comprobado',Icon:CheckCircle2},action_required:{label:'Por completar',Icon:CircleDashed},
  pending:{label:'En proceso',Icon:CircleDashed},blocked:{label:'Requiere habilitación',Icon:Lock},
  not_published:{label:'Sin verificación',Icon:AlertTriangle}};
interface Props { journey:OrganizationSetupJourney; loading?:boolean; error?:string|null; onRefresh:()=>void; returnTo?:string; technicalDetails?:React.ReactNode }
export default function OrganizationSetupWorkspace(props:Props) {
  return <SetupSteps key={`${props.journey.tenant.id}:${props.journey.tenant.slug}`} {...props}/>;
}
function SetupSteps({journey,loading=false,error,onRefresh,returnTo,technicalDetails}:Props) {
  const [selected,setSelected]=React.useState(journey.summary.current_stage_id||journey.stages[0].id);
  React.useEffect(()=>setSelected(journey.summary.current_stage_id||journey.stages[0].id),[journey.summary.current_stage_id]);
  const stage=journey.stages.find(item=>item.id===selected)||journey.stages[0];
  const active=states[stage.status]; const ActiveIcon=active.Icon;
  const href=stage.primary_action&&!loading&&!error?buildTenantJourneyHref(stage.primary_action.href,journey.tenant.slug,returnTo):null;
  const headingId=React.useId();const panelId=React.useId();
  return <section className={styles.workspace} aria-labelledby={headingId} data-testid="organization-setup-workspace">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>{journey.organization_label} · Configuración guiada</span>
        <h2 id={headingId}>{journey.heading}</h2><p>{journey.description}</p></div>
      <button type="button" className={styles.refresh} onClick={onRefresh} disabled={loading}>
        <RefreshCw size={16} aria-hidden="true" className={loading?styles.spin:''}/>{loading?'Verificando…':'Actualizar estado'}
      </button>
    </header>
    <div className={styles.continuity}><ShieldCheck size={18} aria-hidden="true"/><span>{journey.continuity_note}</span></div>
    <div className={styles.progress}><span>{journey.summary.ready} de {journey.summary.total} pasos comprobados</span>
      <span>{journey.summary.progress}%</span><progress max={100} value={journey.summary.progress} aria-label="Pasos de configuración comprobados"/>
    </div>
    {error?<p role="alert" className={styles.warning}>{error} Las acciones quedan en pausa hasta actualizar el estado.</p>:null}
    <div className={styles.layout}>
      <nav aria-label="Pasos de configuración"><ol className={styles.steps}>
        {journey.stages.map((item,index)=>{const StatusIcon=states[item.status].Icon;return <li key={item.id}>
          <button type="button" aria-current={selected===item.id?'step':undefined} aria-controls={panelId}
            onClick={()=>setSelected(item.id)} className={styles.step}>
            <span className={styles.number}>{index+1}</span><span className={styles.stepName}>{item.label}
              <small><StatusIcon size={13} aria-hidden="true"/>{states[item.status].label}</small></span><ChevronRight size={16} aria-hidden="true"/>
          </button></li>;})}
      </ol></nav>
      <section id={panelId} className={styles.detail} aria-label={`Detalle de ${stage.label}`}>
        <span className={styles.state} data-state={stage.status}><ActiveIcon size={16} aria-hidden="true"/>{active.label}</span>
        <h3>{stage.label}</h3><p>{stage.description}</p>
        {href?<a className={styles.primary} href={href}>{stage.primary_action?.label}<ChevronRight size={17} aria-hidden="true"/></a>:null}
        {!stage.published?<p className={styles.warning}>Falta información verificable para este paso. No lo marcamos como completado.</p>:null}
        <details className={styles.evidence}><summary>Evidencia del paso</summary>
          <ul>{stage.evidence.map((item,index)=><li key={index}>{item}</li>)}</ul>
        </details>
        <p className={styles.note}>{journey.readiness_note}</p>
      </section>
    </div>
    {technicalDetails?<details className={styles.technical}><summary>Todos los canales y controles</summary>{technicalDetails}</details>:null}
  </section>;
}
