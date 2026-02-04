import React, { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { ApiError } from '@/utils/api';
import { IntegrationStatus } from '@/types/unified';
import type { CatalogColumn, CatalogMetadata, CatalogRow, TenantCatalog } from '@/types/catalog';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, RefreshCw, ExternalLink, CheckCircle2, AlertCircle,
  MessageSquare, Send, Tags, Eye, Palette, Link2, Smartphone, Search,
  ShoppingBag, MessageCircle, Mail, Settings, ArrowRight, FileSpreadsheet,
  Save, Pencil, FileDown
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import ChatCustomizer from '@/components/admin/ChatCustomizer';
import OrderDispatchSettings from '@/components/admin/OrderDispatchSettings';
import CatalogUploadWizard from '@/components/admin/catalog/CatalogUploadWizard';
import CatalogSpreadsheetEditor from '@/components/admin/catalog/CatalogSpreadsheetEditor';
import ChannelPreview from '@/components/integrations/ChannelPreview';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import IntegrationPreviewDialog from './IntegrationPreviewDialog';
import { cn } from '@/lib/utils';

const INTEGRATION_LOGOS: Record<string, string> = {
  mercadolibre: "https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/5.21.22/mercadolibre/logo__large_plus.png",
  tiendanube: "https://d26lpennugtm8s.cloudfront.net/assets/common/img/logos/header/logo_tiendanube_header.svg",
  whatsapp: "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg",
  telegram: "https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg",
  email: "https://cdn-icons-png.flaticon.com/512/281/281769.png"
};

const CHANNELS = [
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'telegram', label: 'Telegram', icon: Send },
    { id: 'mercadolibre', label: 'MercadoLibre', icon: ShoppingBag },
    { id: 'tiendanube', label: 'Tiendanube', icon: ShoppingBag },
    { id: 'email', label: 'Email', icon: Mail },
];

