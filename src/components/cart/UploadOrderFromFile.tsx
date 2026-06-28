import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ClipboardCheck,
  Copy,
  FileImage,
  ExternalLink,
  FileText,
  FileWarning,
  Hash,
  Loader2,
  MessageCircle,
  Sparkles,
  Upload,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useTenant } from '@/context/TenantContext';
import { cn } from '@/lib/utils';
import type { MarketAssistedIntakeEntry, MarketAssistedIntakeTextExample } from '@/types/market';
import { ApiError, apiFetch, getErrorMessage } from '@/utils/api';

interface UploadOrderFromFileProps {
  onCartUpdated?: (items: unknown) => void;
  onProcessed?: (response: AssistedOrderUploadResponse) => void;
  tenantSlug?: string | null;
  variant?: 'inline' | 'marketplace';
  intakeEntry?: MarketAssistedIntakeEntry | null;
  className?: string;
  id?: string;
}

interface AssistedOrderAction {
  id?: string;
  label?: string;
  type?: string;
  href?: string;
  description?: string;
  enabled?: boolean;
  reference?: string;
  tracking_code?: string;
}

interface AssistedOrderUploadResponse {
  contract_version?: string;
  mode?: string;
  request_kind?: string;
  request_kind_label?: string;
  intake_experience?: MarketAssistedIntakeEntry & {
    capabilities?: Array<{
      id?: string | null;
      label?: string | null;
      description?: string | null;
      status?: string | null;
    }>;
    customer_prompts?: Array<{
      id?: string | null;
      label?: string | null;
      document_type?: string | null;
    }>;
  };
  document_profile?: {
    label?: string | null;
    primary_intent?: string | null;
    operator_goal?: string | null;
    catalog_matching?: boolean | null;
  };
  structured_extraction?: {
    confidence?: string | null;
    fields?: Record<string, unknown> | null;
    missing_fields?: string[] | null;
  } | null;
  items?: unknown[];
  no_encontrados?: unknown[];
  items_no_encontrados?: string[];
  pedido_id?: number | string;
  lead_id?: number | string;
  crm_state?: string;
  customer_message?: string;
  resumen?: string;
  row_errors?: unknown[];
  source?: {
    archivo_url?: string | null;
    archivo_nombre?: string | null;
    input_type?: string | null;
    text_preview?: string | null;
  };
  next_actions?: AssistedOrderAction[];
  customer_next_steps?: Array<{
    id?: string;
    label?: string;
    description?: string;
    status?: string;
  }>;
  review_context?: {
    primary_intent?: string | null;
    review_reasons?: string[];
    recommended_channels?: string[];
  };
  operator_pack?: {
    suggested_reply?: string | null;
    needs_human_review?: boolean | null;
  };
  match_summary?: {
    matched?: number;
    unmatched?: number;
    detected?: number;
    needs_operator_review?: boolean;
  };
  public_follow_up?: {
    contract_version?: string;
    tracking?: {
      kind?: string | null;
      code?: string | null;
      raw_code?: string | null;
      pin?: string | null;
      ticket_id?: number | string | null;
      path?: string | null;
      api_endpoint?: string | null;
      label?: string | null;
    };
    channels?: AssistedOrderAction[];
  };
}

const DOCUMENT_TYPES = [
  { value: 'order_note', label: 'Nota de pedido', helper: 'Lista de productos, cantidades o materiales.' },
  { value: 'handwritten_order', label: 'Nota manuscrita', helper: 'Foto de papel, mostrador o lista escrita a mano.' },
  { value: 'quote_request', label: 'Cotizacion', helper: 'Pedido para presupuestar o revisar stock.' },
  { value: 'receipt', label: 'Factura / recibo', helper: 'Pago, factura, recibo o constancia.' },
  { value: 'tax_bill', label: 'Boleta / impuesto', helper: 'Tasa, impuesto, padron, periodo o vencimiento.' },
  { value: 'certificate', label: 'Certificado / tramite', helper: 'Documentacion, permiso o tramite para validar.' },
  { value: 'service_request', label: 'Reclamo vecinal', helper: 'Luminaria, bache, perdida de agua, limpieza o solicitud municipal.' },
  { value: 'other', label: 'Otro archivo', helper: 'El equipo lo clasifica desde el CRM.' },
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number]['value'];
type DocumentTypeOption = {
  value: DocumentType;
  label: string;
  helper: string;
};

