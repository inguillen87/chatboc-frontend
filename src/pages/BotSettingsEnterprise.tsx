import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, BrainCircuit, CheckCircle2, Cpu, RefreshCw, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/context/TenantContext';
import { ApiError } from '@/utils/api';
import {
  enterpriseService,
  type AiProviderStatusProvider,
  type AiProviderStatusResponse,
  type BotSettingsPayload,
} from '@/services/enterpriseService';
import { getEnterpriseErrorMessage } from '@/utils/enterpriseErrors';
import { hasBotSettingsErrors, sanitizeBotSettingsPayload, validateBotSettings } from '@/utils/botSettings';

const providerLabels: Record<string, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  huggingface: 'Hugging Face',
  ollama: 'Ollama / GLM',
  cohere: 'Cohere',
  docling: 'Docling',
};

const warningLabels: Record<string, string> = {
  gemini_in_provider_order_but_missing_key: 'Gemini esta en el orden de proveedores pero falta la API key.',
  ollama_in_provider_order_but_disabled: 'Ollama esta en el orden de proveedores pero sigue deshabilitado.',
  huggingface_enabled_but_missing_token: 'Hugging Face esta habilitado pero falta el token.',
  huggingface_embeddings_enabled_but_missing_token: 'Embeddings de Hugging Face activos sin token.',
  huggingface_quota_or_payment_required: 'Hugging Face no tiene creditos/cuota disponible; el backend usa fallback local.',
  huggingface_rate_limited: 'Hugging Face esta limitando llamadas; el backend mantiene fallback local.',
  huggingface_auth_failed: 'Hugging Face rechazo la credencial configurada.',
  huggingface_timeout: 'Hugging Face esta demorando demasiado; el backend mantiene fallback local.',
  huggingface_provider_unavailable: 'Hugging Face no esta disponible temporalmente.',
  huggingface_provider_call_failed: 'Hugging Face fallo en runtime; revisar logs y proveedor.',
  docling_enabled_but_package_not_installed: 'Docling esta activo pero el paquete no esta instalado.',
};

const providerRuntimeLabels: Record<string, string> = {
  ready: 'runtime ok',
  degraded: 'degradado',
  not_configured: 'sin configurar',
};

const statusCopy: Record<string, { label: string; badgeClass: string; panelClass: string }> = {
  ready: {
    label: 'Listo',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
    panelClass: 'border-emerald-500/20 bg-emerald-500/5',
  },
  warning: {
    label: 'Atencion',
    badgeClass: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
    panelClass: 'border-amber-500/20 bg-amber-500/5',
  },
  blocked: {
    label: 'Bloqueado',
    badgeClass: 'bg-red-500/15 text-red-700 border-red-500/30',
    panelClass: 'border-red-500/20 bg-red-500/5',
  },
};

const providerIsActive = (provider: AiProviderStatusProvider) =>
  Boolean(provider.chat_default || provider.configured || provider.enabled || provider.installed || provider.provider_order_enabled);

const formatProviderDetail = (key: string, provider: AiProviderStatusProvider) => {
  if (key === 'huggingface') {
    const features = [
      provider.zero_shot_enabled ? 'clasificacion' : null,
      provider.embeddings_enabled ? 'embeddings' : null,
      provider.vision_enabled ? 'vision' : null,
    ].filter(Boolean);
    const runtime = provider.runtime_status === 'degraded' ? 'fallback local activo' : null;
    return [features.length ? features.join(' + ') : String(provider.zero_shot_model || provider.provider || 'inference'), runtime]
      .filter(Boolean)
      .join(' · ');
  }
  if (key === 'ollama') return String(provider.chat_model || 'glm-5.2');
  if (provider.chat_model) return String(provider.chat_model);
  if (provider.provider) return String(provider.provider);
  if (provider.mode) return String(provider.mode);
  return provider.installed ? 'instalado' : provider.enabled ? 'activo' : provider.configured ? 'configurado' : 'pendiente';
};

