import type { ComponentProps } from 'react';
import { SurveyCard as SurveyCardView } from './SurveyCardView';
import { useSurveyCardActions } from '@/hooks/useSurveyCardActions';
import styles from './SurveyCard.module.css';

type Props = Omit<ComponentProps<typeof SurveyCardView>, 'interactionsBlocked'>;

/** Every API survey field belongs to the reviewed snapshot. Canonical object
 * ordering avoids resetting a confirmation merely because JSON keys were reordered.
 * Callbacks are not part of this payload and remain separately capability-checked.
 */
export const SurveyCard = (props: Props) => {
  const scope = JSON.stringify([props.tenantSlug ?? null, props.survey], (_key, value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]))
      : value);
  return <ScopedSurveyCard key={scope} {...props} />;
};

function ScopedSurveyCard(props: Props) {
  const lifecycle = props.survey.admin_lifecycle;
  const canClose = lifecycle
    ? lifecycle.capabilities.can_close && lifecycle.actions.close.enabled
    : props.survey.estado === 'publicada';
  const canDelete = lifecycle?.capabilities.can_delete ?? props.survey.estado === 'borrador';
  const externallyBusy = Boolean(props.publishing || props.closing || props.deleting || props.seeding);
  const actions = useSurveyCardActions({
    blocked: externallyBusy,
    close: canClose ? props.onClose : undefined,
    delete: canDelete ? props.onDelete : undefined,
  });
  const blocked = externallyBusy || actions.pending !== null;
  return <div className={styles.frame} aria-busy={blocked}>
    <SurveyCardView
      {...props}
      interactionsBlocked={blocked}
      closing={Boolean(props.closing || actions.pending === 'close')}
      deleting={Boolean(props.deleting || actions.pending === 'delete')}
      onClose={props.onClose && canClose ? actions.close : undefined}
      onDelete={props.onDelete && canDelete ? actions.delete : undefined}
    />
  </div>;
}
