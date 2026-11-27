import {
  AlertTriangle,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  privacySafeSurveyEvidenceCount,
  serializeSurveyResultEvidenceReceipt,
  type SurveyResultEvidenceAssessment,
} from '@/utils/surveyGovernanceContract';

export interface SurveyResultEvidencePanelProps {
  assessment?: SurveyResultEvidenceAssessment | null;
  loading?: boolean;
  refreshing?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onExport?: (contents: string, filename: string) => void;
}

const closureDateFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'long',
  timeStyle: 'short',
});

const formatClosureDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return closureDateFormatter.format(parsed);
};

const formatPrivacySafeCount = (value: number | null) => {
  const safeCount = privacySafeSurveyEvidenceCount(value);
  if (safeCount.bucket === 'unknown') return '—';
  if (safeCount.bucket === '<5') return '<5';
  return String(safeCount.value ?? 0);
};

const plainReasonByCode: Record<
  NonNullable<SurveyResultEvidenceAssessment['reasonCode']>,
  string
> = {
  governance_contract_unavailable: 'No hay información suficiente para comprobar el cierre.',
  governance_contract_invalid: 'La información recibida no corresponde a esta encuesta.',
  closed_release_missing: 'Todavía no hay una versión cerrada con un registro de resultados.',
  closure_manifest_invalid: 'El cierre está guardado, pero faltan datos necesarios para comprobarlo.',
  analytics_unavailable: 'No hay un total válido de respuestas para comparar.',
  analytics_filtered: 'Quitá los filtros para comparar todas las respuestas sin mostrar grupos pequeños.',
  analytics_not_backend: 'Los datos visibles incluyen información de prueba o fuentes mezcladas. No se puede generar el recibo.',
  response_provenance_invalid: 'No se pudieron separar de forma confiable las respuestas recibidas, de prueba y sin verificar.',
  response_count_mismatch: 'El total guardado al cerrar no coincide con el total de respuestas clasificadas.',
};

const plainAssessmentReason = (assessment?: SurveyResultEvidenceAssessment | null) => {
  if (!assessment) return 'No hay información suficiente para comprobar el cierre.';
  if (assessment.status === 'reconciled') {
    return 'El total guardado al cerrar coincide con el total de respuestas clasificadas.';
  }
  if (assessment.reasonCode) return plainReasonByCode[assessment.reasonCode];
  return 'Todavía no se puede comprobar el cierre.';
};

// Each term/value pair is a direct <div> child of the <dl> (no extra wrapper around it).
const HashReference = ({ label, value, className }: { label: string; value: string; className?: string }) => (
  <div className={cn('min-w-0 rounded-xl border border-border/70 bg-background/70 p-3', className)}>
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-2 break-all font-mono text-xs leading-5 text-foreground" title={value}>
      {value}
    </dd>
  </div>
);

