import { CheckCircle2, Circle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { InterviewSessionResume } from './interviewsTypes';

const formatTimestamp = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

interface InterviewResumeCardProps {
  resume: InterviewSessionResume;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export default function InterviewResumeCard({
  resume,
  isRefreshing = false,
  onRefresh,
}: InterviewResumeCardProps) {
  const completedRefs = new Set(resume.progress.completed_step_refs);
  const currentStepRef = resume.progress.current_step?.step_ref ?? null;
  const checkpointAt = formatTimestamp(resume.progress.last_checkpoint_at);
  const progressPercent = resume.progress.percent;

  return (
    <Card data-testid="interview-resume-card">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <CardTitle>Reanudación de entrevista</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">sesion {resume.session.id}</Badge>
            <Badge variant="outline">{resume.session.status}</Badge>
            <Badge variant="outline">{resume.session.channel}</Badge>
            <Badge variant="secondary">{resume.contract_version}</Badge>
          </div>
        </div>
        {onRefresh ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4${isRefreshing ? ' animate-spin' : ''}`}
            />
            Actualizar
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="space-y-2" aria-label="Progreso de entrevista">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">Progreso verificado</span>
            <span className="text-muted-foreground">
              {progressPercent === null
                ? `${resume.progress.completed_steps}/${resume.progress.total_steps}`
                : `${progressPercent}%`}
            </span>
          </div>
          {progressPercent !== null ? (
            <Progress value={progressPercent} aria-label={`Progreso ${progressPercent}%`} />
          ) : null}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{resume.progress.evidence_count} evidencias</span>
            <span>{resume.progress.pending_required_steps} pasos requeridos pendientes</span>
            {checkpointAt ? <span>Checkpoint: {checkpointAt}</span> : null}
          </div>
        </section>

        {resume.progress.current_step ? (
          <section className="rounded-lg border bg-muted/20 p-4" aria-label="Paso actual">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{resume.progress.current_step.step_ref}</Badge>
              {resume.progress.current_step.required ? (
                <Badge variant="outline">required</Badge>
              ) : null}
            </div>
            <p className="mt-3 font-medium">{resume.progress.current_step.prompt}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {resume.progress.current_step.evidence_types.map((type) => (
                <Badge key={type} variant="secondary">
                  {type}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-3" aria-label="Pasos del contrato">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Pasos del contrato fijado</h3>
            <Badge variant="outline">
              version {resume.program_snapshot.version_number}
            </Badge>
          </div>
          <div className="space-y-2">
            {resume.steps.map((step) => {
              const completed = completedRefs.has(step.step_ref);
              const isCurrent = step.step_ref === currentStepRef;
              const StepIcon = completed ? CheckCircle2 : Circle;
              return (
                <article
                  key={step.step_ref}
                  className={`rounded-lg border p-3${isCurrent ? ' border-primary/60 bg-primary/5' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <StepIcon
                      className={`mt-0.5 h-4 w-4 shrink-0${completed ? ' text-emerald-600' : ' text-muted-foreground'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {step.step_ref}
                        </span>
                        {step.required ? <Badge variant="outline">required</Badge> : null}
                        {isCurrent ? <Badge>current</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm">{step.prompt}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {resume.progress.step_evidence_counts[step.step_ref] ?? 0} evidencias
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3" aria-label="Estado operativo">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">next_action</p>
            <p className="mt-1 break-all font-mono text-sm">{resume.next_action}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">consent.proof_status</p>
            <p className="mt-1 break-all font-mono text-sm">
              {resume.session.consent.proof_status}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">runtime_contract</p>
            <p className="mt-1 break-all font-mono text-sm">
              {resume.program_snapshot.runtime_contract ?? 'legacy_advisory'}
            </p>
          </div>
        </section>

        {resume.evidence.length ? (
          <section className="space-y-2" aria-label="Evidencia registrada">
            <h3 className="font-semibold">Evidencia registrada</h3>
            <div className="flex flex-wrap gap-2">
              {resume.evidence.map((evidence) => {
                const stepRef =
                  typeof evidence.provenance.step_ref === 'string'
                    ? evidence.provenance.step_ref
                    : null;
                return (
                  <Badge key={evidence.id} variant="outline">
                    {evidence.evidence_type} · {evidence.source_channel}
                    {stepRef ? ` · ${stepRef}` : ''}
                  </Badge>
                );
              })}
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
