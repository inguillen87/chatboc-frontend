import { RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import InterviewAssignmentDialog from './InterviewAssignmentDialog';
import {
  INTERVIEW_INBOX_CONTRACT_V2,
  type InterviewInboxEnvelope,
  type InterviewInboxItem,
} from './interviewsTypes';

const formatTimestamp = (value: string | null) => {
  if (!value) return 'Sin registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const visibleEvidence = (item: InterviewInboxItem) =>
  Object.entries(item.evidence.by_type).filter(([, count]) => count > 0);

interface InterviewInboxPanelProps {
  inbox: InterviewInboxEnvelope['inbox'];
  tenantSlug: string;
  isRefreshing?: boolean;
  onRefresh?: () => void | Promise<unknown>;
}

export default function InterviewInboxPanel({
  inbox,
  tenantSlug,
  isRefreshing = false,
  onRefresh,
}: InterviewInboxPanelProps) {
  const freshness = formatTimestamp(inbox.freshness.generated_at);
  const managedAssignmentPresentation =
    inbox.contract_version === INTERVIEW_INBOX_CONTRACT_V2
      ? inbox.presentation.assignment_dialog
      : undefined;

  return (
    <div className="space-y-5" data-testid="interview-inbox">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{inbox.presentation.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{inbox.presentation.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Alcance: {inbox.tenant.name} · actualizado {freshness}
          </p>
        </div>
        {onRefresh ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onRefresh()}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4${isRefreshing ? ' animate-spin' : ''}`}
              aria-hidden="true"
            />
            {isRefreshing ? 'Actualizando…' : 'Actualizar'}
          </Button>
        ) : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen de la bandeja">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Sesiones visibles</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{inbox.summary.sessions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">En curso</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{inbox.summary.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Revisión humana pendiente</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {inbox.summary.awaiting_human_review}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Evidencias registradas</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {inbox.summary.evidence_records}
            </p>
          </CardContent>
        </Card>
      </section>

      {inbox.contract_version !== INTERVIEW_INBOX_CONTRACT_V2 ? (
        <aside className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4" role="note">
          <p className="font-medium">Operación protegida en modo lectura</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Asignación, revisión y seguimiento permanecen bloqueados hasta contar con registros
            persistentes y auditoría específica. Esta bandeja no toma decisiones automáticas.
          </p>
        </aside>
      ) : null}

      <section className="space-y-3" aria-label="Entrevistas">
        {inbox.items.map((item) => {
          const evidence = visibleEvidence(item);
          const progressLabel = item.progress.percent === null
            ? `${item.progress.completed_steps}/${item.progress.total_steps}`
            : `${item.progress.percent}%`;
          const viewAction = item.actions.view_resume;
          return (
            <Card key={item.id}>
              <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-lg">{item.program.name}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{item.session.status_label}</Badge>
                    <Badge variant="outline">{item.session.channel_label}</Badge>
                    {item.review.required ? (
                      <Badge variant="secondary">{item.next_action_label}</Badge>
                    ) : null}
                    {item.assignment.managed_assignment_available &&
                    item.assignment.assigned_user_label ? (
                      <Badge variant="outline">
                        {managedAssignmentPresentation?.assignee_label}:{' '}
                        {item.assignment.assigned_user_label}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Caso {item.case.id} · identidad protegida
                  </p>
                </div>
                <div className="text-left text-xs text-muted-foreground md:text-right">
                  <p>Sesión {item.session.id}</p>
                  <p>Checkpoint {formatTimestamp(item.progress.last_checkpoint_at)}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <section aria-label={`Progreso de la sesión ${item.session.id}`}>
                  <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                    <span>Progreso verificable</span>
                    <span className="font-medium tabular-nums">{progressLabel}</span>
                  </div>
                  {item.progress.percent !== null ? (
                    <Progress
                      value={item.progress.percent}
                      aria-label={`Progreso ${item.progress.percent}%`}
                    />
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{item.progress.pending_required_steps} pasos requeridos pendientes</span>
                    <span>{item.evidence.total} evidencias</span>
                    {item.progress.current_step_ref ? (
                      <span>Paso actual: {item.progress.current_step_ref}</span>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-lg bg-muted/30 p-3" aria-label="Evidencia y auditoría">
                  <div className="flex flex-wrap gap-2">
                    {evidence.length ? (
                      evidence.map(([type, count]) => (
                        <Badge key={type} variant="outline">
                          {type}: {count}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Sin evidencia registrada</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Auditoría: {item.audit.events_recorded} eventos
                    {item.audit.last_event
                      ? ` · último ${item.audit.last_event.event_type} · ${formatTimestamp(item.audit.last_event.created_at)}`
                      : ' · sin evento registrado'}
                  </p>
                </section>

                <div className="flex flex-wrap gap-2" aria-label={`Acciones de la sesión ${item.session.id}`}>
                  {viewAction.enabled ? (
                    <Button asChild size="sm">
                      <Link to={`/t/${encodeURIComponent(tenantSlug)}/educacion/staff/admisiones/${item.id}`}>
                        {viewAction.label}
                      </Link>
                    </Button>
                  ) : (
                    <Button type="button" size="sm" disabled title={viewAction.disabled_reason_code ?? undefined}>
                      {viewAction.label}
                    </Button>
                  )}
                  {item.actions.assign.enabled &&
                  item.assignment.managed_assignment_available &&
                  inbox.capabilities.can_assign &&
                  managedAssignmentPresentation ? (
                    <InterviewAssignmentDialog
                      key={`${item.id}:${item.assignment.version}`}
                      tenantId={inbox.tenant.id}
                      tenantSlug={tenantSlug}
                      item={item}
                      presentation={managedAssignmentPresentation}
                      onAssigned={onRefresh}
                    />
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled
                      title={item.actions.assign.disabled_reason_code ?? undefined}
                    >
                      {item.actions.assign.label}
                    </Button>
                  )}
                  {(['review', 'follow_up'] as const).map((actionId) => {
                    const action = item.actions[actionId];
                    return (
                      <Button
                        key={action.action_id}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled
                        title={action.disabled_reason_code ?? undefined}
                      >
                        {action.label}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {inbox.page.has_more ? (
        <p className="text-sm text-muted-foreground" role="status">
          La vista está limitada a {inbox.page.limit} sesiones y hay más registros. El resumen
          corresponde únicamente a esta página; la continuación todavía no está disponible.
        </p>
      ) : null}
    </div>
  );
}