const IntegracionesPage = () => {
  const { currentSlug } = useTenant();
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedMappingProvider, setSelectedMappingProvider] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogData, setCatalogData] = useState<TenantCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftColumns, setDraftColumns] = useState<CatalogColumn[]>([]);
  const [draftRows, setDraftRows] = useState<CatalogRow[]>([]);
  const [catalogMetadata, setCatalogMetadata] = useState<CatalogMetadata>({});

  // UI State
  const [activeTab, setActiveTab] = useState("integrations");
  const [selectedChannel, setSelectedChannel] = useState("whatsapp");

  // Notification Settings State
  const [ownerPhone, setOwnerPhone] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [notifyTelegram, setNotifyTelegram] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(true);

  useEffect(() => {
    if (currentSlug) {
      loadIntegrations();
      loadSettings();
      loadCatalog();
    }
  }, [currentSlug]);

  const normalizeCatalog = (data: TenantCatalog | any): TenantCatalog => {
    const metadata = data?.metadata ?? data?.catalog ?? {
      title: data?.title,
      description: data?.description,
      banner_url: data?.banner_url,
      enabled: data?.enabled,
      is_public: data?.is_public,
      share_on_intent: data?.share_on_intent,
      prefer_pdf_on_whatsapp: data?.prefer_pdf_on_whatsapp,
      default_message: data?.default_message,
    };
    const links = data?.links ?? {
      view_url: data?.view_url,
      download_url: data?.download_url,
      download_url_pdf: data?.download_url_pdf,
      download_url_json: data?.download_url_json,
      download_url_xlsx: data?.download_url_xlsx,
      download_url_csv: data?.download_url_csv,
      view_label: data?.view_label,
      download_label: data?.download_label,
      history_url: data?.history_url,
      history_label: data?.history_label,
      template_url: data?.template_url,
      template_label: data?.template_label,
      upload_label: data?.upload_label,
      edit_label: data?.edit_label,
      publish_label: data?.publish_label,
      share_label: data?.share_label,
      share_whatsapp_label: data?.share_whatsapp_label,
      share_copy_label: data?.share_copy_label,
      share_hint: data?.share_hint,
      cta_label: data?.cta_label,
    };
    return {
      status: data?.status ?? data?.catalog_status ?? null,
      has_pdf: data?.has_pdf ?? null,
      updated_at: data?.updated_at ?? null,
      published_at: data?.published_at ?? null,
      view_url: data?.view_url ?? null,
      download_url: data?.download_url ?? null,
      download_url_json: data?.download_url_json ?? null,
      metadata,
      links,
      columns: data?.columns ?? null,
      rows: data?.rows ?? null,
      draft: data?.draft ?? null,
    };
  };

  const loadCatalog = async () => {
    if (!currentSlug) return;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const data = await apiClient.adminGetCatalog(currentSlug);
      const normalized = normalizeCatalog(data);
      setCatalogData(normalized);
      setCatalogMetadata(normalized.metadata ?? {});
    } catch (error: any) {
      console.error('Error loading catalog', error);
      if (error instanceof ApiError && [403, 404, 405].includes(error.status)) {
        setCatalogData(null);
        setCatalogMetadata({});
        setCatalogError(null);
      } else {
        setCatalogError(error?.message ?? null);
      }
    } finally {
      setCatalogLoading(false);
    }
  };

  const openCatalogEditor = () => {
    const columns = catalogData?.draft?.columns ?? catalogData?.columns ?? [];
    const rows = catalogData?.draft?.rows ?? catalogData?.rows ?? [];
    setDraftColumns(columns.map((column) => ({ ...column })));
    setDraftRows(rows.map((row) => ({ ...row, cells: { ...row.cells } })));
    setEditorOpen(true);
  };

  const updateCatalogMetadata = (field: keyof CatalogMetadata, value: any) => {
    setCatalogMetadata((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveDraft = async () => {
    if (!currentSlug) return;
    try {
      const fallbackColumns = catalogData?.draft?.columns ?? catalogData?.columns ?? [];
      const fallbackRows = catalogData?.draft?.rows ?? catalogData?.rows ?? [];
      const columnsToSave = draftColumns.length ? draftColumns : fallbackColumns;
      const rowsToSave = draftRows.length ? draftRows : fallbackRows;
      const hasEmptyColumnLabel = columnsToSave.some((column) => !column.label?.trim());
      if (hasEmptyColumnLabel) {
        toast.error('Completá el nombre de todas las columnas');
        return;
      }
      const payload = {
        metadata: catalogMetadata,
        columns: columnsToSave,
        rows: rowsToSave,
      };
      const response = await apiClient.adminUpdateCatalogDraft(currentSlug, payload);
      const normalized = normalizeCatalog(response);
      setCatalogData(normalized);
      setCatalogMetadata(normalized.metadata ?? {});
      toast.success('Borrador guardado');
      setEditorOpen(false);
    } catch (error: any) {
      console.error('Error saving catalog draft', error);
      toast.error(error?.message ?? 'No se pudo guardar el borrador');
    }
  };

  const handlePublishCatalog = async () => {
    if (!currentSlug) return;
    try {
      const response = await apiClient.adminPublishCatalog(currentSlug);
      const normalized = normalizeCatalog(response);
      setCatalogData(normalized);
      toast.success('Catálogo publicado');
    } catch (error: any) {
      console.error('Error publishing catalog', error);
      toast.error(error?.message ?? 'No se pudo publicar el catálogo');
    }
  };

  const handleAddColumn = () => {
    const key = `col_${Date.now()}`;
    setDraftColumns((prev) => [...prev, { key, label: key }]);
    setDraftRows((prev) =>
      prev.map((row) => ({
        ...row,
        cells: { ...row.cells, [key]: "" },
      })),
    );
  };

  const handleUpdateColumn = (index: number, column: CatalogColumn) => {
    setDraftColumns((prev) => prev.map((col, idx) => (idx === index ? column : col)));
  };

  const handleDeleteColumn = (index: number) => {
    const column = draftColumns[index];
    if (!column) return;
    setDraftColumns((prev) => prev.filter((_, idx) => idx !== index));
    setDraftRows((prev) =>
      prev.map((row) => {
        const nextCells = { ...row.cells };
        delete nextCells[column.key];
        return { ...row, cells: nextCells };
      }),
    );
  };

  const handleAddRow = () => {
    const id = `row_${Date.now()}`;
    const baseCells = draftColumns.reduce<Record<string, unknown>>((acc, column) => {
      acc[column.key] = "";
      return acc;
    }, {});
    setDraftRows((prev) => [...prev, { id, cells: baseCells }]);
  };

  const handleDeleteRow = (rowId: CatalogRow["id"]) => {
    setDraftRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const handleUpdateCell = (rowId: CatalogRow["id"], columnKey: string, value: string) => {
    setDraftRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, cells: { ...row.cells, [columnKey]: value } } : row,
      ),
    );
  };

  const handleCommitCell = async (rowId: CatalogRow["id"], columnKey: string, value: string) => {
    if (!currentSlug) return;
    const resolvedRowId =
      typeof rowId === "number"
        ? rowId
        : typeof rowId === "string" && rowId.trim() && !rowId.startsWith("row_")
          ? rowId
          : null;
    if (!resolvedRowId) return;
    try {
      await apiClient.adminUpdateCatalogItem(currentSlug, resolvedRowId, {
        [columnKey]: value,
      });
    } catch (error) {
      console.error("Error updating catalog item", error);
    }
  };

  const catalogViewUrl = catalogData?.links?.view_url ?? catalogData?.view_url ?? null;
  const catalogDownloadUrl = catalogData?.links?.download_url ?? catalogData?.download_url ?? null;
  const catalogViewLabel = catalogData?.links?.view_label ?? null;
  const catalogDownloadLabel = catalogData?.links?.download_label ?? null;
  const catalogShareLabel = catalogData?.links?.share_label ?? null;
  const catalogShareWhatsappLabel = catalogData?.links?.share_whatsapp_label ?? null;
  const catalogShareCopyLabel = catalogData?.links?.share_copy_label ?? null;

  const loadSettings = async () => {
    try {
      if (!currentSlug) return;
      const settings = await apiClient.adminGetNotificationSettings(currentSlug);
      if (settings) {
        setOwnerPhone(settings.owner_phone || '');
        setTelegramChatId(settings.telegram_chat_id || '');
        setNotifyWhatsapp(settings.notification_settings?.whatsapp ?? false);
        setNotifyTelegram(settings.notification_settings?.telegram ?? false);
        setNotifyEmail(settings.notification_settings?.email ?? true);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      if (!currentSlug) return;
      const data = await apiClient.adminGetIntegrations(currentSlug);
      setIntegrations(data);
    } catch (error) {
      console.error('Error loading integrations:', error);
      // Fallback mock data
      setIntegrations([
        { provider: 'mercadolibre', connected: false },
        { provider: 'tiendanube', connected: true, lastSync: new Date().toISOString() },
        { provider: 'whatsapp', connected: true }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getIntegrationStatus = (provider: string) => {
      return integrations.find(i => i.provider === provider) || { provider, connected: false };
  };

  const handleConnect = async (provider: string) => {
    if (!currentSlug) return;
    try {
      const response = await apiClient.adminConnectIntegration(currentSlug, provider);
      if (response.url) {
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;

        window.open(response.url, `Connect ${provider}`, `width=${width},height=${height},top=${top},left=${left}`);
      } else {
          toast.error("No se pudo iniciar la conexión.");
      }
    } catch (error: any) {
        console.error('Connection failed:', error);
        toast.error("Error al conectar con la plataforma.");
    }
  };

  const handleSync = async (provider: string) => {
    if (!currentSlug) return;
    setSyncing(provider);
    try {
       await apiClient.adminSyncIntegration(currentSlug, provider);
       toast.success("Sincronización iniciada correctamente.");
       await loadIntegrations();
    } catch (error) {
      console.error('Sync failed', error);
      toast.error("Error al sincronizar.");
    } finally {
      setSyncing(null);
    }
  };

  const handleSaveNotifications = async () => {
      if (!currentSlug) return;
      setSavingSettings(true);
      try {
        await apiClient.adminUpdateNotificationSettings(currentSlug, {
            owner_phone: ownerPhone,
            telegram_chat_id: telegramChatId,
            notification_settings: {
                whatsapp: notifyWhatsapp,
                telegram: notifyTelegram,
                email: notifyEmail
            }
        });
        toast.success('Configuración guardada correctamente.');
      } catch (error) {
          console.error('Failed to save settings', error);
          toast.error('No se pudo guardar la configuración.');
      } finally {
          setSavingSettings(false);
      }
  };

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Integraciones y Canales</h1>
        <p className="text-muted-foreground">
          Gestioná tus canales de venta, personalizá tu chat y configurá notificaciones.
        </p>
      </div>

      {currentSlug && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6 overflow-x-auto">
                <TabsTrigger value="integrations" className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 py-3 font-semibold text-muted-foreground data-[state=active]:text-foreground">
                    Integraciones
                </TabsTrigger>
                <TabsTrigger value="customization" className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 py-3 font-semibold text-muted-foreground data-[state=active]:text-foreground">
                    Apariencia del Chat
                </TabsTrigger>
                <TabsTrigger value="catalog" className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 py-3 font-semibold text-muted-foreground data-[state=active]:text-foreground">
                    Gestión de Catálogo
                </TabsTrigger>
            </TabsList>

            <TabsContent value="customization">
                <ChatCustomizer />
            </TabsContent>

             <TabsContent value="catalog" className="space-y-6">
                {catalogLoading && (
                  <Card>
                    <CardContent className="p-6 flex items-center gap-3 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" /> Cargando catálogo...
                    </CardContent>
                  </Card>
                )}

                {catalogError && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{catalogError}</AlertDescription>
                  </Alert>
                )}

                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">Estado del catálogo</CardTitle>
                        {catalogData?.status && (
                          <div className="flex items-center gap-2">
                            <Badge variant={catalogData?.has_pdf ? "default" : "secondary"}>{catalogData.status}</Badge>
                          </div>
                        )}
                        {catalogData?.updated_at && (
                          <CardDescription>
                            {formatDistanceToNow(new Date(catalogData.updated_at), { locale: es, addSuffix: true })}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {catalogViewUrl && catalogViewLabel && (
                          <Button asChild variant="outline" size="sm">
                            <a href={catalogViewUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" /> {catalogViewLabel}
                            </a>
                          </Button>
                        )}
                        {catalogDownloadUrl && catalogData?.has_pdf && catalogDownloadLabel && (
                          <Button asChild variant="outline" size="sm">
                            <a href={catalogDownloadUrl} target="_blank" rel="noreferrer">
                              <FileDown className="mr-2 h-4 w-4" /> {catalogDownloadLabel}
                            </a>
                          </Button>
                        )}
                        {catalogViewUrl && catalogShareCopyLabel && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(catalogViewUrl || "")
                                .then(() => toast.success('Enlace copiado'))
                                .catch((err) => {
                                  console.error('Copy failed', err);
                                  toast.error('No se pudo copiar el enlace');
                                });
                            }}
                          >
                            {catalogShareCopyLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {catalogViewUrl && (
                      <div className="flex flex-col gap-2">
                        <Label>Enlace público</Label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input value={catalogViewUrl} readOnly />
                          {catalogShareCopyLabel && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(catalogViewUrl || "")
                                  .then(() => toast.success('Enlace copiado'))
                                  .catch((err) => {
                                    console.error('Copy failed', err);
                                    toast.error('No se pudo copiar el enlace');
                                  });
                              }}
                            >
                              {catalogShareCopyLabel}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Título</Label>
                        <Input
                          value={catalogMetadata.title ?? ''}
                          onChange={(event) => updateCatalogMetadata('title', event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Descripción</Label>
                        <Input
                          value={catalogMetadata.description ?? ''}
                          onChange={(event) => updateCatalogMetadata('description', event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Banner</Label>
                      <Input
                        value={catalogMetadata.banner_url ?? ''}
                        onChange={(event) => updateCatalogMetadata('banner_url', event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mensaje por defecto</Label>
                      <Input
                        value={catalogMetadata.default_message ?? ''}
                        onChange={(event) => updateCatalogMetadata('default_message', event.target.value)}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <Label>Catálogo habilitado</Label>
                        </div>
                        <Switch
                          checked={Boolean(catalogMetadata.enabled)}
                          onCheckedChange={(value) => updateCatalogMetadata('enabled', value)}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <Label>Público</Label>
                        </div>
                        <Switch
                          checked={Boolean(catalogMetadata.is_public)}
                          onCheckedChange={(value) => updateCatalogMetadata('is_public', value)}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <Label>Compartir en intención</Label>
                        </div>
                        <Switch
                          checked={Boolean(catalogMetadata.share_on_intent)}
                          onCheckedChange={(value) => updateCatalogMetadata('share_on_intent', value)}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <Label>Preferir PDF en WhatsApp</Label>
                        </div>
                        <Switch
                          checked={Boolean(catalogMetadata.prefer_pdf_on_whatsapp)}
                          onCheckedChange={(value) => updateCatalogMetadata('prefer_pdf_on_whatsapp', value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button variant="outline" onClick={openCatalogEditor}>
                        <Pencil className="mr-2 h-4 w-4" /> {catalogData?.links?.edit_label ?? 'Editar en planilla'}
                      </Button>
                      <Button variant="outline" onClick={handleSaveDraft}>
                        <Save className="mr-2 h-4 w-4" /> {catalogData?.links?.upload_label ?? 'Guardar borrador'}
                      </Button>
                      <Button onClick={handlePublishCatalog}>
                        {catalogData?.links?.publish_label ?? 'Publicar'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {catalogViewUrl && catalogShareLabel && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{catalogShareLabel}</CardTitle>
                      {catalogData?.links?.share_hint && (
                        <CardDescription>{catalogData.links.share_hint}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {catalogShareWhatsappLabel && (
                          <Button asChild variant="outline">
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(catalogViewUrl)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {catalogShareWhatsappLabel}
                            </a>
                          </Button>
                        )}
                        {catalogShareCopyLabel && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(catalogViewUrl || "")
                                .then(() => toast.success('Enlace copiado'))
                                .catch((err) => {
                                  console.error('Copy failed', err);
                                  toast.error('No se pudo copiar el enlace');
                                });
                            }}
                          >
                            {catalogShareCopyLabel}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                    <div className="p-6 flex flex-col md:flex-row items-center gap-6">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-blue-50 border border-blue-100">
                            <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                        </div>
                        <div className="flex-1 space-y-1 text-center md:text-left">
                            <h3 className="font-semibold text-lg">Importación Masiva</h3>
                            <p className="text-sm text-muted-foreground">
                                Actualizá tus productos subiendo un archivo Excel o CSV. Detectamos automáticamente columnas y precios.
                            </p>
                        </div>
                        <Button onClick={() => setUploadOpen(true)} className="w-full md:w-auto">
                            Iniciar Asistente <ArrowRight className="ml-2 h-4 w-4"/>
                        </Button>
                    </div>
                </Card>

                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
                        <DialogHeader className="sr-only">
                            <DialogTitle>Importación de catálogo</DialogTitle>
                            <DialogDescription>
                                Asistente para revisar y confirmar la vista previa del catálogo antes de importarlo.
                            </DialogDescription>
                        </DialogHeader>
                        <CatalogUploadWizard
                          tenantSlug={currentSlug || ""}
                          onFinish={() => setUploadOpen(false)}
                          templateUrl={catalogData?.links?.template_url}
                          templateLabel={catalogData?.links?.template_label}
                        />
                    </DialogContent>
                </Dialog>

                <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
                  <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Editor de catálogo</DialogTitle>
                      <DialogDescription>Administrá columnas y filas del catálogo.</DialogDescription>
                    </DialogHeader>
                    <CatalogSpreadsheetEditor
                      columns={draftColumns}
                      rows={draftRows}
                      onAddColumn={handleAddColumn}
                      onUpdateColumn={handleUpdateColumn}
                      onDeleteColumn={handleDeleteColumn}
                      onAddRow={handleAddRow}
                      onDeleteRow={handleDeleteRow}
                      onUpdateCell={handleUpdateCell}
                      onCommitCell={handleCommitCell}
                    />
                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setEditorOpen(false)}>
                        Cerrar
                      </Button>
                      <Button onClick={handleSaveDraft}>
                        Guardar borrador
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
            </TabsContent>

            <TabsContent value="integrations" className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-8 items-start">

                    {/* Left: Settings Panel */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Canales Disponibles</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col space-y-2">
                                {CHANNELS.map((channel) => {
                                    const status = getIntegrationStatus(channel.id);
                                    const Icon = channel.icon;
                                    return (
                                        <button
                                            key={channel.id}
                                            onClick={() => setSelectedChannel(channel.id)}
                                            className={cn(
                                                "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all border",
                                                selectedChannel === channel.id
                                                    ? "bg-primary/10 text-foreground border-primary/40 shadow-sm"
                                                    : "border-transparent hover:border-border hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon className="h-4 w-4" />
                                                {channel.label}
                                            </div>
                                            {status.connected && (
                                                <span className="flex h-2 w-2 rounded-full bg-green-500 ring-2 ring-background" />
                                            )}
                                        </button>
                                    )
                                })}
                            </CardContent>
                        </Card>

                        <Card className="bg-muted/40">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Settings className="h-4 w-4"/> Configuración Global
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-xs text-muted-foreground">
                                    Ajustes de notificaciones y despacho aplicables a todos los canales.
                                </p>
                                <OrderDispatchSettings />
                            </CardContent>
                        </Card>

                        <Card className="min-h-[520px]">
                            <CardHeader>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <img
                                            src={INTEGRATION_LOGOS[selectedChannel]}
                                            alt={selectedChannel}
                                            className="h-10 w-10 object-contain"
                                            onError={(e) => { e.currentTarget.style.display='none'; }}
                                        />
                                        <div>
                                            <CardTitle className="capitalize">{CHANNELS.find(c => c.id === selectedChannel)?.label}</CardTitle>
                                            <CardDescription>
                                                {getIntegrationStatus(selectedChannel).connected ? 'Conectado y operativo' : 'No conectado'}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    {getIntegrationStatus(selectedChannel).connected ? (
                                        <Badge className="bg-green-600">Activo</Badge>
                                    ) : (
                                        <Badge variant="secondary">Inactivo</Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {selectedChannel === 'email' ? (
                                    <div className="space-y-5">
                                        <p className="text-sm text-muted-foreground">Configurá las notificaciones por correo electrónico.</p>
                                        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                            <div className="space-y-0.5">
                                                <Label className="text-base">Notificaciones por Email</Label>
                                                <p className="text-xs text-muted-foreground">Resumen diario y backup de seguridad.</p>
                                            </div>
                                            <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
                                        </div>
                                        <div className="flex justify-end">
                                            <Button onClick={handleSaveNotifications} disabled={savingSettings}>
                                                Guardar Preferencias
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {getIntegrationStatus(selectedChannel).connected ? (
                                            <div className="space-y-5">
                                                <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
                                                    <div className="flex items-center gap-2 font-medium mb-1">
                                                        <CheckCircle2 className="h-4 w-4" /> Conexión Establecida
                                                    </div>
                                                    <p>Tu cuenta está vinculada correctamente. Los mensajes y pedidos se sincronizarán automáticamente.</p>
                                                </div>

                                                {(selectedChannel === 'mercadolibre' || selectedChannel === 'tiendanube') && (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <Button variant="outline" onClick={() => {
                                                            setSelectedMappingProvider(selectedChannel);
                                                            setMappingOpen(true);
                                                        }}>
                                                            <Eye className="mr-2 h-4 w-4" /> Previsualizar Sync
                                                        </Button>
                                                        <Button variant="outline" onClick={() => handleSync(selectedChannel)} disabled={!!syncing}>
                                                            {syncing === selectedChannel ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                                                            Sincronizar Ahora
                                                        </Button>
                                                    </div>
                                                )}

                                                <Separator />

                                                <div className="space-y-2">
                                                    <Label>Acciones de Zona de Peligro</Label>
                                                    <Button variant="outline" className="w-full justify-start text-destructive hover:bg-destructive/10">
                                                        Desconectar Cuenta
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <p className="text-sm text-muted-foreground">
                                                    Conectá tu cuenta de {CHANNELS.find(c => c.id === selectedChannel)?.label} para centralizar la gestión.
                                                </p>
                                                <div className="grid gap-4">
                                                    {selectedChannel === 'whatsapp' && (
                                                        <div className="space-y-2">
                                                            <Label>Número de Teléfono</Label>
                                                            <Input placeholder="+549..." />
                                                        </div>
                                                    )}
                                                    <Button onClick={() => handleConnect(selectedChannel)} className="w-full">
                                                        <Link2 className="mr-2 h-4 w-4" /> Conectar Ahora
                                                    </Button>
                                                    <Button variant="ghost" className="w-full">
                                                        Leer documentación
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Additional Config Blocks based on Channel */}
                        {(selectedChannel === 'whatsapp' || selectedChannel === 'telegram') && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Alertas y Notificaciones</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label>Notificar nuevos pedidos</Label>
                                        <Switch
                                            checked={selectedChannel === 'whatsapp' ? notifyWhatsapp : notifyTelegram}
                                            onCheckedChange={selectedChannel === 'whatsapp' ? setNotifyWhatsapp : setNotifyTelegram}
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <Button size="sm" variant="secondary" onClick={handleSaveNotifications}>Actualizar Alertas</Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Right: Persistent Preview */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-6 space-y-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <Eye className="h-5 w-5 text-muted-foreground" />
                                Vista Previa
                            </h3>
                            <Card className="border border-white/10 bg-gradient-to-br from-slate-950/30 via-slate-900/30 to-slate-900/60 shadow-xl">
                                <CardContent className="p-6">
                                    <div className="origin-top transform transition-all duration-300">
                                        <ChannelPreview
                                            channel={selectedChannel as any}
                                            product={selectedChannel === 'mercadolibre' ? { name: 'Producto Demo', price: '$15.000' } : undefined}
                                        />
                                    </div>
                                    <p className="text-center text-xs text-muted-foreground mt-4">
                                        Así verán los mensajes tus clientes en {CHANNELS.find(c => c.id === selectedChannel)?.label}.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                </div>
            </TabsContent>
        </Tabs>
      )}

      {/* Mapping Dialog (Reused) */}
      <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
          <IntegrationPreviewDialog
             provider={selectedMappingProvider}
             tenantSlug={currentSlug}
             onClose={() => setMappingOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IntegracionesPage;
