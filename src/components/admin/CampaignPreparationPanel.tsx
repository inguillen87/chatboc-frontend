import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  LockKeyhole,
  Mail,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  CampaignPreparationError,
  createCampaignIdempotencyKey,
  listCampaignNotificationTemplates,
  prepareCampaign,
  toCampaignPreparationError,
} from '@/features/campaigns/campaignPreparationApi';
import type {
  CampaignChannel,
  CampaignNotificationTemplate,
  CampaignPreparation,
} from '@/features/campaigns/campaignPreparationTypes';
import {
  NotificationTemplatePreviewError,
  previewNotificationTemplate,
  toNotificationTemplatePreviewError,
} from '@/features/notifications/notificationTemplatePreviewApi';
import type { NotificationTemplatePreview } from '@/features/notifications/notificationTemplatePreviewTypes';

const CONTEXT_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const CONTENT_VARIABLE_KEY = /^[1-9][0-9]{0,2}$/;

const parseJsonObject = (
  source: string,
  field: 'context' | 'content_variables',
): Record<string, unknown> => {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new CampaignPreparationError({
      reasonCode: `${field}_json_invalid`,
      field,
    });
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CampaignPreparationError({
      reasonCode: `${field}_must_be_object`,
      field,
    });
  }
  const record = value as Record<string, unknown>;
  const keyPattern = field === 'context' ? CONTEXT_KEY : CONTENT_VARIABLE_KEY;
  if (Object.keys(record).some((key) => !keyPattern.test(key))) {
    throw new CampaignPreparationError({
      reasonCode:
        field === 'context'
          ? 'template_context_key_invalid'
          : 'content_variable_key_invalid',
      field,
    });
  }
  return record;
};

const safeReasonLabel = (value: string) =>
  value.replace(/_/g, ' ').slice(0, 160);

interface CampaignPreparationPanelProps {
  tenantSlug?: string | null;
  selectedContactIds: string[];
  selectedCount: number;
  onSelectMarketingContacts?: (channel: CampaignChannel) => void;
}

