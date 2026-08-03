import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, Eye, Loader2, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  NotificationTemplatePreviewError,
  previewNotificationTemplate,
  toNotificationTemplatePreviewError,
} from '@/features/notifications/notificationTemplatePreviewApi';
import type {
  NotificationTemplateChannel,
  NotificationTemplatePreview,
  NotificationTemplatePreviewFailure,
  NotificationTemplatePreviewRequest,
} from '@/features/notifications/notificationTemplatePreviewTypes';

type SelectorMode = 'template_id' | 'key_channel';

const CONTEXT_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const CONTENT_VARIABLE_KEY = /^[1-9][0-9]{0,2}$/;

const localFailure = (
  reasonCode: string,
  field?: string,
): NotificationTemplatePreviewError =>
  new NotificationTemplatePreviewError({ reasonCode, field });

const parseJsonObject = (
  source: string,
  field: 'context' | 'content_variables',
): Record<string, unknown> => {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw localFailure(`${field}_json_invalid`, field);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw localFailure(`${field}_must_be_object`, field);
  }

  const record = value as Record<string, unknown>;
  const keyPattern = field === 'context' ? CONTEXT_KEY : CONTENT_VARIABLE_KEY;
  if (Object.keys(record).some((key) => !keyPattern.test(key))) {
    throw localFailure(
      field === 'context'
        ? 'template_context_key_invalid'
        : 'content_variable_key_invalid',
      field,
    );
  }
  return record;
};

const readinessLabel = (value: boolean) => (value ? 's\u00ed' : 'no');

const prettyJson = (value: unknown) => JSON.stringify(value, null, 2);

interface NotificationTemplatePreviewPanelProps {
  tenantSlug?: string | null;
}

