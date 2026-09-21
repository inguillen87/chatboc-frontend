import type { ComponentProps } from 'react';
import { SurveyCard as SurveyCardView } from './SurveyCardView';
import { useSurveyCardActions } from '@/hooks/useSurveyCardActions';
import styles from './SurveyCard.module.css';

type Props = ComponentProps<typeof SurveyCardView>;

/** A confirmation belongs to the displayed survey snapshot, not just its numeric ID.
 * Changing tenant, content or lifecycle discards only the local dialog. It never
 * cancels or repeats a request that the server may already be processing.
 */
export const SurveyCard = (props: Props) => {
  const { survey, tenantSlug } = props;
  const scope = JSON.stringify([tenantSlug ?? null, survey.id, survey.titulo, survey.slug,
    survey.descripcion, survey.tipo, survey.estado, survey.inicio_at, survey.fin_at,
    survey.admin_lifecycle, survey.metricas, survey.governance, survey.preguntas]);
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
  return <div className={styles.frame} aria-busy={externallyBusy || actions.pending !== null}>
    <SurveyCardView
      {...props}
      closing={Boolean(props.closing || actions.pending === 'close')}
      deleting={Boolean(props.deleting || actions.pending === 'delete')}
      onClose={props.onClose && canClose ? actions.close : undefined}
      onDelete={props.onDelete && canDelete ? actions.delete : undefined}
    />
  </div>;
}