const DEFAULT_MAX_SAFE_FILE_BYTES = 8 * 1024 * 1024;

const DEFAULT_MARKETPLACE_PIPELINE = [
  {
    id: 'capture',
    label: 'Subi foto, PDF o texto',
    description: 'Pedido anonimo, boleta, certificado o lista escrita a mano.',
  },
  {
    id: 'ai_parse',
    label: 'La IA separa datos',
    description: 'Productos, cantidades, referencias, comprobantes y datos operativos.',
  },
  {
    id: 'crm_handoff',
    label: 'El CRM responde',
    description: 'El equipo confirma stock, precio, tramite o proximo paso.',
  },
  {
    id: 'public_follow_up',
    label: 'Seguimiento publico',
    description: 'El cliente recibe link seguro para continuar sin registro.',
  },
] as const;

const DEFAULT_MARKETPLACE_EXAMPLES = [
  'Foto de papel o mostrador',
  'Pedido de ferreteria, super o bebidas',
  'Pedido pegado desde WhatsApp',
  'Boleta, certificado o comprobante',
];

const DEFAULT_TEXT_EXAMPLES: MarketAssistedIntakeTextExample[] = [
  {
    id: 'hardware_order',
    label: 'Ferreteria',
    document_type: 'quote_request',
    text: '2 chapas galvanizadas\n1 caja de clavos punta paris\n3 bolsas de cemento',
  },
  {
    id: 'municipal_bill',
    label: 'Boleta municipal',
    document_type: 'tax_bill',
    text: 'Boleta de tasa municipal cuenta 9988 periodo 06/2026 vencimiento 15/07/2026',
  },
  {
    id: 'municipal_claim',
    label: 'Reclamo vecinal',
    document_type: 'service_request',
    text: 'Reclamo por luminaria quemada en Don Bosco 55 esquina Sarmiento. De noche queda muy oscuro.',
  },
  {
    id: 'grocery_order',
    label: 'Super/almacen',
    document_type: 'order_note',
    text: '4 packs de agua sin gas\n2 arroz 1kg\n1 aceite 900ml',
  },
];

const CRM_RECEIVES = [
  'Archivo o texto original',
  'Resumen IA con articulos, reclamos o datos detectados',
  'Cruce con catalogo y faltantes',
  'Categoria, area o tramite probable cuando no hay catalogo',
  'Link publico de seguimiento',
];

const ASSISTED_OUTCOMES = [
  {
    label: 'Pedido o cotizacion',
    description: 'Listas de ferreteria, supermercado, bebidas, repuestos o compras institucionales.',
  },
  {
    label: 'Reclamo o tramite',
    description: 'Direccion, categoria, foto, boleta, certificado o dato faltante para el area correcta.',
  },
  {
    label: 'Lead listo para responder',
    description: 'Contacto, canal sugerido, respuesta borrador y seguimiento publico para el CRM.',
  },
];

const STRUCTURED_FIELD_LABELS: Record<string, string> = {
  categoria_probable: 'Categoria',
  direccion: 'Direccion',
  descripcion: 'Descripcion',
  urgencia: 'Urgencia',
  contacto: 'Contacto',
  cuenta_o_padron: 'Cuenta o padron',
  periodo: 'Periodo',
  vencimiento: 'Vencimiento',
  importe: 'Importe',
  concepto: 'Concepto',
  titular: 'Titular',
  tipo_tramite: 'Tipo de tramite',
  identificador: 'Identificador',
  observaciones: 'Observaciones',
  resumen: 'Resumen',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const formatStructuredValue = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(formatStructuredValue).filter(Boolean).join(', ') || null;
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => {
        const formatted = formatStructuredValue(item);
        return formatted ? `${STRUCTURED_FIELD_LABELS[key] || key}: ${formatted}` : null;
      })
      .filter(Boolean)
      .join(' - ') || null;
  }
  return null;
};

const structuredFieldEntries = (fields?: Record<string, unknown> | null) =>
  isRecord(fields)
    ? Object.entries(fields)
        .map(([key, value]) => ({
          key,
          label: STRUCTURED_FIELD_LABELS[key] || key.replace(/_/g, ' '),
          value: formatStructuredValue(value),
        }))
        .filter((entry) => Boolean(entry.value))
    : [];