export default function CampaignPreparationPanel({
  tenantSlug,
  selectedContactIds,
  selectedCount,
  onSelectMarketingContacts,
}: CampaignPreparationPanelProps) {
  const [channel, setChannel] = useState<CampaignChannel>('whatsapp');
  const [templates, setTemplates] = useState<CampaignNotificationTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [contextJson, setContextJson] = useState('{}');
  const [contentVariablesJson, setContentVariablesJson] = useState('{}');
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [prepareLoading, setPrepareLoading] = useState(false);
  const [preview, setPreview] = useState<NotificationTemplatePreview | null>(null);
  const [result, setResult] = useState<CampaignPreparation | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const templateRequestVersionRef = useRef(0);
  const scopeKey = tenantSlug?.trim() || '';
  const contactScopeKey = useMemo(
    () => [...selectedContactIds].sort().join('|'),
    [selectedContactIds],
  );

  const invalidate = () => {
    setPreview(null);
    setResult(null);
    setFailure(null);
    setIdempotencyKey(null);
  };

  useEffect(() => {
    let active = true;
    const requestVersion = ++templateRequestVersionRef.current;
    setTemplates([]);
    setTemplateId('');
    setPreview(null);
    setResult(null);
    setFailure(null);
    setIdempotencyKey(null);
    if (!scopeKey) return () => {
      active = false;
    };

    setTemplatesLoading(true);
    void listCampaignNotificationTemplates(scopeKey, channel)
      .then((items) => {
        if (!active || templateRequestVersionRef.current !== requestVersion) return;
        const activeItems = items.filter(
          (item) => item.is_active && item.channel === channel,
        );
        setTemplates(activeItems);
        setTemplateId(activeItems[0]?.id || '');
      })
      .catch((error) => {
        if (!active || templateRequestVersionRef.current !== requestVersion) return;
        setFailure(
          toCampaignPreparationError(error).reasonCode,
        );
      })
      .finally(() => {
        if (active && templateRequestVersionRef.current === requestVersion) {
          setTemplatesLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [scopeKey, channel]);

  useEffect(() => {
    setPreview(null);
    setResult(null);
    setFailure(null);
    setIdempotencyKey(null);
  }, [contactScopeKey]);

  const parseVariables = () => ({
    context: parseJsonObject(contextJson, 'context'),
    contentVariables: parseJsonObject(
      contentVariablesJson,
      'content_variables',
    ),
  });

  const runPreview = async () => {
    setFailure(null);
    setPreview(null);
    try {
      if (!scopeKey) {
        throw new CampaignPreparationError({
          reasonCode: 'campaign_tenant_required',
          field: 'tenant',
        });
      }
      if (!templateId) {
        throw new CampaignPreparationError({
          reasonCode: 'campaign_template_required',
          field: 'template_id',
        });
      }
      const variables = parseVariables();
      setPreviewLoading(true);
      const rendered = await previewNotificationTemplate(scopeKey, {
        template_id: templateId,
        context: variables.context,
        content_variables: variables.contentVariables,
      });
      setPreview(rendered);
    } catch (error) {
      const safeError =
        error instanceof NotificationTemplatePreviewError
          ? error
          : error instanceof CampaignPreparationError
            ? error
            : toNotificationTemplatePreviewError(error);
      setFailure(safeError.reasonCode);
    } finally {
      setPreviewLoading(false);
    }
  };

  const runPreparation = async () => {
    setFailure(null);
    try {
      if (!scopeKey) {
        throw new CampaignPreparationError({
          reasonCode: 'campaign_tenant_required',
          field: 'tenant',
        });
      }
      if (!templateId) {
        throw new CampaignPreparationError({
          reasonCode: 'campaign_template_required',
          field: 'template_id',
        });
      }
      if (selectedContactIds.length === 0) {
        throw new CampaignPreparationError({
          reasonCode: 'campaign_contacts_required',
          field: 'contact_ids',
        });
      }
      const variables = parseVariables();
      const stableKey = idempotencyKey || createCampaignIdempotencyKey();
      if (!idempotencyKey) setIdempotencyKey(stableKey);
      setPrepareLoading(true);
      const prepared = await prepareCampaign(
        scopeKey,
        {
          template_id: templateId,
          context: variables.context,
          content_variables: variables.contentVariables,
          contact_ids: selectedContactIds,
          max_per_week: 2,
          min_interval_hours: 24,
        },
        stableKey,
      );
      setResult(prepared);
      setPreview(null);
    } catch (error) {
      setFailure(toCampaignPreparationError(error).reasonCode);
    } finally {
      setPrepareLoading(false);
    }
  };

  const selectedWithoutContact = Math.max(
    0,
    selectedCount - selectedContactIds.length,
  );

  return (
    <Card
      className="border-primary/20 bg-card/95 shadow-sm"
      data-testid="campaign-preparation-panel"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LockKeyhole aria-hidden="true" className="h-5 w-5 text-primary" />
              {'Preparaci\u00f3n profesional de campa\u00f1a'}
            </CardTitle>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {
                'Usa una plantilla estricta, eval\u00faa audiencia y crea recibos durables en espera. No contacta al proveedor ni afirma env\u00edo o entrega.'
              }
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
              {'Sin env\u00edo externo'}
            </Badge>
            <Badge variant="outline">Opt-in marketing requerido</Badge>
            <Badge variant="outline">{selectedCount} seleccionados</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="campaign-template-select">Plantilla activa</Label>
                <select
                  id="campaign-template-select"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={templateId}
                  disabled={templatesLoading}
                  onChange={(event) => {
                    setTemplateId(event.target.value);
                    invalidate();
                  }}
                >
                  <option value="">
                    {templatesLoading
                      ? 'Cargando plantillas...'
                      : 'Seleccionar plantilla'}
                  </option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.key}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 self-end">
                <Button
                  type="button"
                  variant={channel === 'whatsapp' ? 'default' : 'outline'}
                  onClick={() => setChannel('whatsapp')}
                  className="gap-2"
                >
                  <MessageSquare aria-hidden="true" className="h-4 w-4" />
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  variant={channel === 'email' ? 'default' : 'outline'}
                  onClick={() => setChannel('email')}
                  className="gap-2"
                >
                  <Mail aria-hidden="true" className="h-4 w-4" />
                  Email
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="campaign-context-json">Contexto nombrado (JSON)</Label>
                <Textarea
                  id="campaign-context-json"
                  value={contextJson}
                  rows={4}
                  spellCheck={false}
                  onChange={(event) => {
                    setContextJson(event.target.value);
                    invalidate();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-content-variables-json">
                  Variables proveedor (JSON)
                </Label>
                <Textarea
                  id="campaign-content-variables-json"
                  value={contentVariablesJson}
                  rows={4}
                  spellCheck={false}
                  onChange={(event) => {
                    setContentVariablesJson(event.target.value);
                    invalidate();
                  }}
                />
              </div>
            </div>

            {templates.length === 0 && !templatesLoading && (
              <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-3 text-sm text-muted-foreground">
                {
                  'No hay plantillas activas para este canal. Cre\u00e1 y valid\u00e1 una plantilla antes de preparar la campa\u00f1a.'
                }
              </div>
            )}
            {selectedWithoutContact > 0 && (
              <div className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {selectedWithoutContact}{' '}
                  {
                    'seleccionados no tienen una identidad Contact tenant-scoped y no se incluir\u00e1n en esta preparaci\u00f3n.'
                  }
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background/60 p-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onSelectMarketingContacts?.(channel)}
              className="justify-start gap-2"
            >
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              Seleccionar opt-in
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={previewLoading || templatesLoading || !templateId}
              onClick={runPreview}
              className="justify-start gap-2"
            >
              {previewLoading ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Eye aria-hidden="true" className="h-4 w-4" />
              )}
              {'Probar contenido (sin env\u00edo)'}
            </Button>
            <Button
              type="button"
              disabled={prepareLoading || templatesLoading || !templateId}
              onClick={runPreparation}
              className="justify-start gap-2"
            >
              {prepareLoading ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <LockKeyhole aria-hidden="true" className="h-4 w-4" />
              )}
              {idempotencyKey && failure
                ? 'Reintentar misma preparaci\u00f3n'
                : 'Crear recibos en espera'}
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              {
                'Los recibos quedan held/not_attempted. No existe reintento autom\u00e1tico ni estado delivered sin callback.'
              }
            </p>
          </div>
        </div>

        {failure && (
          <div
            role="alert"
            className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{safeReasonLabel(failure)}</span>
          </div>
        )}

        {preview && (
          <div className="rounded-xl border border-border/70 bg-background/60 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{'Vista previa estricta'}</strong>
              <Badge variant="outline">
                {'Transporte no verificado'}
              </Badge>
            </div>
            {preview.rendered.subject && (
              <p className="mt-3 font-semibold">{preview.rendered.subject}</p>
            )}
            <p className="mt-2 whitespace-pre-wrap">{preview.rendered.body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {preview.readiness.blockers.map((blocker) => (
                <Badge key={blocker} variant="secondary">
                  {safeReasonLabel(blocker)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <strong>{'Preparaci\u00f3n registrada'}</strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  ID {result.campaign.id} | estado {result.campaign.status}
                </p>
              </div>
              <Badge variant="outline">held / not_attempted</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg bg-background/70 p-3">
                <span className="block text-xs text-muted-foreground">Solicitados</span>
                <strong className="text-lg">{result.audience.requested}</strong>
              </div>
              <div className="rounded-lg bg-background/70 p-3">
                <span className="block text-xs text-muted-foreground">Elegibles</span>
                <strong className="text-lg">{result.audience.eligible}</strong>
              </div>
              <div className="rounded-lg bg-background/70 p-3">
                <span className="block text-xs text-muted-foreground">Excluidos</span>
                <strong className="text-lg">{result.audience.excluded}</strong>
              </div>
              <div className="rounded-lg bg-background/70 p-3">
                <span className="block text-xs text-muted-foreground">
                  Transporte no intentado
                </span>
                <strong className="text-lg">
                  {result.queue.transport_outcomes.not_attempted}
                </strong>
              </div>
              <div className="rounded-lg bg-background/70 p-3">
                <span className="block text-xs text-muted-foreground">Recibos durables</span>
                <strong className="text-lg">{result.queue.receipts.length}</strong>
              </div>
              <div className="rounded-lg bg-background/70 p-3">
                <span className="block text-xs text-muted-foreground">Outcome unknown</span>
                <strong className="text-lg">
                  {result.queue.transport_outcomes.unknown}
                </strong>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.readiness.blockers.map((blocker) => (
                <Badge key={blocker} variant="secondary">
                  {safeReasonLabel(blocker)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