const defaultExport = (contents: string, filename: string) => {
  const blob = new Blob([contents], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export function SurveyResultEvidencePanel({
  assessment,
  loading = false,
  refreshing = false,
  error,
  onRefresh,
  onExport,
}: SurveyResultEvidencePanelProps) {
  const reconciling = loading || refreshing;
  const reconciled = assessment?.status === 'reconciled' && !error && !reconciling;
  const canExport = Boolean(
    reconciled &&
    assessment?.canExportReconciledCountReceipt &&
    !reconciling,
  );
  const release = assessment?.release ?? null;
  const reason = error || plainAssessmentReason(assessment);
  const hideCohortCounts = assessment?.reasonCode === 'analytics_filtered';

  const handleExport = () => {
    if (!canExport || !assessment || assessment.status !== 'reconciled' || !release) return;
    const contents = serializeSurveyResultEvidenceReceipt(assessment);
    const filename = `recibo-cierre-encuesta-${release.surveyId}-release-v${release.versionNumber}.json`;
    (onExport ?? defaultExport)(contents, filename);
  };

  return (
    <Card
      data-testid="survey-result-evidence-panel"
      role="region"
      aria-labelledby="survey-result-evidence-title"
      className="rounded-xl border-border bg-card shadow-none"
    >
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle id="survey-result-evidence-title">Control del cierre</CardTitle>
            <CardDescription>
              Compara el total guardado al cerrar la consulta con las respuestas registradas. No muestra datos personales ni grupos pequeños.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-lg font-medium">No certifica resultados</Badge>
            <Badge variant="outline" className="rounded-lg font-medium">Sin verificación externa</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {reconciling ? (
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Comparando el cierre con las respuestas…
          </div>
        ) : (
          <div
            data-testid="survey-result-evidence-status"
            className={`rounded-xl border p-4 ${
              reconciled
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
                : 'border-border bg-muted/40 text-foreground'
            }`}
            role={reconciled ? 'status' : 'alert'}
          >
            <div className="flex items-start gap-3">
              {reconciled ? (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">
                  {reconciled ? 'Los totales coinciden' : 'Todavía no se puede comprobar el cierre'}
                </p>
                <p className="text-sm leading-6 opacity-90">{reason}</p>
              </div>
            </div>
          </div>
        )}

        {release ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs font-medium text-muted-foreground">Versión cerrada</p>
                <p className="mt-2 text-lg font-semibold">v{release.versionNumber}</p>
                <p className="text-xs text-muted-foreground">ID {release.releaseId}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3 sm:col-span-1 lg:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">Fecha de cierre</p>
                <p className="mt-2 text-sm font-medium">{formatClosureDate(release.closedAt)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs font-medium text-muted-foreground">Reglas aplicadas</p>
                <p className="mt-2 break-words text-sm font-medium">{release.eligibilityPolicyVersion || 'Sin versión informada'}</p>
                <p className="break-words text-xs text-muted-foreground">{release.consentPolicyVersion || 'Consentimiento sin versión informada'}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Estas huellas digitales fueron informadas por el sistema. Esta pantalla no vuelve a calcularlas ni confirma su contenido.
            </p>
            <dl className="grid gap-3 lg:grid-cols-2">
              <HashReference label="Huella del registro de cierre" value={release.manifestSha256} />
              <HashReference label="Huella de la consulta guardada" value={release.snapshotSha256} />
              <HashReference label="Huella de las reglas aplicadas" value={release.policySha256} />
              <HashReference label="Huella de las respuestas incluidas" value={release.responseSetSha256} />
              <HashReference
                className="lg:col-span-2"
                label="Huella de la revisión humana"
                value={release.humanReviewReferenceSha256}
              />
            </dl>
          </>
        ) : null}

        {assessment && !hideCohortCounts ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">Total guardado al cerrar</p>
                <p className="mt-1 text-2xl font-semibold">{assessment.counts.manifest ?? '—'}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">Respuestas incluidas</p>
                <p className="mt-1 text-2xl font-semibold">{assessment.counts.analytics ?? '—'}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">Respuestas recibidas</p>
                <p className="mt-1 text-2xl font-semibold">{formatPrivacySafeCount(assessment.counts.real)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">Respuestas de prueba</p>
                <p className="mt-1 text-2xl font-semibold">{formatPrivacySafeCount(assessment.counts.synthetic)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">Respuestas sin verificar</p>
                <p className="mt-1 text-2xl font-semibold">{formatPrivacySafeCount(assessment.counts.unverified)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Para proteger la privacidad, los grupos de 1 a 4 respuestas aparecen como &lt;5. El recibo no incluye respuestas, identidades ni grupos.
            </p>
          </div>
        ) : null}

        <div className="rounded-xl border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">
          Esta comparación solo revisa cantidades. No revisa qué respondió cada persona ni cómo se distribuyeron las respuestas. Tampoco confirma las huellas digitales informadas. Como no hay un padrón oficial cerrado, no calcula participación, abstención, cuórum ni ganador. No certifica una elección ni un resultado legal.
        </div>

        <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Un archivo CSV descargado desde Resultados no reemplaza este recibo ni le da validez por sí solo.
          </p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {onRefresh ? (
              <Button type="button" variant="outline" className="h-11 w-full rounded-sm sm:w-auto" onClick={onRefresh} disabled={refreshing}>
                {refreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Comparar de nuevo
              </Button>
            ) : null}
            <Button
              type="button"
              className="h-11 w-full rounded-sm sm:w-auto"
              onClick={handleExport}
              disabled={!canExport}
              aria-describedby="survey-result-evidence-export-help"
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Descargar recibo de cierre
            </Button>
          </div>
        </div>
        <p id="survey-result-evidence-export-help" className="sr-only">
          La descarga solo se habilita cuando el total del cierre y la clasificación de respuestas coinciden.
        </p>
      </CardContent>
    </Card>
  );
}

export default SurveyResultEvidencePanel;