const BotSettingsEnterprise = () => {
  const { tenant, currentSlug } = useTenant();
  const navigate = useNavigate();
  const tenantId = tenant?.id ? Number(tenant.id) : 0;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AiProviderStatusResponse | null>(null);
  const [aiStatusLoading, setAiStatusLoading] = useState(false);
  const [aiStatusError, setAiStatusError] = useState<string | null>(null);

  const [form, setForm] = useState<BotSettingsPayload>({
    tenant_id: 0,
    name: '',
    tone: '',
    system_prompt: '',
    fallback_behavior: 'auto_reply',
    branding: {
      logo_url: '',
      primary_color: '',
      secondary_color: '',
    },
  });

  useEffect(() => {
    const load = async () => {
      if (!tenantId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await enterpriseService.getBotSettings(tenantId, currentSlug || undefined);
        setForm({
          tenant_id: tenantId,
          name: data?.settings?.name || '',
          tone: data?.settings?.tone || '',
          system_prompt: data?.settings?.system_prompt || '',
          fallback_behavior: data?.settings?.fallback_behavior || 'auto_reply',
          branding: {
            logo_url: data?.settings?.branding?.logo_url || '',
            primary_color: data?.settings?.branding?.primary_color || '',
            secondary_color: data?.settings?.branding?.secondary_color || '',
          },
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          navigate('/permission-denied');
          return;
        }
        const status = err instanceof ApiError ? err.status : undefined;
        setError(getEnterpriseErrorMessage(status, 'load_bot_settings'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tenantId, currentSlug, navigate]);

  const loadAiStatus = async () => {
    setAiStatusLoading(true);
    setAiStatusError(null);
    try {
      const data = await enterpriseService.getAiProviderStatus({ smoke: true });
      setAiStatus(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setAiStatusError('Solo administradores pueden ver el diagnostico IA global.');
      } else {
        setAiStatusError('No se pudo cargar el diagnostico IA.');
      }
    } finally {
      setAiStatusLoading(false);
    }
  };

  useEffect(() => {
    if (!tenantId) return;
    loadAiStatus();
  }, [tenantId]);

  const validation = useMemo(() => validateBotSettings(form), [form]);
  const isValid = useMemo(() => !hasBotSettingsErrors(validation), [validation]);
  const readinessStatus = aiStatus?.readiness?.status || 'blocked';
  const readinessVisual = statusCopy[readinessStatus] || statusCopy.blocked;
  const providers = (aiStatus?.providers
    ? Object.entries(aiStatus.providers)
    : []) as Array<[string, AiProviderStatusProvider]>;
  const activeProviders = providers.filter(([, provider]) => providerIsActive(provider));
  const warnings = aiStatus?.readiness?.warnings || [];

  const handleSave = async () => {
    if (!tenantId || !isValid) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await enterpriseService.updateBotSettings(
        sanitizeBotSettingsPayload(form, tenantId),
        currentSlug || undefined,
      );
      setSuccess('Configuración guardada.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        navigate('/permission-denied');
        return;
      }
      const status = err instanceof ApiError ? err.status : undefined;
      setError(getEnterpriseErrorMessage(status, 'save_bot_settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  if (!tenantId) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuración del bot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Necesitás seleccionar un tenant para editar la configuración.</p>
            <Button variant="outline" onClick={() => navigate('/analytics')}>Ir a analytics</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <Card className={`overflow-hidden border ${readinessVisual.panelClass}`}>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Matriz IA operativa</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Estado real de motores para WhatsApp, widget, metricas y automatizaciones.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={readinessVisual.badgeClass}>
                  {readinessVisual.label}
                </Badge>
                <Badge variant="outline" className="gap-1 bg-background/70">
                  <ShieldCheck className="h-3 w-3" />
                  secretos ocultos
                </Badge>
                {aiStatus?.generated_at ? (
                  <Badge variant="outline" className="bg-background/70">
                    {new Date(aiStatus.generated_at).toLocaleString()}
                  </Badge>
                ) : null}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadAiStatus} disabled={aiStatusLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${aiStatusLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {aiStatusError ? (
            <Alert variant={aiStatusError.includes('administradores') ? 'default' : 'destructive'}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Diagnostico no disponible</AlertTitle>
              <AlertDescription>{aiStatusError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-background/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-primary" />
                Chat principal
              </div>
              <p className="mt-2 text-2xl font-semibold">
                {aiStatus?.readiness?.chat_ready ? 'Activo' : aiStatusLoading ? '...' : 'Pendiente'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Ruteo LLM para conversaciones.</p>
            </div>
            <div className="rounded-lg border bg-background/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                IA especializada
              </div>
              <p className="mt-2 text-2xl font-semibold">
                {aiStatus?.readiness?.specialized_ai_ready ? 'Activa' : aiStatusLoading ? '...' : 'Pendiente'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">HF, vision, embeddings y documentos.</p>
            </div>
            <div className="rounded-lg border bg-background/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Cpu className="h-4 w-4 text-primary" />
                Orden de modelos
              </div>
              <p className="mt-2 truncate text-2xl font-semibold">
                {(aiStatus?.llm_provider_order || []).join(' -> ') || (aiStatusLoading ? '...' : 'sin datos')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Prioridad usada por el backend.</p>
            </div>
          </div>

          {warnings.length ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
                <AlertCircle className="h-4 w-4" />
                Warnings de configuracion
              </div>
              <div className="space-y-1 text-sm text-amber-900">
                {warnings.map((warning) => (
                  <p key={warning}>{warningLabels[warning] || warning}</p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-3">
            {(activeProviders.length ? activeProviders : providers).map(([key, provider]) => {
              const active = providerIsActive(provider);
              return (
                <div key={key} className="rounded-lg border bg-background/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{providerLabels[key] || key}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatProviderDetail(key, provider)}</p>
                    </div>
                    {active ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {provider.configured ? <Badge variant="secondary">configurado</Badge> : null}
                    {provider.enabled ? <Badge variant="secondary">activo</Badge> : null}
                    {provider.provider_order_enabled ? <Badge variant="outline">en ruteo</Badge> : null}
                    {provider.mode === 'experimental' ? <Badge variant="outline">experimental</Badge> : null}
                    {provider.installed ? <Badge variant="outline">instalado</Badge> : null}
                    {provider.runtime_status ? (
                      <Badge variant={provider.runtime_status === 'degraded' ? 'destructive' : 'outline'}>
                        {providerRuntimeLabels[String(provider.runtime_status)] || String(provider.runtime_status)}
                      </Badge>
                    ) : null}
                    {provider.quota_depleted ? <Badge variant="destructive">sin creditos</Badge> : null}
                    {provider.fallback_behavior ? <Badge variant="outline">fallback local</Badge> : null}
                  </div>
                </div>
              );
            })}
          </div>

          {aiStatus?.smoke?.results?.length ? (
            <div className="rounded-lg border bg-background/80 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Smoke checks</p>
                <Badge variant="outline">{aiStatus.smoke.live_enabled ? 'live habilitado' : 'config only'}</Badge>
              </div>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                {aiStatus.smoke.results.map((result, index) => (
                  <div key={`${result.provider || 'provider'}-${index}`} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{providerLabels[result.provider || ''] || result.provider}</span>
                      <Badge variant={result.ok ? 'secondary' : 'destructive'}>{result.ok ? 'ok' : 'fallo'}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {result.task || result.mode || result.reason_code || result.error_type || 'diagnostico'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración del bot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Input
              value={form.name || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nombre bot"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{validation.name || 'Nombre visible del asistente.'}</span>
              <span>{(form.name || '').length}/120</span>
            </div>
          </div>
          <div className="space-y-1">
            <Input
              value={form.tone || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, tone: e.target.value }))}
              placeholder="Tono"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{validation.tone || 'Ejemplo: profesional, cercano, directo.'}</span>
              <span>{(form.tone || '').length}/120</span>
            </div>
          </div>
          <div className="space-y-1">
            <Textarea
              value={form.system_prompt || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, system_prompt: e.target.value }))}
              placeholder="System prompt"
              rows={6}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{validation.system_prompt || 'Instrucciones internas del bot para este tenant.'}</span>
              <span>{(form.system_prompt || '').length}/4000</span>
            </div>
          </div>
          <Select
            value={form.fallback_behavior || 'auto_reply'}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, fallback_behavior: value as BotSettingsPayload['fallback_behavior'] }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="derivar_humano">derivar_humano</SelectItem>
              <SelectItem value="auto_reply">auto_reply</SelectItem>
              <SelectItem value="silent">silent</SelectItem>
            </SelectContent>
          </Select>
          {validation.fallback_behavior ? <p className="text-xs text-destructive">{validation.fallback_behavior}</p> : null}
          <div className="space-y-1">
            <Input
              value={form.branding?.logo_url || ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, branding: { ...prev.branding, logo_url: e.target.value } }))
              }
              placeholder="Logo URL"
            />
            {validation.logo_url ? <p className="text-xs text-destructive">{validation.logo_url}</p> : null}
          </div>
          <div className="space-y-1">
            <Input
              value={form.branding?.primary_color || ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, branding: { ...prev.branding, primary_color: e.target.value } }))
              }
              placeholder="Color primario"
            />
            {validation.primary_color ? <p className="text-xs text-destructive">{validation.primary_color}</p> : null}
          </div>
          <div className="space-y-1">
            <Input
              value={form.branding?.secondary_color || ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, branding: { ...prev.branding, secondary_color: e.target.value } }))
              }
              placeholder="Color secundario"
            />
            {validation.secondary_color ? <p className="text-xs text-destructive">{validation.secondary_color}</p> : null}
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          {success ? <p className="text-green-600 text-sm">{success}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={!isValid || saving}>
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  branding: {
                    ...prev.branding,
                    primary_color: '',
                    secondary_color: '',
                  },
                }))
              }
              disabled={saving}
            >
              Limpiar colores
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BotSettingsEnterprise;
