import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Palette, MessageSquare, Upload, Check, Volume2, Monitor,
  Smartphone, Tablet, Shield, Settings, Zap, Globe, Lock, WifiOff, AlertCircle, Plus, Trash2, ExternalLink, CheckCircle2
} from 'lucide-react';
import WidgetPreview from '@/components/chat/WidgetPreview';
import { useTenant } from '@/context/TenantContext';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/api/client';
import { cn } from '@/lib/utils';

interface ChatCustomizerProps {
  initialConfig?: any;
  onSave?: (config: any) => Promise<void>;
}

const DEFAULT_THEME = {
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
  const [config, setConfig] = useState(initialConfig || DEFAULT_THEME);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

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

  // FAQ State
  const [newFaq, setNewFaq] = useState('');

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


  // Debounce logic
  const [debouncedConfig, setDebouncedConfig] = useState(config);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedConfig(config);
    }, 1000);
    return () => clearTimeout(timer);
  }, [config]);

  const loadTheme = useCallback(async () => {
    if (!currentSlug) return;
    if (initialConfig) {
      setConfig({ ...DEFAULT_THEME, ...initialConfig });
      return;
    }

    setLoading(true);
    try {
      const themeData = await apiClient.getChatTheme(currentSlug);
      if (themeData) {
         const tc = themeData.theme_config || {};
         const behavior = tc.behavior || {};
         const security = tc.security || {};
         const advanced = tc.advanced || {};
         const content = tc.content || {};

         const flatConfig = {
             primaryColor: tc.light?.primary || DEFAULT_THEME.primaryColor,
             accentColor: tc.light?.secondary || DEFAULT_THEME.accentColor,
             fontFamily: tc.font_family || DEFAULT_THEME.fontFamily,
             animation: tc.animation || DEFAULT_THEME.animation,
             borderRadius: tc.border_radius ?? DEFAULT_THEME.borderRadius,
             userMsgColor: tc.light?.foreground || DEFAULT_THEME.userMsgColor,
             chatBackground: tc.light?.background || DEFAULT_THEME.chatBackground,
             botName: themeData.bot_name || DEFAULT_THEME.botName,
             welcomeMessage: themeData.welcome_message || DEFAULT_THEME.welcomeMessage,
             ctaMessage: themeData.cta_messages?.[0] || DEFAULT_THEME.ctaMessage,
             showLogo: themeData.show_logo ?? DEFAULT_THEME.showLogo,
             logoUrl: themeData.logo_url || DEFAULT_THEME.logoUrl,
             mode: tc.mode || DEFAULT_THEME.mode,
             soundEnabled: tc.sound_enabled ?? DEFAULT_THEME.soundEnabled,

             // New Fields
             autoOpen: behavior.auto_open ?? DEFAULT_THEME.autoOpen,
             autoOpenDelay: behavior.auto_open_delay ?? DEFAULT_THEME.autoOpenDelay,
             position: behavior.position ?? DEFAULT_THEME.position,
             sideOffset: behavior.side_offset ?? DEFAULT_THEME.sideOffset,
             bottomOffset: behavior.bottom_offset ?? DEFAULT_THEME.bottomOffset,
             allowedDomains: (security.allowed_domains || []).join('\n'),
             privacyMode: security.privacy_mode || DEFAULT_THEME.privacyMode,
             zIndex: advanced.z_index ?? DEFAULT_THEME.zIndex,
             mobileHidden: advanced.mobile_hidden ?? DEFAULT_THEME.mobileHidden,
             showBranding: advanced.show_branding ?? DEFAULT_THEME.showBranding,
             faqSuggestions: content.faq_suggestions || DEFAULT_THEME.faqSuggestions,
         };
         setConfig(flatConfig);
         setDebouncedConfig(flatConfig);
      }
    } catch (error) {
      console.error("Failed to load chat theme", error);
    } finally {
      setLoading(false);
    }
  }, [currentSlug, initialConfig]);

  // Load initial data
  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  useEffect(() => {
    const loadPublicWidget = async () => {
      if (!currentSlug) return;
      try {
        const data = await apiClient.get<any>(`/api/public/tenants/${currentSlug}/widget-config`, { tenantSlug: currentSlug });
        setWidgetAccess(normalizeWidgetAccessState(data));
        const builderConfig = data?.builder_config || data?.widget?.builder_config || {};
        const snippet = builderConfig?.embed_snippet || data?.embed_snippet || '';
        const token = data?.owner_token || data?.entity_token || data?.widget_token || data?.token;
        const tenantSlug = data?.tenant_slug || data?.tenant?.slug || currentSlug;
        const tipoChat = data?.tipo_chat || data?.tipoChat || data?.widget_tipo_chat;
        setPublicEmbedSnippet(snippet);
        const attributes = { ...(builderConfig?.attributes || {}) } as Record<string, string>;
        setPublicEmbedAttributes(attributes);
        setPublicWidgetInfo({ token, tenantSlug, tipoChat });
      } catch (error) {
        console.error("Failed to load public widget config", error);
        const errorRecord = asPlainRecord(error);
        setWidgetAccess(normalizeWidgetAccessState(errorRecord?.body ?? errorRecord?.response));
      }
    };
    loadPublicWidget();
  }, [currentSlug]);

  const handleChange = (field: string, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
      setConfig(prev => ({
          ...prev,
          primaryColor: preset.primary,
          accentColor: preset.accent,
          chatBackground: preset.bg,
          borderRadius: preset.radius,
          mode: preset.mode
      }));
      setHasUnsavedChanges(true);
      toast.info(`Tema "${preset.name}" aplicado.`);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        handleChange('logoUrl', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const constructPayload = (cfg: typeof DEFAULT_THEME) => ({
      theme_config: {
          mode: cfg.mode,
          light: {
              primary: cfg.primaryColor,
              secondary: cfg.accentColor,
              background: cfg.chatBackground,
              foreground: cfg.userMsgColor
          },
          dark: {
              primary: cfg.primaryColor,
              secondary: cfg.accentColor,
              background: '#1a1a1a',
              foreground: '#ffffff'
          },
          font_family: cfg.fontFamily,
          animation: cfg.animation,
          border_radius: cfg.borderRadius,
          sound_enabled: cfg.soundEnabled,

          behavior: {
             auto_open: cfg.autoOpen,
             auto_open_delay: cfg.autoOpenDelay,
             position: cfg.position,
             side_offset: cfg.sideOffset,
             bottom_offset: cfg.bottomOffset,
          },
          security: {
             allowed_domains: cfg.allowedDomains.split('\n').filter(d => d.trim()),
             privacy_mode: cfg.privacyMode
          },
          advanced: {
             z_index: cfg.zIndex,
             mobile_hidden: cfg.mobileHidden,
             show_branding: cfg.showBranding
          },
          content: {
             faq_suggestions: cfg.faqSuggestions
          }
      },
      cta_messages: [cfg.ctaMessage],
      bot_name: cfg.botName,
      welcome_message: cfg.welcomeMessage,
      logo_url: cfg.logoUrl,
      show_logo: cfg.showLogo
  });

  const performSave = async (cfg: typeof DEFAULT_THEME, isAutoSave = false) => {
    if (!currentSlug) return;
    setSaving(true);
    try {
      const payload = constructPayload(cfg);
      if (onSave) {
          await onSave(cfg);
      } else {
          // Updates the Draft configuration
          await apiClient.updateChatTheme(currentSlug, payload);
      }
      if (!isAutoSave) toast.success("Borrador guardado.");
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Save failed", error);
      if (!isAutoSave) toast.error("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (hasUnsavedChanges) {
        performSave(debouncedConfig, true);
    }
  }, [debouncedConfig]);

  const handleAddFaq = () => {
    if (!newFaq.trim()) return;
    const updated = [...(config.faqSuggestions || []), newFaq.trim()];
    handleChange('faqSuggestions', updated);
    setNewFaq('');
  };

  const handleRemoveFaq = (index: number) => {
    const updated = [...(config.faqSuggestions || [])];
    updated.splice(index, 1);
    handleChange('faqSuggestions', updated);
  };

  const isDomainAllowed = useMemo(() => {
    if (typeof window === 'undefined') return true;
    if (!config.allowedDomains.trim()) return true; // Empty means all allowed
    const domains = config.allowedDomains.split('\n').map(d => d.trim()).filter(Boolean);
    const currentDomain = window.location.hostname;
    return domains.some(d => currentDomain.includes(d));
  }, [config.allowedDomains]);

  return (
    <div className="grid lg:grid-cols-2 gap-10">
      {/* LEFT COLUMN: Controls */}
      <div className="space-y-8">
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
                             <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label>Demora de apertura ({config.autoOpenDelay}s)</Label>
                                </div>
                                <Slider
                                    value={[config.autoOpenDelay]}
                                    min={0}
                                    max={30}
                                    step={1}
                                    onValueChange={(val) => handleChange('autoOpenDelay', val[0])}
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
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
                             <div className="space-y-2">
                                <Label>Sonidos</Label>
                                <div className="flex items-center gap-2 h-10">
                                    <Switch checked={config.soundEnabled} onCheckedChange={(c) => handleChange('soundEnabled', c)} />
                                    <span className="text-sm">{config.soundEnabled ? 'Activados' : 'Silencio'}</span>
                                </div>
                             </div>
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
                                <Label>Avatar</Label>
                                <div className="relative group">
                                    <Label htmlFor="logo-upload" className="cursor-pointer block">
                                        <div className="h-10 w-full rounded border bg-muted flex items-center justify-center overflow-hidden hover:bg-muted/80 transition-colors">
                                            {config.logoUrl ? (
                                                <img src={config.logoUrl} alt="Avatar" className="h-full w-full object-cover" />
                                            ) : (
                                                <Upload className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </div>
                                    </Label>
                                    <Input
                                        id="logo-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleLogoUpload}
                                    />
                                </div>
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

                        <div className="space-y-3 pt-4 border-t">
                            <Label>Preguntas Frecuentes (Sugerencias)</Label>
                            <div className="space-y-2">
                                {config.faqSuggestions?.map((faq: string, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <Input value={faq} readOnly className="h-9 bg-muted/50" />
                                        <Button variant="ghost" size="sm" onClick={() => handleRemoveFaq(idx)}>
                                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={newFaq}
                                        onChange={(e) => setNewFaq(e.target.value)}
                                        placeholder="Ej: ¿Cómo comprar?"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddFaq()}
                                    />
                                    <Button variant="outline" size="sm" onClick={handleAddFaq}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
                 <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary"/> Seguridad y Acceso</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <Label>Dominios Permitidos (Whitelist)</Label>
                                {isDomainAllowed ? (
                                    <span className="text-xs flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                        <CheckCircle2 className="w-3 h-3"/> Dominio Actual Autorizado
                                    </span>
                                ) : (
                                    <span className="text-xs flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                        <AlertCircle className="w-3 h-3"/> Dominio Actual No Autorizado
                                    </span>
                                )}
                            </div>
                            <textarea
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={config.allowedDomains}
                                onChange={(e) => handleChange('allowedDomains', e.target.value)}
                                placeholder="ejemplo.com&#10;mi-tienda.com"
                            />
                            <p className="text-xs text-muted-foreground">Un dominio por línea. Dejar vacío para permitir todos.</p>
                        </div>

                        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                             <div className="space-y-0.5">
                                <Label>Modo de Privacidad</Label>
                                <p className="text-xs text-muted-foreground">{config.privacyMode === 'public' ? 'Cualquiera puede iniciar chat' : 'Requiere autenticación previa'}</p>
                             </div>
                             <div className="flex items-center gap-2">
                                <span className={cn("text-xs font-medium", config.privacyMode === 'public' ? "text-primary" : "text-muted-foreground")}>Público</span>
                                <Switch
                                    checked={config.privacyMode === 'private'}
                                    onCheckedChange={(c) => handleChange('privacyMode', c ? 'private' : 'public')}
                                />
                                <span className={cn("text-xs font-medium", config.privacyMode === 'private' ? "text-primary" : "text-muted-foreground")}>Privado</span>
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
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                             <div className="flex justify-between items-center">
                                  <Label>Z-Index ({config.zIndex})</Label>
                             </div>
                             <Slider
                                 value={[config.zIndex]}
                                 min={0}
                                 max={999999}
                                 step={100}
                                 onValueChange={(val) => handleChange('zIndex', val[0])}
                             />
                         </div>

                         <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                             <div className="space-y-0.5">
                                <Label>Ocultar en Móviles</Label>
                                <p className="text-xs text-muted-foreground">El widget no se cargará en pantallas pequeñas.</p>
                             </div>
                             <Switch
                                checked={config.mobileHidden}
                                onCheckedChange={(c) => handleChange('mobileHidden', c)}
                             />
                        </div>

                        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                             <div className="space-y-0.5">
                                <Label>Mostrar Branding</Label>
                                <p className="text-xs text-muted-foreground">Pie de página "Powered by Chatboc".</p>
                             </div>
                             <Switch
                                checked={config.showBranding}
                                onCheckedChange={(c) => handleChange('showBranding', c)}
                             />
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

        <div className="sticky bottom-4 z-10 flex gap-2">
             <Button className="flex-1 h-11 rounded-xl shadow-sm" variant="outline" onClick={() => performSave(config)} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
                Guardar Borrador
            </Button>
             <Button className="flex-1 h-11 rounded-xl shadow-lg shadow-primary/20" onClick={async () => {
                 if (widgetEmbedLocked) {
                     toast.error(widgetLockMessage);
                     return;
                 }
                 await performSave(config, true);
                 if (!currentSlug) return;
                 try {
                     setSaving(true);
                     await apiClient.post(`/api/admin/tenants/${currentSlug}/widget-config/publish`);
                     toast.success("¡Widget publicado en vivo!");
                 } catch (e) {
                     toast.error("Error al publicar.");
                 } finally {
                     setSaving(false);
                 }
             }} disabled={saving || widgetEmbedLocked}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
                Publicar Widget
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
