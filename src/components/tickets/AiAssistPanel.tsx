import React from 'react';
import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tags,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { enterpriseService, type TicketAiEnrichmentResponse } from '@/services/enterpriseService';
import type { Ticket } from '@/types/tickets';
import { cn } from '@/lib/utils';

type RecordLike = Record<string, unknown>;

interface AiAssistPanelProps {
  ticket: Ticket;
}

const asRecord = (value: unknown): RecordLike => (
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordLike) : {}
);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
};

const asBoolean = (value: unknown): boolean => value === true || value === 'true' || value === 1 || value === '1';

const asScore = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(1, parsed));
};

const humanizeToken = (value: unknown): string => (
  asString(value)
    .replace(/^signal:/i, '')
    .replace(/^sentiment:/i, 'sentimiento:')
    .replace(/^intent:/i, 'intencion:')
    .replace(/_/g, ' ')
);

const formatPercent = (score: number | null): string | null => (
  score === null ? null : `${Math.round(score * 100)}%`
);

const normalizeRisk = (risk: string): string => {
  const normalized = risk.toLowerCase().trim();
  if (['critico', 'critical', 'urgente'].includes(normalized)) return 'critico';
  if (['alto', 'alta', 'high'].includes(normalized)) return 'alto';
  if (['medio', 'media', 'medium'].includes(normalized)) return 'medio';
  if (['bajo', 'baja', 'low'].includes(normalized)) return 'bajo';
  return normalized || 'sin_senal';
};

const riskStyles: Record<string, { label: string; className: string; iconClassName: string; progress: number }> = {
  critico: {
    label: 'Riesgo critico',
    className: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200',
    iconClassName: 'text-red-500',
    progress: 94,
  },
  alto: {
    label: 'Riesgo alto',
    className: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-200',
    iconClassName: 'text-orange-500',
    progress: 78,
  },
  medio: {
    label: 'Riesgo medio',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200',
    iconClassName: 'text-amber-500',
    progress: 56,
  },
  bajo: {
    label: 'Riesgo bajo',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
    iconClassName: 'text-emerald-500',
    progress: 28,
  },
  sin_senal: {
    label: 'Sin senal critica',
    className: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-200',
    iconClassName: 'text-slate-500',
    progress: 12,
  },
};

const normalizeActions = (...sources: unknown[]): Array<{ id: string; label: string; priority?: string }> => {
  const seen = new Set<string>();
  const actions: Array<{ id: string; label: string; priority?: string }> = [];

  sources.forEach((source) => {
    asArray(source).forEach((item, index) => {
      const record = asRecord(item);
      const label = typeof item === 'string'
        ? item.trim()
        : asString(record.label || record.title || record.name || record.id);
      if (!label) return;
      const id = asString(record.id || record.action_id || record.key) || label || `action-${index}`;
      const dedupeKey = id.toLowerCase();
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      actions.push({
        id,
        label,
        priority: asString(record.priority || record.severity) || undefined,
      });
    });
  });

  return actions;
};

const extractHints = (payload: TicketAiEnrichmentResponse | null) => {
  const provider = asRecord(payload?.huggingface);
  const providerHints = asRecord(provider.crm_hints);
  return {
    ...providerHints,
    ...asRecord(payload?.crm_hints),
  };
};

const buildSignalRows = (payload: TicketAiEnrichmentResponse | null) => {
  const provider = asRecord(payload?.huggingface);
  const category = asRecord(provider.category);
  const priority = asRecord(provider.priority);
  const sentiment = asRecord(provider.sentiment);
  const intent = asRecord(provider.intent);

  const rows = [
    {
      label: 'Categoria sugerida',
      value: asString(category.categoria || category.label),
      score: asScore(category.score),
    },
    {
      label: 'Prioridad IA',
      value: asString(priority.prioridad || priority.label),
      score: asScore(priority.score),
    },
    {
      label: 'Sentimiento',
      value: asString(sentiment.label || sentiment.sentiment),
      score: asScore(sentiment.score),
    },
    {
      label: 'Intencion pyme',
      value: asString(intent.label || intent.intent),
      score: asScore(intent.score),
    },
  ];

  return rows.filter((row) => row.value);
};

