import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ClipboardCheck,
  ClipboardList,
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
  X,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { TurnstileChallenge } from '@/components/security/TurnstileChallenge';
import { useTenant } from '@/context/TenantContext';
import { CLOUDFLARE_TURNSTILE_SITE_KEY } from '@/env';
import { cn } from '@/lib/utils';
import type {
  MarketAssistedIntakeEntry,
  MarketAssistedIntakeTextExample,
  MarketPublicSecurityContract,
} from '@/types/market';
import { ApiError, apiFetch, getErrorMessage } from '@/utils/api';

interface UploadOrderFromFileProps {
  onCartUpdated?: (items: unknown) => void;
  onProcessed?: (response: AssistedOrderUploadResponse) => void;
  tenantSlug?: string | null;
  variant?: 'inline' | 'marketplace' | 'crm';
  intakeEntry?: MarketAssistedIntakeEntry | null;
  fallbackWhatsappHref?: string | null;
  suggestedTextDraft?: string | null;
  suggestedTextDraftKey?: number | null;
  suggestedDocumentType?: string | null;
  securityContract?: MarketPublicSecurityContract | null;
  compactMarketplaceHeader?: boolean;
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

interface AssistedOperationalResult {
  contract_version?: string | null;
  type?: 'assisted_order_request' | 'municipal_ticket' | 'document_request' | string | null;
  request_kind?: string | null;
  request_kind_label?: string | null;
  created_record?: string | null;
  created_record_id?: number | string | null;
  pedido_id?: number | string | null;
  status?: string | null;
  status_label?: string | null;
  requires_operator_confirmation?: boolean | null;
  admin_surface?: string | null;
  admin_thread_binding?: string | null;
  record_reference?: string | null;
  tracking_path?: string | null;
  tracking_code?: string | null;
  tracking_kind?: string | null;
  customer_headline?: string | null;
  customer_description?: string | null;
  operator_next_step?: string | null;
  linked_record?: Record<string, unknown> | null;
}

interface AssistedOperatorTask {
  id?: string | null;
  label?: string | null;
  description?: string | null;
  tone?: string | null;
}

interface AssistedOperatorContactLink {
  type?: string | null;
  label?: string | null;
  href?: string | null;
}

interface AssistedOperatorSlaHint {
  label?: string | null;
  minutes?: number | string | null;
  severity?: string | null;
}

interface AssistedOperatorSummary {
  objective?: string | null;
  target_module?: string | null;
  recommended_next_step?: string | null;
  priority?: string | null;
  priority_reason_label?: string | null;
  sla_hint?: AssistedOperatorSlaHint | null;
  operator_queue?: string | null;
  operator_queue_label?: string | null;
  contact_state?: string | null;
}

interface CrmOrderDraftLine {
  status?: string | null;
  confirmation_state?: string | null;
  customer_visible_status?: string | null;
  source_name?: string | null;
  name?: string | null;
  normalized_name?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  catalog_item_id?: number | string | null;
  candidate_count?: number | string | null;
  confidence?: string | number | null;
}

interface CrmOrderDraftConfirmationReason {
  id?: string | null;
  label?: string | null;
  description?: string | null;
}

interface CrmOrderDraftConfirmation {
  contract_version?: string | null;
  status?: string | null;
  status_label?: string | null;
  headline?: string | null;
  description?: string | null;
  confidence_level?: string | null;
  confidence_score?: number | string | null;
  matched?: number | string | null;
  detected?: number | string | null;
  blocking_reasons?: CrmOrderDraftConfirmationReason[] | null;
  primary_action_id?: string | null;
  primary_action_label?: string | null;
  allowed_actions?: string[] | null;
}

interface CrmOrderDraft {
  contract_version?: string | null;
  reference?: string | null;
  contact_state?: string | null;
  recommended_next_step?: string | null;
  summary?: Record<string, unknown> | null;
  lines?: CrmOrderDraftLine[] | null;
  row_errors?: unknown[] | null;
  provider_status?: string | null;
  status?: string | null;
  state?: string | null;
  customer_confirmation?: CrmOrderDraftConfirmation | null;
  confirmation?: CrmOrderDraftConfirmation | null;
  source?: Record<string, unknown> | null;
}

type SourceAttachmentView = {
  url: string | null;
  name: string | null;
  id: string | null;
  mimeType: string | null;
  thumbnailUrl: string | null;
};

interface AssistedOrderUploadResponse {
  contract_version?: string;
  mode?: string;
  request_kind?: string;
  request_kind_label?: string;
  idempotency_key?: string | null;
  idempotent_replay?: boolean | null;
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
    row_errors?: unknown[] | null;
    provider_status?: string | null;
  } | null;
  items?: unknown[];
  no_encontrados?: unknown[];
  items_no_encontrados?: string[];
  pedido_id?: number | string;
  lead_id?: number | string;
  crm_state?: string;
  provider_status?: string | null;
  status?: string | null;
  state?: string | null;
  customer_message?: string;
  resumen?: string;
  row_errors?: unknown[];
  source?: {
    archivo_url?: string | null;
    archivo_nombre?: string | null;
    input_type?: string | null;
    text_preview?: string | null;
    provider_status?: string | null;
    row_errors?: unknown[] | null;
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
    priority?: string | null;
    priority_reason_label?: string | null;
    operator_queue?: string | null;
    operator_queue_label?: string | null;
    sla_hint?: AssistedOperatorSlaHint | null;
  };
  operational_result?: AssistedOperationalResult | null;
  operator_pack?: {
    suggested_reply?: string | null;
    needs_human_review?: boolean | null;
    priority?: string | null;
    priority_reason_label?: string | null;
    operator_queue?: string | null;
    operator_queue_label?: string | null;
    recommended_next_step?: string | null;
    sla_hint?: AssistedOperatorSlaHint | null;
    contact_links?: AssistedOperatorContactLink[] | null;
    suggested_tasks?: AssistedOperatorTask[] | null;
  };
  operator_intake_summary?: AssistedOperatorSummary | null;
  crm_order_draft?: CrmOrderDraft | null;
  crm_handoff?: {
    draft_order?: CrmOrderDraft | null;
    suggested_reply?: string | null;
    [key: string]: unknown;
  } | null;
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
  { value: 'other', label: 'Otro archivo', helper: 'El equipo lo clasifica antes de responder.' },
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number]['value'];
type DocumentTypeSelection = DocumentType | 'auto';
type DocumentTypeOption = {
  value: DocumentType;
  label: string;
  helper: string;
};

const AUTO_DOCUMENT_TYPE_OPTION = {
  value: 'auto' as const,
  label: 'Detección automática',
  helper: 'Chatboc clasifica la solicitud a partir del archivo o texto. Podés corregirla si ya conocés el tipo.',
};

const normalizeContractName = (value: string | null | undefined) => value?.trim() ?? '';

const isHeaderContractName = (value: string | null | undefined) => {
  const normalized = normalizeContractName(value);
  return /^x-/i.test(normalized);
};

const resolveCheckoutOrigin = (endpoint: string, isMarketplace: boolean) => {
  try {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost';
    const url = new URL(endpoint || '/', base);
    const fromQuery = url.searchParams.get('origen') || url.searchParams.get('origin');
    if (fromQuery?.trim()) return fromQuery.trim();
  } catch {
    // Keep the origin deterministic even when a tenant sends a non URL-like endpoint.
  }

  return isMarketplace ? 'marketplace' : 'web';
};

const normalizeIdempotencyPart = (value: string | null | undefined, fallback: string) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
};

const createAssistedIntakeIdempotencyKey = (
  tenantSlug: string | null | undefined,
  documentType: string,
  inputMode: 'file' | 'text',
) => {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  const randomPart =
    typeof cryptoApi?.randomUUID === 'function'
      ? cryptoApi.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return [
    'assisted_intake',
    normalizeIdempotencyPart(tenantSlug, 'global'),
    normalizeIdempotencyPart(documentType, 'document'),
    inputMode,
    randomPart,
  ].join(':');
};

const isStandardAssistedIntakeEndpoint = (endpoint: string) => /\/pedidos\/from-file/i.test(endpoint);

const buildSubmitTextFields = (primaryField: string, endpoint: string) => {
  const primary = normalizeContractName(primaryField);
  if (!/\/pedidos\/from-file/i.test(endpoint)) {
    return primary && !isHeaderContractName(primary) ? [primary] : [];
  }
  return Array.from(
    new Set(
      [
        primary,
        'pedido_text',
        'texto_pedido',
        'order_text',
        'notes_text',
        'message',
        'description',
        'descripcion',
        'texto',
        'text',
      ]
        .map(normalizeContractName)
        .filter((fieldName) => fieldName && !isHeaderContractName(fieldName)),
    ),
  );
};

const DEFAULT_MAX_SAFE_FILE_BYTES = 8 * 1024 * 1024;
const DEFAULT_ACCEPTED_FILE_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.csv', '.xls', '.xlsx', '.doc', '.docx', '.txt'];

type AssistedSubmitContract = NonNullable<MarketAssistedIntakeEntry['submit']>;

const normalizeAcceptedExtension = (extension: string | null | undefined) => {
  const normalized = String(extension ?? '').trim().toLowerCase();
  if (!normalized) return null;
  return normalized.startsWith('.') ? normalized : `.${normalized}`;
};

