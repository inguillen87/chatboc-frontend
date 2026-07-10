import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { ApiError } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
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
  Save, Pencil, FileDown, PhoneCall, Clipboard, Sparkles, ShieldCheck,
  KeyRound, Copy, Bot, QrCode
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import ChatCustomizer from '@/components/admin/ChatCustomizer';
import OrderDispatchSettings from '@/components/admin/OrderDispatchSettings';
import CatalogUploadWizard from '@/components/admin/catalog/CatalogUploadWizard';
import CatalogSpreadsheetEditor from '@/components/admin/catalog/CatalogSpreadsheetEditor';
import ChannelPreview from '@/components/integrations/ChannelPreview';
import WhatsappTechProviderOnboarding from '@/components/integrations/WhatsappTechProviderOnboarding';
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
import {
  buildIntegrationPlanLockView,
  lockMatchesChannel,
  type IntegrationPlanLockView,
} from './integrationPlanLock';

const CHANNEL_GUIDANCE: Record<string, { title: string; detail: string; outcome: string }> = {
  whatsapp: {
    title: "WhatsApp Business",
    detail: "Autorización oficial con Meta, sender productivo, menú y pruebas antes de operar.",
    outcome: "Atención, ventas y casos trazables desde WhatsApp.",
  },
  telegram: {
    title: "Telegram",
    detail: "Canal complementario para avisos, soporte y comunidades.",
    outcome: "Notificaciones y respuestas por chat.",
  },
  mercadolibre: {
    title: "MercadoLibre",
    detail: "Sincroniza catálogo, consultas y pedidos para responder desde un solo lugar.",
    outcome: "Ventas y stock con seguimiento centralizado.",
  },
  tiendanube: {
    title: "Tiendanube",
    detail: "Conecta ecommerce, carrito y catálogo para cerrar pedidos con contexto.",
    outcome: "Pedidos online preparados para despacho.",
  },
  mercadopago: {
    title: "Cobros y checkout",
    detail: "Configura MercadoPago para webviews, marketplace y pedidos conversacionales con pago seguro.",
    outcome: "Checkout listo para cobrar pedidos desde WhatsApp, widget y marketplace.",
  },
  email: {
    title: "Email",
    detail: "Respaldo operativo para notificaciones, comprobantes y alertas internas.",
    outcome: "Confirmaciones y reportes por correo.",
  },
};

const INTEGRATION_LOGOS: Record<string, string> = {
  mercadolibre: "https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/5.21.22/mercadolibre/logo__large_plus.png",
  tiendanube: "https://d26lpennugtm8s.cloudfront.net/assets/common/img/logos/header/logo_tiendanube_header.svg",
  whatsapp: "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg",
  mercadopago: "https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/6.6.92/mercadopago/logo__large.png",
  telegram: "https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg",
  email: "https://cdn-icons-png.flaticon.com/512/281/281769.png"
};

const CHANNELS = [
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'telegram', label: 'Telegram', icon: Send },
    { id: 'mercadolibre', label: 'MercadoLibre', icon: ShoppingBag },
    { id: 'tiendanube', label: 'Tiendanube', icon: ShoppingBag },
    { id: 'mercadopago', label: 'Cobros', icon: KeyRound },
    { id: 'email', label: 'Email', icon: Mail },
];

type QuickMenuPreviewItem = {
  id?: string;
  label: string;
  description?: string;
  sector?: string;
  rubro?: string;
  tenant_slug?: string;
};

type WhatsappSandboxState = {
  customerWhatsapp: string;
  joinPhrase: string;
  rubro: string;
  brief: string;
  testMessage: string;
};

type WhatsappSandboxResult = {
  mode: "remote" | "local";
  message: string;
  deeplink?: string | null;
  copyText?: string | null;
  previewText?: string | null;
  qrUrl?: string | null;
  requestId?: string | null;
  joinNumber?: string | null;
  joinPhrase?: string | null;
  instructions?: string[];
  quickMenu?: QuickMenuPreviewItem[];
};

type WhatsappSandboxSetup = {
  contractVersion?: string | null;
  mode?: string | null;
  requestId?: string | null;
  deeplink?: string | null;
  copyText?: string | null;
  previewText?: string | null;
  qrUrl?: string | null;
  joinNumber?: string | null;
  joinPhrase?: string | null;
  instructions: string[];
  quickMenu: QuickMenuPreviewItem[];
  testEndpoint?: string | null;
  sessionEndpoint?: string | null;
};

type PaymentGatewayStatus = {
  provider?: string | null;
  configured: boolean;
  accessTokenMasked?: string | null;
  status?: string | null;
  testedAt?: string | null;
  ok?: boolean | null;
  details?: Record<string, unknown> | null;
};

const DEFAULT_WHATSAPP_SANDBOX: WhatsappSandboxState = {
  customerWhatsapp: "",
  joinPhrase: "",
  rubro: "",
  brief: "",
  testMessage: "",
};

const normalizeQuickMenuPreviewItem = (item: unknown, index: number): QuickMenuPreviewItem | null => {
  if (!item) return null;
  if (typeof item === "string") {
    const label = item.trim();
    return label ? { id: `menu-${index}`, label } : null;
  }
  if (typeof item !== "object" || Array.isArray(item)) return null;
  const source = item as Record<string, unknown>;
  const label = [source.label, source.title, source.text, source.texto]
    .find((value) => typeof value === "string" && value.trim());
  if (typeof label !== "string" || !label.trim()) return null;
  const readText = (key: string) =>
    typeof source[key] === "string" && String(source[key]).trim()
      ? String(source[key]).trim()
      : undefined;
  return {
    id: readText("id") || readText("key") || `menu-${index}`,
    label: label.trim(),
    description: readText("description") || readText("subtitle") || readText("detail"),
    sector: readText("sector"),
    rubro: readText("rubro") || readText("rubro_slug") || readText("rubro_key"),
    tenant_slug: readText("tenant_slug") || readText("tenantSlug"),
  };
};

const readTextValue = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

const normalizeSandboxInstructions = (source: unknown): string[] => {
  if (!Array.isArray(source)) return [];
  return source
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (!item || typeof item !== "object" || Array.isArray(item)) return "";
      const record = item as Record<string, unknown>;
      return readTextValue(record.label, record.title, record.text, record.description) || "";
    })
    .filter(Boolean);
};

const normalizeSandboxPreviewText = (source: unknown): string | null => {
  if (typeof source === "string" && source.trim()) return source.trim();
  if (Array.isArray(source)) {
    const lines = source
      .map(normalizeSandboxPreviewText)
      .filter((value): value is string => Boolean(value));
    return lines.length ? lines.join("\n") : null;
  }
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  return readTextValue(
    record.copy_text,
    record.copyText,
    record.message,
    record.text,
    record.body,
    record.label,
    record.title,
  );
};