export default function AiAssistPanel({ ticket }: AiAssistPanelProps) {
  const [enrichment, setEnrichment] = React.useState<TicketAiEnrichmentResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestSeq = React.useRef(0);

  const ticketRecord = asRecord(ticket);
  const ticketId = asString(ticketRecord.id || ticketRecord.ticket_id);
  const ticketType = asString(ticketRecord.ticket_type || ticketRecord.tipo || ticketRecord.tenant_type).toLowerCase();
  const scope = ticketType.includes('pym') ? 'pyme' : 'municipio';
  const ticketNumber = asString(
    ticketRecord.nro_ticket ||
    ticketRecord.ticket_number ||
    ticketRecord.ticketNumber ||
    ticketRecord.numero_ticket,
  );
  const tenantSlug = asString(ticketRecord.tenant_slug) || undefined;

  const loadEnrichment = React.useCallback(async () => {
    if (!ticketId) {
      setError('No se pudo resolver el identificador del ticket para IA.');
      setEnrichment(null);
      return;
    }
    const currentRequest = requestSeq.current + 1;
    requestSeq.current = currentRequest;
    setLoading(true);
    setError(null);

    try {
      const response = await enterpriseService.getTicketAiEnrichment(
        ticketId,
        {
          scope,
          comments_limit: 40,
          nro_ticket: ticketNumber || undefined,
          ticket_number: ticketNumber || undefined,
          ticket_type: scope,
        },
        tenantSlug,
      );
      if (requestSeq.current !== currentRequest) return;
      setEnrichment(response);
    } catch (err) {
      if (requestSeq.current !== currentRequest) return;
      console.error('Unable to load ticket AI enrichment', err);
      setError('No se pudo calcular la asistencia IA para este ticket.');
      setEnrichment(null);
    } finally {
      if (requestSeq.current === currentRequest) {
        setLoading(false);
      }
    }
  }, [scope, tenantSlug, ticketId, ticketNumber]);

  React.useEffect(() => {
    void loadEnrichment();
  }, [loadEnrichment]);

  const hints = React.useMemo(() => extractHints(enrichment), [enrichment]);
  const riskKey = normalizeRisk(asString(hints.risk_level));
  const risk = riskStyles[riskKey] || riskStyles.sin_senal;
  const actions = React.useMemo(
    () => normalizeActions(hints.recommended_actions, asRecord(enrichment?.huggingface).recommended_actions),
    [enrichment, hints.recommended_actions],
  );
  const signalRows = React.useMemo(() => buildSignalRows(enrichment), [enrichment]);
  const tags = React.useMemo(
    () => asArray(hints.tags).map(humanizeToken).filter(Boolean).slice(0, 8),
    [hints.tags],
  );
  const source = asRecord(enrichment?.source);
  const provider = asRecord(enrichment?.huggingface);
  const advisoryOnly = asBoolean(enrichment?.advisory_policy?.advisory_only) || asBoolean(hints.advisory_only);
  const mutatesState = asBoolean(enrichment?.advisory_policy?.mutates_operational_state) || asBoolean(hints.mutates_operational_state);
  const engineLabel = asString(provider.provider_family) || 'huggingface/local';

  return (
    <Card className="overflow-hidden border-primary/20 bg-background/95 shadow-sm">
      <CardHeader className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <BrainCircuit className="h-4 w-4 text-primary" />
              Asistencia IA del caso
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Lectura operativa para priorizar, responder y derivar sin modificar el ticket.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void loadEnrichment()}
            disabled={loading}
            aria-label="Actualizar asistencia IA"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1 bg-background/80">
            <Sparkles className="h-3 w-3" />
            {engineLabel}
          </Badge>
          <Badge variant="outline" className="gap-1 bg-background/80">
            <ShieldCheck className="h-3 w-3" />
            {advisoryOnly && !mutatesState ? 'advisory-only' : 'requiere revision'}
          </Badge>
          {enrichment?.contract_version ? (
            <Badge variant="outline" className="bg-background/80">
              {enrichment.contract_version}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        {error ? (
          <div className="rounded-lg border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
            {error}
          </div>
        ) : null}

        {loading && !enrichment ? (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Analizando contexto del reclamo...
          </div>
        ) : null}

        {enrichment ? (
          <>
            <div className={cn('rounded-lg border p-3', risk.className)}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', risk.iconClassName)} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{risk.label}</p>
                    {asBoolean(hints.requires_human_attention) ? (
                      <Badge variant="outline" className="bg-background/70">
                        revisar humano
                      </Badge>
                    ) : null}
                  </div>
                  <Progress value={risk.progress} className="h-1.5 bg-background/60" />
                  <div className="flex flex-wrap gap-2 text-xs">
                    {asBoolean(hints.requires_exact_location) ? <Badge variant="secondary">validar ubicacion</Badge> : null}
                    {asBoolean(hints.requires_photo) ? <Badge variant="secondary">revisar evidencia</Badge> : null}
                    {!asBoolean(hints.requires_exact_location) && !asBoolean(hints.requires_photo) ? (
                      <span className="text-muted-foreground">Sin requisitos adicionales detectados.</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {signalRows.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {signalRows.map((row) => (
                  <div key={`${row.label}-${row.value}`} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{row.label}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{humanizeToken(row.value)}</p>
                      {formatPercent(row.score) ? (
                        <Badge variant="outline">{formatPercent(row.score)}</Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {actions.length ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Proximas acciones sugeridas
                </div>
                <div className="space-y-2">
                  {actions.slice(0, 4).map((action) => (
                    <div key={action.id} className="rounded-lg border border-border/60 bg-background/80 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{action.label}</p>
                        {action.priority ? <Badge variant="secondary">{humanizeToken(action.priority)}</Badge> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {tags.length ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Tags className="h-3.5 w-3.5" />
                  Senales detectadas
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="bg-background/80 capitalize">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                  Fuente analizada
                </div>
                <p>{asString(source.text_chars) || '0'} caracteres</p>
                <p>{asString(source.comments_count) || '0'} comentarios incluidos</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Seguridad operativa
                </div>
                <p>Estado sin cambios: {mutatesState ? 'revisar contrato' : 'confirmado'}</p>
                <p>Secretos expuestos: {enrichment.secret_values_exposed ? 'si' : 'no'}</p>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