export default function NotificationTemplatePreviewPanel({
  tenantSlug,
}: NotificationTemplatePreviewPanelProps) {
  const [selectorMode, setSelectorMode] = useState<SelectorMode>('template_id');
  const [templateId, setTemplateId] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  const [channel, setChannel] = useState<NotificationTemplateChannel>('whatsapp');
  const [contextJson, setContextJson] = useState('{}');
  const [contentVariablesJson, setContentVariablesJson] = useState('{}');
  const [preview, setPreview] = useState<NotificationTemplatePreview | null>(null);
  const [failure, setFailure] = useState<NotificationTemplatePreviewFailure | null>(null);
  const [loading, setLoading] = useState(false);
  const requestVersionRef = useRef(0);
  const scopeKey = tenantSlug?.trim().toLowerCase() || '';
  const activeScopeRef = useRef(scopeKey);
  activeScopeRef.current = scopeKey;

  useEffect(() => {
    requestVersionRef.current += 1;
    setPreview(null);
    setFailure(null);
    setLoading(false);
  }, [scopeKey]);

  const invalidatePreview = () => {
    setPreview(null);
    setFailure(null);
  };

  const chooseMode = (mode: SelectorMode) => {
    setSelectorMode(mode);
    invalidatePreview();
  };

  const submitPreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestVersion = ++requestVersionRef.current;
    const requestScope = scopeKey;
    setPreview(null);
    setFailure(null);

    try {
      if (!requestScope) {
        throw localFailure(
          'notification_template_preview_tenant_required',
          'tenant',
        );
      }

      const context = parseJsonObject(contextJson, 'context');
      const contentVariables = parseJsonObject(
        contentVariablesJson,
        'content_variables',
      );
      const payload: NotificationTemplatePreviewRequest = {
        context,
        content_variables: contentVariables,
      };

      if (selectorMode === 'template_id') {
        const normalizedId = templateId.trim();
        if (!normalizedId) throw localFailure('template_id_required', 'template_id');
        payload.template_id = normalizedId;
      } else {
        const normalizedKey = templateKey.trim().toLowerCase();
        if (!normalizedKey) throw localFailure('template_key_required', 'key');
        payload.key = normalizedKey;
        payload.channel = channel;
      }

      setLoading(true);
      const response = await previewNotificationTemplate(requestScope, payload);
      if (
        requestVersionRef.current !== requestVersion ||
        activeScopeRef.current !== requestScope
      ) {
        return;
      }
      setPreview(response);
    } catch (error) {
      if (
        requestVersionRef.current !== requestVersion ||
        activeScopeRef.current !== requestScope
      ) {
        return;
      }
      const safeError = toNotificationTemplatePreviewError(error);
      setFailure({
        reasonCode: safeError.reasonCode,
        field: safeError.field,
        variableNames: safeError.variableNames,
      });
    } finally {
      if (
        requestVersionRef.current === requestVersion &&
        activeScopeRef.current === requestScope
      ) {
        setLoading(false);
      }
    }
  };

  return (
    <Card className="border-border/70" data-testid="notification-template-preview-panel">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Eye className="h-5 w-5 text-primary" />
              Vista previa profesional
            </CardTitle>
            <CardDescription className="mt-2 max-w-3xl">
              Renderiza una plantilla del tenant sin contactar al proveedor, poner mensajes en cola ni validar el transporte.
            </CardDescription>
          </div>
          <Badge variant="outline">
            {scopeKey ? `tenant: ${scopeKey}` : 'tenant requerido'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-5" onSubmit={submitPreview} noValidate>
          <div className="space-y-2">
            <Label>Selector de plantilla</Label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Selector de plantilla">
              <Button
                type="button"
                size="sm"
                variant={selectorMode === 'template_id' ? 'default' : 'outline'}
                aria-pressed={selectorMode === 'template_id'}
                onClick={() => chooseMode('template_id')}
              >
                template_id
              </Button>
              <Button
                type="button"
                size="sm"
                variant={selectorMode === 'key_channel' ? 'default' : 'outline'}
                aria-pressed={selectorMode === 'key_channel'}
                onClick={() => chooseMode('key_channel')}
              >
                key + channel
              </Button>
            </div>
          </div>

          {selectorMode === 'template_id' ? (
            <div className="space-y-2">
              <Label htmlFor="notification-preview-template-id">Template ID</Label>
              <Input
                id="notification-preview-template-id"
                value={templateId}
                onChange={(event) => {
                  setTemplateId(event.target.value);
                  invalidatePreview();
                }}
                placeholder="UUID de la plantilla"
                autoComplete="off"
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="notification-preview-key">Template key</Label>
                <Input
                  id="notification-preview-key"
                  value={templateKey}
                  onChange={(event) => {
                    setTemplateKey(event.target.value);
                    invalidatePreview();
                  }}
                  placeholder="claim_status"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notification-preview-channel">Canal</Label>
                <select
                  id="notification-preview-channel"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={channel}
                  onChange={(event) => {
                    setChannel(event.target.value as NotificationTemplateChannel);
                    invalidatePreview();
                  }}
                >
                  <option value="whatsapp">whatsapp</option>
                  <option value="email">email</option>
                  <option value="push">push</option>
                  <option value="in_app">in_app</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="notification-preview-context">Context JSON</Label>
              <Textarea
                id="notification-preview-context"
                className="min-h-36 font-mono text-xs"
                value={contextJson}
                onChange={(event) => {
                  setContextJson(event.target.value);
                  invalidatePreview();
                }}
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                Variables nombradas del template local, por ejemplo claim_code.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notification-preview-content-variables">
                Content variables JSON
              </Label>
              <Textarea
                id="notification-preview-content-variables"
                className="min-h-36 font-mono text-xs"
                value={contentVariablesJson}
                onChange={(event) => {
                  setContentVariablesJson(event.target.value);
                  invalidatePreview();
                }}
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                Variables numeradas del provider: claves "1" a "999".
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={loading || !scopeKey}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              Generar vista previa
            </Button>
            <p className="text-xs font-medium text-muted-foreground">
              {'No env\u00eda mensajes ni certifica producci\u00f3n.'}
            </p>
          </div>
        </form>

        {failure ? (
          <div
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 space-y-1">
                <p className="font-semibold">No se pudo generar la vista previa.</p>
                <p>
                  reason_code: <code>{failure.reasonCode}</code>
                </p>
                {failure.field ? (
                  <p>
                    field: <code>{failure.field}</code>
                  </p>
                ) : null}
                {failure.variableNames?.length ? (
                  <p>
                    variables: <code>{failure.variableNames.join(', ')}</code>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {preview ? (
          <section className="space-y-4" aria-label="Resultado de vista previa">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{preview.contract_version}</Badge>
              <Badge variant="outline">{preview.template.channel}</Badge>
              <Badge variant="outline">{preview.template.key}</Badge>
              <Badge variant={preview.template.is_active ? 'secondary' : 'destructive'}>
                {preview.template.is_active ? 'template activo' : 'template inactivo'}
              </Badge>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-xl border bg-muted/15 p-4">
                <h3 className="text-sm font-semibold">Asunto</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {preview.rendered.subject ?? 'Sin asunto para este canal'}
                </p>
              </article>
              <article className="rounded-xl border bg-muted/15 p-4">
                <h3 className="text-sm font-semibold">Body renderizado</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {preview.rendered.body}
                </p>
              </article>
            </div>

            <article className="rounded-xl border p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Snapshot del provider
              </h3>
              {preview.provider_template ? (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{preview.provider_template.provider}</Badge>
                    <Badge variant="outline">{preview.provider_template.name}</Badge>
                    <Badge variant="outline">{preview.provider_template.language}</Badge>
                    {preview.provider_template.category ? (
                      <Badge variant="outline">{preview.provider_template.category}</Badge>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap">
                    {preview.provider_template.rendered_body || 'Sin body provider.'}
                  </p>
                  {preview.provider_template.rendered_components !== null &&
                  preview.provider_template.rendered_components !== undefined ? (
                    <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">
                      {prettyJson(preview.provider_template.rendered_components)}
                    </pre>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Estado provider: {preview.provider_template.lifecycle.state}{' \u00b7 '}
                    {preview.provider_template.lifecycle.reason}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  La plantilla no tiene un snapshot provider vinculado.
                </p>
              )}
            </article>

            <div className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-xl border p-4">
                <h3 className="text-sm font-semibold">Readiness informado</h3>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">{'Preview v\u00e1lido'}</dt>
                    <dd>{readinessLabel(preview.readiness.preview_valid)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{'Aprobaci\u00f3n provider'}</dt>
                    <dd>{readinessLabel(preview.readiness.provider_template_approval_valid)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Provider listo</dt>
                    <dd>{readinessLabel(preview.readiness.provider_template_ready)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Transporte verificado</dt>
                    <dd>{readinessLabel(preview.readiness.transport_readiness_checked)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{'Env\u00edo producci\u00f3n permitido'}</dt>
                    <dd>{readinessLabel(preview.readiness.production_send_allowed)}</dd>
                  </div>
                </dl>
              </article>

              <article className="rounded-xl border p-4">
                <h3 className="text-sm font-semibold">Blockers</h3>
                {preview.readiness.blockers.length ? (
                  <ul className="mt-3 space-y-2 text-sm">
                    {preview.readiness.blockers.map((blocker) => (
                      <li key={blocker} className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <code className="break-all">{blocker}</code>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Sin blockers de contenido informados.
                  </p>
                )}
              </article>
            </div>

            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
              {'Vista previa sin efectos: 0 mensajes en cola, 0 enviados y ninguna llamada al provider. El transporte no fue verificado y el env\u00edo en producci\u00f3n permanece bloqueado.'}
            </p>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