const normalizeAcceptedMimeType = (mimeType: string | null | undefined) => {
  const normalized = String(mimeType ?? '').trim().toLowerCase();
  return normalized || null;
};

const buildAcceptedFileSpec = (submitContract: AssistedSubmitContract | null) => {
  const contractMimeTypes =
    submitContract?.accepted_mime_types?.map(normalizeAcceptedMimeType).filter((value): value is string => Boolean(value)) ?? [];
  const contractExtensions =
    submitContract?.accepted_extensions?.map(normalizeAcceptedExtension).filter((value): value is string => Boolean(value)) ?? [];
  const hasExplicitAccept = contractMimeTypes.length > 0 || contractExtensions.length > 0;
  const extensions = hasExplicitAccept ? contractExtensions : DEFAULT_ACCEPTED_FILE_EXTENSIONS;
  const values = [...contractMimeTypes, ...extensions];
  return {
    values,
    mimeTypes: contractMimeTypes,
    extensions,
  };
};

const acceptedMimeMatches = (fileType: string, acceptedMimeType: string) => {
  if (!fileType) return false;
  if (acceptedMimeType.endsWith('/*')) {
    return fileType.startsWith(acceptedMimeType.slice(0, -1));
  }
  return fileType === acceptedMimeType;
};

const fileMatchesAcceptedSpec = (
  file: File,
  acceptedSpec: ReturnType<typeof buildAcceptedFileSpec>,
) => {
  const lowerName = file.name.toLowerCase();
  const fileType = normalizeAcceptedMimeType(file.type) ?? '';
  return (
    acceptedSpec.extensions.some((extension) => lowerName.endsWith(extension)) ||
    acceptedSpec.mimeTypes.some((mimeType) => acceptedMimeMatches(fileType, mimeType))
  );
};

const DEFAULT_MARKETPLACE_PIPELINE = [
  {
    id: 'capture',
    label: 'Foto o texto',
    description: 'El cliente sube papel, PDF, boleta o lista pegada sin registro.',
  },
  {
    id: 'ai_parse',
    label: 'Lectura ordenada',
    description: 'Chatboc separa articulos, cantidades, direccion, tramite y faltantes.',
  },
  {
    id: 'crm_handoff',
    label: 'Solicitud en panel',
    description: 'El panel recibe resumen, archivo original, candidatos y proximo paso.',
  },
  {
    id: 'public_follow_up',
    label: 'Respuesta y seguimiento',
    description: 'La respuesta sigue por WhatsApp, mail, llamada o link publico seguro.',
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
    document_type: 'handwritten_order',
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
  'Resumen con articulos, reclamos o datos detectados',
  'Cruce con catalogo y faltantes',
  'Categoria, area o tramite probable cuando no hay catalogo',
  'Link publico de seguimiento',
];

const PUBLIC_PIPELINE_LABELS: Record<string, string> = {
  capture: 'Foto o texto',
  ai_parse: 'Lectura ordenada',
  crm_handoff: 'Solicitud en panel',
  public_follow_up: 'Respuesta y seguimiento',
};

const PUBLIC_PIPELINE_DESCRIPTIONS: Record<string, string> = {
  capture: 'Foto, PDF, boleta o lista pegada sin registro.',
  ai_parse: 'Articulos, cantidades, direccion, tramite y faltantes.',
  crm_handoff: 'Resumen, archivo original, candidatos y proximo paso.',
  public_follow_up: 'WhatsApp, mail, llamada o link publico seguro.',
};

const MARKETPLACE_PIPELINE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  capture: Upload,
  ai_parse: Sparkles,
  crm_handoff: ClipboardList,
  public_follow_up: MessageCircle,
};

const getMarketplacePipelineIcon = (id?: string | null) =>
  MARKETPLACE_PIPELINE_ICONS[String(id ?? '')] ?? ClipboardCheck;

const publicFacingText = (value: unknown) =>
  String(value ?? '')
    .replace(/\bOCR\s*\+\s*IA\b/gi, 'Lectura del documento')
    .replace(/\bIntake\b/gi, 'Ingreso')
    .replace(/\bCRM\b/g, 'panel')
    .replace(/\bIA\b/g, 'lectura')
    .replace(/\s+/g, ' ')
    .trim();

const publicProductName = (value: unknown) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

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
    description: 'Contacto, canal sugerido, respuesta borrador y seguimiento publico para el equipo.',
  },
];

const PROCESSING_STEPS = [
  {
    id: 'capture',
    label: 'Entrada seleccionada',
    description: 'Archivo, foto, PDF o texto listo para iniciar la lectura.',
  },
  {
    id: 'ai_parse',
    label: 'Analizando datos',
    description: 'Buscamos articulos, cantidades, reclamos, tramites y datos faltantes.',
  },
  {
    id: 'crm_ready',
    label: 'Preparando la solicitud',
    description: 'Armamos la referencia y el contexto antes de enviarlos al equipo.',
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

const CRM_NEXT_STEP_LABELS: Record<string, string> = {
  resolver_items_y_cotizar: 'Resolver items y cotizar',
  confirmar_stock_y_precio: 'Confirmar stock y precio',
  responder_por_whatsapp: 'Responder por WhatsApp',
  derivar_a_operador: 'Derivar a operador',
  crear_reclamo: 'Crear reclamo',
  validar_documento: 'Validar documento',
};

const CRM_CONTACT_STATE_LABELS: Record<string, string> = {
  available: 'Contacto disponible',
  partial: 'Contacto parcial',
  missing: 'Falta contacto',
  unknown: 'Contacto sin validar',
};

const CRM_LINE_STATUS_LABELS: Record<string, string> = {
  matched: 'En catalogo',
  exact_match: 'En catalogo',
  needs_review: 'Revisar',
  unmatched: 'Sin match',
  candidate: 'Candidato',
};

const OPERATOR_PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta',
  normal: 'Normal',
  low: 'Baja',
};

const OPERATOR_NEXT_STEP_LABELS: Record<string, string> = {
  pedir_contacto_y_responder: 'Pedir contacto y responder',
  resolver_faltantes_y_responder: 'Resolver faltantes y responder',
  revisar_documento_y_responder: 'Revisar documento y responder',
  confirmar_stock_precio_y_responder: 'Confirmar stock, precio y responder',
  derivar_area_y_responder: 'Derivar area y responder',
};

const OPERATOR_QUEUE_LABELS: Record<string, string> = {
  commerce_assisted_orders: 'Pedidos asistidos',
  municipal_claims: 'Reclamos municipales',
  document_requests: 'Documentos y tramites',
};

const OPERATOR_CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  phone: 'Telefono',
  crm: 'Panel',
  web: 'Web',
  widget: 'Chat web',
};

const OPERATIONAL_SURFACE_LABELS: Record<string, string> = {
  orders: 'Pedidos asistidos',
  tickets: 'Reclamos',
  document_requests: 'Documentos y tramites',
};

const OPERATIONAL_RECORD_LABELS: Record<string, string> = {
  pedido_conversacional: 'Solicitud asistida',
  tenant_ticket: 'Ticket del equipo',
  municipio_ticket: 'Reclamo municipal',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const MANUAL_REVIEW_STATES = new Set([
  'manual_review',
  'human_review',
  'requires_manual_review',
  'needs_manual_review',
]);

const PROVIDER_FAILURE_STATES = new Set([
  'ai_unavailable',
  'provider_unavailable',
  'failed',
  'failure',
  'error',
  'legacy',
]);

const compactString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const normalized = String(value).trim();
    return normalized || null;
  }
  return null;
};

const isTurnstileSecurityError = (body: unknown): body is Record<string, unknown> => {
  if (!isRecord(body)) return false;
  const code = normalizeStateToken(body.codigo ?? body.code ?? body.error);
  const contract = isRecord(body.security) ? body.security : {};
  const provider = normalizeStateToken(contract.provider);
  const resetTurnstile = isRecord(body.frontend_contract) && body.frontend_contract.reset_turnstile === true;
  return (
    code === 'turnstile_verificacion_fallida' ||
    code === 'turnstile_no_configurado' ||
    provider === 'cloudflare_turnstile' ||
    resetTurnstile
  );
};

const normalizeStateToken = (value: unknown): string | null =>
  compactString(value)?.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || null;

const hasArrayItems = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

const hasManualReviewState = (...values: unknown[]): boolean =>
  values.some((value) => {
    const normalized = normalizeStateToken(value);
    return Boolean(normalized && MANUAL_REVIEW_STATES.has(normalized));
  });

const hasProviderFailureState = (...values: unknown[]): boolean =>
  values.some((value) => {
    const normalized = normalizeStateToken(value);
    return Boolean(normalized && PROVIDER_FAILURE_STATES.has(normalized));
  });

