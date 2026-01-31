import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Palette, MessageSquare, Image, Upload, Sparkles, Type } from 'lucide-react';
import WidgetPreview from '@/components/chat/WidgetPreview';
import { useTenant } from '@/context/TenantContext';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
};

const ChatCustomizer: React.FC<ChatCustomizerProps> = ({ initialConfig, onSave }) => {
  const { currentSlug } = useTenant();
  const [config, setConfig] = useState(initialConfig || DEFAULT_THEME);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    if (initialConfig) {
      setConfig({ ...DEFAULT_THEME, ...initialConfig });
    }
  }, [initialConfig]);

  const handleChange = (field: string, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      // Create local preview URL
      const url = URL.createObjectURL(file);
      handleChange('logoUrl', url);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (onSave) {
          await onSave(config);
      } else if (currentSlug) {
          // Default persistence logic if onSave not provided but context is available
          await apiClient.adminUpdateNotificationSettings(currentSlug, {
              widget_settings: config
          });
      } else {
          // Fallback simulation
          await new Promise(r => setTimeout(r, 1000));
      }
      toast.success("Personalización guardada correctamente.");
    } catch (error) {
      console.error("Save failed", error);
      toast.error("Error al guardar la personalización.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Settings Form */}
      <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5"/> Apariencia</CardTitle>
                <CardDescription>Personalizá los colores y estilo del chat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Color Primario</Label>
                        <div className="flex gap-2">
                            <Input
                                type="color"
                                value={config.primaryColor}
                                onChange={(e) => handleChange('primaryColor', e.target.value)}
                                className="w-12 h-10 p-1 cursor-pointer"
                            />
                            <Input
                                value={config.primaryColor}
                                onChange={(e) => handleChange('primaryColor', e.target.value)}
                                className="font-mono"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Color de Acento</Label>
                        <div className="flex gap-2">
                            <Input
                                type="color"
                                value={config.accentColor}
                                onChange={(e) => handleChange('accentColor', e.target.value)}
                                className="w-12 h-10 p-1 cursor-pointer"
                            />
                            <Input
                                value={config.accentColor}
                                onChange={(e) => handleChange('accentColor', e.target.value)}
                                className="font-mono"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                        <Label>Color Burbuja Usuario</Label>
                        <div className="flex gap-2">
                            <Input
                                type="color"
                                value={config.userMsgColor || config.accentColor}
                                onChange={(e) => handleChange('userMsgColor', e.target.value)}
                                className="w-12 h-10 p-1 cursor-pointer"
                            />
                            <Input
                                value={config.userMsgColor || config.accentColor}
                                onChange={(e) => handleChange('userMsgColor', e.target.value)}
                                className="font-mono"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Fondo del Chat</Label>
                        <div className="flex gap-2">
                            <Input
                                type="color"
                                value={config.chatBackground || '#ffffff'}
                                onChange={(e) => handleChange('chatBackground', e.target.value)}
                                className="w-12 h-10 p-1 cursor-pointer"
                            />
                            <Input
                                value={config.chatBackground || '#ffffff'}
                                onChange={(e) => handleChange('chatBackground', e.target.value)}
                                className="font-mono"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label>Redondeo de Bordes (Radius)</Label>
                            <span className="text-sm text-muted-foreground">{config.borderRadius}px</span>
                        </div>
                        <Slider
                            value={[config.borderRadius]}
                            min={0}
                            max={24}
                            step={2}
                            onValueChange={(val) => handleChange('borderRadius', val[0])}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-muted-foreground"/> Animación</Label>
                        <Select value={config.animation} onValueChange={(v) => handleChange('animation', v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Ninguna</SelectItem>
                                <SelectItem value="pulse">Latido (Pulse)</SelectItem>
                                <SelectItem value="bounce">Rebote (Bounce)</SelectItem>
                                <SelectItem value="fade">Aparición (Fade)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2"><Type className="h-4 w-4 text-muted-foreground"/> Tipografía</Label>
                        <Select value={config.fontFamily} onValueChange={(v) => handleChange('fontFamily', v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Inter">Inter (Estándar)</SelectItem>
                                <SelectItem value="Roboto">Roboto</SelectItem>
                                <SelectItem value="Montserrat">Montserrat</SelectItem>
                                <SelectItem value="Open Sans">Open Sans</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5"/> Contenido</CardTitle>
                <CardDescription>Define la identidad de tu asistente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Nombre del Bot</Label>
                    <Input
                        value={config.botName}
                        onChange={(e) => handleChange('botName', e.target.value)}
                        placeholder="Ej: Asistente de Ventas"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Mensaje de Bienvenida</Label>
                    <Input
                        value={config.welcomeMessage}
                        onChange={(e) => handleChange('welcomeMessage', e.target.value)}
                        placeholder="Mensaje inicial al abrir el chat"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Texto de Llamada (Burbuja)</Label>
                    <Input
                        value={config.ctaMessage}
                        onChange={(e) => handleChange('ctaMessage', e.target.value)}
                        placeholder="Ej: ¿Necesitás ayuda?"
                    />
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Image className="h-5 w-5"/> Logo</CardTitle>
                <CardDescription>Sube la imagen que aparecerá en el encabezado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {config.logoUrl ? (
                            <img src={config.logoUrl} alt="Logo" className="h-full w-full object-cover" />
                        ) : (
                            <Image className="h-8 w-8 text-muted-foreground" />
                        )}
                    </div>
                    <div className="flex-1">
                        <Label htmlFor="logo-upload" className="cursor-pointer">
                            <div className="flex items-center justify-center w-full h-10 px-4 py-2 border border-dashed rounded-md hover:bg-muted/50 transition-colors">
                                <Upload className="h-4 w-4 mr-2" /> Subir Imagen
                            </div>
                        </Label>
                        <Input
                            id="logo-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleLogoUpload}
                        />
                        <p className="text-xs text-muted-foreground mt-2">Recomendado: 200x200px PNG o JPG.</p>
                    </div>
                </div>
                <div className="flex items-center justify-between p-2 border rounded">
                    <Label htmlFor="show-logo">Mostrar Logo</Label>
                    <Switch
                        id="show-logo"
                        checked={config.showLogo}
                        onCheckedChange={(checked) => handleChange('showLogo', checked)}
                    />
                </div>
            </CardContent>
            <CardFooter>
                <Button className="w-full" onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar Personalización
                </Button>
            </CardFooter>
        </Card>
      </div>

      {/* Live Preview */}
      <div className="lg:sticky lg:top-8 h-fit space-y-4">
        <h3 className="text-lg font-semibold">Vista Previa en Vivo</h3>
        <p className="text-sm text-muted-foreground mb-4">Así verán tus clientes el chat en tu sitio web.</p>
        <div className="h-[600px] w-full max-w-[400px] mx-auto border-4 border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden bg-background relative">
             {/* Simulate Site Background */}
             <div className="absolute inset-0 bg-slate-50 flex items-center justify-center">
                 <p className="text-slate-300 font-bold text-4xl -rotate-12 select-none">TU SITIO WEB</p>
             </div>

             {/* Widget Preview Component */}
             <WidgetPreview
                tenantSlug={currentSlug || 'demo'}
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
        </div>
      </div>
    </div>
  );
};

export default ChatCustomizer;
