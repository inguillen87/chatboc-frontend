// src/pages/Integracion.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiFetch, ApiError, resolveTenantSlug } from "@/utils/api";
import { useUser } from "@/hooks/useUser";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Check,
  Settings,
  RefreshCw,
  Layout,
  MessageCircle,
  Link as LinkIcon,
  Menu as MenuIcon,
  Phone,
  Code,
  Copy
} from "lucide-react";
import { TenantConfigBundle } from "@/types/TenantConfig";
import { tenantService } from "@/services/tenantService";
import MenuBuilder from "@/components/tenant/MenuBuilder";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Integracion = () => {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useUser();
  const [config, setConfig] = useState<TenantConfigBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [copiado, setCopiado] = useState<"iframe" | "script" | null>(null);

  const tenantSlug = useMemo(() => resolveTenantSlug(user?.tenantSlug || (user as any)?.tenant_slug), [user]);

  const loadConfig = useCallback(async () => {
    if (!tenantSlug) return;
    try {
      setLoading(true);
      const data = await tenantService.getTenantConfig(tenantSlug);
      setConfig(data);
    } catch (error) {
      console.error("Failed to load tenant config", error);
      toast.error("Error cargando configuración del tenant");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    if (!userLoading && tenantSlug) {
      loadConfig();
    }
  }, [userLoading, tenantSlug, loadConfig]);

  const handleSave = async (section: keyof TenantConfigBundle | "configs", data: any) => {
    if (!tenantSlug || !config) return;

    setSaving(true);
    try {
      const payload: Partial<TenantConfigBundle> = {};

      if (section === "configs") {
         payload.configs = { ...config.configs, ...data };
      } else if (section === "tenant") {
         payload.tenant = { ...config.tenant, ...data };
      } else {
         // @ts-ignore
         payload[section] = data;
      }

      const updated = await tenantService.updateTenantConfig(tenantSlug, payload);
      setConfig(updated);
      toast.success("Cambios guardados correctamente");
    } catch (error) {
      console.error("Failed to save config", error);
      toast.error("Error al guardar cambios");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignWhatsapp = async () => {
    if (!tenantSlug) return;
    try {
      const result = await tenantService.assignWhatsappNumber(tenantSlug);
      toast.success(`Número asignado: ${result.phone_number}`);
      loadConfig();
    } catch (error) {
      toast.error("No hay números disponibles o ocurrió un error");
    }
  };

  const generateEmbedCode = (type: "script" | "iframe") => {
      if (!config) return "";
      const base = (import.meta.env.VITE_WIDGET_API_BASE || "https://chatboc.ar").replace(/\/+$/, "");
      const widgetScriptUrl = `${base}/widget.js`;
      const tenant = config.tenant.slug;

      if (type === "script") {
          return `<script src="${widgetScriptUrl}" data-tenant="${tenant}" data-shadow-dom="true"></script>`;
      } else {
          return `<iframe src="${base}/iframe?tenant=${tenant}" style="border:none; position:fixed; bottom:20px; right:20px; z-index:9999; width:400px; height:600px;"></iframe>`;
      }
  };

  const copiarCodigo = async (type: "script" | "iframe") => {
      const text = generateEmbedCode(type);
      try {
          await navigator.clipboard.writeText(text);
          setCopiado(type);
          toast.success("Código copiado");
          setTimeout(() => setCopiado(null), 2000);
      } catch (e) {
          toast.error("No se pudo copiar");
      }
  };

  if (userLoading || loading) {
    return <div className="p-8 text-center">Cargando configuración...</div>;
  }

  if (!config) {
    return <div className="p-8 text-center text-destructive">No se pudo cargar la configuración del tenant.</div>;
  }

  // Helpers to safely access nested config
  // We assume the structure returned by backend matches TenantConfigBundle
  // If backend uses "default" keys inside configs, adapt here.
  const getWidgetConfig = () => config.configs.widget["default"] || {};
  const getContactsConfig = () => config.configs.contacts["default"] || {};
  const getLinksConfig = () => config.configs.links["default"] || { items: [] };
  const getMenuConfig = () => config.configs.menu["default"] || { version: 1, main_menu: [], submenus: {} };

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center">
            <Settings className="mr-3 h-8 w-8" />
            Integración y Configuración
          </h1>
          <p className="mt-2 text-muted-foreground">
            Gestiona la apariencia, menús y canales de tu organización ({config.tenant.nombre}).
          </p>
        </div>
        <Button onClick={loadConfig} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Recargar
        </Button>
      </header>

      {(config.tenant.plan === 'pro' || config.tenant.plan === 'full') ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
            <TabsTrigger value="general" className="py-3">
              <Layout className="mr-2 h-4 w-4" /> General
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="py-3">
              <Phone className="mr-2 h-4 w-4" /> WhatsApp
            </TabsTrigger>
            <TabsTrigger value="widget" className="py-3">
              <MessageCircle className="mr-2 h-4 w-4" /> Widget
            </TabsTrigger>
            <TabsTrigger value="menus" className="py-3">
              <MenuIcon className="mr-2 h-4 w-4" /> Menús
            </TabsTrigger>
            <TabsTrigger value="contacts" className="py-3">
              <LinkIcon className="mr-2 h-4 w-4" /> Contactos
            </TabsTrigger>
          </TabsList>

          {/* --- GENERAL TAB --- */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Información del Tenant</CardTitle>
                <CardDescription>Datos básicos de la organización.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre / Razón Social</Label>
                    <Input
                      value={config.tenant.nombre}
                      onChange={(e) => handleSave("tenant", { nombre: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug (Identificador)</Label>
                    <Input value={config.tenant.slug} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Input value={config.tenant.tipo} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Input value={config.tenant.plan} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Color Primario</Label>
                    <div className="flex gap-2">
                       <Input
                          type="color"
                          className="w-12 p-1"
                          value={config.tenant.color_primario || "#000000"}
                          onChange={(e) => handleSave("tenant", { color_primario: e.target.value })}
                       />
                       <Input
                          value={config.tenant.color_primario || ""}
                          onChange={(e) => handleSave("tenant", { color_primario: e.target.value })}
                       />
                    </div>
                  </div>
                  <div className="space-y-2">
                      <Label>Logo URL</Label>
                      <Input
                          value={config.tenant.logo_url || ""}
                          onChange={(e) => handleSave("tenant", { logo_url: e.target.value })}
                      />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- WHATSAPP TAB --- */}
          <TabsContent value="whatsapp">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de WhatsApp</CardTitle>
                <CardDescription>Gestiona el número asignado a tu cuenta.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {config.whatsapp?.has_number ? (
                  <div className="rounded-md border bg-green-50 p-4 dark:bg-green-900/20">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <Check className="h-5 w-5" />
                      <span className="font-semibold">Número Asignado Correctamente</span>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Número:</span>
                        <span className="font-mono">{config.whatsapp.phone_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sender ID:</span>
                        <span className="font-mono">{config.whatsapp.sender_id}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border bg-yellow-50 p-4 dark:bg-yellow-900/20">
                    <p className="text-yellow-800 dark:text-yellow-200 mb-4">
                      Tu organización aún no tiene un número de WhatsApp oficial asignado.
                    </p>
                    <Button onClick={handleAssignWhatsapp}>
                      Asignar número automáticamente
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- WIDGET TAB --- */}
          <TabsContent value="widget">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                 <CardHeader>
                    <CardTitle>Personalización del Widget</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    <div className="space-y-2">
                       <Label>Título de Bienvenida</Label>
                       <Input
                          value={getWidgetConfig().welcome_title || ""}
                          onChange={(e) => handleSave("configs", { widget: { default: { ...getWidgetConfig(), welcome_title: e.target.value } } })}
                       />
                    </div>
                    <div className="space-y-2">
                       <Label>Subtítulo</Label>
                       <Input
                          value={getWidgetConfig().welcome_subtitle || ""}
                          onChange={(e) => handleSave("configs", { widget: { default: { ...getWidgetConfig(), welcome_subtitle: e.target.value } } })}
                       />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                       <Label>Abrir por defecto</Label>
                       <Switch
                          checked={getWidgetConfig().default_open}
                          onCheckedChange={(checked) => handleSave("configs", { widget: { default: { ...getWidgetConfig(), default_open: checked } } })}
                       />
                    </div>
                 </CardContent>
              </Card>

              <Card>
                <CardHeader>
                    <CardTitle>Código de Integración</CardTitle>
                    <CardDescription>Copia y pega este código en tu sitio web.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-md bg-muted p-4 font-mono text-xs overflow-x-auto">
                        {generateEmbedCode("script")}
                    </div>
                    <Button className="w-full" onClick={() => copiarCodigo("script")}>
                        {copiado === "script" ? <Check className="mr-2 h-4 w-4"/> : <Copy className="mr-2 h-4 w-4"/>}
                        Copiar Script (Recomendado)
                    </Button>
                    <div className="rounded-md bg-muted p-4 font-mono text-xs overflow-x-auto mt-4">
                        {generateEmbedCode("iframe")}
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => copiarCodigo("iframe")}>
                        {copiado === "iframe" ? <Check className="mr-2 h-4 w-4"/> : <Copy className="mr-2 h-4 w-4"/>}
                        Copiar Iframe
                    </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* --- MENUS TAB --- */}
          <TabsContent value="menus">
            <MenuBuilder
              value={getMenuConfig()}
              onChange={(newMenu) => handleSave("configs", { menu: { default: newMenu } })}
            />
          </TabsContent>

          {/* --- CONTACTS TAB --- */}
          <TabsContent value="contacts">
              <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                      <CardHeader>
                          <CardTitle>Información de Contacto</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          <div className="space-y-2">
                              <Label>Teléfono</Label>
                              <Input
                                  value={getContactsConfig().telefono || ""}
                                  onChange={(e) => handleSave("configs", { contacts: { default: { ...getContactsConfig(), telefono: e.target.value } } })}
                              />
                          </div>
                          <div className="space-y-2">
                              <Label>WhatsApp (Humano)</Label>
                              <Input
                                  value={getContactsConfig().whatsapp_humano || ""}
                                  onChange={(e) => handleSave("configs", { contacts: { default: { ...getContactsConfig(), whatsapp_humano: e.target.value } } })}
                              />
                          </div>
                           <div className="space-y-2">
                              <Label>Email</Label>
                              <Input
                                  value={getContactsConfig().email || ""}
                                  onChange={(e) => handleSave("configs", { contacts: { default: { ...getContactsConfig(), email: e.target.value } } })}
                              />
                          </div>
                      </CardContent>
                  </Card>

                  {/* Future implementation: Links builder */}
                  <Card>
                      <CardHeader>
                          <CardTitle>Links y Trámites</CardTitle>
                          <CardDescription>Próximamente: Editor de enlaces directos.</CardDescription>
                      </CardHeader>
                      <CardContent>
                          <p className="text-muted-foreground text-sm">Esta funcionalidad estará disponible en la próxima actualización.</p>
                      </CardContent>
                  </Card>
              </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información del Tenant</CardTitle>
              <CardDescription>Datos básicos de la organización.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre / Razón Social</Label>
                  <Input value={config.tenant.nombre} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Input value={config.tenant.plan} disabled className="bg-muted" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
                <CardTitle>Código de Integración</CardTitle>
                <CardDescription>Copia y pega este código en tu sitio web.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="rounded-md bg-muted p-4 font-mono text-xs overflow-x-auto">
                    {generateEmbedCode("script")}
                </div>
                <Button className="w-full" onClick={() => copiarCodigo("script")}>
                    {copiado === "script" ? <Check className="mr-2 h-4 w-4"/> : <Copy className="mr-2 h-4 w-4"/>}
                    Copiar Script (Recomendado)
                </Button>
            </CardContent>
          </Card>
          <Card className="border-primary">
            <CardHeader>
              <CardTitle>Mejora tu Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground p-8">
                <p>Mejora tu plan a PRO o FULL para acceder a la personalización del widget, menús interactivos, integración con WhatsApp y mucho más.</p>
                <Button className="mt-4" onClick={() => navigate(`/${tenantSlug}/perfil`)}>Ver Planes</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Integracion;