export const normalizeSandboxContract = (response: any): WhatsappSandboxSetup => {
  const whatsappSandbox = response?.whatsapp_sandbox ?? {};
  const sandbox = response?.sandbox ?? whatsappSandbox?.sandbox ?? {};
  const twilio = response?.twilio ?? {};
  const session = response?.session ?? {};
  const channel = response?.channel ?? {};
  const test = response?.test ?? {};
  const preview = response?.preview ?? {};
  const responseInstructions = normalizeSandboxInstructions(response?.instructions);
  const instructions = responseInstructions.length
    ? responseInstructions
    : normalizeSandboxInstructions(sandbox?.instructions).length
      ? normalizeSandboxInstructions(sandbox?.instructions)
      : normalizeSandboxInstructions(whatsappSandbox?.instructions);
  const quickMenu = [
    response?.demo_context?.quick_menu,
    session?.demo_context?.quick_menu,
    response?.quick_menu,
    whatsappSandbox?.quick_menu,
    sandbox?.quick_menu,
  ]
    .flatMap((source) => (Array.isArray(source) ? source : []))
    .map(normalizeQuickMenuPreviewItem)
    .filter((item): item is QuickMenuPreviewItem => Boolean(item));

  return {
    contractVersion: readTextValue(response?.contract_version, response?.contractVersion),
    mode: readTextValue(
      response?.mode,
      response?.delivery_mode,
      response?.frontend_contract?.mode,
      response?.frontend_contract?.render_as,
    ),
    requestId: readTextValue(response?.request_id, response?.requestId),
    deeplink: readTextValue(
      response?.deeplink,
      response?.wa_deeplink,
      preview?.deeplink,
      preview?.wa_deeplink,
      sandbox?.wa_deeplink,
      sandbox?.deeplink,
      whatsappSandbox?.wa_deeplink,
      twilio?.wa_deeplink,
      channel?.wa_deeplink,
    ),
    copyText: readTextValue(
      response?.copy_text,
      response?.copyText,
      preview?.copy_text,
      preview?.copyText,
      test?.copy_text,
      sandbox?.copy_text,
      whatsappSandbox?.copy_text,
    ),
    previewText: normalizeSandboxPreviewText(
      response?.preview || response?.message_preview || test?.preview || whatsappSandbox?.preview,
    ),
    qrUrl: readTextValue(
      response?.qr_url,
      response?.qrUrl,
      preview?.qr_url,
      preview?.qrUrl,
      sandbox?.qr_url,
      sandbox?.qrUrl,
      whatsappSandbox?.qr_url,
      twilio?.qr_url,
      channel?.qr_url,
    ),
    joinNumber: readTextValue(
      response?.display_number,
      response?.phone_number,
      sandbox?.join_number,
      sandbox?.sandbox_number,
      sandbox?.display_number,
      twilio?.join_number,
      twilio?.sandbox_number,
      response?.join_number,
      response?.sandbox_number,
      whatsappSandbox?.display_number,
      channel?.display_number,
      channel?.sandbox_number,
    ),
    joinPhrase: readTextValue(
      sandbox?.join_phrase,
      sandbox?.joinPhrase,
      whatsappSandbox?.join_phrase,
      twilio?.join_phrase,
      response?.join_phrase,
      session?.join_phrase,
    ),
    instructions,
    quickMenu,
    testEndpoint: readTextValue(
      test?.endpoint,
      sandbox?.test_endpoint,
      response?.test_endpoint,
      response?.frontend_contract?.test_endpoint,
      response?.links?.test_endpoint,
      response?.links?.sandbox_test,
    ),
    sessionEndpoint: readTextValue(
      response?.session_endpoint,
      response?.links?.sandbox_session,
      response?.links?.session_endpoint,
      response?.frontend_contract?.action_endpoint,
    ),
  };
};

