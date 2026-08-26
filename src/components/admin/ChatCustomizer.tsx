import React, { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Palette, MessageSquare, Check, Volume2, Monitor,
  Smartphone, Tablet, Shield, Settings, Zap, Globe, Lock, WifiOff, AlertCircle, ExternalLink, CheckCircle2
} from 'lucide-react';
import WidgetPreview from '@/components/chat/WidgetPreview';
import { useTenant } from '@/context/TenantContext';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/api/client';
import { cn } from '@/lib/utils';
import { tenantService } from '@/services/tenantService';
import {
  buildTenantRuntimeWidgetUpdate,
  clearChatCustomizerDraft,
  findPublicWidgetRuntimeMismatches,
  findTenantRuntimePersistenceMismatches,
  readChatCustomizerDraft,
  readChatCustomizerConfig,
  writeChatCustomizerDraft,
  type ChatCustomizerConfig,
  type TenantRuntimeWidgetConfig,
} from '@/utils/chatCustomizerPersistence';

interface ChatCustomizerProps {
  initialConfig?: any;
  onSave?: (config: any) => Promise<void>;
}

const DEFAULT_THEME: ChatCustomizerConfig = {
  // Branding
  primaryColor: '#007aff',
  accentColor: '#005bb5',
  fontFamily: 'Inter',
  animation: 'pulse', // none, pulse, bounce, fade
  borderRadius: 16,
  userMsgColor: '#005bb5',
  chatBackground: '#ffffff',
  showLogo: true,
  logoUrl: '',
  mode: 'light', // light or dark

  // Content
  botName: 'Asistente Virtual',
  welcomeMessage: '¡Hola! ¿En qué puedo ayudarte hoy?',
  ctaMessage: '¿Tenés alguna duda?',
  faqSuggestions: [] as string[],

  // Behavior
  soundEnabled: true,
  autoOpen: false,
  autoOpenDelay: 5, // seconds
  position: 'right', // left, right
  sideOffset: 20,
  bottomOffset: 20,

  // Security
  allowedDomains: '', // newline separated
  privacyMode: 'public', // public, private

  // Advanced
  zIndex: 9999,
  mobileHidden: false,
  showBranding: true,
};

const PRESETS = [
    { name: 'Default Blue', primary: '#007aff', accent: '#005bb5', bg: '#ffffff', radius: 16, mode: 'light' },
    { name: 'WhatsApp Style', primary: '#25D366', accent: '#128C7E', bg: '#E5DDD5', radius: 12, mode: 'light' },
    { name: 'Midnight', primary: '#6366f1', accent: '#4f46e5', bg: '#0f172a', radius: 8, mode: 'dark' },
    { name: 'Elegant', primary: '#18181b', accent: '#27272a', bg: '#ffffff', radius: 0, mode: 'light' },
    { name: 'Warm', primary: '#f97316', accent: '#ea580c', bg: '#fff7ed', radius: 20, mode: 'light' },
];

type WidgetAccessState = {
  enabled?: boolean | null;
  reason_code?: string | null;
  lock_reason_code?: string | null;
  required_plan?: string | null;
  current_plan?: string | null;
  upgrade_url?: string | null;
  message?: string | null;
  frontend_contract?: Record<string, unknown> | null;
  upgrade?: Record<string, unknown> | null;
  [key: string]: unknown;
};

const asPlainRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const readString = (record: Record<string, unknown> | null | undefined, keys: string[]): string | null => {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
};

const readBoolean = (record: Record<string, unknown> | null | undefined, keys: string[]): boolean | null => {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
  }
  return null;
};

