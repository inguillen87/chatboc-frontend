import React from 'react';
import { Link2 } from 'lucide-react';
import type { ModuleId, ModuleSelection } from '@/utils/organizationModules';
import { planModuleToggle, readSelectionAssistance, type ModuleTogglePlan } from '@/utils/moduleSelectionAssistance';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import styles from './OrganizationModuleSelector.module.css';

interface Props { snapshot: ModuleSelection; draft: ModuleId[]; disabled: boolean; onChange: (ids: ModuleId[]) => void }
interface PendingChange { context: string; draft: string; plan: ModuleTogglePlan }
export default function ModuleSelectionGrid({ snapshot, draft, disabled, onChange }: Props) {
  const assistance = readSelectionAssistance('selection_assistance' in snapshot ? snapshot.selection_assistance : null);
  const [pending, setPending] = React.useState<PendingChange | null>(null);
  const locked = disabled || !snapshot.can_edit;
  const context = JSON.stringify([snapshot.tenant, snapshot.revision, snapshot.catalog_version, snapshot.catalog, assistance]);
  const currentDraft = JSON.stringify(draft);
  const canApply = !!pending && !!assistance && !locked && pending.context === context && pending.draft === currentDraft;
  React.useEffect(() => { if (pending && !canApply) setPending(null); }, [pending, canApply]);
  const names = (ids: ModuleId[]) => ids.map(id => snapshot.catalog.find(item => item.id === id)?.label || id).join(' · ');
  const toggle = (id: ModuleId) => {
    if (locked) return;
    const plan = planModuleToggle(snapshot.catalog, draft, id);
    if (!plan) return;
    if (plan.added.length + plan.removed.length > 1) {
      if (assistance) setPending({ context, draft: currentDraft, plan });
      return;
    }
    onChange(plan.selected);
  };
  const affected = pending ? [...pending.plan.added, ...pending.plan.removed] : [];
  return <>
    {assistance ? <p className={styles.note}>{assistance.hint}</p> : null}
    <div className={styles.grid}>{snapshot.catalog.map(module => {
      const chosen = draft.includes(module.id);
      const missing = module.requires.some(id => !draft.includes(id));
      const neededBy = snapshot.catalog.filter(item => draft.includes(item.id) && item.requires.includes(module.id));
      return <label key={module.id} className={styles.card} data-selected={chosen}>
        <input type="checkbox" aria-label={module.label} checked={chosen}
          disabled={locked || (!assistance && (missing || (chosen && neededBy.length > 0)))}
          onChange={() => toggle(module.id)} />
        <span><strong>{module.label}</strong><span className={styles.description}>{module.description}</span>
          {module.requires.length ? <small><Link2 size={13} aria-hidden="true"/>{snapshot.ui.requires}: {names(module.requires)}</small> : null}
          {chosen && neededBy.length ? <small>{snapshot.ui.dependency} {names(neededBy.map(item => item.id))}</small> : null}
        </span>
      </label>;
    })}</div>
    {assistance ? <AlertDialog open={canApply} onOpenChange={open => { if (!open) setPending(null); }}>
      <AlertDialogContent className={styles.modal}>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.plan.removed.length ? assistance.remove_title : assistance.select_title}</AlertDialogTitle>
          <AlertDialogDescription>{assistance.detail}</AlertDialogDescription>
        </AlertDialogHeader>
        <section className={styles.compare}>
          <h4>{pending?.plan.removed.length ? assistance.removed_heading : assistance.added_heading}</h4>
          <ul className="mt-3 space-y-2" data-testid="module-dependency-impact">
            {affected.map(id => <li key={id} className="break-words">{names([id])}</li>)}
          </ul>
        </section>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">{assistance.cancel}</AlertDialogCancel>
          <AlertDialogAction type="button" disabled={!canApply} onClick={() => {
            if (!canApply || !pending) return;
            const selected = pending.plan.selected;
            setPending(null); onChange(selected);
          }}>{assistance.apply_draft}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog> : null}
  </>;
}
