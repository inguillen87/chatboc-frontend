import {useEffect, useId, useState} from 'react';
import {AlertTriangle, CheckCircle2, FileText, Loader2, RefreshCw, Search, ShieldCheck} from 'lucide-react';
import {AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle} from '@/components/ui/alert-dialog';
import type {useWhatsappTemplatePacks} from '@/hooks/useWhatsappTemplatePacks';
import {displayedTemplateState, type TemplatePack, type TemplatePackCatalog, type TemplatePackItem} from './whatsappTemplatePackContract';
import type {TemplateWorkspaceUI} from './templateWorkspaceUI';
import styles from './WhatsappTemplateWorkspace.module.css';

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es');
export function matchesTemplateQuery(item: TemplatePackItem, query: string): boolean {
  const normalized = fold(query.trim().slice(0, 200));
  if (!normalized) return true;
  return [item.name, item.intent, item.intent_label, item.preview?.body, item.preview?.cta?.text]
    .some(value => typeof value === 'string' && fold(value).includes(normalized));
}
type Props = {catalog: TemplatePackCatalog; ui: TemplateWorkspaceUI; state: ReturnType<typeof useWhatsappTemplatePacks>};

/** Filtered previews never change the full-pack mutation scope. */
export default function WhatsappTemplateWorkspace({catalog, ui, state}: Props) {
  const prefix = useId();
  const [selected, setSelected] = useState(catalog.packs[0]?.vertical ?? '');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [confirmation, setConfirmation] = useState<{catalog: TemplatePackCatalog; pack: TemplatePack} | null>(null);
  const pack = catalog.packs.find(item => item.vertical === selected) ?? catalog.packs[0];
  const all = pack?.templates ?? [];
  const lifecycle = catalog.frontend_contract?.lifecycle_labels ?? {};
  const blockerLabels = catalog.frontend_contract?.blocker_labels ?? {};
  const counts = new Map<string, number>();
  all.forEach(item => { const key = displayedTemplateState(item); counts.set(key, (counts.get(key) ?? 0) + 1); });
  const states = Array.from(new Set([...Object.keys(lifecycle), ...counts.keys(), ...(filter ? [filter] : [])]));
  const filtered = all.filter(item => (!filter || displayedTemplateState(item) === filter) && matchesTemplateQuery(item, query));
  const busy = state.loading || Boolean(state.savingVertical);
  const allCreated = all.length > 0 && all.every(item => item.materialized === true);
  const canCreate = state.canMaterialize && !busy && !state.error && all.length > 0 && !allCreated;
  const currentConfirmation = confirmation?.catalog === catalog && confirmation?.pack === pack && canCreate;
  useEffect(() => { setConfirmation(null); }, [catalog, state.loading, state.error]);
  const resetFilters = () => {setQuery(''); setFilter('');};
  const countText = ui.results.replace('{visible}', String(filtered.length)).replace('{total}', String(all.length));
  return <section className={styles.root} aria-label={ui.title} aria-busy={busy} data-testid="whatsapp-template-packs">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}><ShieldCheck size={17} aria-hidden="true"/>{catalog.tenant.slug}</span>
        <h2>{ui.title}</h2><p>{ui.description}</p></div>
      <button className={styles.button} type="button" onClick={() => void state.refresh()} disabled={busy}>
        {state.loading ? <Loader2 size={17} aria-hidden="true"/> : <RefreshCw size={17} aria-hidden="true"/>}{ui.refresh}
      </button>
    </header>
    <p className={styles.scopeNote}>{ui.provider_notice}</p>
    {state.notice ? <p role="status" className={styles.notice}>{state.notice}</p> : null}
    {state.error ? <div role="alert" className={styles.warning}><p>{state.error}</p><p>{ui.stale}</p></div> : null}
    {!pack ? <p className={styles.empty}>{ui.empty}</p> : <>
      <div className={styles.controls}>
        <label htmlFor={`${prefix}-pack`}>{ui.pack_label}<select id={`${prefix}-pack`} value={pack.vertical} disabled={busy}
          onChange={event => {setSelected(event.target.value); resetFilters(); setConfirmation(null);}}>
          {catalog.packs.map(item => <option key={item.vertical} value={item.vertical}>{item.label || item.vertical}</option>)}
        </select></label>
        <label htmlFor={`${prefix}-search`}>{ui.search_label}<span className={styles.search}>
          <Search size={17} aria-hidden="true"/><input id={`${prefix}-search`} type="search" value={query} maxLength={200}
            placeholder={ui.search_placeholder} onChange={event => setQuery(event.target.value)} />
        </span></label>
        <label htmlFor={`${prefix}-state`}>{ui.state_label}<select id={`${prefix}-state`} value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="">{ui.all_states} ({all.length})</option>
          {states.map(key => <option key={key} value={key}>{lifecycle[key] || ui.unverified} ({counts.get(key) ?? 0})</option>)}
        </select></label>
      </div>
      <div className={styles.resultRow}><p role="status" aria-live="polite">{countText}</p>
        {query || filter ? <button type="button" className={styles.button} onClick={resetFilters}>{ui.clear_filters}</button> : null}</div>
      <div className={styles.packHeading}><h3>{pack.label || pack.vertical}</h3><span>{pack.pack_id} · v{pack.pack_version}</span></div>
      {!filtered.length ? <p className={styles.empty}>{ui.no_results}</p> : <div className={styles.grid}>
        {filtered.map(item => {
          const status = displayedTemplateState(item);
          const approved = status === 'approved';
          return <article className={styles.template} key={item.name} data-state={status}>
            <div className={styles.templateHeader}><h4>{item.intent_label || item.intent || item.name}</h4>
              <span className={styles.badge} data-state={status}>
                {approved ? <CheckCircle2 size={13} aria-hidden="true"/> : <FileText size={13} aria-hidden="true"/>}
                {lifecycle[status] || ui.unverified}
              </span></div>
            <p className={styles.body}>{item.preview?.body}</p>
            {item.preview?.cta?.text ? <div className={styles.cta}><strong>{item.preview.cta.text}</strong>
              {item.preview.cta.url ? <span>{item.preview.cta.url}</span> : null}</div> : null}
            {item.blockers?.length ? <ul className={styles.blockers}>{item.blockers.map((key, i) => <li key={`${key}-${i}`}>
              <AlertTriangle size={13} aria-hidden="true"/>{blockerLabels[key] || key}</li>)}</ul> : null}
            <code className={styles.name}>{item.name}</code>
          </article>;
        })}
      </div>}
      <footer className={styles.footer}><p>{ui.approval_note}</p>
        {catalog.capabilities?.materialize_local_draft === true ? <button type="button" className={`${styles.button} ${styles.primary}`}
          disabled={!canCreate} onClick={() => {if (canCreate) setConfirmation({catalog, pack});}}>
          <FileText size={17} aria-hidden="true"/>{state.savingVertical ? ui.creating : allCreated ? ui.created : ui.create}
        </button> : null}
      </footer>
    </>}
    <AlertDialog open={Boolean(confirmation && currentConfirmation)} onOpenChange={open => {if (!open) setConfirmation(null);}}>
      <AlertDialogContent className={styles.dialog}><AlertDialogHeader>
        <AlertDialogTitle>{ui.confirm_title}</AlertDialogTitle><AlertDialogDescription>{ui.confirm_description}</AlertDialogDescription>
      </AlertDialogHeader>
        <dl className={styles.confirmDetails}><div><dt>{ui.tenant_label}</dt><dd>{catalog.tenant.slug}</dd></div>
          <div><dt>{ui.selection_label}</dt><dd>{confirmation?.pack.label || confirmation?.pack.vertical}</dd>
            <dd>{confirmation?.pack.pack_id} · v{confirmation?.pack.pack_version}</dd></div></dl>
        <AlertDialogFooter><AlertDialogCancel>{ui.cancel}</AlertDialogCancel>
          <AlertDialogAction disabled={!currentConfirmation} onClick={() => {
            const target = confirmation; setConfirmation(null);
            if (target && currentConfirmation) void state.materialize(target.pack);
          }}>{ui.confirm_action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