const normalizeWidgetAccessState = (payload: unknown): WidgetAccessState | null => {
  const record = asPlainRecord(payload);
  if (!record) return null;
  const access = asPlainRecord(record.access) ?? asPlainRecord(record.integration_access) ?? asPlainRecord(record.integrationAccess) ?? record;
  const frontendContract =
    asPlainRecord(access.frontend_contract) ??
    asPlainRecord(access.frontendContract) ??
    asPlainRecord(record.frontend_contract) ??
    asPlainRecord(record.frontendContract);
  const upgrade = asPlainRecord(access.upgrade) ?? asPlainRecord(record.upgrade);
  const enabled = readBoolean(access, ['enabled', 'allowed', 'active']);

  return {
    ...access,
    enabled,
    reason_code: readString(access, ['reason_code', 'reasonCode']) ?? readString(record, ['reason_code', 'reasonCode']),
    lock_reason_code: readString(access, ['lock_reason_code', 'lockReasonCode']) ?? readString(record, ['lock_reason_code', 'lockReasonCode']),
    required_plan: readString(access, ['required_plan', 'requiredPlan']),
    current_plan: readString(access, ['current_plan', 'currentPlan']),
    upgrade_url: readString(access, ['upgrade_url', 'upgradeUrl']) ?? readString(upgrade, ['upgrade_url', 'upgradeUrl', 'url']),
    message: readString(record, ['message']) ?? readString(frontendContract, ['message']),
    frontend_contract: frontendContract,
    upgrade,
  };
};
const ChatCustomizer: React.FC<ChatCustomizerProps> = ({ initialConfig, onSave }) => {
  const { currentSlug } = useTenant();
  const [config, setConfig] = useState<ChatCustomizerConfig>({ ...DEFAULT_THEME, ...(initialConfig || {}) });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [restoredDraftAt, setRestoredDraftAt] = useState<string | null>(null);
  const [draftPersistenceError, setDraftPersistenceError] = useState<string | null>(null);
  const [loadedTenantSlug, setLoadedTenantSlug] = useState<string | null>(initialConfig && currentSlug ? currentSlug : null);
  const changeVersionRef = useRef(0);
  const loadGenerationRef = useRef(0);
  const publicLoadGenerationRef = useRef(0);
  const saveGenerationRef = useRef(0);
  const activeTenantSlugRef = useRef(currentSlug);
  activeTenantSlugRef.current = currentSlug;
  const loadedRuntimePayloadRef = useRef<TenantRuntimeWidgetConfig | null>(null);
  const draftStorage = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }, []);

  // Preview States
  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewMode, setPreviewMode] = useState<'widget' | 'embed'>('widget');
  const [embedSnippet, setEmbedSnippet] = useState<string>('');
  const [embedAttributes, setEmbedAttributes] = useState<Record<string, string>>({});
  const [publicEmbedSnippet, setPublicEmbedSnippet] = useState<string>('');
  const [publicEmbedAttributes, setPublicEmbedAttributes] = useState<Record<string, string>>({});
  const [publicWidgetInfo, setPublicWidgetInfo] = useState<{ token?: string; tenantSlug?: string; tipoChat?: string } | null>(null);
  const [showFullSnippet, setShowFullSnippet] = useState(false);
  const [widgetAccess, setWidgetAccess] = useState<WidgetAccessState | null>(null);

  // Simulation States
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [simulateError, setSimulateError] = useState(false);

  const apiBaseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const fallbackBase = window.location.origin || '';
    const base = import.meta.env.VITE_WIDGET_API_BASE || fallbackBase;
    return base ? base.replace(/\/+$/, '') : '';
  }, []);

  const parseScriptSrc = useCallback((snippet: string) => {
    const srcMatch = snippet.match(/<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/i);
    return srcMatch?.[1] || '';
  }, []);

  const widgetScriptUrl = useMemo(() => {
    const fromPublicSnippet = parseScriptSrc(publicEmbedSnippet);
    const fromPrivateSnippet = parseScriptSrc(embedSnippet);
    const fallbackOrigin = typeof window === 'undefined' ? '' : window.location.origin;
    const chosenSrc = fromPublicSnippet || fromPrivateSnippet;

    if (chosenSrc) return chosenSrc;
    if (!fallbackOrigin) return '';
    return `${fallbackOrigin.replace(/\/+$/, '')}/widget.js`;
  }, [embedSnippet, parseScriptSrc, publicEmbedSnippet]);

  const buildFallbackSnippet = useCallback(
    (attributes: Record<string, string>, info?: { token?: string; tenantSlug?: string; tipoChat?: string } | null) => {
      if (!widgetScriptUrl) return '';
      const mergedAttributes: Record<string, string> = { ...attributes };

      const tenant = mergedAttributes['data-tenant'] || info?.tenantSlug || currentSlug || '';
      if (tenant) mergedAttributes['data-tenant'] = tenant;

      const attributeEntries = Object.entries(mergedAttributes).filter(([, value]) => value);
      if (!attributeEntries.length) return '';

      const attributeString = attributeEntries
        .map(([key, value]) => `\n        ${key}="${value}"`)
        .join('');
      return `<script async src="${widgetScriptUrl}"${attributeString}></script>`;
    },
    [apiBaseUrl, currentSlug, widgetScriptUrl],
  );

  const previewIframeSrc = useMemo(() => {
    if (typeof window === "undefined") return '';
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();

    params.set("tenantSlug", currentSlug || 'demo');
    params.set("defaultOpen", previewOpen ? "true" : "false");

    // Pass config props to iframe
    if (config.primaryColor) params.set('primaryColor', config.primaryColor);
    if (config.accentColor) params.set('accentColor', config.accentColor);
    if (config.position) params.set('position', config.position);
    if (config.sideOffset) params.set('sideOffset', String(config.sideOffset));
    if (config.bottomOffset) params.set('bottomOffset', String(config.bottomOffset));
    if (config.zIndex) params.set('zIndex', String(config.zIndex));
    if (config.faqSuggestions && config.faqSuggestions.length > 0) {
        params.set('faqSuggestions', JSON.stringify(config.faqSuggestions));
    }

    return `${baseUrl}/iframe?${params.toString()}`;
  }, [config, previewOpen, currentSlug]);

  const resolvedEmbedSnippet = useMemo(() => {
    if (embedSnippet) return embedSnippet;
    return buildFallbackSnippet(embedAttributes, null);
  }, [buildFallbackSnippet, embedAttributes, embedSnippet]);

  const resolvedPublicEmbedSnippet = useMemo(() => {
    if (publicEmbedSnippet) return publicEmbedSnippet;
    return buildFallbackSnippet(publicEmbedAttributes, publicWidgetInfo);
  }, [buildFallbackSnippet, publicEmbedAttributes, publicEmbedSnippet, publicWidgetInfo]);

  const shortEmbedSnippet = useMemo(() => {
      // Simplified for brevity, similar to original logic
      return resolvedPublicEmbedSnippet || resolvedEmbedSnippet;
  }, [resolvedPublicEmbedSnippet, resolvedEmbedSnippet]);

  const widgetFrontendContract = widgetAccess?.frontend_contract ?? null;
  const widgetReasonCode = String(widgetAccess?.lock_reason_code ?? widgetAccess?.reason_code ?? '').toLowerCase();
  const widgetEmbedLocked = Boolean(
    widgetAccess?.enabled === false ||
    widgetFrontendContract?.hide_embed_copy === true ||
    widgetFrontendContract?.hide_widget_session === true ||
    widgetReasonCode === 'plan_required' ||
    widgetReasonCode === 'plan_full_required',
  );
  const widgetLockMessage = widgetAccess?.message || 'Plan Full requerido para publicar o embeber el widget en sitios externos.';
  const widgetUpgradeUrl = widgetAccess?.upgrade_url || null;
  const editorReady = Boolean(currentSlug && loadedTenantSlug === currentSlug && !loadError);

  const loadTheme = useCallback(async () => {
    if (!currentSlug) return;
    const requestedSlug = currentSlug;
    const generation = ++loadGenerationRef.current;
    saveGenerationRef.current += 1;
    setSaving(false);
    setLoadedTenantSlug(null);
    setHasUnsavedChanges(false);
    setSaveError(null);
    setLoadError(null);
    setLastSavedAt(null);
    setRestoredDraftAt(null);
    setDraftPersistenceError(null);
    setConfig({ ...DEFAULT_THEME });
    loadedRuntimePayloadRef.current = null;
    if (initialConfig) {
      const initial = { ...DEFAULT_THEME, ...initialConfig };
      const draft = readChatCustomizerDraft(draftStorage, requestedSlug, DEFAULT_THEME);
      setConfig(draft?.config ?? initial);
      setLoadedTenantSlug(requestedSlug);
      setHasUnsavedChanges(Boolean(draft));
      setRestoredDraftAt(draft?.updated_at || null);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const themeData = await tenantService.getRuntimeWidgetConfig(requestedSlug);
      if (generation !== loadGenerationRef.current || activeTenantSlugRef.current !== requestedSlug) return;
      if (!themeData || typeof themeData !== 'object') {
        throw new Error('El servidor no devolvió una configuración válida.');
      }
      const flatConfig = readChatCustomizerConfig(themeData, DEFAULT_THEME);
      const draft = readChatCustomizerDraft(draftStorage, requestedSlug, DEFAULT_THEME);
      loadedRuntimePayloadRef.current = themeData;
      setConfig(draft?.config ?? flatConfig);
      setLoadedTenantSlug(requestedSlug);
      setHasUnsavedChanges(Boolean(draft));
      setRestoredDraftAt(draft?.updated_at || null);
      setSaveError(null);
    } catch (error) {
      if (generation !== loadGenerationRef.current || activeTenantSlugRef.current !== requestedSlug) return;
      console.error("Failed to load chat theme", error);
      loadedRuntimePayloadRef.current = null;
      setLoadError('No se pudo cargar la marca vigente. Reintentá antes de editar para no sobrescribir una configuración anterior.');
    } finally {
      if (generation === loadGenerationRef.current && activeTenantSlugRef.current === requestedSlug) {
        setLoading(false);
      }
    }
  }, [currentSlug, draftStorage, initialConfig]);

  // Load initial data
  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  useEffect(() => {
    const loadPublicWidget = async () => {
      if (!currentSlug) return;
      const requestedSlug = currentSlug;
      const generation = ++publicLoadGenerationRef.current;
      setWidgetAccess(null);
      setPublicEmbedSnippet('');
      setPublicEmbedAttributes({});
      setPublicWidgetInfo(null);
      try {
        const data = await apiClient.get<any>(`/api/public/tenants/${requestedSlug}/widget-config`, { tenantSlug: requestedSlug });
        if (generation !== publicLoadGenerationRef.current || activeTenantSlugRef.current !== requestedSlug) return;
        setWidgetAccess(normalizeWidgetAccessState(data));
        const builderConfig = data?.builder_config || data?.widget?.builder_config || {};
        const snippet = builderConfig?.embed_snippet || data?.embed_snippet || '';
        const token = data?.owner_token || data?.entity_token || data?.widget_token || data?.token;
        const tenantSlug = data?.tenant_slug || data?.tenant?.slug || requestedSlug;
        const tipoChat = data?.tipo_chat || data?.tipoChat || data?.widget_tipo_chat;
        setPublicEmbedSnippet(snippet);
        const attributes = { ...(builderConfig?.attributes || {}) } as Record<string, string>;
        setPublicEmbedAttributes(attributes);
        setPublicWidgetInfo({ token, tenantSlug, tipoChat });
      } catch (error) {
        if (generation !== publicLoadGenerationRef.current || activeTenantSlugRef.current !== requestedSlug) return;
        console.error("Failed to load public widget config", error);
        const errorRecord = asPlainRecord(error);
        setWidgetAccess(normalizeWidgetAccessState(errorRecord?.body ?? errorRecord?.response));
      }
    };
    loadPublicWidget();
  }, [currentSlug]);

  useEffect(() => {
    if (!hasUnsavedChanges || typeof window === 'undefined') return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges || !currentSlug || loadedTenantSlug !== currentSlug) return;
    const persisted = writeChatCustomizerDraft(draftStorage, currentSlug, config);
    setDraftPersistenceError(
      persisted
        ? null
        : 'Este navegador bloqueó el borrador de sesión. Guardá antes de cambiar de pantalla.',
    );
  }, [config, currentSlug, draftStorage, hasUnsavedChanges, loadedTenantSlug]);

  const handleChange = (field: string, value: any) => {
    if (!editorReady) return;
    setConfig(prev => ({ ...prev, [field]: value }));
    changeVersionRef.current += 1;
    setHasUnsavedChanges(true);
    setSaveError(null);
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
      if (!editorReady) return;
      setConfig(prev => ({
          ...prev,
          primaryColor: preset.primary,
          accentColor: preset.accent,
          chatBackground: preset.bg,
          borderRadius: preset.radius,
          mode: preset.mode
      }));
      changeVersionRef.current += 1;
      setHasUnsavedChanges(true);
      setSaveError(null);
      toast.info(`Tema "${preset.name}" aplicado.`);
  };

  const performSave = async (cfg: ChatCustomizerConfig): Promise<boolean> => {
    if (!currentSlug || !editorReady) {
      setSaveError('Primero debe cargarse y confirmarse la configuración de la organización activa.');
      return false;
    }
    const requestedSlug = currentSlug;
    const saveVersion = changeVersionRef.current;
    const saveGeneration = ++saveGenerationRef.current;
    const isActiveSave = () =>
      activeTenantSlugRef.current === requestedSlug && saveGenerationRef.current === saveGeneration;
    setSaving(true);
    setSaveError(null);
    try {
      if (onSave) {
          await onSave(cfg);
          if (!isActiveSave()) return false;
      } else {
          const payload = buildTenantRuntimeWidgetUpdate(cfg, loadedRuntimePayloadRef.current);
          await tenantService.updateRuntimeWidgetConfig(requestedSlug, payload);
          if (!isActiveSave()) return false;
          const persisted = await tenantService.getRuntimeWidgetConfig(requestedSlug);
          if (!isActiveSave()) return false;
          const mismatches = findTenantRuntimePersistenceMismatches(cfg, persisted, DEFAULT_THEME);
          if (mismatches.length > 0) {
            throw new Error(`El servidor respondió pero no conservó: ${mismatches.slice(0, 4).join(', ')}.`);
          }
          loadedRuntimePayloadRef.current = persisted;
          const publicRuntime = await tenantService.getPublicRuntimeWidgetConfig(requestedSlug);
          if (!isActiveSave()) return false;
          const publicMismatches = findPublicWidgetRuntimeMismatches(cfg, publicRuntime);
          if (publicMismatches.length > 0) {
            throw new Error(`El contrato público todavía no refleja: ${publicMismatches.slice(0, 4).join(', ')}.`);
          }
      }
      if (changeVersionRef.current === saveVersion) {
        setHasUnsavedChanges(false);
        setRestoredDraftAt(null);
        setDraftPersistenceError(null);
        clearChatCustomizerDraft(draftStorage, requestedSlug);
      }
      setLastSavedAt(new Date().toISOString());
      toast.success(
        onSave
          ? 'Configuración entregada y confirmada por el guardado externo.'
          : widgetEmbedLocked
            ? 'Configuración verificada. El widget externo se habilitará al activar el canal correspondiente.'
            : 'Marca guardada y verificada en el widget público.',
      );
      return true;
    } catch (error) {
      if (!isActiveSave()) return false;
      console.error("Save failed", error);
      const detail = error instanceof Error && error.message ? ` ${error.message}` : '';
      setSaveError(`No se pudo confirmar el guardado.${detail}`);
      setHasUnsavedChanges(true);
      toast.error('No se pudo guardar la marca. Los cambios siguen pendientes.');
      return false;
    } finally {
      if (isActiveSave()) setSaving(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-10">
      {/* LEFT COLUMN: Controls */}
      <div className="space-y-8">
        {loadError && (
          <div role="alert" className="rounded-2xl border border-red-300/50 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1 space-y-3">
                <p className="font-semibold">No se cargó la configuración vigente</p>
                <p>{loadError}</p>
                <Button type="button" size="sm" variant="outline" onClick={loadTheme} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Reintentar carga
                </Button>
              </div>
            </div>
          </div>
        )}

        {saveError && (
          <div role="alert" className="rounded-2xl border border-red-300/50 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Cambios pendientes, sin aplicar</p>
                <p className="mt-1">{saveError}</p>
              </div>
            </div>
          </div>
        )}

        {hasUnsavedChanges && restoredDraftAt && (
          <div role="status" className="rounded-2xl border border-amber-300/50 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
            <p className="font-semibold">Borrador sin guardar recuperado</p>
            <p className="mt-1 text-amber-800/80 dark:text-amber-100/75">
              Pertenece únicamente a {currentSlug}. Revisalo y guardalo para aplicarlo al widget público.
            </p>
          </div>
        )}

        {draftPersistenceError && (
          <div role="alert" className="rounded-2xl border border-amber-300/50 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
            {draftPersistenceError}
          </div>
        )}

        <div className={cn(!editorReady && 'pointer-events-none select-none opacity-60')} aria-disabled={!editorReady}>
        <Tabs defaultValue="branding" className="space-y-6">
            <TabsList className="w-full justify-start border border-border/60 rounded-2xl h-auto p-1 bg-card/60 backdrop-blur gap-1 overflow-x-auto">
                <TabsTrigger value="branding" className="rounded-xl px-3 py-2 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"><Palette className="w-4 h-4 mr-2"/> Marca</TabsTrigger>
                <TabsTrigger value="behavior" className="rounded-xl px-3 py-2 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"><Zap className="w-4 h-4 mr-2"/> Comportamiento</TabsTrigger>
                <TabsTrigger value="content" className="rounded-xl px-3 py-2 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"><MessageSquare className="w-4 h-4 mr-2"/> Contenido</TabsTrigger>
                <TabsTrigger value="security" className="rounded-xl px-3 py-2 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"><Shield className="w-4 h-4 mr-2"/> Seguridad</TabsTrigger>
                <TabsTrigger value="advanced" className="rounded-xl px-3 py-2 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"><Settings className="w-4 h-4 mr-2"/> Avanzado</TabsTrigger>
            </TabsList>

            <TabsContent value="branding" className="space-y-6">
                <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary"/> Estilo y Marca</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <Label>Temas Predefinidos</Label>
                            <div className="flex gap-2 flex-wrap">
                                {PRESETS.map((preset) => (
                                    <button
                                        key={preset.name}
                                        onClick={() => applyPreset(preset)}
                                        className={cn(
                                            "h-10 w-10 rounded-full border-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                            config.primaryColor === preset.primary ? "border-primary ring-2 ring-primary/20" : "border-transparent"
                                        )}
                                        style={{ background: preset.primary }}
                                        title={preset.name}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Color Primario</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        value={config.primaryColor}
                                        onChange={(e) => handleChange('primaryColor', e.target.value)}
                                        className="w-12 h-10 p-1 cursor-pointer shrink-0"
                                    />
                                    <Input
                                        value={config.primaryColor}
                                        onChange={(e) => handleChange('primaryColor', e.target.value)}
                                        className="font-mono uppercase"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Color Secundario</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        value={config.accentColor}
                                        onChange={(e) => handleChange('accentColor', e.target.value)}
                                        className="w-12 h-10 p-1 cursor-pointer shrink-0"
                                    />
                                    <Input
                                        value={config.accentColor}
                                        onChange={(e) => handleChange('accentColor', e.target.value)}
                                        className="font-mono uppercase"
                                    />
                                </div>
                            </div>
                        </div>

                         <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                     <Label>Redondeo ({config.borderRadius}px)</Label>
                                </div>
                                <Slider
                                    value={[config.borderRadius]}
                                    min={0}
                                    max={24}
                                    step={2}
                                    onValueChange={(val) => handleChange('borderRadius', val[0])}
                                />
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="behavior" className="space-y-6">
                <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary"/> Comportamiento</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                             <div className="space-y-0.5">
                                <Label>Apertura Automática</Label>
                                <p className="text-xs text-muted-foreground">Abrir el chat al cargar la página</p>
                             </div>
                             <Switch
                                checked={config.autoOpen}
                                onCheckedChange={(c) => handleChange('autoOpen', c)}
                             />
                        </div>

                        {config.autoOpen && (
                          <p className="text-xs text-muted-foreground">La apertura publicada actualmente es inmediata.</p>
                        )}

                        <div className="space-y-2">
                                <Label>Posición</Label>
                                <Select value={config.position} onValueChange={(v) => handleChange('position', v)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="right">Derecha</SelectItem>
                                        <SelectItem value="left">Izquierda</SelectItem>
                                    </SelectContent>
                                </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label>Margen Lateral (px)</Label>
                                <Input type="number" value={config.sideOffset} onChange={(e) => handleChange('sideOffset', Number(e.target.value))} />
                             </div>
                             <div className="space-y-2">
                                <Label>Margen Inferior (px)</Label>
                                <Input type="number" value={config.bottomOffset} onChange={(e) => handleChange('bottomOffset', Number(e.target.value))} />
                             </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="content" className="space-y-6">
                <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary"/> Identidad del Bot</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="flex gap-4">
                             <div className="space-y-2 flex-1">
                                <Label>Nombre del Asistente</Label>
                                <Input
                                    value={config.botName}
                                    onChange={(e) => handleChange('botName', e.target.value)}
                                    placeholder="Ej: Sofía"
                                />
                             </div>
                             <div className="space-y-2 w-1/3">
                                     <Label htmlFor="logo-url">Avatar HTTPS</Label>
                                     <Input
                                         id="logo-url"
                                         type="url"
                                         value={config.logoUrl}
                                         onChange={(event) => handleChange('logoUrl', event.target.value)}
                                         placeholder="https://cdn.organismo.gob.ar/logo.svg"
                                     />
                             </div>
                         </div>

                        <div className="space-y-2">
                            <Label>Mensaje de Bienvenida</Label>
                            <Input
                                value={config.welcomeMessage}
                                onChange={(e) => handleChange('welcomeMessage', e.target.value)}
                                placeholder="Ej: ¡Hola! 👋 ¿En qué te puedo ayudar?"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Llamada a la Acción (Burbuja)</Label>
                            <Input
                                value={config.ctaMessage}
                                onChange={(e) => handleChange('ctaMessage', e.target.value)}
                                placeholder="Ej: ¿Tenés alguna duda?"
                            />
                        </div>

                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                          Las respuestas rápidas se administran desde Flujos conversacionales para que tengan versión, permisos y trazabilidad.
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
                 <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary"/> Seguridad y Acceso</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-xl border border-amber-300/50 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
                          <div className="flex items-start gap-3">
                            <Lock className="mt-0.5 h-5 w-5 shrink-0" />
                            <div>
                              <p className="font-semibold">Control de dominio y acceso enterprise</p>
                              <p className="mt-1 text-amber-800/80 dark:text-amber-100/75">
                                La whitelist, la verificación DNS y el acceso privado se habilitarán desde el control plane con prueba de propiedad y SSO. No se simulan desde este editor visual.
                              </p>
                            </div>
                          </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-6">
                 <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary"/> Avanzado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                          Visibilidad móvil, nivel de superposición y disclosure de proveedor formarán parte de una publicación versionada con preview y rollback. Este panel sólo muestra controles que el runtime puede verificar hoy.
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
        </div>

        <div className="sticky bottom-4 z-10 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {hasUnsavedChanges
                ? 'Hay cambios pendientes. Se aplican únicamente al guardar.'
                : lastSavedAt
                  ? `Guardado verificado a las ${new Date(lastSavedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
                  : 'La marca cargada coincide con el servidor.'}
            </span>
            {!hasUnsavedChanges && lastSavedAt ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : null}
          </div>
          <Button
            className="h-11 w-full rounded-xl shadow-lg shadow-primary/20"
            onClick={() => performSave(config)}
            disabled={saving || loading || !editorReady || !hasUnsavedChanges}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
            Guardar y aplicar cambios
          </Button>
        </div>
      </div>

      {/* RIGHT COLUMN: Preview */}
      <div className="lg:sticky lg:top-8 h-fit space-y-4 rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-4 flex-wrap">
             <div>
                <h3 className="text-lg font-semibold flex items-center gap-2"><Monitor className="h-5 w-5"/> Vista Previa</h3>
             </div>
             {hasUnsavedChanges && (
                 <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded animate-pulse border border-amber-200">
                     Cambios sin guardar
                 </span>
             )}
        </div>

        <div className="flex flex-wrap gap-2">
            <Button
                variant={previewMode === 'widget' ? "default" : "outline"}
                size="sm"
                onClick={() => setPreviewMode('widget')}
            >
                Widget
            </Button>
            <Button
                variant={previewMode === 'embed' ? "default" : "outline"}
                size="sm"
                onClick={() => setPreviewMode('embed')}
            >
                Código
            </Button>
            <div className="flex items-center gap-2 ml-auto rounded-full border border-border/60 bg-background/80 px-3 py-1">
                <Label className="text-xs text-muted-foreground">Mostrar</Label>
                <Switch checked={previewOpen} onCheckedChange={setPreviewOpen} />
            </div>
        </div>

        {/* Simulation Controls */}
        {previewMode === 'widget' && (
            <div className="flex items-center justify-between gap-2 p-2 bg-muted/40 rounded-lg border overflow-x-auto">
                 <span className="text-xs font-semibold text-muted-foreground shrink-0">Simular:</span>
                 <div className="flex gap-2">
                     <Button
                        size="sm"
                        variant={simulateLoading ? "secondary" : "ghost"}
                        className="h-6 px-2 text-xs"
                        onClick={() => setSimulateLoading(!simulateLoading)}
                     >
                        {simulateLoading && <Loader2 className="w-3 h-3 mr-1 animate-spin"/>} Loading
                     </Button>
                     <Button
                        size="sm"
                        variant={simulateOffline ? "secondary" : "ghost"}
                        className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => setSimulateOffline(!simulateOffline)}
                     >
                        {simulateOffline && <WifiOff className="w-3 h-3 mr-1"/>} Offline
                     </Button>
                      <Button
                        size="sm"
                        variant={simulateError ? "secondary" : "ghost"}
                        className="h-6 px-2 text-xs text-red-500 hover:text-red-500"
                        onClick={() => setSimulateError(!simulateError)}
                     >
                        {simulateError && <AlertCircle className="w-3 h-3 mr-1"/>} Error
                     </Button>
                 </div>
                 <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs ml-auto"
                    onClick={() => {
                        window.open(`${previewIframeSrc}&fullpage=true`, '_blank');
                    }}
                 >
                    <ExternalLink className="w-3 h-3 mr-1" /> Nueva Pestaña
                 </Button>
            </div>
        )}

        {previewMode === 'widget' ? (
             <WidgetPreview
                tenantSlug={currentSlug || 'demo'}
                defaultOpen={previewOpen}

                // Branding
                primaryColor={config.primaryColor}
                accentColor={config.accentColor}
                userMsgColor={config.userMsgColor}
                chatBackground={config.chatBackground}
                borderRadius={config.borderRadius}
                logoUrl={config.logoUrl}
                fontFamily={config.fontFamily}
                logoAnimation={config.animation}

                // Content
                botName={config.botName}
                welcomeMessage={config.welcomeMessage}
                ctaMessage={config.ctaMessage}
                faqSuggestions={config.faqSuggestions}

                // Behavior & Layout
                autoOpenDelay={config.autoOpenDelay}
                position={config.position as 'left' | 'right'}
                sideOffset={config.sideOffset}
                bottomOffset={config.bottomOffset}
                zIndex={config.zIndex}

                // Simulation
                simulateState={
                    simulateLoading ? 'loading' :
                    simulateOffline ? 'offline' :
                    simulateError ? 'error' : null
                }
            />
        ) : (
            <Card className="border border-border/60 shadow-sm bg-card/80 rounded-2xl">
                <CardHeader>
                    <CardTitle className="text-base">Snippet de integración</CardTitle>
                    <CardDescription>Copiá y pegá este script en el &lt;body&gt; de tu sitio web.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {widgetEmbedLocked ? (
                        <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm shadow-sm">
                            <div className="flex items-start gap-3">
                                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/50 bg-amber-200/20 text-amber-700 dark:text-amber-300">
                                    <Lock className="h-5 w-5" />
                                </span>
                                <div className="space-y-3">
                                    <div>
                                        <p className="font-semibold text-foreground">Integracion web bloqueada por plan</p>
                                        <p className="mt-1 text-sm text-muted-foreground">{widgetLockMessage}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <span className="rounded-full border border-border/60 bg-background/70 px-2 py-1">Plan actual: {widgetAccess?.current_plan || 'sin confirmar'}</span>
                                        <span className="rounded-full border border-border/60 bg-background/70 px-2 py-1">Requerido: {widgetAccess?.required_plan || 'Full'}</span>
                                    </div>
                                    {widgetUpgradeUrl && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => window.open(widgetUpgradeUrl, '_blank', 'noopener,noreferrer')}
                                        >
                                            Ver planes <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-2xl border border-border/40 bg-slate-950/95 text-slate-100 p-4 text-xs font-mono whitespace-pre-wrap shadow-inner ring-1 ring-white/5 max-h-48 overflow-auto">
                                {showFullSnippet ? (resolvedPublicEmbedSnippet || resolvedEmbedSnippet) : shortEmbedSnippet}
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowFullSnippet((prev) => !prev)}
                                >
                                  {showFullSnippet ? 'Ocultar todo' : 'Ver todo'}
                                </Button>
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(resolvedPublicEmbedSnippet || resolvedEmbedSnippet);
                                        toast.success("Copiado al portapapeles");
                                    }}
                                >
                                    Copiar Código
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
};

export default ChatCustomizer;