const makeAbsoluteHref = (href?: string | null) => {
  if (!href) return null;
  if (/^(https?:|mailto:|tel:|whatsapp:)/i.test(href)) return href;
  if (typeof window === 'undefined') return href;
  try {
    return new URL(href, window.location.origin).toString();
  } catch {
    return href;
  }
};

const openTargetForHref = (href?: string | null) =>
  href && /^(https?:|mailto:|tel:|whatsapp:)/i.test(href) ? '_blank' : '_self';

const isDocumentType = (value?: string | null): value is DocumentType =>
  DOCUMENT_TYPES.some((item) => item.value === value);

const UploadOrderFromFile: React.FC<UploadOrderFromFileProps> = ({
  onCartUpdated,
  onProcessed,
  tenantSlug,
  variant = 'inline',
  intakeEntry,
  className,
  id,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const { currentSlug } = useTenant();
  const effectiveTenantSlug = tenantSlug ?? currentSlug ?? null;
  const isMarketplace = variant === 'marketplace';

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [missingItems, setMissingItems] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [matchSummary, setMatchSummary] = useState<AssistedOrderUploadResponse['match_summary'] | null>(null);
  const [processedResponse, setProcessedResponse] = useState<AssistedOrderUploadResponse | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>('order_note');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [orderText, setOrderText] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const selectedDocumentType = useMemo(
    () => DOCUMENT_TYPES.find((item) => item.value === documentType) ?? DOCUMENT_TYPES[0],
    [documentType],
  );
  const documentTypeOptions = useMemo(() => {
    const defaults = new Map(DOCUMENT_TYPES.map((item) => [item.value, item]));
    const backendTypes = intakeEntry?.document_types ?? [];
    const normalized = backendTypes
      .map((item) => {
        const id = item?.id;
        if (!isDocumentType(id)) return null;
        const fallback = defaults.get(id);
        return {
          value: id,
          label: item.label || fallback?.label || id,
          helper: item.helper || fallback?.helper || 'Solicitud asistida para revisar desde el CRM.',
        };
      })
      .filter((item): item is DocumentTypeOption => Boolean(item));
    return normalized.length ? normalized : [...DOCUMENT_TYPES];
  }, [intakeEntry?.document_types]);
  const activeDocumentType = useMemo(
    () => documentTypeOptions.find((item) => item.value === documentType) ?? selectedDocumentType,
    [documentType, documentTypeOptions, selectedDocumentType],
  );

  const intakeExperience = processedResponse?.intake_experience ?? intakeEntry ?? null;
  const submitContract = intakeExperience?.submit ?? null;
  const submitEndpoint = submitContract?.endpoint || '/api/pedidos/from-file?origen=marketplace';
  const submitMethod = (submitContract?.method || 'POST').toUpperCase() === 'POST' ? 'POST' : 'POST';
  const submitFileField = submitContract?.file_field || 'archivo';
  const submitTextField = submitContract?.text_field || 'pedido_text';
  const submitDocumentTypeField = submitContract?.document_type_field || 'document_type';
  const submitTenantFields = submitContract?.tenant_fields?.length ? submitContract.tenant_fields : ['tenant', 'tenant_slug'];
  const submitContactFields = submitContract?.contact_fields?.length
    ? submitContract.contact_fields
    : ['contact_name', 'contact_phone', 'contact_email', 'contact_notes'];
  const submitMaxFileBytes =
    typeof submitContract?.max_file_mb === 'number' && submitContract.max_file_mb > 0
      ? submitContract.max_file_mb * 1024 * 1024
      : DEFAULT_MAX_SAFE_FILE_BYTES;
  const submitMaxTextChars =
    typeof submitContract?.max_text_chars === 'number' && submitContract.max_text_chars > 0
      ? submitContract.max_text_chars
      : 12000;
  const submitAccept = useMemo(() => {
    const mimeTypes = submitContract?.accepted_mime_types?.filter(Boolean) ?? [];
    const extensions = (submitContract?.accepted_extensions?.filter(Boolean) ?? []).map((extension) =>
      extension.startsWith('.') ? extension : `.${extension}`,
    );
    const values = [...mimeTypes, ...extensions];
    return values.length
      ? values.join(',')
      : '.pdf,.jpg,.jpeg,.png,.webp,.csv,.xls,.xlsx,.doc,.docx,.txt';
  }, [submitContract?.accepted_extensions, submitContract?.accepted_mime_types]);
  const marketplacePipeline =
    intakeExperience?.pipeline?.length ? intakeExperience.pipeline.slice(0, 4) : DEFAULT_MARKETPLACE_PIPELINE;
  const marketplaceExamples = intakeExperience?.input_examples?.length
    ? intakeExperience.input_examples.slice(0, 4)
    : DEFAULT_MARKETPLACE_EXAMPLES;
  const marketplaceTextExamples = intakeExperience?.text_examples?.length
    ? intakeExperience.text_examples.filter((example) => example?.label && example?.text).slice(0, 4)
    : DEFAULT_TEXT_EXAMPLES;
  const crmReceives = intakeExperience?.crm_receives?.length ? intakeExperience.crm_receives.slice(0, 5) : CRM_RECEIVES;

  const applyTextExample = (example: MarketAssistedIntakeTextExample) => {
    if (isDocumentType(example.document_type)) {
      setDocumentType(example.document_type);
    }
    if (example.text) {
      setOrderText(example.text);
      window.setTimeout(() => textAreaRef.current?.focus(), 0);
    }
  };

  const processRequest = async ({ file, text }: { file?: File | null; text?: string | null }) => {
    const normalizedText = text?.trim() ?? '';
    if (!file && !normalizedText) {
      setError('Subi un archivo o escribi el pedido para que Chatboc lo analice.');
      return;
    }
    if (file && file.size > submitMaxFileBytes) {
      const maxMb = Math.max(1, Math.floor(submitMaxFileBytes / (1024 * 1024)));
      setError(`El archivo supera el limite de ${maxMb} MB para este marketplace.`);
      return;
    }
    if (normalizedText.length > submitMaxTextChars) {
      setError(`El texto supera el limite de ${submitMaxTextChars.toLocaleString()} caracteres.`);
      return;
    }

    setUploading(true);
    setError(null);
    setMissingItems([]);
    setSuccessMessage(null);
    setMatchSummary(null);
    setProcessedResponse(null);
    setStatusMessage(`Analizando ${activeDocumentType.label.toLowerCase()} con IA...`);
    setProgress(10);

    try {
      const formData = new FormData();
      if (file) {
        formData.append(submitFileField, file, file.name);
      }
      if (normalizedText) {
        formData.append(submitTextField, normalizedText);
      }
      formData.append(submitDocumentTypeField, documentType);
      const contactValues: Record<string, string> = {
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        contact_email: contactEmail.trim(),
        contact_notes: contactNotes.trim(),
      };
      submitContactFields.forEach((fieldName) => {
        const value = contactValues[fieldName];
        if (value) formData.append(fieldName, value);
      });
      if (effectiveTenantSlug) {
        submitTenantFields.forEach((fieldName) => formData.append(fieldName, effectiveTenantSlug));
      }

      const endpoint = isMarketplace ? submitEndpoint : '/api/pedidos/from-file';
      const response = await apiFetch<AssistedOrderUploadResponse>(
        endpoint,
        {
          method: submitMethod,
          body: formData,
          sendAnonId: true,
          tenantSlug: effectiveTenantSlug ?? undefined,
          suppressPanel401Redirect: true,
          onResponse: (res) => {
            const total = Number(res.headers.get('Content-Length'));
            if (Number.isFinite(total) && total > 0) {
              setProgress(70);
              setStatusMessage('Procesando respuesta del servidor...');
            }
          },
        },
      );

      setProgress(90);
      setMatchSummary(response?.match_summary ?? null);
      setProcessedResponse(response ?? null);

      if (response?.items && typeof onCartUpdated === 'function') {
        onCartUpdated(response.items);
      }
      if (typeof onProcessed === 'function') {
        onProcessed(response);
      }

      if (Array.isArray(response?.items_no_encontrados)) {
        setMissingItems(response.items_no_encontrados.filter((item) => typeof item === 'string'));
      }

      setSuccessMessage(
        response?.customer_message ?? response?.resumen ?? 'Hemos armado un borrador en base a tu archivo.',
      );
      if (normalizedText) {
        setOrderText('');
      }
      setStatusMessage('Solicitud procesada correctamente.');
    } catch (uploadError) {
      if (uploadError instanceof ApiError) {
        const contentType = String(uploadError.body?.contentType || '').toLowerCase();
        if (contentType.includes('text/html')) {
          console.warn('[UploadOrderFromFile] Respuesta inesperada al importar archivo', uploadError.body?.raw);
          setError(
            isMarketplace
              ? 'No pudimos interpretar el archivo por ahora. Intenta con una foto mas clara o deja tu contacto para que el equipo lo revise.'
              : 'No pudimos interpretar el archivo por ahora. Revisa tu acceso e intenta nuevamente.',
          );
        } else {
          setError(getErrorMessage(uploadError, 'No pudimos interpretar el archivo. Intenta nuevamente.'));
        }
      } else if (uploadError instanceof TypeError) {
        setError('No pudimos procesar el archivo. Verifica tu conexion y vuelve a intentarlo.');
      } else {
        setError(getErrorMessage(uploadError, 'No pudimos interpretar el archivo. Intenta nuevamente.'));
      }
      setStatusMessage(null);
    } finally {
      setProgress(100);
      setUploading(false);
      setIsDragging(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const processFile = async (file: File | null | undefined) => {
    await processRequest({ file });
  };

  const processText = async () => {
    await processRequest({ text: orderText });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await processFile(event.target.files?.[0]);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (uploading) return;
    await processFile(event.dataTransfer.files?.[0]);
  };

  const enabledActions = processedResponse?.next_actions?.filter((action) => action.enabled !== false) ?? [];
  const publicActions = enabledActions.filter((action) => action.type === 'link' && action.href);
  const reviewActions = enabledActions.filter((action) => action.type !== 'link');
  const customerNextSteps = processedResponse?.customer_next_steps ?? [];
  const requestId = processedResponse?.pedido_id ?? processedResponse?.lead_id ?? null;
  const trackingAction = enabledActions.find((action) => action.id === 'tracking' || action.tracking_code);
  const whatsappHandoffAction =
    processedResponse?.public_follow_up?.channels?.find((action) => action.id === 'whatsapp_handoff' && action.href) ??
    enabledActions.find((action) => action.id === 'whatsapp_handoff' && action.href);
  const trackingCode =
    processedResponse?.public_follow_up?.tracking?.code ??
    trackingAction?.tracking_code ??
    (requestId ? `pc-${requestId}` : null);
  const trackingPath =
    processedResponse?.public_follow_up?.tracking?.path ??
    trackingAction?.href ??
    null;
  const trackingHref = makeAbsoluteHref(trackingPath);
  const whatsappHandoffHref = whatsappHandoffAction?.href ?? null;
  const hasPublicFollowUp = Boolean(processedResponse && (trackingCode || trackingHref || whatsappHandoffHref));
  const trackingKind = processedResponse?.public_follow_up?.tracking?.kind ?? null;
  const isClaimFollowUp = trackingKind === 'claim' || processedResponse?.request_kind === 'service_request';
  const followUpBadgeLabel = isClaimFollowUp ? 'Reclamo trazable' : 'Pedido trazable';
  const followUpTitle = isClaimFollowUp ? 'Seguimiento de reclamo creado' : 'Seguimiento publico creado';
  const followUpDescription = isClaimFollowUp
    ? 'El vecino puede consultar el estado, agregar datos y continuar por WhatsApp sin registrarse. El CRM conserva el archivo o texto original, la lectura de IA y el ticket municipal.'
    : 'El cliente puede consultar el estado, agregar datos y continuar por WhatsApp sin registrarse. El CRM conserva el archivo o texto original y la lectura de IA.';
  const structuredFields = structuredFieldEntries(processedResponse?.structured_extraction?.fields);
  const missingStructuredFields = processedResponse?.structured_extraction?.missing_fields?.filter(Boolean) ?? [];
  const copyFollowUpLink = async () => {
    const value = trackingHref ?? trackingCode;
    if (!value) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(value);
      setStatusMessage('Link de seguimiento copiado.');
    } catch {
      setError('No pudimos copiar el link. Abrilo desde el boton de seguimiento.');
    }
  };

  return (
    <div id={id} className={cn('space-y-4', isMarketplace && 'rounded-xl border bg-card p-4 shadow-sm', className)}>
      {isMarketplace ? (
        <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Pedido asistido por IA</Badge>
                    <Badge variant="outline">Sin registro previo</Badge>
                    <Badge variant="secondary">IA + revision humana</Badge>
                  </div>
                  <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-normal">
                    {intakeExperience?.title ?? 'Subi una nota, foto o pedido y Chatboc lo convierte en solicitud trazable'}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {intakeExperience?.summary ??
                      'Pensado para vecinos y clientes que no quieren navegar un catalogo: suben una foto de papel, pegan una lista o adjuntan una boleta, y el equipo recibe un lead/pedido con lectura IA, link de seguimiento y respuesta lista desde el CRM.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {marketplaceExamples.map((example) => (
                  <span key={example} className="rounded-md border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                    {example}
                  </span>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {ASSISTED_OUTCOMES.map((outcome) => (
                  <div key={outcome.label} className="rounded-lg border bg-background/80 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ClipboardCheck className="h-4 w-4 text-primary" />
                      {outcome.label}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{outcome.description}</p>
                  </div>
                ))}
              </div>
              {marketplaceTextExamples.length ? (
                <div className="rounded-xl border bg-background/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ejemplos rapidos</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {marketplaceTextExamples.map((example) => (
                      <Button
                        key={example.id ?? example.label}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={uploading}
                        onClick={() => applyTextExample(example)}
                      >
                        {example.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <FileImage className="mr-2 h-4 w-4" />
                  Subir foto o papel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => textAreaRef.current?.focus()}
                  disabled={uploading}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Escribir pedido
                </Button>
              </div>
            </div>

            <div className="grid gap-2 rounded-xl border bg-card/80 p-3">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Flujo operativo</p>
              {marketplacePipeline.map((step, index) => (
                <div key={step.id ?? step.label ?? index} className="rounded-lg border bg-background p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{step.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {isMarketplace ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo de archivo</legend>
              <div className="mt-2 grid grid-cols-1 gap-2 min-[460px]:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Tipo de archivo o solicitud">
                {documentTypeOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={documentType === item.value}
                    disabled={uploading}
                    onClick={() => setDocumentType(item.value)}
                    className={cn(
                      'min-w-0 rounded-lg border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      documentType === item.value ? 'border-primary bg-primary/10 text-primary' : 'bg-background',
                    )}
                  >
                    <span className="block break-words text-sm font-semibold">{item.label}</span>
                    <span className="mt-1 block break-words text-xs text-muted-foreground">{item.helper}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div
              data-assisted-upload-dropzone="true"
              data-testid="assisted-upload-dropzone"
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-background p-5 text-center transition-colors',
                isDragging ? 'border-primary bg-primary/10' : 'hover:border-primary/50 hover:bg-muted/40',
                uploading && 'pointer-events-none opacity-70',
              )}
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              </div>
              <p className="font-semibold">Arrastra el archivo o seleccionalo</p>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Acepta imagenes, PDF, Excel, Word, CSV y TXT. Puede ser una foto de papel, una nota manuscrita o una boleta; si la IA no puede leerlo con confianza, igual crea la solicitud para revision humana.
              </p>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Tambien podes escribir o pegar el pedido</p>
                  <p className="text-xs text-muted-foreground">
                    Para listas copiadas de WhatsApp, pedidos de mostrador o notas simples sin archivo.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit">
                  Sin login
                </Badge>
              </div>
              <Textarea
                ref={textAreaRef}
                value={orderText}
                onChange={(event) => setOrderText(event.target.value)}
                placeholder={`Ej: 2 chapas galvanizadas
1 caja de clavos
3 bolsas de cemento`}
                rows={4}
                disabled={uploading}
                className="mt-3"
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Chatboc lo transforma en borrador de pedido, reclamo, tramite o lead para que el equipo responda desde el CRM. Maximo {submitMaxTextChars.toLocaleString()} caracteres.
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={uploading || !orderText.trim()}
                  onClick={processText}
                  className="shrink-0"
                >
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Crear solicitud IA
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-semibold">Contacto para seguimiento</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Opcional, pero ayuda a responder por WhatsApp, email o llamada si faltan datos.
            </p>
            <div className="mt-3 grid gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="assisted-contact-name">Nombre</Label>
                <Input
                  id="assisted-contact-name"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  placeholder="Nombre"
                  disabled={uploading}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="assisted-contact-phone">WhatsApp o telefono</Label>
                <Input
                  id="assisted-contact-phone"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  placeholder="WhatsApp o telefono"
                  disabled={uploading}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="assisted-contact-email">Email</Label>
                <Input
                  id="assisted-contact-email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="Email"
                  disabled={uploading}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="assisted-contact-notes">Observaciones</Label>
                <Textarea
                  id="assisted-contact-notes"
                  value={contactNotes}
                  onChange={(event) => setContactNotes(event.target.value)}
                  placeholder="Observaciones, direccion o referencia"
                  rows={3}
                  disabled={uploading}
                />
              </div>
            </div>
            <Separator className="my-3" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">El CRM recibe</p>
              <div className="mt-2 grid gap-2">
                {crmReceives.map((item) => (
                  <div key={item} className="flex items-start gap-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                    <ClipboardCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          ref={fileInputRef}
          type="file"
          accept={submitAccept}
          onChange={handleFileChange}
          disabled={uploading}
          className={cn(isMarketplace ? 'sr-only' : 'max-w-xs')}
          style={
            isMarketplace
              ? { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }
              : undefined
          }
        />
        <Button
          type="button"
          variant={isMarketplace ? 'default' : 'secondary'}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className={cn(isMarketplace && 'w-full sm:w-auto lg:hidden')}
        >
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {isMarketplace ? 'Subir archivo' : 'Subir nota de pedido'}
        </Button>
        {isMarketplace ? (
          <p className="text-xs text-muted-foreground">
            El equipo ve el archivo o texto original, el resumen IA y las acciones siguientes desde el CRM.
          </p>
        ) : null}
      </div>

      {uploading && <Progress value={progress} className="h-2" />}

      {statusMessage && (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {statusMessage}
        </p>
      )}

      {successMessage && (
        <Alert className="border-green-200 bg-green-50 text-green-900">
          <ClipboardCheck className="h-4 w-4" />
          <AlertTitle>Solicitud creada</AlertTitle>
          <AlertDescription>
            {requestId ? <span className="mb-2 block font-semibold">Referencia #{requestId}</span> : null}
            <span>{successMessage}</span>
            {matchSummary ? (
              <span className="mt-2 block text-xs">
                Detectados: {matchSummary.detected ?? 0}. En catalogo: {matchSummary.matched ?? 0}. Para revisar: {matchSummary.unmatched ?? 0}.
              </span>
            ) : null}
            {processedResponse?.source?.archivo_nombre ? (
              <span className="mt-2 flex items-center gap-1 text-xs">
                <FileText className="h-3.5 w-3.5" />
                {processedResponse.source.archivo_nombre}
              </span>
            ) : null}
            {processedResponse?.source?.text_preview ? (
              <span className="mt-2 block rounded-md bg-white/70 p-2 text-xs">
                Pedido escrito: {processedResponse.source.text_preview}
              </span>
            ) : null}
            {processedResponse?.operator_pack?.needs_human_review ? (
              <span className="mt-2 block text-xs font-medium">
                El CRM lo marco para revision humana antes de responder.
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      )}

      {hasPublicFollowUp ? (
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-background to-sky-50 p-4 shadow-sm dark:border-emerald-900 dark:from-emerald-950/30 dark:via-background dark:to-sky-950/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-900">
                  Link seguro
                </Badge>
                <Badge variant="outline">{followUpBadgeLabel}</Badge>
              </div>
              <h3 className="mt-3 text-lg font-semibold">{followUpTitle}</h3>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {followUpDescription}
              </p>
            </div>
            {trackingCode ? (
              <div className="rounded-lg border bg-background px-4 py-3 text-left shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Codigo</p>
                <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                  <Hash className="h-4 w-4 text-primary" />
                  {trackingCode}
                </div>
              </div>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {trackingHref ? (
              <Button asChild variant="default" size="sm">
                <a href={trackingHref} target={openTargetForHref(trackingHref)} rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir seguimiento
                </a>
              </Button>
            ) : null}
            {trackingHref || trackingCode ? (
              <Button type="button" variant="outline" size="sm" onClick={copyFollowUpLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar seguimiento
              </Button>
            ) : null}
            {whatsappHandoffHref ? (
              <Button asChild variant="outline" size="sm">
                <a href={whatsappHandoffHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Continuar por WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {processedResponse && structuredFields.length ? (
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                Lo que entendimos
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Estos datos quedan normalizados para que el CRM responda sin volver a interpretar el papel o mensaje original.
              </p>
            </div>
            {processedResponse.structured_extraction?.confidence ? (
              <Badge variant="outline" className="w-fit">
                {String(processedResponse.structured_extraction.confidence).replace(/_/g, ' ')}
              </Badge>
            ) : null}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {structuredFields.slice(0, 9).map((field) => (
              <div key={field.key} className="rounded-lg border bg-muted/25 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{field.label}</p>
                <p className="mt-1 break-words text-sm font-medium">{field.value}</p>
              </div>
            ))}
          </div>
          {missingStructuredFields.length ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
              <p className="font-semibold">Falta completar</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {missingStructuredFields.slice(0, 8).map((field) => (
                  <Badge key={field} variant="outline" className="bg-background/80">
                    {STRUCTURED_FIELD_LABELS[field] || field.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {processedResponse && (publicActions.length > 0 || reviewActions.length > 0) ? (
        <div className="rounded-lg border bg-background p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Proximos pasos</p>
              <p className="text-xs text-muted-foreground">La solicitud ya quedo asociada al CRM del espacio.</p>
            </div>
            <Badge variant="outline">
              {processedResponse.crm_state === 'ready_for_confirmation' ? 'Lista para confirmar' : 'Revision operativa'}
            </Badge>
          </div>
          <Separator className="my-3" />
          {customerNextSteps.length ? (
            <div className="mb-3 grid gap-2 md:grid-cols-2">
              {customerNextSteps.map((step) => (
                <div key={step.id ?? step.label} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{step.label}</span>
                    <Badge variant="outline" className="shrink-0">
                      {step.status === 'done' ? 'Listo' : 'Pendiente'}
                    </Badge>
                  </div>
                  {step.description ? <p className="mt-1 text-xs text-muted-foreground">{step.description}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid gap-2 md:grid-cols-2">
            {publicActions.map((action) => (
              <Button key={action.id ?? action.label} asChild variant="outline" size="sm" className="justify-between">
                <a href={action.href} target={openTargetForHref(action.href)} rel="noreferrer">
                  <span>{action.label ?? 'Abrir'}</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ))}
            {reviewActions.slice(0, 3).map((action) => (
              <div key={action.id ?? action.label} className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <ArrowRight className="h-4 w-4 text-primary" />
                  {action.label}
                </div>
                {action.description ? <p className="mt-1 text-xs text-muted-foreground">{action.description}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error al procesar</AlertTitle>
          <AlertDescription>
            {error}
            <br />
            {isMarketplace
              ? 'Proba con una foto mas clara, un PDF mas liviano o deja tu contacto para que el equipo lo revise.'
              : 'Verifica que el archivo tenga el formato correcto y que tu sesion siga activa. Si el problema persiste, intenta nuevamente mas tarde.'}
          </AlertDescription>
        </Alert>
      )}

      {missingItems.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <FileWarning className="h-4 w-4" />
          <AlertTitle>Articulos para revision</AlertTitle>
          <AlertDescription>
            No pudimos asociar los siguientes items: {missingItems.join(', ')}. Quedaron marcados para revision comercial.
          </AlertDescription>
        </Alert>
      )}

      {isMarketplace ? (
        <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <div className="flex items-start gap-2">
            <ClipboardCheck className="mt-0.5 h-4 w-4 text-primary" />
            <span>Si el archivo o texto es claro, se arma un borrador con cantidades y productos del catalogo.</span>
          </div>
          <div className="flex items-start gap-2">
            <MessageCircle className="mt-0.5 h-4 w-4 text-primary" />
            <span>Si falta informacion, queda como lead para que el equipo lo complete por chat, WhatsApp, email o telefono.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default UploadOrderFromFile;
