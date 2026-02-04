import React, { useMemo, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Palette, MessageSquare, Upload, Check, Volume2, Monitor, Smartphone, Tablet } from 'lucide-react';
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
  primaryColor: '#007aff',
  accentColor: '#005bb5',
  fontFamily: 'Inter',
  animation: 'pulse', // none, pulse, bounce, fade
  borderRadius: 16,
  userMsgColor: '#005bb5',
  chatBackground: '#ffffff',
  botName: 'Asistente Virtual',
  welcomeMessage: '¡Hola! ¿En qué puedo ayudarte hoy?',
  ctaMessage: '¿Tenés alguna duda?',
  showLogo: true,
  logoUrl: '',
  mode: 'light', // light or dark
  soundEnabled: true,
};

const PRESETS = [
    { name: 'Default Blue', primary: '#007aff', accent: '#005bb5', bg: '#ffffff', radius: 16, mode: 'light' },
    { name: 'WhatsApp Style', primary: '#25D366', accent: '#128C7E', bg: '#E5DDD5', radius: 12, mode: 'light' },
    { name: 'Midnight', primary: '#6366f1', accent: '#4f46e5', bg: '#0f172a', radius: 8, mode: 'dark' },
    { name: 'Elegant', primary: '#18181b', accent: '#27272a', bg: '#ffffff', radius: 0, mode: 'light' },
    { name: 'Warm', primary: '#f97316', accent: '#ea580c', bg: '#fff7ed', radius: 20, mode: 'light' },
];