const prettifyToken = (value: unknown, labels: Record<string, string> = {}) => {
  const normalized = compactString(value);
  if (!normalized) return null;
  const key = normalized.toLowerCase();
  if (labels[key]) return labels[key];
  return key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const readSummaryNumber = (summary: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!summary) return null;
  for (const key of keys) {
    const value = summary[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

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

const getCrmOrderDraft = (response?: AssistedOrderUploadResponse | null): CrmOrderDraft | null => {
  if (!response) return null;
  if (isRecord(response.crm_order_draft)) return response.crm_order_draft as CrmOrderDraft;
  if (isRecord(response.crm_handoff) && isRecord(response.crm_handoff.draft_order)) {
    return response.crm_handoff.draft_order as CrmOrderDraft;
  }
  return null;
};

const isAssistedUploadManualReview = (response?: AssistedOrderUploadResponse | null): boolean => {
  if (!response) return false;
  const responseRecord = response as Record<string, unknown>;
  const draft = getCrmOrderDraft(response);
  const draftRecord = isRecord(draft) ? draft : {};
  const sourceRecord = (isRecord(response.source) ? response.source : {}) as Record<string, unknown>;
  const structuredRecord = (isRecord(response.structured_extraction) ? response.structured_extraction : {}) as Record<string, unknown>;
  const crmHandoffRecord = (isRecord(response.crm_handoff) ? response.crm_handoff : {}) as Record<string, unknown>;
  const draftSourceRecord = isRecord(draft?.source) ? draft.source : {};
  const hasUsableDraftLines = Array.isArray(draft?.lines) && draft.lines.length > 0;

  const hasExplicitManualState = hasManualReviewState(
    response.crm_state,
    response.status,
    response.state,
    draft?.status,
    draft?.state,
    crmHandoffRecord.status,
    crmHandoffRecord.state,
  );
  const hasProviderFailure = hasProviderFailureState(
    response.provider_status,
    responseRecord.providerStatus,
    sourceRecord.provider_status,
    sourceRecord.providerStatus,
    structuredRecord.provider_status,
    structuredRecord.providerStatus,
    draft?.provider_status,
    draftSourceRecord.provider_status,
    draftSourceRecord.providerStatus,
  );
  const hasRowErrors =
    hasArrayItems(response.row_errors) ||
    hasArrayItems(responseRecord.rowErrors) ||
    hasArrayItems(sourceRecord.row_errors) ||
    hasArrayItems(structuredRecord.row_errors) ||
    hasArrayItems(draft?.row_errors) ||
    hasArrayItems(draftRecord.rowErrors) ||
    hasArrayItems(draftSourceRecord.row_errors) ||
    hasArrayItems(crmHandoffRecord.row_errors);
  const reviewRequestedWithoutDraft =
    (response.operator_pack?.needs_human_review === true ||
      response.match_summary?.needs_operator_review === true) &&
    !hasUsableDraftLines;

  return hasExplicitManualState || hasProviderFailure || hasRowErrors || reviewRequestedWithoutDraft;
};

const getCrmSuggestedReply = (response?: AssistedOrderUploadResponse | null) => {
  const fromPack = compactString(response?.operator_pack?.suggested_reply);
  if (fromPack) return fromPack;
  if (isRecord(response?.crm_handoff)) return compactString(response.crm_handoff.suggested_reply);
  return null;
};

const publicOperatorText = (value: unknown) => publicFacingText(value);

const getOperatorTasks = (tasks?: AssistedOperatorTask[] | null) =>
  Array.isArray(tasks)
    ? tasks
        .map((task) => ({
          id: compactString(task.id) ?? publicOperatorText(task.label),
          label: publicOperatorText(task.label),
          description: publicOperatorText(task.description),
          tone: compactString(task.tone),
        }))
        .filter((task) => task.label)
        .slice(0, 4)
    : [];

const getOperatorChannels = (
  contactLinks?: AssistedOperatorContactLink[] | null,
  recommendedChannels?: string[] | null,
) => {
  const fromLinks = Array.isArray(contactLinks)
    ? contactLinks.map((link) => compactString(link.type) ?? compactString(link.label))
    : [];
  const source = fromLinks.length ? fromLinks : (recommendedChannels ?? []);
  const seen = new Set<string>();
  return source
    .map((channel) => compactString(channel))
    .filter((channel): channel is string => Boolean(channel))
    .map((channel) => {
      const key = channel.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return OPERATOR_CHANNEL_LABELS[key] ?? prettifyToken(channel) ?? channel;
    })
    .filter((channel): channel is string => Boolean(channel))
    .slice(0, 4);
};

const getCrmLineName = (line: CrmOrderDraftLine) =>
  compactString(line.source_name) ??
  compactString(line.name) ??
  compactString(line.normalized_name) ??
  'Item detectado';

const getCrmLineQuantity = (line: CrmOrderDraftLine) => {
  const quantity = compactString(line.quantity);
  const unit = compactString(line.unit);
  if (quantity && unit) return `${quantity} ${unit}`;
  return quantity ?? unit ?? null;
};

const getCrmDraftConfirmation = (draft?: CrmOrderDraft | null): CrmOrderDraftConfirmation | null => {
  const confirmation = draft?.customer_confirmation ?? draft?.confirmation;
  return isRecord(confirmation) ? (confirmation as CrmOrderDraftConfirmation) : null;
};

const isReadyConfirmationStatus = (status?: string | null) =>
  normalizeStateToken(status) === 'ready_for_customer_confirmation';

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

const normalizeAttachmentRecord = (
  attachment: Record<string, unknown>,
  source?: Record<string, unknown> | null,
): SourceAttachmentView | null => {
  const url = compactString(
    attachment.url ??
      attachment.href ??
      attachment.archivo_url ??
      attachment.file_url ??
      attachment.fileUrl ??
      attachment.download_url ??
      attachment.downloadUrl ??
      attachment.public_url ??
      attachment.publicUrl ??
      attachment.secure_url ??
      attachment.secureUrl ??
      source?.archivo_url,
  );
  const name = compactString(
    attachment.name ??
      attachment.filename ??
      attachment.fileName ??
      attachment.original_filename ??
      attachment.originalFilename ??
      attachment.archivo_nombre ??
      attachment.title ??
      attachment.label ??
      source?.archivo_nombre ??
      source?.original_filename,
  );
  const id = compactString(
    attachment.id ??
      attachment.attachment_id ??
      attachment.attachmentId ??
      attachment.source_attachment_id ??
      attachment.sourceAttachmentId ??
      attachment.upload_id ??
      attachment.uploadId ??
      attachment.file_id ??
      attachment.fileId ??
      source?.attachment_id ??
      source?.source_attachment_id,
  );
  const mimeType = compactString(
    attachment.mimeType ??
      attachment.mime_type ??
      attachment.content_type ??
      attachment.contentType ??
      attachment.type ??
      source?.mime_type ??
      source?.mimeType,
  );
  const thumbnailUrl = compactString(
    attachment.thumbnailUrl ??
      attachment.thumbnail_url ??
      attachment.thumbUrl ??
      attachment.thumb_url ??
      attachment.preview_url ??
      attachment.previewUrl ??
      source?.thumbnail_url ??
      source?.thumbnailUrl,
  );

  return url || name || id || mimeType || thumbnailUrl ? { url, name, id, mimeType, thumbnailUrl } : null;
};

const normalizeSourceAttachment = (payload?: unknown): SourceAttachmentView | null => {
  if (!isRecord(payload)) return null;
  const source = isRecord(payload.source) ? payload.source : null;
  const candidateGroups: Array<[Record<string, unknown> | null, string[]]> = [
    [payload, ['source_attachment', 'sourceAttachment']],
    [payload, ['attachmentInfo', 'attachment_info']],
    [source, ['source_attachment', 'sourceAttachment']],
    [source, ['attachmentInfo', 'attachment_info']],
  ];

  for (const [record, keys] of candidateGroups) {
    if (!record) continue;
    for (const key of keys) {
      const candidate = record[key];
      if (isRecord(candidate)) {
        const normalized = normalizeAttachmentRecord(candidate, source);
        if (normalized) return normalized;
      }
    }
  }

  return source ? normalizeAttachmentRecord({}, source) : null;
};

const IMAGE_ATTACHMENT_EXT_RE = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

const isImageAttachmentUrl = (url?: string | null) =>
  Boolean(url && (/^data:image\//i.test(url) || IMAGE_ATTACHMENT_EXT_RE.test(url)));

const isImageAttachment = (attachment: SourceAttachmentView) => {
  const mimeType = attachment.mimeType?.toLowerCase() ?? '';
  return mimeType.startsWith('image/') || mimeType === 'image' || isImageAttachmentUrl(attachment.url) || isImageAttachmentUrl(attachment.thumbnailUrl);
};

const buildWhatsappFollowUpHref = (baseHref: string | null | undefined, requestId: number | string | null) => {
  if (!baseHref) return null;

  const reference = requestId ? ` Referencia #${requestId}.` : '';
  const text = `Hola, subi una solicitud en Chatboc.${reference} Quiero continuar por WhatsApp.`;

  try {
    const url = new URL(baseHref);
    if (url.hostname.includes('wa.me') || url.hostname.includes('whatsapp.com')) {
      url.searchParams.set('text', text);
      return url.toString();
    }
  } catch {
    return baseHref;
  }

  return baseHref;
};

const isDocumentType = (value?: string | null): value is DocumentType =>
  DOCUMENT_TYPES.some((item) => item.value === value);

const formatPendingFileSize = (size: number) => {
  if (!Number.isFinite(size) || size <= 0) return '0 KB';
  const mb = size / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
};

const UploadOrderFromFile: React.FC<UploadOrderFromFileProps> = ({
  onCartUpdated,
  onProcessed,
  tenantSlug,
  variant = 'inline',
  intakeEntry,
  fallbackWhatsappHref,
  suggestedTextDraft,
  suggestedTextDraftKey,
  suggestedDocumentType,
  securityContract,
  compactMarketplaceHeader = false,
  className,
  id,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastSuggestedTextDraftRef = useRef('');
  const assistedIntakeIdempotencyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const { currentSlug } = useTenant();
  const effectiveTenantSlug = tenantSlug ?? currentSlug ?? null;
  const isMarketplace = variant === 'marketplace';
  const isCrm = variant === 'crm';
  const isAssistedSurface = isMarketplace || isCrm;

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [missingItems, setMissingItems] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [matchSummary, setMatchSummary] = useState<AssistedOrderUploadResponse['match_summary'] | null>(null);
  const [processedResponse, setProcessedResponse] = useState<AssistedOrderUploadResponse | null>(null);
  const [documentType, setDocumentType] = useState<DocumentTypeSelection>(
    variant === 'marketplace' ? 'auto' : 'order_note',
  );
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [orderText, setOrderText] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const turnstileContract = securityContract?.turnstile ?? null;
  const hasExplicitTurnstileContract = Boolean(turnstileContract);
  const turnstileRequired = Boolean(
    isMarketplace &&
      turnstileContract &&
      (turnstileContract.required === true ||
        turnstileContract.enforced === true ||
        turnstileContract.status === 'required'),
  );
  const turnstileSiteKey =
    isMarketplace && (!hasExplicitTurnstileContract || turnstileRequired)
      ? CLOUDFLARE_TURNSTILE_SITE_KEY
      : '';
  const turnstileEnabled = Boolean(turnstileSiteKey);
  const turnstileUnavailable = Boolean(isMarketplace && turnstileRequired && !turnstileSiteKey);
  const turnstileRequiresToken = turnstileEnabled && (!hasExplicitTurnstileContract || turnstileRequired);

  useEffect(() => {
    const nextDraft = String(suggestedTextDraft || '').trim();
    const previousDraft = lastSuggestedTextDraftRef.current;
    if (!nextDraft) {
      lastSuggestedTextDraftRef.current = '';
      return;
    }
    setOrderText((current) => {
      if (current.trim() && current !== previousDraft) return current;
      lastSuggestedTextDraftRef.current = nextDraft;
      return nextDraft;
    });
  }, [suggestedTextDraft, suggestedTextDraftKey]);

  useEffect(() => {
    if (!isDocumentType(suggestedDocumentType)) return;
    setDocumentType((current) => (current === 'auto' || current === 'order_note' ? suggestedDocumentType : current));
  }, [suggestedDocumentType]);

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
          helper: item.helper || fallback?.helper || 'Solicitud asistida para revisar antes de responder.',
        };
      })
      .filter((item): item is DocumentTypeOption => Boolean(item));
    return normalized.length ? normalized : [...DOCUMENT_TYPES];
  }, [intakeEntry?.document_types]);
  const intakeExperience = processedResponse?.intake_experience ?? intakeEntry ?? null;
  const submitContract = intakeExperience?.submit ?? null;
  const hasExplicitIntakeContract = Boolean(intakeExperience);
  const submitEndpoint = submitContract?.endpoint || (!hasExplicitIntakeContract ? '/api/pedidos/from-file?origen=marketplace' : '');
  const supportsAutomaticDocumentType = isMarketplace && isStandardAssistedIntakeEndpoint(submitEndpoint);
  const effectiveDocumentType: DocumentTypeSelection =
    documentType === 'auto' && !supportsAutomaticDocumentType ? 'order_note' : documentType;
  const submissionDocumentType = effectiveDocumentType === 'auto' ? null : effectiveDocumentType;
  const activeDocumentType = useMemo(
    () =>
      effectiveDocumentType === 'auto'
        ? AUTO_DOCUMENT_TYPE_OPTION
        : documentTypeOptions.find((item) => item.value === effectiveDocumentType) ?? selectedDocumentType,
    [documentTypeOptions, effectiveDocumentType, selectedDocumentType],
  );
  const canSubmitToServer = !isMarketplace || Boolean(submitEndpoint);
  const submitDisabled = uploading || !canSubmitToServer || turnstileUnavailable;
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
  const submitAcceptedFileSpec = useMemo(
    () => buildAcceptedFileSpec(submitContract),
    [submitContract?.accepted_extensions, submitContract?.accepted_mime_types],
  );
  const submitAccept = submitAcceptedFileSpec.values.join(',');
  const submitAcceptedLabel = useMemo(() => {
    const extensionLabels = submitAcceptedFileSpec.extensions
      .map((extension) => extension.replace(/^\./, '').trim().toUpperCase())
      .filter(Boolean);
    const mimeLabels = submitAcceptedFileSpec.mimeTypes
      .map((mimeType) => {
        const normalized = mimeType.toLowerCase();
        if (normalized.includes('jpeg')) return 'JPG';
        if (normalized.includes('png')) return 'PNG';
        if (normalized.includes('webp')) return 'WEBP';
        if (normalized.includes('pdf')) return 'PDF';
        if (normalized.includes('csv')) return 'CSV';
        if (normalized.includes('spreadsheet') || normalized.includes('excel')) return 'EXCEL';
        if (normalized.includes('wordprocessing') || normalized.includes('msword')) return 'WORD';
        if (normalized.includes('plain')) return 'TXT';
        if (normalized.startsWith('image/')) return 'IMAGEN';
        return null;
      })
      .filter((label): label is string => Boolean(label));
    const labels = Array.from(new Set([...extensionLabels, ...mimeLabels]));
    const order = ['JPG', 'JPEG', 'PNG', 'WEBP', 'PDF', 'TXT', 'CSV', 'XLS', 'XLSX', 'EXCEL', 'DOC', 'DOCX', 'WORD'];
    const sorted = labels.sort((a, b) => {
      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
    return sorted.length ? sorted.join(', ') : 'PDF, JPG, PNG, WEBP, CSV, Excel, Word o TXT';
  }, [submitAcceptedFileSpec]);
  const submitMaxFileMbLabel = Math.max(1, Math.floor(submitMaxFileBytes / (1024 * 1024)));
  const marketplacePipeline = (
    intakeExperience?.pipeline?.length ? intakeExperience.pipeline.slice(0, 4) : DEFAULT_MARKETPLACE_PIPELINE
  ).map((step) => ({
    ...step,
    label: PUBLIC_PIPELINE_LABELS[String(step.id ?? '')] ?? publicFacingText(step.label),
    description: PUBLIC_PIPELINE_DESCRIPTIONS[String(step.id ?? '')] ?? publicFacingText(step.description),
  }));
  const marketplaceExamples = intakeExperience?.input_examples?.length
    ? intakeExperience.input_examples.slice(0, 4)
    : DEFAULT_MARKETPLACE_EXAMPLES;
  const marketplaceTextExamples = intakeExperience?.text_examples?.length
    ? intakeExperience.text_examples.filter((example) => example?.label && example?.text).slice(0, 4)
    : DEFAULT_TEXT_EXAMPLES;
  const crmReceives = (intakeExperience?.crm_receives?.length ? intakeExperience.crm_receives.slice(0, 5) : CRM_RECEIVES)
    .map(publicFacingText)
    .filter(Boolean);
  const publicIntakeTitle =
    publicFacingText(intakeExperience?.title) || 'Subi una nota, foto o pedido y Chatboc lo convierte en solicitud trazable';
  const publicIntakeSummary =
    publicFacingText(intakeExperience?.summary) ||
    'Subi una foto de papel, pega una lista o adjunta una boleta: el equipo recibe la solicitud ordenada, con datos faltantes y un canal claro para responderte.';
  const publicIntakeDisplayName =
    publicProductName(intakeExperience?.display_name) ||
    publicProductName(intakeExperience?.product_surface?.name) ||
    publicProductName((intakeExperience?.frontend_contract as Record<string, unknown> | null | undefined)?.display_name) ||
    'Vega Marketplace IA';

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
    if (!canSubmitToServer) {
      setError('Este marketplace todavia no habilito la carga asistida desde el backend.');
      return;
    }
    if (turnstileUnavailable) {
      setError('Cloudflare Turnstile esta requerido, pero falta configurar la site key publica en el frontend.');
      return;
    }
    if (turnstileRequiresToken && !turnstileToken.trim()) {
      setError('Completa la verificacion de seguridad para enviar la solicitud anonima.');
      return;
    }
    if (file && !fileMatchesAcceptedSpec(file, submitAcceptedFileSpec)) {
      setError(`Formato no aceptado. Usa ${submitAcceptedLabel}.`);
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
    setStatusMessage(
      file
        ? `Subiendo ${file.name} y preparando lectura...`
        : submissionDocumentType
          ? `Analizando ${activeDocumentType.label.toLowerCase()} para separar articulos y datos...`
          : 'Analizando el contenido para detectar el tipo y separar artículos y datos...',
    );
    setProgress(10);

    try {
      const endpoint = isMarketplace ? submitEndpoint : isCrm ? '/api/pedidos/from-file?origen=crm_admin' : '/api/pedidos/from-file';
      const inputMode = file ? 'file' : 'text';
      const idempotencyFingerprint = JSON.stringify([
        endpoint,
        effectiveTenantSlug ?? 'global',
        submissionDocumentType ?? 'auto',
        inputMode,
        file ? `${file.name}:${file.size}:${file.type}:${file.lastModified}` : normalizedText,
        contactName.trim(),
        contactPhone.trim(),
        contactEmail.trim(),
        contactNotes.trim(),
      ]);
      let idempotencyKey: string | null = null;
      if (isStandardAssistedIntakeEndpoint(endpoint)) {
        const cached = assistedIntakeIdempotencyRef.current;
        if (!cached || cached.fingerprint !== idempotencyFingerprint) {
          assistedIntakeIdempotencyRef.current = {
            fingerprint: idempotencyFingerprint,
            key: createAssistedIntakeIdempotencyKey(effectiveTenantSlug, submissionDocumentType ?? 'auto', inputMode),
          };
        }
        idempotencyKey = assistedIntakeIdempotencyRef.current.key;
      }

      const formData = new FormData();
      if (file) {
        formData.append(submitFileField, file, file.name);
      }
      if (normalizedText) {
        buildSubmitTextFields(submitTextField, endpoint).forEach((fieldName) => {
          formData.append(fieldName, normalizedText);
        });
      }
      if (submissionDocumentType) {
        formData.append(submitDocumentTypeField, submissionDocumentType);
      }
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
        submitTenantFields
          .map(normalizeContractName)
          .filter((fieldName) => fieldName && !isHeaderContractName(fieldName))
          .forEach((fieldName) => formData.append(fieldName, effectiveTenantSlug));
      }
      if (idempotencyKey) {
        formData.append('idempotency_key', idempotencyKey);
      }
      if (turnstileToken.trim()) {
        formData.append('turnstile_token', turnstileToken.trim());
      }

      const submitHeaderNames = Array.from(
        new Map(
          [
            ...(submitContract?.headers ?? []),
            ...submitTenantFields.filter(isHeaderContractName),
          ]
            .map(normalizeContractName)
            .filter(Boolean)
            .map((headerName) => [headerName.toLowerCase(), headerName] as const),
        ).values(),
      );
      const submitHeaders = submitHeaderNames.reduce<Record<string, string>>((headers, headerName) => {
        if (/^x-tenant(?:-slug)?$/i.test(headerName) && effectiveTenantSlug) {
          headers[headerName] = effectiveTenantSlug;
        } else if (/^x-checkout-origin$/i.test(headerName)) {
          headers[headerName] = resolveCheckoutOrigin(endpoint, isMarketplace);
        } else if (/^(?:x-)?idempotency-key$/i.test(headerName) && idempotencyKey) {
          headers[headerName] = idempotencyKey;
        }
        return headers;
      }, {});
      if (
        idempotencyKey &&
        !Object.keys(submitHeaders).some((headerName) => /^(?:x-)?idempotency-key$/i.test(headerName))
      ) {
        submitHeaders['Idempotency-Key'] = idempotencyKey;
      }
      const response = await apiFetch<AssistedOrderUploadResponse>(
        endpoint,
        {
          method: submitMethod,
          body: formData,
          ...(Object.keys(submitHeaders).length ? { headers: submitHeaders } : {}),
          skipAuth: isMarketplace,
          omitCredentials: isMarketplace,
          sendAnonId: !isCrm,
          tenantSlug: effectiveTenantSlug ?? undefined,
          suppressPanel401Redirect: isMarketplace,
          onResponse: (res) => {
            const total = Number(res.headers.get('Content-Length'));
            if (Number.isFinite(total) && total > 0) {
              setProgress(70);
              setStatusMessage('Terminamos la lectura inicial; armando constancia y proximo paso...');
            }
          },
        },
      );

      setProgress(90);
      setStatusMessage('Preparando solicitud para que el equipo responda sin perder contexto...');
      setMatchSummary(response?.match_summary ?? null);
      setProcessedResponse(response ?? null);
      const responseNeedsManualReview = isAssistedUploadManualReview(response);

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
        response?.customer_message ??
          response?.resumen ??
          (responseNeedsManualReview
            ? 'Recibimos la solicitud, pero la lectura automatica no genero un borrador confiable. Queda en revision manual con el archivo o texto original.'
            : 'Hemos armado un borrador en base a tu archivo.'),
      );
      if (normalizedText) {
        setOrderText('');
      }
      if (file) {
        setPendingFile(null);
      }
      setStatusMessage(
        responseNeedsManualReview
          ? 'Solicitud recibida: requiere revision manual antes de responder.'
          : 'Solicitud procesada: quedo lista para revision, respuesta y seguimiento.',
      );
      assistedIntakeIdempotencyRef.current = null;
    } catch (uploadError) {
      if (uploadError instanceof ApiError) {
        if (isTurnstileSecurityError(uploadError.body)) {
          setTurnstileToken('');
          setTurnstileResetSignal((value) => value + 1);
          setError(
            compactString(uploadError.body?.mensaje) ||
              'No pudimos validar la verificacion de seguridad. Completala otra vez e intenta nuevamente.',
          );
          setStatusMessage(null);
          return;
        }
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

  const stageFileForAssistedSurface = (file: File | null | undefined) => {
    if (!file) return;
    if (file && !fileMatchesAcceptedSpec(file, submitAcceptedFileSpec)) {
      setPendingFile(null);
      setError(`Formato no aceptado. Usa ${submitAcceptedLabel}.`);
      return;
    }
    if (file.size > submitMaxFileBytes) {
      const maxMb = Math.max(1, Math.floor(submitMaxFileBytes / (1024 * 1024)));
      setPendingFile(null);
      setError(`El archivo supera el limite de ${maxMb} MB para este marketplace.`);
      return;
    }
    setPendingFile(file);
    setError(null);
    setSuccessMessage(null);
    setStatusMessage(null);
    setMatchSummary(null);
    setProcessedResponse(null);
  };

  const processText = async () => {
    await processRequest({ text: orderText });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (isAssistedSurface) {
      stageFileForAssistedSurface(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    await processFile(file);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (uploading) return;
    const file = event.dataTransfer.files?.[0];
    if (isAssistedSurface) {
      stageFileForAssistedSurface(file);
      return;
    }
    await processFile(file);
  };

  const enabledActions = processedResponse?.next_actions?.filter((action) => action.enabled !== false) ?? [];
  const publicActions = enabledActions.filter((action) => action.type === 'link' && action.href);
  const reviewActions = enabledActions.filter((action) => action.type !== 'link');
  const customerNextSteps = processedResponse?.customer_next_steps ?? [];
  const requestId = processedResponse?.pedido_id ?? processedResponse?.lead_id ?? null;
  const needsManualReview = isAssistedUploadManualReview(processedResponse);
  const requestJourneySteps = processedResponse
    ? needsManualReview
      ? [
          {
            id: 'capture',
            label: 'Entrada conservada',
            description: 'El archivo o texto original quedo asociado a la referencia.',
          },
          {
            id: 'ai_parse',
            label: 'Lectura para revisar',
            description: 'La IA no confirmo todos los datos y dejo las advertencias visibles.',
          },
          {
            id: 'crm_ready',
            label: 'Caso enviado al equipo',
            description: 'Quedo en revision manual para responder sin perder el contenido original.',
          },
        ]
      : [
          {
            id: 'capture',
            label: 'Entrada conservada',
            description: 'El archivo o texto original quedo asociado a la referencia.',
          },
          {
            id: 'ai_parse',
            label: 'Datos identificados',
            description: 'Articulos, cantidades y contexto ya fueron extraidos para revision.',
          },
          {
            id: 'crm_ready',
            label: 'Solicitud lista',
            description: 'El equipo recibio el borrador, la referencia y los proximos pasos.',
          },
        ]
    : PROCESSING_STEPS;
  const operationalResult = isRecord(processedResponse?.operational_result)
    ? processedResponse.operational_result
    : null;
  const trackingAction = enabledActions.find((action) => action.id === 'tracking' || action.tracking_code);
  const whatsappHandoffAction =
    processedResponse?.public_follow_up?.channels?.find((action) => action.id === 'whatsapp_handoff' && action.href) ??
    enabledActions.find((action) => action.id === 'whatsapp_handoff' && action.href);
  const trackingCode =
    processedResponse?.public_follow_up?.tracking?.code ??
    operationalResult?.tracking_code ??
    trackingAction?.tracking_code ??
    null;
  const referenceCode = trackingCode ?? compactString(operationalResult?.record_reference) ?? (requestId ? String(requestId) : null);
  const trackingPath =
    processedResponse?.public_follow_up?.tracking?.path ??
    operationalResult?.tracking_path ??
    trackingAction?.href ??
    null;
  const trackingHref = makeAbsoluteHref(trackingPath);
  const whatsappHandoffHref =
    whatsappHandoffAction?.href ??
    buildWhatsappFollowUpHref(fallbackWhatsappHref, requestId);
  const hasRealTracking = Boolean(trackingCode || trackingHref);
  const hasPublicFollowUp = Boolean(processedResponse && (hasRealTracking || whatsappHandoffHref || requestId || operationalResult));
  const trackingKind = processedResponse?.public_follow_up?.tracking?.kind ?? operationalResult?.tracking_kind ?? null;
  const isClaimFollowUp =
    trackingKind === 'claim' ||
    processedResponse?.request_kind === 'service_request' ||
    operationalResult?.type === 'municipal_ticket';
  const operationalSurfaceLabel =
    prettifyToken(operationalResult?.admin_surface, OPERATIONAL_SURFACE_LABELS) ??
    (isClaimFollowUp ? 'Reclamos' : 'Pedidos asistidos');
  const operationalRecordLabel =
    prettifyToken(operationalResult?.created_record, OPERATIONAL_RECORD_LABELS) ??
    (isClaimFollowUp ? 'Reclamo municipal' : 'Solicitud asistida');
  const operationalStatusLabel =
    publicOperatorText(operationalResult?.status_label) ??
    (needsManualReview ? 'Revision del equipo' : isClaimFollowUp ? 'Reclamo creado' : 'Solicitud recibida');
  const operationalNextStepLabel =
    publicOperatorText(operationalResult?.operator_next_step) ??
    (isClaimFollowUp ? 'Revisar reclamo y actualizar estado' : 'Resolver faltantes y responder');
  const followUpBadgeLabel = hasRealTracking
    ? isClaimFollowUp ? 'Reclamo trazable' : 'Pedido trazable'
    : operationalStatusLabel;
  const followUpTitle = operationalResult?.customer_headline
    ? operationalResult.customer_headline
    : hasRealTracking
    ? isClaimFollowUp ? 'Seguimiento de reclamo creado' : 'Seguimiento publico creado'
    : 'Referencia recibida';
  const followUpDescription = operationalResult?.customer_description
    ? operationalResult.customer_description
    : !hasRealTracking
    ? 'La solicitud quedo registrada para el equipo. Si todavia no hay link publico, la referencia permite continuar por WhatsApp sin perder el contexto.'
    : isClaimFollowUp
    ? 'El vecino puede consultar el estado, agregar datos y continuar por WhatsApp sin registrarse. El equipo conserva el archivo o texto original, la lectura y el ticket municipal.'
    : 'El cliente puede consultar el estado y continuar por WhatsApp sin registrarse. El equipo conserva el archivo o texto original y la lectura.';
  const structuredFields = structuredFieldEntries(processedResponse?.structured_extraction?.fields);
  const missingStructuredFields = processedResponse?.structured_extraction?.missing_fields?.filter(Boolean) ?? [];
  const crmDraft = getCrmOrderDraft(processedResponse);
  const crmDraftSummary = isRecord(crmDraft?.summary) ? crmDraft.summary : null;
  const crmDraftLines = Array.isArray(crmDraft?.lines)
    ? crmDraft.lines.filter(isRecord).slice(0, 6) as CrmOrderDraftLine[]
    : [];
  const crmDraftDetected = readSummaryNumber(crmDraftSummary, ['detected', 'total']) ?? matchSummary?.detected ?? 0;
  const crmDraftMatched = readSummaryNumber(crmDraftSummary, ['matched']) ?? matchSummary?.matched ?? 0;
  const crmDraftUnmatched = readSummaryNumber(crmDraftSummary, ['unmatched', 'needs_review']) ?? matchSummary?.unmatched ?? 0;
  const crmDraftReference = compactString(crmDraft?.reference) ?? referenceCode;
  const crmDraftContactState = prettifyToken(crmDraft?.contact_state, CRM_CONTACT_STATE_LABELS);
  const crmDraftNextStep = prettifyToken(crmDraft?.recommended_next_step, CRM_NEXT_STEP_LABELS);
  const crmDraftConfirmation = getCrmDraftConfirmation(crmDraft);
  const crmDraftConfirmationReasons = Array.isArray(crmDraftConfirmation?.blocking_reasons)
    ? crmDraftConfirmation.blocking_reasons.filter(isRecord).slice(0, 4) as CrmOrderDraftConfirmationReason[]
    : [];
  const crmDraftIsReadyToConfirm = isReadyConfirmationStatus(crmDraftConfirmation?.status);
  const crmSuggestedReply = getCrmSuggestedReply(processedResponse);
  const operatorPack = processedResponse?.operator_pack ?? null;
  const operatorSummary = processedResponse?.operator_intake_summary ?? null;
  const operatorPriorityLabel = prettifyToken(
    operatorSummary?.priority ?? operatorPack?.priority ?? processedResponse?.review_context?.priority,
    OPERATOR_PRIORITY_LABELS,
  );
  const operatorQueueLabel =
    publicOperatorText(
      operatorSummary?.operator_queue_label ??
        operatorPack?.operator_queue_label ??
        processedResponse?.review_context?.operator_queue_label,
    ) ||
    prettifyToken(
      operatorSummary?.operator_queue ?? operatorPack?.operator_queue ?? processedResponse?.review_context?.operator_queue,
      OPERATOR_QUEUE_LABELS,
    );
  const operatorNextStepLabel = prettifyToken(
    operatorSummary?.recommended_next_step ?? operatorPack?.recommended_next_step ?? crmDraft?.recommended_next_step,
    { ...CRM_NEXT_STEP_LABELS, ...OPERATOR_NEXT_STEP_LABELS },
  );
  const operatorSlaLabel = compactString(
    operatorSummary?.sla_hint?.label ?? operatorPack?.sla_hint?.label ?? processedResponse?.review_context?.sla_hint?.label,
  );
  const operatorReasonLabel = publicOperatorText(
    operatorSummary?.priority_reason_label ??
      operatorPack?.priority_reason_label ??
      processedResponse?.review_context?.priority_reason_label,
  );
  const operatorObjective = publicOperatorText(operatorSummary?.objective ?? processedResponse?.document_profile?.operator_goal);
  const operatorTasks = getOperatorTasks(operatorPack?.suggested_tasks);
  const operatorChannels = getOperatorChannels(operatorPack?.contact_links, processedResponse?.review_context?.recommended_channels);
  const hasOperatorHandoff = Boolean(
    processedResponse &&
      (operatorPriorityLabel ||
        operatorQueueLabel ||
        operatorNextStepLabel ||
        operatorSlaLabel ||
        operatorReasonLabel ||
        operatorObjective ||
        operatorTasks.length ||
        operatorChannels.length),
  );
  const sourceAttachment = normalizeSourceAttachment(processedResponse);
  const sourceAttachmentIsImage = sourceAttachment ? isImageAttachment(sourceAttachment) : false;
  const sourceAttachmentPreviewUrl = sourceAttachmentIsImage ? sourceAttachment?.thumbnailUrl ?? sourceAttachment?.url : null;
  const copyFollowUpLink = async () => {
    const value = trackingHref ?? referenceCode;
    if (!value) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(value);
      setStatusMessage(hasRealTracking ? 'Link de seguimiento copiado.' : 'Referencia copiada.');
    } catch {
      setError(hasRealTracking ? 'No pudimos copiar el link. Abrilo desde el boton de seguimiento.' : 'No pudimos copiar la referencia.');
    }
  };

  return (
    <div id={id} className={cn('space-y-4', isAssistedSurface && 'rounded-lg border bg-card p-3 shadow-sm sm:p-4', className)}>
      {isMarketplace && !compactMarketplaceHeader ? (
        <div className="overflow-hidden rounded-lg border bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
          <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
            <div className="space-y-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" data-testid="marketplace-assisted-product-surface">
                      {publicIntakeDisplayName}
                    </Badge>
                    <Badge variant="outline">Carga asistida</Badge>
                    <Badge variant="outline">Sin registro previo</Badge>
                    <Badge variant="secondary">Revision humana</Badge>
                  </div>
                  <h2 className="mt-2 max-w-2xl text-lg font-semibold tracking-normal sm:text-xl">
                    {publicIntakeTitle}
                  </h2>
                  <p className="mt-1 line-clamp-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {publicIntakeSummary}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {marketplaceExamples.map((example) => (
                  <span key={example} className="max-w-full break-words rounded-md border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                    {example}
                  </span>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {ASSISTED_OUTCOMES.map((outcome) => (
                  <div key={outcome.label} className="min-w-0 rounded-lg border bg-background/80 p-2.5">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ClipboardCheck className="h-4 w-4 text-primary" />
                      {outcome.label}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{outcome.description}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitDisabled}
                  className="w-full sm:w-auto"
                >
                  <FileImage className="mr-2 h-4 w-4" />
                  Subir foto o papel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => textAreaRef.current?.focus()}
                  disabled={uploading}
                  className="w-full sm:w-auto"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Escribir pedido
                </Button>
              </div>
              {marketplaceTextExamples.length ? (
                <div className="rounded-lg border bg-background/80 p-3">
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
            </div>

            <div
              data-testid="marketplace-assisted-visible-pipeline"
              className="rounded-lg border border-primary/20 bg-background/80 p-3 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Como se resuelve</p>
                <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary">
                  4 pasos
                </Badge>
              </div>
              <div className="mt-3 grid gap-2">
                {marketplacePipeline.map((step, index) => {
                  const StepIcon = getMarketplacePipelineIcon(step.id ? String(step.id) : null);
                  return (
                    <div
                      key={step.id ?? step.label ?? index}
                      className="relative rounded-lg border bg-card/90 p-2.5 shadow-sm"
                    >
                      {index < marketplacePipeline.length - 1 ? (
                        <span className="absolute left-[21px] top-10 hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
                      ) : null}
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <StepIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-primary">{index + 1}</span>
                            <p className="truncate text-sm font-semibold">{step.label}</p>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isMarketplace && compactMarketplaceHeader ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Carga asistida</Badge>
            <Badge variant="outline">Sin registro previo</Badge>
          </div>
          <h2 className="mt-2 text-base font-semibold tracking-normal sm:text-lg">{publicIntakeTitle}</h2>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{publicIntakeSummary}</p>
        </div>
      ) : null}

      {isAssistedSurface ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            {!canSubmitToServer ? (
              <Alert variant="default" className="border-amber-200 bg-amber-50 text-amber-900">
                <FileWarning className="h-4 w-4" />
                <AlertTitle>Carga asistida pendiente</AlertTitle>
                <AlertDescription>
                  El backend publico este bloque, pero no envio un endpoint de carga. El admin debe habilitar el contrato submit antes de recibir archivos.
                </AlertDescription>
              </Alert>
            ) : null}
            <div
              data-assisted-upload-dropzone="true"
              data-testid="assisted-upload-dropzone"
              role="button"
              tabIndex={0}
              aria-disabled={submitDisabled}
              onClick={() => {
                if (!submitDisabled) fileInputRef.current?.click();
              }}
              onKeyDown={(event) => {
                if (!submitDisabled && (event.key === 'Enter' || event.key === ' ')) fileInputRef.current?.click();
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-background p-4 text-center transition-colors',
                isDragging ? 'border-primary bg-primary/10' : 'hover:border-primary/50 hover:bg-muted/40',
                submitDisabled && 'pointer-events-none opacity-70',
              )}
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              </div>
              <p className="font-semibold">Arrastra el archivo o seleccionalo</p>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Acepta {submitAcceptedLabel}. Maximo {submitMaxFileMbLabel} MB. Si no lo leemos con confianza, igual queda para revision humana.
              </p>
            </div>

            {pendingFile ? (
              <div className="rounded-lg border border-primary/25 bg-primary/5 p-3" data-testid="assisted-pending-file">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Archivo seleccionado</p>
                    <p className="mt-1 break-all text-sm text-muted-foreground">
                      {pendingFile.name} - {formatPendingFileSize(pendingFile.size)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {effectiveDocumentType === 'auto'
                        ? 'Chatboc detectará el tipo al procesarlo. Dejá un contacto si querés que el equipo responda más rápido.'
                        : 'Usaremos la clasificación elegida. Dejá un contacto si querés que el equipo responda más rápido.'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:w-auto">
                    <Button
                      type="button"
                      size="sm"
                      disabled={submitDisabled || uploading}
                      onClick={() => processFile(pendingFile)}
                    >
                      {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Crear solicitud con archivo
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1"
                      >
                        Cambiar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={uploading}
                        onClick={() => setPendingFile(null)}
                        className="flex-1"
                      >
                        <X className="mr-1 h-4 w-4" />
                        Quitar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border bg-background p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Tambien podes escribir o pegar lo que necesitas</p>
                  <p className="text-xs text-muted-foreground">
                    Sirve para listas copiadas de WhatsApp, pedidos de mostrador, reclamos, boletas o notas simples sin archivo.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit">
                  {isCrm ? 'Operador autenticado' : 'Sin login'}
                </Badge>
              </div>
              <Textarea
                ref={textAreaRef}
                data-assisted-textarea="true"
                value={orderText}
                onChange={(event) => setOrderText(event.target.value)}
                placeholder={`Ej: 2 chapas galvanizadas
1 caja de clavos
3 bolsas de cemento`}
                rows={3}
                disabled={uploading}
                className="mt-3"
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Lo convertimos en solicitud trazable. Maximo {submitMaxTextChars.toLocaleString()} caracteres.
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={submitDisabled || !orderText.trim()}
                  onClick={processText}
                  className="w-full shrink-0 sm:w-auto"
                >
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Crear solicitud
                </Button>
              </div>
            </div>

            {turnstileEnabled ? (
              <TurnstileChallenge
                siteKey={turnstileSiteKey}
                onToken={setTurnstileToken}
                resetSignal={turnstileResetSignal}
                testId="marketplace-turnstile-challenge"
                description="Protege la carga anonima de pedidos, reclamos y documentos sin pedirte registro previo."
              />
            ) : null}

            {turnstileUnavailable ? (
              <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
                <FileWarning className="h-4 w-4" />
                <AlertTitle>Proteccion pendiente de configurar</AlertTitle>
                <AlertDescription>
                  Cloudflare Turnstile esta requerido para esta carga anonima, pero falta publicar la site key del frontend.
                </AlertDescription>
              </Alert>
            ) : null}

            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clasificación</legend>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Dejala en automático para avanzar sin elegir una categoría. Usá una opción manual solo si necesitás corregirla.
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Tipo de archivo o solicitud">
                {supportsAutomaticDocumentType ? (
                  <button
                    type="button"
                    data-testid="assisted-document-type-auto"
                    aria-pressed={effectiveDocumentType === 'auto'}
                    disabled={uploading}
                    onClick={() => setDocumentType('auto')}
                    className={cn(
                      'min-w-0 rounded-lg border p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      effectiveDocumentType === 'auto' ? 'border-primary bg-primary/10 text-primary' : 'bg-background',
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="break-words text-sm font-semibold">{AUTO_DOCUMENT_TYPE_OPTION.label}</span>
                      <Badge variant="secondary" className="text-[10px]">Recomendado</Badge>
                    </span>
                    <span className="mt-1 block break-words text-xs text-muted-foreground">{AUTO_DOCUMENT_TYPE_OPTION.helper}</span>
                  </button>
                ) : null}
                {documentTypeOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={effectiveDocumentType === item.value}
                    disabled={uploading}
                    onClick={() => setDocumentType(item.value)}
                    className={cn(
                      'min-w-0 rounded-lg border p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      effectiveDocumentType === item.value ? 'border-primary bg-primary/10 text-primary' : 'bg-background',
                    )}
                  >
                    <span className="block break-words text-sm font-semibold">{item.label}</span>
                    <span className="mt-1 block break-words text-xs text-muted-foreground">{item.helper}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Contacto para respuesta</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Recomendado: ayuda a responder por WhatsApp, email o llamada si faltan datos.
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">Recomendado</Badge>
            </div>
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
                <Label htmlFor="assisted-contact-phone">WhatsApp para respuesta</Label>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">El equipo recibe</p>
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
          disabled={submitDisabled}
          className={cn(isAssistedSurface ? 'sr-only' : 'max-w-xs')}
          style={
            isAssistedSurface
              ? { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }
              : undefined
          }
        />
        {!isAssistedSurface ? (
          <Button
            type="button"
            variant="secondary"
            disabled={submitDisabled}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Subir nota de pedido
          </Button>
        ) : null}
        {isAssistedSurface ? (
          <p className="text-xs text-muted-foreground">
            {isCrm
              ? 'El caso queda en el CRM con archivo o texto original, datos detectados y acciones recomendadas.'
              : 'El equipo ve el archivo o texto original, los datos detectados y las acciones siguientes desde su panel.'}
          </p>
        ) : null}
      </div>

      {(uploading || statusMessage) && (
        <div className="rounded-lg border bg-muted/25 p-3" role="status" aria-live="polite">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                {uploading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" /> : <ClipboardCheck className="h-4 w-4 shrink-0 text-primary" />}
                <span>{uploading ? 'Procesando solicitud' : 'Estado de la solicitud'}</span>
              </div>
              {statusMessage ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {statusMessage}
                </p>
              ) : null}
            </div>
            {uploading ? (
              <Badge variant="outline" className="w-fit shrink-0">
                {Math.min(100, Math.max(0, progress))}%
              </Badge>
            ) : null}
          </div>
          {uploading ? <Progress value={progress} className="mt-3 h-2" /> : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {requestJourneySteps.map((step, index) => {
              const isActive = uploading && progress >= index * 35;
              const isConfirmed = Boolean(processedResponse);
              return (
                <div
                  key={step.id}
                  data-state={isConfirmed ? (needsManualReview ? 'manual-review' : 'confirmed') : isActive ? 'active' : 'pending'}
                  className={cn(
                    'min-w-0 rounded-md border bg-background px-3 py-2 text-xs',
                    isActive && 'border-primary/40 bg-primary/5',
                    isConfirmed && !needsManualReview && 'border-emerald-300/70 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20',
                    isConfirmed && needsManualReview && 'border-amber-300/70 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20',
                  )}
                >
                  <p className="break-words font-semibold">{step.label}</p>
                  <p className="mt-1 break-words text-muted-foreground">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {successMessage && (
        <Alert
          className={cn(
            needsManualReview
              ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100'
              : 'border-green-200 bg-green-50 text-green-900',
          )}
        >
          {needsManualReview ? <FileWarning className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
          <AlertTitle>{needsManualReview ? 'Solicitud recibida para revision' : 'Solicitud creada'}</AlertTitle>
          <AlertDescription>
            {requestId ? <span className="mb-2 block font-semibold">Referencia #{requestId}</span> : null}
            <span>{successMessage}</span>
            {needsManualReview ? (
              <span className="mt-2 block text-xs font-medium">
                No se genero un borrador editable automatico. El equipo ve la entrada original y la revisa antes de responder.
              </span>
            ) : null}
            {matchSummary ? (
              <span className="mt-2 block text-xs">
                Detectados: {matchSummary.detected ?? 0}. En catalogo: {matchSummary.matched ?? 0}. Para revisar: {matchSummary.unmatched ?? 0}.
              </span>
            ) : null}
            {processedResponse?.source?.text_preview ? (
              <span className="mt-2 block rounded-md bg-white/70 p-2 text-xs">
                Pedido escrito: {processedResponse.source.text_preview}
              </span>
            ) : null}
            {processedResponse?.operator_pack?.needs_human_review ? (
              <span className="mt-2 block text-xs font-medium">
                El equipo lo marco para revision humana antes de responder.
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      )}

      {processedResponse && sourceAttachment ? (
        <div className="rounded-xl border bg-background p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {sourceAttachmentPreviewUrl ? (
              <img
                src={sourceAttachmentPreviewUrl}
                alt={sourceAttachment.name ? `Vista previa de ${sourceAttachment.name}` : 'Vista previa de evidencia adjunta'}
                className="h-24 w-24 shrink-0 rounded-md border bg-muted object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
                <FileText className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold">
                {sourceAttachmentIsImage ? <FileImage className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                Evidencia adjunta recibida
              </div>
              {sourceAttachment.name ? (
                <p className="mt-1 break-words text-sm text-muted-foreground">{sourceAttachment.name}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {sourceAttachment.id ? <Badge variant="outline">ID {sourceAttachment.id}</Badge> : null}
                {sourceAttachment.mimeType ? <Badge variant="outline">{sourceAttachment.mimeType}</Badge> : null}
                {sourceAttachment.url ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={sourceAttachment.url} target={openTargetForHref(sourceAttachment.url)} rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir archivo
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
              {operationalResult ? (
                <div
                  data-testid="assisted-operational-result"
                  className="mt-3 grid gap-2 text-sm sm:grid-cols-3"
                >
                  <div className="rounded-lg border border-emerald-200/70 bg-background/80 px-3 py-2 dark:border-emerald-900/70">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Constancia
                    </p>
                    <p className="mt-1 break-words font-semibold text-foreground">
                      {operationalStatusLabel}
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-200/70 bg-background/80 px-3 py-2 dark:border-emerald-900/70">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Panel del equipo
                    </p>
                    <p className="mt-1 break-words font-semibold text-foreground">
                      {operationalSurfaceLabel}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {operationalRecordLabel}
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-200/70 bg-background/80 px-3 py-2 dark:border-emerald-900/70">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Proximo paso
                    </p>
                    <p className="mt-1 break-words font-semibold text-foreground">
                      {operationalNextStepLabel}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
            {referenceCode ? (
              <div className="rounded-lg border bg-background px-4 py-3 text-left shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {hasRealTracking ? 'Codigo' : 'Referencia'}
                </p>
                <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                  <Hash className="h-4 w-4 text-primary" />
                  {referenceCode}
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
            {trackingHref || referenceCode ? (
              <Button type="button" variant="outline" size="sm" onClick={copyFollowUpLink}>
                <Copy className="mr-2 h-4 w-4" />
                {hasRealTracking ? 'Copiar seguimiento' : 'Copiar referencia'}
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

      {hasOperatorHandoff ? (
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold">
                <ClipboardList className="h-4 w-4 text-primary" />
                Que hace el equipo ahora
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                La solicitud queda ordenada con prioridad, canal y tareas sugeridas para responder sin volver a interpretar el archivo o mensaje original.
              </p>
              {operatorObjective ? (
                <p className="mt-2 rounded-lg border bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
                  {operatorObjective}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {operatorPriorityLabel ? <Badge variant="outline">Prioridad {operatorPriorityLabel}</Badge> : null}
              {operatorQueueLabel ? <Badge variant="outline">{operatorQueueLabel}</Badge> : null}
              {operatorSlaLabel ? <Badge variant="secondary">SLA {operatorSlaLabel}</Badge> : null}
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {operatorNextStepLabel ? (
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proximo paso</p>
                <p className="mt-1 text-sm font-semibold">{operatorNextStepLabel}</p>
              </div>
            ) : null}
            {operatorReasonLabel ? (
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motivo</p>
                <p className="mt-1 text-sm font-semibold">{operatorReasonLabel}</p>
              </div>
            ) : null}
            {operatorChannels.length ? (
              <div className="rounded-lg border bg-muted/20 p-3 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Canales de respuesta</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {operatorChannels.map((channel) => (
                    <Badge key={channel} variant="outline" className="bg-background">
                      {channel}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {operatorTasks.length ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {operatorTasks.map((task) => (
                <div key={task.id ?? task.label} className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-start gap-2">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">{task.label}</p>
                      {task.description ? (
                        <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{task.description}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {processedResponse && crmDraft ? (
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold">
                <ClipboardList className={cn('h-4 w-4', needsManualReview ? 'text-amber-600' : 'text-primary')} />
                {needsManualReview ? 'Revision manual que recibe el equipo' : 'Borrador que recibe el equipo'}
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {needsManualReview
                  ? 'El panel conserva la entrada original y las senales de lectura incompleta para que una persona responda sin perder contexto.'
                  : 'El panel ve esta lectura inicial junto al archivo original para responder por WhatsApp, email o llamada.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {crmDraftReference ? <Badge variant="outline">Ref. {crmDraftReference}</Badge> : null}
              {crmDraftContactState ? <Badge variant="outline">{crmDraftContactState}</Badge> : null}
              {crmDraftNextStep ? <Badge variant="secondary">{crmDraftNextStep}</Badge> : null}
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              { label: 'Detectados', value: crmDraftDetected },
              { label: 'En catalogo', value: crmDraftMatched },
              { label: 'Para revisar', value: crmDraftUnmatched },
            ].map((metric) => (
              <div key={metric.label} className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-lg font-semibold">{metric.value}</p>
              </div>
            ))}
          </div>

          {crmDraftConfirmation ? (
            <div
              data-testid="assisted-draft-confirmation"
              className={cn(
                'mt-4 rounded-xl border p-3',
                crmDraftIsReadyToConfirm
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100'
                  : 'border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100',
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="bg-background/80">
                      {crmDraftConfirmation.status_label || (crmDraftIsReadyToConfirm ? 'Listo para confirmar' : 'Revision del equipo')}
                    </Badge>
                    {crmDraftConfirmation.confidence_level ? (
                      <Badge variant="outline" className="bg-background/80">
                        Confianza {String(crmDraftConfirmation.confidence_level).replace(/_/g, ' ')}
                      </Badge>
                    ) : null}
                  </div>
                  {crmDraftConfirmation.headline ? (
                    <p className="mt-2 break-words text-sm font-semibold">{crmDraftConfirmation.headline}</p>
                  ) : null}
                  {crmDraftConfirmation.description ? (
                    <p className="mt-1 break-words text-sm opacity-90">{crmDraftConfirmation.description}</p>
                  ) : null}
                </div>
                {crmDraftConfirmation.primary_action_label ? (
                  <div className="rounded-lg border bg-background/80 px-3 py-2 text-xs font-semibold">
                    {crmDraftConfirmation.primary_action_label}
                  </div>
                ) : null}
              </div>
              {crmDraftConfirmationReasons.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {crmDraftConfirmationReasons.map((reason) => (
                    <div key={reason.id ?? reason.label} className="rounded-lg border bg-background/80 p-2">
                      <p className="text-xs font-semibold">{reason.label}</p>
                      {reason.description ? <p className="mt-1 text-xs opacity-80">{reason.description}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {crmDraftLines.length ? (
            <div className="mt-4 space-y-2">
              {crmDraftLines.map((line, index) => {
                const lineStatus = prettifyToken(line.status, CRM_LINE_STATUS_LABELS);
                const publicLineStatus = compactString(line.customer_visible_status);
                const lineConfidence = compactString(line.confidence);
                const lineQuantity = getCrmLineQuantity(line);
                const candidateCount = compactString(line.candidate_count);
                return (
                  <div key={`${getCrmLineName(line)}-${index}`} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold">{getCrmLineName(line)}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {lineQuantity ? <span>Cantidad: {lineQuantity}</span> : null}
                          {compactString(line.catalog_item_id) ? <span>Producto #{compactString(line.catalog_item_id)}</span> : null}
                          {candidateCount ? <span>{candidateCount} candidatos</span> : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                        {publicLineStatus ? <Badge variant="secondary" className="w-fit">{publicLineStatus}</Badge> : null}
                        {lineConfidence ? <Badge variant="outline" className="w-fit">Confianza {lineConfidence}</Badge> : null}
                        {lineStatus ? <Badge variant="outline" className="w-fit">{lineStatus}</Badge> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
              {needsManualReview
                ? 'No hay lineas confiables para confirmar automaticamente. El equipo revisa el archivo o texto original antes de responder.'
                : 'El equipo recibira el archivo o texto original y separara los items manualmente si la lectura no alcanza.'}
            </div>
          )}

          {crmSuggestedReply ? (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Respuesta sugerida</p>
              <p className="mt-2 break-words text-sm">{crmSuggestedReply}</p>
            </div>
          ) : null}
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
                Estos datos quedan normalizados para que el equipo responda sin volver a interpretar el papel o mensaje original.
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
              <p className="text-xs text-muted-foreground">La solicitud ya quedo asociada al panel del espacio.</p>
            </div>
            <Badge variant="outline">
              {needsManualReview
                ? 'Revision manual'
                : processedResponse.crm_state === 'ready_for_confirmation'
                  ? 'Lista para confirmar'
                  : 'Revision del equipo'}
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
