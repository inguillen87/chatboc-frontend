import {
  AlertTriangle,
  Download,
  FileCheck2,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

const HashEvidence = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-xl border border-border/70 bg-background/70 p-3">
    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
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
  const reason = error || assessment?.reason || 'No hay evidencia suficiente para conciliar el resultado.';
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
      className={reconciled
        ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] via-background to-background'
        : 'border-amber-500/30 bg-gradient-to-br from-amber-500/[0.06] via-background to-background'}
    >
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle id="survey-result-evidence-title" className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-primary" aria-hidden="true" />
              Recibo de cierre conciliado por conteo
            </CardTitle>
            <CardDescription>
              Compara cantidades del cierre gobernado con analytics sin publicar datos personales ni cohortes pequeñas.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Resultado no certificado</Badge>
            <Badge variant="outline">Sin anclaje externo</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5" aria-labelledby="survey-result-evidence-title">
        {reconciling ? (
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Conciliando manifiesto, conteos y procedencia de las respuestas…
          </div>
        ) : (
          <div
            data-testid="survey-result-evidence-status"
            className={`rounded-xl border p-4 ${
              reconciled
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
                : 'border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100'
            }`}
            role={reconciled ? 'status' : 'alert'}
          >
            <div className="flex items-start gap-3">
              {reconciled ? (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">
                  {reconciled ? 'Cierre conciliado por conteo' : 'Resultado no conciliado'}
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
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Release cerrado</p>
                <p className="mt-2 text-lg font-semibold">v{release.versionNumber}</p>
                <p className="text-xs text-muted-foreground">ID {release.releaseId}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3 sm:col-span-1 lg:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fecha de cierre</p>
                <p className="mt-2 text-sm font-medium">{formatClosureDate(release.closedAt)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Políticas</p>
                <p className="mt-2 text-sm font-medium">{release.eligibilityPolicyVersion || 'Sin versión informada'}</p>
                <p className="text-xs text-muted-foreground">{release.consentPolicyVersion || 'Consentimiento sin versión informada'}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Estos hashes son referencias declaradas por el backend. Este cliente no recalcula ni verifica sus digests.
            </p>
            <dl className="grid gap-3 lg:grid-cols-2">
              <HashEvidence label="Hash del manifiesto" value={release.manifestSha256} />
              <HashEvidence label="Snapshot del instrumento" value={release.snapshotSha256} />
              <HashEvidence label="Hash de la política" value={release.policySha256} />
              <HashEvidence label="Hash del conjunto de respuestas" value={release.responseSetSha256} />
              <div className="lg:col-span-2">
                <HashEvidence label="Huella de la revisión humana" value={release.humanReviewReferenceSha256} />
              </div>
            </dl>
          </>
        ) : null}

        {assessment && !hideCohortCounts ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">Conteo del manifiesto</p>
                <p className="mt-1 text-2xl font-semibold">{assessment.counts.manifest ?? '—'}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">Analytics real incluido</p>
                <p className="mt-1 text-2xl font-semibold">{assessment.counts.analytics ?? '—'}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">Respuestas reales</p>
                <p className="mt-1 text-2xl font-semibold">{formatPrivacySafeCount(assessment.counts.real)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">Sintéticas separadas</p>
                <p className="mt-1 text-2xl font-semibold">{formatPrivacySafeCount(assessment.counts.synthetic)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">No verificadas separadas</p>
                <p className="mt-1 text-2xl font-semibold">{formatPrivacySafeCount(assessment.counts.unverified)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Privacidad k=5: los subgrupos de 1 a 4 respuestas se muestran como &lt;5. El recibo no incluye respuestas, identidades ni segmentos.
            </p>
          </div>
        ) : null}

        <div className="rounded-xl border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">
          Esta conciliación sólo compara conteos. No valida la distribución ni el contenido de las respuestas y tampoco verifica los hashes declarados. Sin población autoritativa sellada no se calculan participación, abstención, quorum ni ganador. No certifica una elección ni un resultado legal.
        </div>

        <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            El CSV operativo de analytics no reemplaza este recibo ni adquiere validez por sí solo.
          </p>
          <div className="flex flex-wrap gap-2">
            {onRefresh ? (
              <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
                {refreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Volver a conciliar
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
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
          La descarga sólo se habilita cuando manifiesto, clasificación y analytics coinciden por conteo.
        </p>
      </CardContent>
    </Card>
  );
}

export default SurveyResultEvidencePanel;