const ChatCustomizer: React.FC<ChatCustomizerProps> = ({ initialConfig, onSave }) => {
  const { currentSlug } = useTenant();
  const [config, setConfig] = useState(initialConfig || DEFAULT_THEME);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [previewMode, setPreviewMode] = useState<'widget' | 'embed'>('widget');
  const [embedSnippet, setEmbedSnippet] = useState<string>('');
  const [embedAttributes, setEmbedAttributes] = useState<Record<string, string>>({});
  const [publicEmbedSnippet, setPublicEmbedSnippet] = useState<string>('');
  const [publicEmbedAttributes, setPublicEmbedAttributes] = useState<Record<string, string>>({});
  const [publicWidgetInfo, setPublicWidgetInfo] = useState<{ token?: string; tenantSlug?: string; tipoChat?: string } | null>(null);
  const previewIframeSrc = useMemo(() => {
    if (typeof window === "undefined") return '';
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();
    const tenant = publicEmbedAttributes["data-tenant"] || publicEmbedAttributes["data-tenant-slug"] || publicWidgetInfo?.tenantSlug || currentSlug;
    const entityToken =
      publicEmbedAttributes["data-owner-token"]
      || publicEmbedAttributes["data-entity-token"]
      || publicEmbedAttributes["data-widget-token"]
      || publicWidgetInfo?.token
      || '';
    const endpoint = publicEmbedAttributes["data-endpoint"] || publicWidgetInfo?.tipoChat || '';

    if (tenant) {
      params.set("tenant", tenant);
      params.set("tenantSlug", tenant);
    }
    if (entityToken) {
      params.set("entityToken", entityToken);
      params.set("ownerToken", entityToken);
    }
    if (endpoint) {
      params.set("endpoint", endpoint);
    }

    params.set("defaultOpen", previewOpen ? "true" : "false");

    const attributeMap: Record<string, string> = {
      "data-width": "openWidth",
      "data-height": "openHeight",
      "data-closed-width": "closedWidth",
      "data-closed-height": "closedHeight",
      "data-bottom": "bottom",
      "data-right": "right",
      "data-logo-url": "logoUrl",
      "data-header-logo-url": "headerLogoUrl",
      "data-logo-animation": "logoAnimation",
      "data-welcome-title": "welcomeTitle",
      "data-welcome-subtitle": "welcomeSubtitle",
    };

    Object.entries(attributeMap).forEach(([attr, queryKey]) => {
      const value = publicEmbedAttributes[attr];
      if (value) params.set(queryKey, value);
    });

    return `${baseUrl}/iframe?${params.toString()}`;
  }, [publicEmbedAttributes, publicWidgetInfo, previewOpen, currentSlug]);
  const resolvedEmbedSnippet = useMemo(() => embedSnippet, [embedSnippet]);

  // Debounce logic
  const [debouncedConfig, setDebouncedConfig] = useState(config);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedConfig(config);
    }, 1000);
    return () => clearTimeout(timer);
  }, [config]);

  // Load initial data
  useEffect(() => {
    const loadTheme = async () => {
      if (!currentSlug) return;
      if (initialConfig) {
        setConfig({ ...DEFAULT_THEME, ...initialConfig });
        return;
      }

      setLoading(true);
      try {
        const themeData = await apiClient.getChatTheme(currentSlug);
        if (themeData) {
           const builderConfig = themeData.configs?.widget?.default?.builder_config
             || themeData.widget?.builder_config
             || {};
           const snippet = builderConfig?.embed_snippet
             || themeData.widget?.embed_snippet
             || '';
           setEmbedSnippet(snippet);
           setEmbedAttributes(builderConfig?.attributes || {});
           const flatConfig = {
               primaryColor: themeData.theme_config?.light?.primary || DEFAULT_THEME.primaryColor,
               accentColor: themeData.theme_config?.light?.secondary || DEFAULT_THEME.accentColor,
               fontFamily: themeData.theme_config?.font_family || DEFAULT_THEME.fontFamily,
               animation: themeData.theme_config?.animation || DEFAULT_THEME.animation,
               borderRadius: themeData.theme_config?.border_radius ?? DEFAULT_THEME.borderRadius,
               userMsgColor: themeData.theme_config?.light?.foreground || DEFAULT_THEME.userMsgColor,
               chatBackground: themeData.theme_config?.light?.background || DEFAULT_THEME.chatBackground,
               botName: themeData.bot_name || DEFAULT_THEME.botName,
               welcomeMessage: themeData.welcome_message || DEFAULT_THEME.welcomeMessage,
               ctaMessage: themeData.cta_messages?.[0] || DEFAULT_THEME.ctaMessage,
               showLogo: themeData.show_logo ?? DEFAULT_THEME.showLogo,
               logoUrl: themeData.logo_url || DEFAULT_THEME.logoUrl,
               mode: themeData.theme_config?.mode || DEFAULT_THEME.mode,
               soundEnabled: themeData.theme_config?.sound_enabled ?? DEFAULT_THEME.soundEnabled,
           };
           setConfig(flatConfig);
           setDebouncedConfig(flatConfig);
        }
      } catch (error) {
        console.error("Failed to load chat theme", error);
      } finally {
        setLoading(false);
      }
    };

    loadTheme();
  }, [currentSlug, initialConfig]);

  useEffect(() => {
    const loadPublicWidget = async () => {
      if (!currentSlug) return;
      try {
        const data = await apiClient.get<any>(`/api/public/tenants/${currentSlug}/widget-config`, { tenantSlug: currentSlug });
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
          sound_enabled: cfg.soundEnabled
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
          await apiClient.updateChatTheme(currentSlug, payload);
      }
      if (!isAutoSave) toast.success("Personalización guardada correctamente.");
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

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <Tabs defaultValue="appearance" className="space-y-6">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6 overflow-x-auto">
                <TabsTrigger value="appearance" className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 py-3 font-semibold text-muted-foreground data-[state=active]:text-foreground">
                    Apariencia
                </TabsTrigger>
                <TabsTrigger value="content" className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 py-3 font-semibold text-muted-foreground data-[state=active]:text-foreground">
                    Contenido
                </TabsTrigger>
            </TabsList>

            <TabsContent value="appearance" className="space-y-6">
                <Card className="border-t-4 border-t-primary">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary"/> Estilo y Marca</CardTitle>
                        <CardDescription>Elegí una plantilla o personalizá cada detalle.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <Label>Temas Predefinidos</Label>
                            <div className="grid grid-cols-5 gap-2">
                                {PRESETS.map((preset) => (
                                    <button
                                        key={preset.name}
                                        onClick={() => applyPreset(preset)}
                                        className={cn(
                                            "h-10 rounded-full border-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                            config.primaryColor === preset.primary ? "border-primary ring-2 ring-primary/20" : "border-transparent"
                                        )}
                                        style={{ background: preset.primary }}
                                        title={preset.name}
                                    >
                                        <span className="sr-only">{preset.name}</span>
                                    </button>
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

                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                     <Label>Redondeo ({config.borderRadius}px)</Label>
                                </div>
                                <Slider
                                    value={[config.borderRadius]}
                                    min={0}
                                    max={24}
                                    step={2}
                                    onValueChange={(val) => handleChange('borderRadius', val[0])}
                                    className="py-2"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Animación de Entrada</Label>
                                <Select value={config.animation} onValueChange={(v) => handleChange('animation', v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Sin animación</SelectItem>
                                        <SelectItem value="pulse">Latido (Pulse)</SelectItem>
                                        <SelectItem value="bounce">Rebote (Bounce)</SelectItem>
                                        <SelectItem value="fade">Suave (Fade)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                             <div className="flex items-center gap-2">
                                <Volume2 className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor="sound-toggle" className="cursor-pointer">Sonidos de Chat</Label>
                             </div>
                             <Switch
                                id="sound-toggle"
                                checked={config.soundEnabled}
                                onCheckedChange={(c) => handleChange('soundEnabled', c)}
                             />
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="content" className="space-y-6">
                <Card>
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
                            <p className="text-xs text-muted-foreground">Aparece junto al botón flotante cuando está cerrado.</p>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

        <div className="sticky bottom-4">
             <Button className="w-full" onClick={() => performSave(config)} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Guardar Cambios
            </Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-8 h-fit space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
             <div>
                <h3 className="text-lg font-semibold flex items-center gap-2"><Monitor className="h-5 w-5"/> Vista Previa</h3>
                <p className="text-sm text-muted-foreground">Interactuá con el chat para probarlo.</p>
             </div>
             {hasUnsavedChanges && (
                 <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded animate-pulse">
                     Cambios sin guardar...
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
                Modo embed
            </Button>
            <div className="flex items-center gap-2 ml-auto">
                <Label className="text-xs text-muted-foreground">Preview abierto</Label>
                <Switch checked={previewOpen} onCheckedChange={setPreviewOpen} />
            </div>
        </div>

        <div className="flex items-center gap-2">
            <Button
                variant={previewDevice === 'mobile' ? "default" : "outline"}
                size="icon"
                onClick={() => setPreviewDevice('mobile')}
            >
                <Smartphone className="h-4 w-4" />
            </Button>
            <Button
                variant={previewDevice === 'tablet' ? "default" : "outline"}
                size="icon"
                onClick={() => setPreviewDevice('tablet')}
            >
                <Tablet className="h-4 w-4" />
            </Button>
            <Button
                variant={previewDevice === 'desktop' ? "default" : "outline"}
                size="icon"
                onClick={() => setPreviewDevice('desktop')}
            >
                <Monitor className="h-4 w-4" />
            </Button>
        </div>

        {previewMode === 'widget' ? (
            <div
                className={cn(
                    "mx-auto border-[8px] border-slate-900 shadow-2xl overflow-hidden relative ring-1 ring-slate-900/10 transition-all",
                    (publicEmbedSnippet || resolvedEmbedSnippet) ? "bg-transparent" : "bg-white",
                    previewDevice === 'mobile' && "h-[700px] w-full max-w-[420px] rounded-[3rem]",
                    previewDevice === 'tablet' && "h-[640px] w-full max-w-[560px] rounded-[2.5rem]",
                    previewDevice === 'desktop' && "h-[520px] w-full max-w-[720px] rounded-[1.75rem]"
                )}
            >
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-xl z-30"></div>

                 {!publicEmbedSnippet && !resolvedEmbedSnippet && (
                    <div className="absolute inset-0 bg-slate-100 z-0 flex flex-col items-center justify-center text-slate-300">
                        <div className="w-32 h-4 bg-slate-200 rounded mb-4"></div>
                        <div className="w-48 h-4 bg-slate-200 rounded mb-2"></div>
                        <div className="w-40 h-4 bg-slate-200 rounded"></div>
                    </div>
                 )}

                 <div className="relative z-20 w-full h-full">
                     {publicEmbedSnippet || resolvedEmbedSnippet ? (
                        <iframe
                          key={`${previewDevice}-${previewOpen}-${currentSlug || 'demo'}`}
                          title="Widget preview"
                          className="absolute inset-0 w-full h-full border-0 bg-transparent"
                          src={previewIframeSrc}
                          allow="clipboard-read; clipboard-write; autoplay"
                        />
                      ) : (
                        <WidgetPreview
                          key={`${previewDevice}-${previewOpen}-${currentSlug || 'demo'}`}
                          tenantSlug={currentSlug || 'demo'}
                          defaultOpen={previewOpen}
                          primaryColor={config.primaryColor}
                          accentColor={config.accentColor}
                          userMsgColor={config.userMsgColor}
                          chatBackground={config.chatBackground}
                          borderRadius={config.borderRadius}
                          ctaMessage={config.ctaMessage}
                          botName={config.botName}
                          logoUrl={config.logoUrl}
                          welcomeMessage={config.welcomeMessage}
                          logoAnimation={config.animation}
                          fontFamily={config.fontFamily}
                        />
                      )}
                 </div>
            </div>
        ) : (
            <Card className="border-0 shadow-xl bg-slate-950/20">
                <CardHeader>
                    <CardTitle className="text-base">Snippet de integración</CardTitle>
                    <CardDescription>Copiá y pegá este script en tu plataforma.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg bg-slate-950 text-slate-100 p-4 text-xs font-mono whitespace-pre-wrap">
                        {publicEmbedSnippet || resolvedEmbedSnippet}
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">Atributos activos</p>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(publicEmbedSnippet ? publicEmbedAttributes : embedAttributes).map(([key, value]) => (
                                <div key={key} className="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/5 p-2">
                                    <span className="font-medium text-foreground">{key}</span>
                                    <span>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
};

export default ChatCustomizer;
