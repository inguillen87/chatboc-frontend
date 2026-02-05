import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Check, RotateCcw, Upload, Copy } from 'lucide-react';
import WidgetPreview from './WidgetPreview';
import { toast } from 'sonner';

interface ChatCustomizerProps {
  tenantSlug: string;
  initialDraft: any;
  initialLive: any;
  onSaveDraft: (config: any) => Promise<void>;
  onPublish: () => Promise<void>;
  onReset: () => void;
  isSaving: boolean;
}

const ChatCustomizer: React.FC<ChatCustomizerProps> = ({
  tenantSlug,
  initialDraft,
  initialLive,
  onSaveDraft,
  onPublish,
  onReset,
  isSaving
}) => {
  const [config, setConfig] = useState<any>(initialDraft || {});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setConfig(initialDraft || {});
    setHasChanges(false);
  }, [initialDraft]);

  const handleChange = (section: string, key: string, value: any) => {
    setConfig((prev: any) => {
      const newConfig = { ...prev };
      if (!newConfig[section]) newConfig[section] = {};
      newConfig[section][key] = value;
      return newConfig;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    await onSaveDraft(config);
    setHasChanges(false);
  };

  const handleCopySnippet = () => {
    const snippet = `<script src="https://www.chatboc.ar/widget.js" data-tenant="${tenantSlug}" data-entity-token="TU_TOKEN_AQUI"></script>`;
    navigator.clipboard.writeText(snippet);
    toast.success("Snippet copiado al portapapeles");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-100px)]">
      {/* Editor Panel */}
      <div className="flex flex-col gap-6 overflow-y-auto pr-2 pb-10 scrollbar-thin">
        <div className="flex items-center justify-between">
           <div>
             <h2 className="text-2xl font-bold">Personalización</h2>
             <p className="text-muted-foreground text-sm">Diseña y configura tu widget.</p>
           </div>
           <div className="flex gap-2">
             <Button variant="outline" size="sm" onClick={onReset} disabled={isSaving}>
               <RotateCcw className="w-4 h-4 mr-2" /> Reset
             </Button>
             <Button onClick={handleSave} disabled={isSaving || !hasChanges} size="sm">
               {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
               Guardar Draft
             </Button>
             <Button variant="secondary" onClick={onPublish} disabled={isSaving} size="sm">
               Publicar
             </Button>
           </div>
        </div>

        <Tabs defaultValue="branding" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="branding">Marca</TabsTrigger>
            <TabsTrigger value="content">Contenido</TabsTrigger>
            <TabsTrigger value="behavior">Comportamiento</TabsTrigger>
            <TabsTrigger value="security">Seguridad</TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Identidad Visual</CardTitle>
                <CardDescription>Colores y logos de tu marca.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Nombre del Asistente</Label>
                  <Input
                    value={config.brand?.name || ''}
                    onChange={(e) => handleChange('brand', 'name', e.target.value)}
                    placeholder="Ej: Chatboc"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Color Primario</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={config.brand?.primaryColor || '#2563eb'}
                        className="w-12 p-1 cursor-pointer"
                        onChange={(e) => handleChange('brand', 'primaryColor', e.target.value)}
                      />
                      <Input
                        value={config.brand?.primaryColor || '#2563eb'}
                        onChange={(e) => handleChange('brand', 'primaryColor', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Color Acento</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={config.brand?.accentColor || '#22c55e'}
                        className="w-12 p-1 cursor-pointer"
                        onChange={(e) => handleChange('brand', 'accentColor', e.target.value)}
                      />
                      <Input
                        value={config.brand?.accentColor || '#22c55e'}
                        onChange={(e) => handleChange('brand', 'accentColor', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>URL del Logo</Label>
                  <Input
                    value={config.brand?.logoUrl || ''}
                    onChange={(e) => handleChange('brand', 'logoUrl', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Textos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Título de Bienvenida</Label>
                  <Input
                    value={config.copy?.welcomeTitle || ''}
                    onChange={(e) => handleChange('copy', 'welcomeTitle', e.target.value)}
                    placeholder="Hola 👋"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Subtítulo</Label>
                  <Input
                    value={config.copy?.welcomeSubtitle || ''}
                    onChange={(e) => handleChange('copy', 'welcomeSubtitle', e.target.value)}
                    placeholder="¿En qué puedo ayudarte?"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Placeholder del Input</Label>
                  <Input
                    value={config.copy?.inputPlaceholder || ''}
                    onChange={(e) => handleChange('copy', 'inputPlaceholder', e.target.value)}
                    placeholder="Escribe un mensaje..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Comportamiento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Iniciar Abierto</Label>
                  <Switch
                    checked={config.behavior?.startOpen || false}
                    onCheckedChange={(c) => handleChange('behavior', 'startOpen', c)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Requerir Nombre</Label>
                  <Switch
                    checked={config.behavior?.requireName || false}
                    onCheckedChange={(c) => handleChange('behavior', 'requireName', c)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Permitir Anónimos</Label>
                  <Switch
                    checked={config.behavior?.allowAnonymous !== false} // default true
                    onCheckedChange={(c) => handleChange('behavior', 'allowAnonymous', c)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Modo</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={config.behavior?.mode || 'auto'}
                    onChange={(e) => handleChange('behavior', 'mode', e.target.value)}
                  >
                    <option value="auto">Automático</option>
                    <option value="pyme">Pyme</option>
                    <option value="municipio">Municipio</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Seguridad</CardTitle>
                <CardDescription>Controla dónde se puede mostrar el widget.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Dominios Permitidos (uno por línea)</Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={(config.security?.allowedDomains || []).join('\n')}
                    onChange={(e) => handleChange('security', 'allowedDomains', e.target.value.split('\n').map((x: string) => x.trim()).filter(Boolean))}
                    placeholder="ejemplo.com"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Bloquear Dominios Desconocidos</Label>
                  <Switch
                    checked={config.security?.blockUnknownDomains || false}
                    onCheckedChange={(c) => handleChange('security', 'blockUnknownDomains', c)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integración</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-950 text-slate-50 p-4 rounded-md font-mono text-xs overflow-x-auto relative group">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleCopySnippet}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <pre className="whitespace-pre-wrap break-all">
{`<script src="https://www.chatboc.ar/widget.js"
  data-tenant="${tenantSlug}"
  data-entity-token="TOKEN_SECRETO">
</script>`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Panel */}
      <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-4 lg:p-8 flex items-center justify-center">
        <WidgetPreview config={config} tenantSlug={tenantSlug} />
      </div>
    </div>
  );
};

export default ChatCustomizer;