const IntegracionesPage = () => {
  const { currentSlug } = useTenant();
  const [searchParams] = useSearchParams();
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
  const requestedChannel = searchParams.get("channel");
  const requestedAction = searchParams.get("action");

  // Notification Settings State
  const [ownerPhone, setOwnerPhone] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [notifyTelegram, setNotifyTelegram] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [widgetQuickMenu, setWidgetQuickMenu] = useState<QuickMenuPreviewItem[]>([]);
  const [whatsappSandbox, setWhatsappSandbox] =
    useState<WhatsappSandboxState>(DEFAULT_WHATSAPP_SANDBOX);
  const [sandboxSetup, setSandboxSetup] = useState<WhatsappSandboxSetup | null>(null);
  const [sandboxSetupLoading, setSandboxSetupLoading] = useState(false);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<WhatsappSandboxResult | null>(null);
  const [integrationPlanLock, setIntegrationPlanLock] = useState<IntegrationPlanLockView | null>(null);
  const [channelPlanLocks, setChannelPlanLocks] = useState<Record<string, IntegrationPlanLockView>>({});
  const [paymentGateway, setPaymentGateway] = useState<PaymentGatewayStatus | null>(null);
  const [paymentToken, setPaymentToken] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentTesting, setPaymentTesting] = useState(false);

  useEffect(() => {
    if (currentSlug) {
      loadIntegrations();
      loadSettings();
      loadCatalog();
      loadWidgetQuickMenu();
      loadWhatsappSandboxSetup();
      loadPaymentGateway();
    }
  }, [currentSlug]);

  useEffect(() => {
    if (!requestedChannel) return;
    const normalizedChannel = requestedChannel.trim().toLowerCase();
    if (!CHANNELS.some((channel) => channel.id === normalizedChannel)) return;
    setActiveTab("integrations");
    setSelectedChannel(normalizedChannel);
  }, [requestedChannel]);

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
      status_label: data?.status_label,
      updated_label: data?.updated_label,
      public_link_label: data?.public_link_label,
      title_label: data?.title_label,
      description_label: data?.description_label,
      banner_label: data?.banner_label,
      default_message_label: data?.default_message_label,
      enabled_label: data?.enabled_label,
      is_public_label: data?.is_public_label,
      share_on_intent_label: data?.share_on_intent_label,
      prefer_pdf_on_whatsapp_label: data?.prefer_pdf_on_whatsapp_label,
      upload_label: data?.upload_label,
      edit_label: data?.edit_label,
      publish_label: data?.publish_label,
      preview_label: data?.preview_label,
      editor_title: data?.editor_title,
      editor_description: data?.editor_description,
      editor_close_label: data?.editor_close_label,
      editor_save_label: data?.editor_save_label,
      add_row_label: data?.add_row_label,
      add_column_label: data?.add_column_label,
      empty_rows_label: data?.empty_rows_label,
      empty_columns_label: data?.empty_columns_label,
      upload_section_title: data?.upload_section_title,
      upload_section_description: data?.upload_section_description,
      upload_section_button_label: data?.upload_section_button_label,
      share_label: data?.share_label,
      share_whatsapp_label: data?.share_whatsapp_label,
      share_copy_label: data?.share_copy_label,
      share_hint: data?.share_hint,
      search_placeholder: data?.search_placeholder,
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

  const loadWidgetQuickMenu = async () => {
    if (!currentSlug) return;
    try {
      const data = await apiClient.get<any>(
        `/api/public/tenants/${encodeURIComponent(currentSlug)}/widget-config`,
        {
          tenantSlug: currentSlug,
          skipAuth: true,
          omitCredentials: true,
          omitEntityToken: true,
          omitChatSessionId: true,
          isWidgetRequest: true,
        },
      );
      const sources = [
        data?.quick_menu,
        data?.onboarding?.quick_menu,
        data?.widget?.quick_menu,
        data?.builder_config?.quick_menu,
      ];
      const items = sources
        .flatMap((source) => (Array.isArray(source) ? source : []))
        .map(normalizeQuickMenuPreviewItem)
        .filter((item): item is QuickMenuPreviewItem => Boolean(item));
      const unique = new Map<string, QuickMenuPreviewItem>();
      items.forEach((item) => {
        const key = (item.id || item.label).toLowerCase();
        if (!unique.has(key)) unique.set(key, item);
      });
      setWidgetQuickMenu(Array.from(unique.values()));
    } catch (error) {
      setWidgetQuickMenu([]);
    }
  };

  const loadWhatsappSandboxSetup = async () => {
    if (!currentSlug) return;
    const fallbackSessionEndpoint = `/api/v2/tenants/${encodeURIComponent(currentSlug)}/whatsapp/sandbox-session`;
    setSandboxSetupLoading(true);
    try {
      const response = await apiClient.get<any>(
        `/api/v2/tenants/${encodeURIComponent(currentSlug)}/whatsapp/sandbox-setup`,
        {
          tenantSlug: currentSlug,
          suppressPanel401Redirect: true,
        },
      );
      const setup = normalizeSandboxContract(response);
      setSandboxSetup({
        ...setup,
        sessionEndpoint: setup.sessionEndpoint || fallbackSessionEndpoint,
      });
      setWhatsappSandbox((prev) => ({
        ...prev,
        customerWhatsapp:
          prev.customerWhatsapp ||
          (setup.joinNumber ? setup.joinNumber.replace(/^whatsapp:/i, "") : ""),
        joinPhrase: prev.joinPhrase || setup.joinPhrase || "",
        rubro:
          prev.rubro ||
          readTextValue(response?.demo_context?.rubro, response?.demo_context?.sector) ||
          "",
        testMessage:
          prev.testMessage ||
          readTextValue(
            response?.demo_context?.test_message,
            response?.test?.sample_message,
            response?.test?.message,
            response?.sandbox?.sample_message,
            response?.sample_message,
          ) ||
          "",
      }));
    } catch (error) {
      setSandboxSetup({
        instructions: [],
        quickMenu: [],
        sessionEndpoint: fallbackSessionEndpoint,
      });
    } finally {
      setSandboxSetupLoading(false);
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

  const getCatalogDraftEndpoint = () => {
    const links = (catalogData?.links ?? {}) as Record<string, unknown>;
    const draft = (catalogData?.draft ?? {}) as Record<string, unknown>;
    const endpoint =
      links.draft_endpoint ||
      links.draft_url ||
      links.save_draft_endpoint ||
      draft.endpoint ||
      draft.save_endpoint;
    return typeof endpoint === "string" && endpoint.trim() ? endpoint.trim() : null;
  };

  const persistCatalogDraftLocally = (payload: Record<string, unknown>) => {
    if (!currentSlug) return;
    const key = `chatboc_catalog_draft:${currentSlug}`;
    safeLocalStorage.setItem(
      key,
      JSON.stringify({
        ...payload,
        saved_at: new Date().toISOString(),
        source: "frontend_local_draft",
      }),
    );
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
      const draftEndpoint = getCatalogDraftEndpoint();
      if (!draftEndpoint) {
        persistCatalogDraftLocally(payload);
        setCatalogData((prev) =>
          prev
            ? {
                ...prev,
                draft: {
                  ...(prev.draft ?? {}),
                  columns: columnsToSave,
                  rows: rowsToSave,
                },
                metadata: catalogMetadata,
              }
            : prev,
        );
        toast.success('Borrador guardado en este navegador');
        setEditorOpen(false);
        return;
      }

      const response = await apiClient.put<TenantCatalog>(draftEndpoint, payload, {
        tenantSlug: currentSlug,
      });
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

  const normalizePaymentGatewayStatus = (data: any): PaymentGatewayStatus => ({
    provider: readTextValue(data?.provider) || "mercadopago",
    configured: Boolean(data?.configured || data?.ok || ["configured", "ok", "active"].includes(String(data?.status || "").toLowerCase())),
    accessTokenMasked: readTextValue(data?.access_token_masked, data?.masked_token, data?.account),
    status: readTextValue(data?.status) || (data?.configured ? "configured" : "missing"),
    testedAt: readTextValue(data?.tested_at, data?.lastSync, data?.last_sync_at),
    ok: typeof data?.ok === "boolean" ? data.ok : null,
    details: data?.details && typeof data.details === "object" && !Array.isArray(data.details) ? data.details : null,
  });

  const loadPaymentGateway = async () => {
    if (!currentSlug) return;
    setPaymentLoading(true);
    try {
      const data = await apiClient.adminGetMercadoPagoCredentials(currentSlug);
      setPaymentGateway(normalizePaymentGatewayStatus(data));
      setPaymentToken("");
      clearIntegrationPlanLock("mercadopago");
    } catch (error: any) {
      const status = error instanceof ApiError ? error.status : Number(error?.status || 0);
      if (status === 403) {
        rememberIntegrationPlanLock(error, "mercadopago", "mercadopago_checkout");
        setPaymentGateway(null);
      } else {
        console.error("Error loading MercadoPago credentials", error);
        setPaymentGateway(null);
      }
    } finally {
      setPaymentLoading(false);
    }
  };

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
      clearIntegrationPlanLock();
    } catch (error) {
      console.error('Error loading integrations:', error);
      const lock = rememberIntegrationPlanLock(error, undefined, "marketplace_sync");
      setIntegrations([]);
      if (lock) {
        toast.info(`${lock.featureLabel}: requiere plan ${lock.requiredPlan}.`);
        return;
      }
      toast.error('No se pudieron cargar las integraciones reales del tenant.');
    } finally {
      setLoading(false);
    }
  };

  const getIntegrationStatus = (provider: string) => {
      return integrations.find(i => i.provider === provider) || { provider, connected: false };
  };

  const rememberIntegrationPlanLock = (source: unknown, provider?: string, fallbackFeatureId = "marketplace_sync") => {
    const lock = buildIntegrationPlanLockView(source, fallbackFeatureId);
    if (!lock) return null;
    setIntegrationPlanLock(lock);
    if (provider) {
      setChannelPlanLocks((prev) => ({ ...prev, [provider]: lock }));
    }
    return lock;
  };

  const clearIntegrationPlanLock = (provider?: string) => {
    if (!provider) {
      setIntegrationPlanLock(null);
      setChannelPlanLocks({});
      return;
    }
    setChannelPlanLocks((prev) => {
      if (!prev[provider]) return prev;
      const next = { ...prev };
      delete next[provider];
      return next;
    });
  };

  const selectedChannelPlanLock =
    channelPlanLocks[selectedChannel] ||
    (lockMatchesChannel(integrationPlanLock, selectedChannel) ? integrationPlanLock : null);

  const handleConnect = async (provider: string) => {
    if (!currentSlug) return;
    try {
      const response = await apiClient.adminConnectIntegration(currentSlug, provider);
      clearIntegrationPlanLock(provider);
      const connectUrl = response.redirect_url || response.url;
      const isTwilioTechProvider =
        provider === 'whatsapp' &&
        (response.provider === 'twilio_tech_provider' ||
          response.frontend_contract?.render_as === 'twilio_tech_provider_onboarding');

      if (isTwilioTechProvider && !connectUrl) {
        toast.info("Revisa el panel de onboarding de WhatsApp: faltan pasos de plataforma antes de abrir Meta.");
        return;
      }

      if (connectUrl) {
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;

        window.open(connectUrl, `Connect ${provider}`, `width=${width},height=${height},top=${top},left=${left}`);
        if (isTwilioTechProvider) {
          toast.success("Registro embebido de WhatsApp iniciado. Al finalizar, actualiza el estado del sender.");
        }
      } else {
          toast.error("No se pudo iniciar la conexión.");
      }
    } catch (error: any) {
        console.error('Connection failed:', error);
        const status = error instanceof ApiError ? error.status : Number(error?.status || 0);
        if (status === 409) {
          const body = error instanceof ApiError ? error.body : null;
          const missing = Array.isArray(body?.missing) ? body.missing.filter(Boolean).join(", ") : "";
          const reason = body?.reason_code === "missing_twilio_meta_platform_env"
            ? "Faltan variables Twilio/Meta para habilitar el onboarding oficial."
            : "La plataforma necesita configuracion antes de conectar.";
          toast.error(missing ? `${reason} Faltante: ${missing}` : reason);
          return;
        }
        if (status === 503) {
          toast.error("La plataforma no está configurada todavía. Contactá soporte para habilitarla.");
          return;
        }
        if (status === 403) {
          const lock = rememberIntegrationPlanLock(
            error,
            provider,
            provider === "whatsapp" ? "whatsapp_sender_management" : "marketplace_sync",
          );
          toast.error(
            lock
              ? `${lock.featureLabel}: requiere plan ${lock.requiredPlan}.`
              : "Tu plan actual no incluye esta integracion. Contacta a ventas para habilitarla.",
          );
          return;
        }
        toast.error("Error al conectar con la plataforma.");
    }
  };

  const handleSync = async (provider: string) => {
    if (!currentSlug) return;
    setSyncing(provider);
    try {
       await apiClient.adminSyncIntegration(currentSlug, provider);
       clearIntegrationPlanLock(provider);
       toast.success("Sincronización iniciada correctamente.");
       await loadIntegrations();
    } catch (error: any) {
      console.error('Sync failed', error);
      const status = error instanceof ApiError ? error.status : Number(error?.status || 0);
      if (status === 403) {
        const lock = rememberIntegrationPlanLock(error, provider, "marketplace_sync");
        toast.error(
          lock
            ? `${lock.featureLabel}: requiere plan ${lock.requiredPlan}.`
            : "Tu plan actual no permite sincronizar marketplaces externos.",
        );
        return;
      }
      toast.error("Error al sincronizar.");
    } finally {
      setSyncing(null);
    }
  };

  const handleSavePaymentGateway = async () => {
    if (!currentSlug) return;
    const token = paymentToken.trim();
    if (!token) {
      toast.error("Pegá el access token de MercadoPago antes de guardar.");
      return;
    }
    setPaymentSaving(true);
    try {
      const data = await apiClient.adminSetMercadoPagoCredentials(currentSlug, token);
      setPaymentGateway(normalizePaymentGatewayStatus(data));
      setPaymentToken("");
      clearIntegrationPlanLock("mercadopago");
      toast.success("MercadoPago configurado");
      await loadIntegrations();
    } catch (error: any) {
      const status = error instanceof ApiError ? error.status : Number(error?.status || 0);
      if (status === 403) {
        const lock = rememberIntegrationPlanLock(error, "mercadopago", "mercadopago_checkout");
        toast.error(
          lock
            ? `${lock.featureLabel}: requiere plan ${lock.requiredPlan}.`
            : "Tu plan actual no permite configurar cobros.",
        );
        return;
      }
      console.error("Error saving MercadoPago credentials", error);
      toast.error("No se pudo guardar MercadoPago.");
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleTestPaymentGateway = async () => {
    if (!currentSlug) return;
    if (!paymentGateway?.configured) {
      toast.error("Primero guardá el access token de MercadoPago.");
      return;
    }
    setPaymentTesting(true);
    try {
      const data = await apiClient.adminTestMercadoPagoCredentials(currentSlug);
      setPaymentGateway(normalizePaymentGatewayStatus(data));
      clearIntegrationPlanLock("mercadopago");
      toast.success("MercadoPago validado");
      await loadIntegrations();
    } catch (error: any) {
      const status = error instanceof ApiError ? error.status : Number(error?.status || 0);
      if (status === 403) {
        const lock = rememberIntegrationPlanLock(error, "mercadopago", "mercadopago_checkout");
        toast.error(
          lock
            ? `${lock.featureLabel}: requiere plan ${lock.requiredPlan}.`
            : "Tu plan actual no permite probar cobros.",
        );
        return;
      }
      console.error("Error testing MercadoPago credentials", error);
      toast.error("MercadoPago no respondió correctamente.");
    } finally {
      setPaymentTesting(false);
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

  const updateWhatsappSandbox = (field: keyof WhatsappSandboxState, value: string) => {
    setWhatsappSandbox((prev) => ({ ...prev, [field]: value }));
    setSandboxResult(null);
  };

  const buildSandboxMessage = () =>
    [
      whatsappSandbox.joinPhrase.trim() || sandboxSetup?.joinPhrase || "",
      whatsappSandbox.testMessage.trim(),
      whatsappSandbox.brief.trim() ? `Brief: ${whatsappSandbox.brief.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

  const buildSandboxDeeplink = () => {
    const digits = (
      whatsappSandbox.customerWhatsapp ||
      sandboxSetup?.joinNumber ||
      sandboxResult?.joinNumber ||
      ""
    ).replace(/[^\d]/g, "");
    if (!digits) return null;
    const text = buildSandboxMessage();
    return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  };

  const buildSandboxInstructionsText = () => {
    if (sandboxResult?.copyText) return sandboxResult.copyText;
    const instructions = sandboxResult?.instructions?.length
      ? sandboxResult.instructions
      : sandboxSetup?.instructions || [];
    const lines = [
      sandboxResult?.joinNumber || sandboxSetup?.joinNumber
        ? `Numero de prueba: ${sandboxResult?.joinNumber || sandboxSetup?.joinNumber}`
        : "",
      sandboxResult?.joinPhrase || sandboxSetup?.joinPhrase || whatsappSandbox.joinPhrase.trim()
        ? `Frase: ${sandboxResult?.joinPhrase || sandboxSetup?.joinPhrase || whatsappSandbox.joinPhrase.trim()}`
        : "",
      ...instructions,
      whatsappSandbox.testMessage.trim() ? `Mensaje inicial: ${whatsappSandbox.testMessage.trim()}` : "",
      whatsappSandbox.brief.trim() ? `Brief: ${whatsappSandbox.brief.trim()}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  };

  const copySandboxBrief = async () => {
    const text = buildSandboxInstructionsText() || buildSandboxMessage();
    if (!text) {
      toast.error("Completá la frase clave o el mensaje de prueba");
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success("Instrucciones copiadas");
  };

  const handlePrepareWhatsappSandbox = async () => {
    if (!currentSlug) return;
    const deeplink = buildSandboxDeeplink();

    const payload = {
      tenant_slug: currentSlug,
      whatsapp: whatsappSandbox.customerWhatsapp.trim() || undefined,
      join_phrase: whatsappSandbox.joinPhrase.trim(),
      rubro: whatsappSandbox.rubro.trim(),
      brief: whatsappSandbox.brief.trim(),
      test_message: whatsappSandbox.testMessage.trim(),
      menu_preview: widgetQuickMenu.slice(0, 6),
      quick_menu_received_by_frontend: widgetQuickMenu.slice(0, 6),
      source: "tenant_integrations_panel",
    };

    setSandboxLoading(true);
    try {
      const testEndpoint =
        sandboxSetup?.testEndpoint ||
        sandboxSetup?.sessionEndpoint ||
        `/api/v2/tenants/${encodeURIComponent(currentSlug)}/whatsapp/sandbox-session`;
      const response = await apiClient.post<any>(
        testEndpoint,
        payload,
        { tenantSlug: currentSlug, suppressPanel401Redirect: true },
      );
      const testResult = normalizeSandboxContract(response);
      const remoteDeeplink = testResult.deeplink || deeplink;
      const remoteJoinNumber = testResult.joinNumber || sandboxSetup?.joinNumber || null;
      const remoteJoinPhrase = testResult.joinPhrase || sandboxSetup?.joinPhrase || null;
      const remoteInstructions = testResult.instructions.length
        ? testResult.instructions
        : sandboxSetup?.instructions || [];
      const remoteMenu = testResult.quickMenu.length
        ? testResult.quickMenu
        : sandboxSetup?.quickMenu || [];
      if (remoteJoinPhrase) {
        setWhatsappSandbox((prev) => ({ ...prev, joinPhrase: prev.joinPhrase || remoteJoinPhrase }));
      }
      setSandboxResult({
        mode: "remote",
        message: "Prueba lista: el backend registró la sesión sandbox y devolvió enlace, texto copiable y preview sin enviar mensajes reales.",
        deeplink: remoteDeeplink,
        copyText: testResult.copyText,
        previewText: testResult.previewText,
        qrUrl: testResult.qrUrl || sandboxSetup?.qrUrl || null,
        requestId: testResult.requestId,
        joinNumber: remoteJoinNumber,
        joinPhrase: remoteJoinPhrase,
        instructions: remoteInstructions,
        quickMenu: remoteMenu.length ? remoteMenu : undefined,
      });
      toast.success("Demo WhatsApp preparada");
      if (remoteDeeplink) {
        window.open(remoteDeeplink, "_blank", "noopener,noreferrer");
      }
    } catch (error: any) {
      console.error("No se pudo preparar sandbox WhatsApp", error);
      setSandboxResult(null);
      const requestId = error instanceof ApiError && error.requestId ? ` Req: ${error.requestId}` : "";
      toast.error(`No se pudo preparar la prueba desde backend.${requestId}`);
    } finally {
      setSandboxLoading(false);
    }
  };

  const renderWhatsappSandboxPanel = () => {
    const menuPreview = (
      sandboxResult?.quickMenu?.length
        ? sandboxResult.quickMenu
        : sandboxSetup?.quickMenu?.length
          ? sandboxSetup.quickMenu
          : widgetQuickMenu
    ).slice(0, 3);
    const sandboxDeeplink = sandboxResult?.deeplink || sandboxSetup?.deeplink || buildSandboxDeeplink();
    const effectiveJoinNumber = sandboxResult?.joinNumber || sandboxSetup?.joinNumber;
    const effectiveJoinPhrase =
      sandboxResult?.joinPhrase || sandboxSetup?.joinPhrase || whatsappSandbox.joinPhrase.trim();
    const effectiveQrUrl = sandboxResult?.qrUrl || sandboxSetup?.qrUrl;
    const instructionPreview = sandboxResult?.instructions?.length
      ? sandboxResult.instructions
      : sandboxSetup?.instructions || [];

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Prueba controlada
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Bot className="h-3.5 w-3.5" /> Menu publicado
                </Badge>
                {sandboxSetupLoading ? (
                  <Badge variant="outline" className="gap-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando guia
                  </Badge>
                ) : null}
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-tight">Probar WhatsApp antes de salir a producción</h3>
              {/*
                  Prepará una prueba guiada con número, frase de unión y brief del rubro. El usuario abre WhatsApp desde un enlace o copia las instrucciones; no se promete envío automático desde el backend.
              */}
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Prepara una prueba guiada con número, frase de unión, brief del rubro y menú publicado. El backend debe registrar la sesión antes de mostrar el enlace de grabación.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copySandboxBrief}
              className="shrink-0"
            >
              <Copy className="mr-2 h-4 w-4" /> Copiar instrucciones
            </Button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-background/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <PhoneCall className="h-4 w-4 text-primary" /> 1. WhatsApp de prueba
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sandbox-whatsapp">Número WhatsApp</Label>
                  <Input
                    id="sandbox-whatsapp"
                    value={whatsappSandbox.customerWhatsapp}
                    onChange={(event) => updateWhatsappSandbox("customerWhatsapp", event.target.value)}
                    placeholder="+549..."
                    inputMode="tel"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sandbox-join">Frase de unión</Label>
                  <Input
                    id="sandbox-join"
                    value={whatsappSandbox.joinPhrase}
                    onChange={(event) => updateWhatsappSandbox("joinPhrase", event.target.value)}
                    placeholder="join palabra-clave"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-background/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> 2. Rubro y brief
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sandbox-rubro">Rubro o recorrido</Label>
                  <Input
                    id="sandbox-rubro"
                    value={whatsappSandbox.rubro}
                    onChange={(event) => updateWhatsappSandbox("rubro", event.target.value)}
                    placeholder="Usar rubro del tenant"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sandbox-brief">Brief de la prueba</Label>
                  <Textarea
                    id="sandbox-brief"
                    value={whatsappSandbox.brief}
                    onChange={(event) => updateWhatsappSandbox("brief", event.target.value)}
                    placeholder="Qué tiene que probar el cliente, qué menú debe ver y qué acción esperada debe ocurrir."
                    className="min-h-[92px]"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-background/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Clipboard className="h-4 w-4 text-primary" /> 3. Mensaje inicial
              </div>
              <Textarea
                value={whatsappSandbox.testMessage}
                onChange={(event) => updateWhatsappSandbox("testMessage", event.target.value)}
                placeholder="Mensaje que querés mandar para iniciar la demo."
                className="min-h-[126px]"
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button onClick={handlePrepareWhatsappSandbox} disabled={sandboxLoading} className="flex-1">
                  {sandboxLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Preparar enlace
                </Button>
                <Button
                  variant="outline"
                  disabled={!sandboxDeeplink}
                  onClick={() => sandboxDeeplink && window.open(sandboxDeeplink, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" /> Abrir
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border bg-background/70 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4 text-primary" />
              Menu que verá el usuario
            </div>
            {(effectiveJoinNumber || effectiveJoinPhrase) && (
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                {effectiveJoinNumber ? (
                  <div className="rounded-lg border bg-muted/30 px-3 py-2">
                    <span className="font-semibold text-foreground">Número de prueba: </span>
                    <span className="font-mono">{effectiveJoinNumber}</span>
                  </div>
                ) : null}
                {effectiveJoinPhrase ? (
                  <div className="rounded-lg border bg-muted/30 px-3 py-2">
                    <span className="font-semibold text-foreground">Frase de unión: </span>
                    <span className="font-mono">{effectiveJoinPhrase}</span>
                  </div>
                ) : null}
              </div>
            )}
            {effectiveQrUrl ? (
              <div className="mt-3 flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <QrCode className="h-4 w-4 text-primary" />
                  QR publicado por el contrato
                </div>
                <img
                  src={effectiveQrUrl}
                  alt=""
                  className="h-28 w-28 rounded-md border bg-background object-contain p-1"
                />
              </div>
            ) : null}
            {instructionPreview.length ? (
              <ol className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                {instructionPreview.slice(0, 3).map((instruction, index) => (
                  <li key={`${instruction}-${index}`} className="rounded-lg border bg-muted/20 px-3 py-2">
                    <span className="font-semibold text-foreground">{index + 1}. </span>
                    {instruction}
                  </li>
                ))}
              </ol>
            ) : null}
            {menuPreview.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {menuPreview.map((item) => (
                  <Badge key={item.id || item.label} variant="outline" className="rounded-full">
                    {item.label}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Todavía no llegó quick menu desde el widget config. La prueba sigue disponible con el brief.
              </p>
            )}
          </div>

          {sandboxResult && (
            <Alert className="mt-4">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>{sandboxResult.mode === "remote" ? "Prueba lista" : "Prueba registrada"}</AlertTitle>
              <AlertDescription>
                {sandboxResult.message}
                {sandboxResult.requestId ? ` Req: ${sandboxResult.requestId}` : ""}
                {sandboxResult.previewText ? (
                  <span className="mt-2 block rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                    {sandboxResult.previewText}
                  </span>
                ) : null}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  };

  const renderIntegrationPlanLockPanel = (lock: IntegrationPlanLockView, scope: "page" | "channel" = "channel") => {
    const isMarketplaceLock = lock.featureId === "marketplace_sync";
    const isWhatsappLock = lock.featureId === "whatsapp_sender_management";
    return (
      <Alert
        data-testid={scope === "page" ? "integrations-page-plan-lock" : "integration-channel-plan-lock"}
        className="border-amber-400/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
      >
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="flex flex-wrap items-center gap-2">
          <span>{lock.featureLabel}</span>
          <Badge variant="secondary">Plan requerido</Badge>
        </AlertTitle>
        <AlertDescription className="mt-3 space-y-4">
            <p className="max-w-3xl text-sm leading-6">{lock.message}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-background/70 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Actual</p>
                <p className="text-sm font-semibold text-foreground">{lock.currentPlan}</p>
              </div>
              <div className="rounded-lg border bg-background/70 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Requiere</p>
                <p className="text-sm font-semibold text-foreground">{lock.requiredPlan}</p>
              </div>
              <div className="rounded-lg border bg-background/70 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Feature</p>
                <p className="truncate font-mono text-xs text-foreground">{lock.featureId}</p>
              </div>
              <div className="rounded-lg border bg-background/70 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Accion</p>
                <p className="truncate font-mono text-xs text-foreground">{lock.featureAction}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href={lock.upgradeUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> {lock.upgradeLabel}
                </a>
              </Button>
              {isMarketplaceLock ? (
                <Button size="sm" variant="outline" onClick={() => setActiveTab("catalog")}>
                  <ShoppingBag className="mr-2 h-4 w-4" /> Seguir con catalogo manual
                </Button>
              ) : null}
              {isWhatsappLock ? (
                <Button size="sm" variant="outline" onClick={() => setSelectedChannel("whatsapp")}>
                  <MessageCircle className="mr-2 h-4 w-4" /> Probar sandbox WhatsApp
                </Button>
              ) : null}
            </div>
        </AlertDescription>
      </Alert>
    );
  };

  const renderPaymentGatewayPanel = () => {
    const status = paymentGateway?.status || (paymentGateway?.configured ? "configured" : "missing");
    const isReady = Boolean(paymentGateway?.configured && (paymentGateway.ok === true || status === "ok" || status === "configured"));
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border bg-muted/30 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isReady ? "default" : "secondary"} className="gap-1">
                  {paymentLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  {isReady ? "Checkout listo" : "Checkout pendiente"}
                </Badge>
                {paymentGateway?.testedAt ? <Badge variant="outline">Testeado {paymentGateway.testedAt}</Badge> : null}
              </div>
              <div>
                <h4 className="text-lg font-semibold">MercadoPago para pedidos y marketplace</h4>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Usa credenciales del tenant para crear preferencias de pago desde webviews, carrito, WhatsApp y widget sin exponer tokens al cliente.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="w-fit">
              {status}
            </Badge>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="mercadopago-token">Access token del tenant</Label>
                <Input
                  id="mercadopago-token"
                  type="password"
                  value={paymentToken}
                  onChange={(event) => setPaymentToken(event.target.value)}
                  placeholder={paymentGateway?.accessTokenMasked || "APP_USR-..."}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Se guarda en backend y luego solo se muestra enmascarado.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={handleSavePaymentGateway} disabled={paymentSaving || paymentLoading}>
                  {paymentSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar MercadoPago
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestPaymentGateway}
                  disabled={paymentTesting || paymentLoading || !paymentGateway?.configured}
                >
                  {paymentTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Probar conexion
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Credencial activa</p>
              <p className="mt-2 break-all font-mono text-sm text-foreground">
                {paymentGateway?.accessTokenMasked || "Sin token guardado"}
              </p>
              <Separator className="my-4" />
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Estado</span>
                  <span className="font-medium">{status}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Proveedor</span>
                  <span className="font-medium">{paymentGateway?.provider || "mercadopago"}</span>
                </div>
                {paymentGateway?.details?.site_id ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Site</span>
                    <span className="font-medium">{String(paymentGateway.details.site_id)}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const viewUrl = catalogData?.links?.view_url ?? null;
  const downloadUrl = catalogData?.links?.download_url ?? null;
  const hasPdf = Boolean(catalogData?.has_pdf);
  const statusText = catalogData?.status ?? (hasPdf ? 'publicado' : 'sin catálogo');
  const statusLabel = catalogData?.links?.status_label ?? 'Estado del catálogo';
  const viewLabel = catalogData?.links?.view_label ?? 'Ver online';
  const downloadLabel = catalogData?.links?.download_label ?? 'Descargar PDF';
  const copyLabel = catalogData?.links?.share_copy_label ?? 'Copiar link';
  const whatsappLabel = catalogData?.links?.share_whatsapp_label ?? 'WhatsApp';
  const shareLabel = catalogData?.links?.share_label ?? 'Compartir catálogo';
  const selectedChannelConfig = CHANNELS.find((channel) => channel.id === selectedChannel) ?? CHANNELS[0];
  const selectedChannelStatus = getIntegrationStatus(selectedChannel);
  const selectedChannelGuidance = CHANNEL_GUIDANCE[selectedChannel] ?? CHANNEL_GUIDANCE.whatsapp;
  const connectedChannels = CHANNELS.filter((channel) => getIntegrationStatus(channel.id).connected).length;
  const whatsappStatus = getIntegrationStatus("whatsapp");
  const activationPath = [
    { label: "Autorizar con Meta", done: whatsappStatus.connected },
    { label: "Registrar sender", done: whatsappStatus.connected },
    { label: "Probar mensajes", done: whatsappStatus.connected },
    { label: "Publicar canal", done: whatsappStatus.connected },
  ];

  const readinessLabel = loading
    ? "Cargando canales"
    : connectedChannels > 0
      ? `${connectedChannels} de ${CHANNELS.length} canales conectados`
      : "Pendiente de autorización";

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-10">
      <div className="rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-emerald-500/10 p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1 rounded-full">
                <ShieldCheck className="h-3.5 w-3.5" /> Profile management
              </Badge>
              <Badge variant="secondary" className="gap-1 rounded-full">
                <Sparkles className="h-3.5 w-3.5" /> Meta Tech Provider
              </Badge>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Integraciones y canales</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
                Autoriza WhatsApp Business, prueba recorridos reales, publica el widget y deja cada canal listo para operar sin exponer consolas externas al cliente.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[460px]">
            <div className="rounded-2xl border bg-background/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Estado</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{readinessLabel}</p>
            </div>
            <div className="rounded-2xl border bg-background/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">WhatsApp</p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {whatsappStatus.connected ? "Operativo" : "Requiere autorización"}
              </p>
            </div>
            <div className="rounded-2xl border bg-background/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Canal activo</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{selectedChannelConfig.label}</p>
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-2 md:grid-cols-4">
          {activationPath.map((step, index) => (
            <div key={step.label} className="flex items-center gap-2 rounded-2xl border bg-background/70 px-3 py-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  step.done
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                    : "border-primary/30 bg-primary/10 text-primary"
                )}
              >
                {step.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="text-xs font-medium text-foreground">{step.label}</span>
            </div>
          ))}
        </div>
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
                {catalogLoading && statusLabel && (
                  <Card>
                    <CardContent className="p-6 flex items-center gap-3 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" /> {statusLabel}
                    </CardContent>
                  </Card>
                )}

                {catalogError && statusLabel && (
                  <Alert variant="destructive">
                    <AlertTitle>{statusLabel}</AlertTitle>
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

                {catalogData?.links?.upload_section_title && catalogData?.links?.upload_section_button_label && (
                  <Card>
                      <div className="p-6 flex flex-col md:flex-row items-center gap-6">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-blue-50 border border-blue-100">
                              <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                          </div>
                          <div className="flex-1 space-y-1 text-center md:text-left">
                              <h3 className="font-semibold text-lg">{catalogData.links.upload_section_title}</h3>
                              {catalogData.links.upload_section_description && (
                                <p className="text-sm text-muted-foreground">
                                  {catalogData.links.upload_section_description}
                                </p>
                              )}
                          </div>
                          <Button onClick={() => setUploadOpen(true)} className="w-full md:w-auto">
                              {catalogData.links.upload_section_button_label} <ArrowRight className="ml-2 h-4 w-4"/>
                          </Button>
                      </div>
                  </Card>
                )}

                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
                        <DialogHeader className="sr-only">
                            <DialogTitle>{catalogData?.links?.upload_section_title || "Importar catálogo"}</DialogTitle>
                            <DialogDescription>
                                {catalogData?.links?.upload_section_description || "Sube un archivo para importar o actualizar el catálogo."}
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
                    <DialogHeader className={catalogData?.links?.editor_title || catalogData?.links?.editor_description ? "" : "sr-only"}>
                      <DialogTitle>{catalogData?.links?.editor_title || "Editor de catálogo"}</DialogTitle>
                      <DialogDescription>
                        {catalogData?.links?.editor_description || "Edita las filas y columnas del catálogo del tenant."}
                      </DialogDescription>
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
                      {catalogData?.links?.editor_close_label && (
                        <Button variant="outline" onClick={() => setEditorOpen(false)}>
                          {catalogData.links.editor_close_label}
                        </Button>
                      )}
                      {catalogData?.links?.editor_save_label && (
                        <Button onClick={handleSaveDraft}>
                          {catalogData.links.editor_save_label}
                        </Button>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
            </TabsContent>

            <TabsContent value="integrations" className="space-y-8">
                {integrationPlanLock && !lockMatchesChannel(integrationPlanLock, selectedChannel)
                  ? renderIntegrationPlanLockPanel(integrationPlanLock, "page")
                  : null}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-8 items-start">

                    {/* Left: Settings Panel */}
                    <div className="space-y-6">
                        <Card className="overflow-hidden">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg">Canales disponibles</CardTitle>
                                        <CardDescription>Autoriza, prueba y publica cada canal desde el perfil del tenant.</CardDescription>
                                    </div>
                                    <Badge variant="outline" className="shrink-0">
                                        {connectedChannels}/{CHANNELS.length}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                {CHANNELS.map((channel) => {
                                    const status = getIntegrationStatus(channel.id);
                                    const Icon = channel.icon;
                                    const guidance = CHANNEL_GUIDANCE[channel.id] ?? CHANNEL_GUIDANCE.whatsapp;
                                    return (
                                        <button
                                            key={channel.id}
                                            onClick={() => setSelectedChannel(channel.id)}
                                            className={cn(
                                                "flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3 text-sm transition-all",
                                                selectedChannel === channel.id
                                                    ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                                                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground"
                                            )}
                                        >
                                            <div className="flex min-w-0 items-start gap-3">
                                                <span className={cn(
                                                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background",
                                                    selectedChannel === channel.id && "border-primary/40 bg-primary/10 text-primary"
                                                )}>
                                                    <Icon className="h-4 w-4" />
                                                </span>
                                                <div className="min-w-0 text-left">
                                                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                                                        <span>{channel.label}</span>
                                                        <span className={cn(
                                                            "rounded-full px-2 py-0.5 text-[11px]",
                                                            status.connected
                                                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                                                                : "bg-muted text-muted-foreground"
                                                        )}>
                                                            {status.connected ? "Operativo" : "Pendiente"}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{guidance.outcome}</p>
                                                </div>
                                            </div>
                                            <ArrowRight className={cn(
                                                "mt-2 h-4 w-4 shrink-0 transition-transform",
                                                selectedChannel === channel.id && "translate-x-0.5 text-primary"
                                            )} />
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

                        <Card className="min-h-[520px] overflow-hidden">
                            <CardHeader>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <img
                                            src={INTEGRATION_LOGOS[selectedChannel]}
                                            alt={selectedChannelConfig.label}
                                            className="h-10 w-10 object-contain"
                                            onError={(e) => { e.currentTarget.style.display='none'; }}
                                        />
                                        <div>
                                            <CardTitle>{selectedChannelGuidance.title}</CardTitle>
                                            <CardDescription>
                                                {selectedChannelStatus.connected ? selectedChannelGuidance.outcome : selectedChannelGuidance.detail}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    {selectedChannelStatus.connected ? (
                                        <Badge className="bg-green-600">Activo</Badge>
                                    ) : (
                                        <Badge variant="secondary">Inactivo</Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="rounded-2xl border bg-muted/30 p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Siguiente paso</p>
                                            <p className="mt-1 text-sm text-foreground">
                                                {selectedChannel === "whatsapp"
                                                    ? "Completar autorización Meta, sender, prueba de mensaje y rutas de webhook."
                                                    : selectedChannelStatus.connected
                                                      ? "Revisar sincronización, permisos y reglas operativas del canal."
                                                      : "Conectar credenciales y validar una prueba real antes de publicarlo."}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="w-fit">
                                            {selectedChannelStatus.connected ? "Listo para operar" : "Requiere configuración"}
                                        </Badge>
                                    </div>
                                </div>
                                {selectedChannelPlanLock ? renderIntegrationPlanLockPanel(selectedChannelPlanLock) : null}
                                {selectedChannel === 'whatsapp' ? (
                                    <div className="space-y-6">
                                        <WhatsappTechProviderOnboarding tenantSlug={currentSlug} focusAction={requestedAction} />
                                        <Separator />
                                        {renderWhatsappSandboxPanel()}
                                        <Separator />
                                        <div className="rounded-xl border bg-muted/30 p-4">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <h4 className="font-semibold">Conexión operativa</h4>
                                                    <p className="text-sm text-muted-foreground">
                                                        Activá el canal real cuando el número, la frase clave y el menú ya estén validados.
                                                    </p>
                                                </div>
                                                <Button onClick={() => handleConnect(selectedChannel)} variant="outline">
                                                    <Link2 className="mr-2 h-4 w-4" /> Conectar canal
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : selectedChannel === 'mercadopago' ? (
                                    renderPaymentGatewayPanel()
                                ) : selectedChannel === 'email' ? (
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
                                            message={
                                                selectedChannel === 'whatsapp'
                                                    ? whatsappSandbox.testMessage || whatsappSandbox.brief || undefined
                                                    : undefined
                                            }
                                            menuItems={selectedChannel === 'whatsapp' ? widgetQuickMenu : []}
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
          <DialogHeader className="sr-only">
            <DialogTitle>Previsualización de sincronización</DialogTitle>
            <DialogDescription>Revisa el mapeo de campos antes de sincronizar el canal.</DialogDescription>
          </DialogHeader>
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
