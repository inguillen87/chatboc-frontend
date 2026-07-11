import { useId, type ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Copy,
  ExternalLink,
  FileQuestion,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
  User,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  AssistedCatalogCandidate,
  AssistedOrderRequest,
  CrmOrderDraft,
  CrmOrderDraftLine,
  Order,
} from '@/types/unified';

type AssistedRequestPanelProps = {
  order: Order;
  className?: string;
  dense?: boolean;
  onResolveCatalogCandidate?: (payload: {
    lineId?: string | null;
    sourceName: string;
    catalogItemId: string | number;
    candidateName: string;
  }) => Promise<void> | void;
  resolvingCatalogCandidateKey?: string | null;
};

type SourceAttachmentView = {
  url: string | null;
  name: string | null;
  id: string | null;
  mimeType: string | null;
  thumbnailUrl: string | null;
};

type CandidateGroupView = {
  itemLabel: string;
  candidates: AssistedCatalogCandidate[];
};

type StructuredFieldEntry = {
  key: string;
  label: string;
  value: string;
};

type CustomerBlockerView = {
  id?: string | null;
  code?: string | null;
  label?: string | null;
  message?: string | null;
  description?: string | null;
  source_name?: string | null;
  line_id?: string | null;
};

const HUMAN_FIELD_LABELS: Record<string, string> = {
  categoria_probable: 'Categoria probable',
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
  canal_ingreso: 'Canal de ingreso',
  estado: 'Estado',
  prioridad: 'Prioridad',
  tipo: 'Tipo',
  campos: 'Campos detectados',
  contact: 'Contacto',
  name: 'Nombre',
  phone: 'Telefono',
  whatsapp: 'WhatsApp',
  email: 'Email',
  source_file: 'Archivo fuente',
  catalog_resolution: 'Resolucion de catalogo',
  triage_data: 'Datos de triage',
};

const TARGET_MODULE_LABELS: Record<string, string> = {
  municipal_claims: 'Reclamos municipales',
  document_requests: 'Tramites y documentos',
  orders: 'Pedidos y cotizaciones',
};

const RECORD_LABELS: Record<string, string> = {
  tenant_ticket: 'Ticket municipal',
  crm_task: 'Tarea CRM',
  assisted_order: 'Pedido asistido',
};

const PROCESSING_STATES = new Set([
  'processing',
  'pending_ai',
  'pending_extraction',
  'queued',
  'queued_for_extraction',
  'extracting',
  'analyzing',
  'analysing',
]);

const MANUAL_REVIEW_STATES = new Set(['manual_review', 'ai_unavailable', 'failed', 'error']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const valueText = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = valueText(value)?.trim();
    if (text) return text;
  }
  return null;
};

const firstIdentifier = (...values: unknown[]): string | number | null => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const firstNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
};

const uniqueStrings = (...values: unknown[]) => {
  const output: string[] = [];
  const seen = new Set<string>();

  const append = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(append);
      return;
    }
    const text = valueText(value)?.trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    output.push(text);
  };

  values.forEach(append);
  return output;
};

const humanizeKey = (value: unknown) => {
  const text = valueText(value)?.trim();
  if (!text) return null;
  return HUMAN_FIELD_LABELS[text] || text.replace(/_/g, ' ');
};

const sentenceCase = (value: string | null) =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : null;

const intentLabel = (value: unknown) => {
  const text = valueText(value);
  if (!text) return null;
  const labels: Record<string, string> = {
    create_order_or_quote: 'Pedido o cotizacion',
    create_quote: 'Cotizacion',
    document_review: 'Revision de comprobante',
    tax_or_payment_support: 'Boleta o impuesto',
    certificate_or_procedure_review: 'Certificado o tramite',
    municipal_service_request: 'Reclamo o solicitud vecinal',
    manual_review: 'Revision manual',
  };
  return labels[text] || sentenceCase(text.replace(/_/g, ' '));
};

const reviewReasonLabel = (value: unknown) => {
  const text = valueText(value);
  if (!text) return null;
  const labels: Record<string, string> = {
    lectura_ia_baja_confianza: 'Lectura IA de baja confianza',
    items_sin_match_exacto: 'Items sin match exacto',
    catalogo_sin_match_automatico: 'Sin match automatico',
    contacto_incompleto: 'Contacto incompleto',
    listo_para_confirmar: 'Listo para confirmar',
  };
  return labels[text] || sentenceCase(text.replace(/_/g, ' '));
};

const targetModuleLabel = (value: unknown) => {
  const text = valueText(value);
  if (!text) return null;
  return TARGET_MODULE_LABELS[text] || sentenceCase(text.replace(/_/g, ' '));
};

const recordLabel = (value: unknown) => {
  const text = valueText(value);
  if (!text) return null;
  return RECORD_LABELS[text] || sentenceCase(text.replace(/_/g, ' '));
};

const crmStateLabel = (state?: string | null) => {
  if (state === 'ready_for_confirmation' || state === 'ready_to_reply') return 'Listo para confirmar';
  if (state === 'pending_operator_review' || state === 'needs_review') return 'Revision requerida';
  if (state && MANUAL_REVIEW_STATES.has(state)) return 'Revision manual';
  if (state && PROCESSING_STATES.has(state)) return 'Procesando';
  return state ? sentenceCase(state.replace(/_/g, ' ')) || 'Solicitud asistida' : 'Solicitud asistida';
};

const crmStateClassName = (state?: string | null) => {
  if (state === 'ready_for_confirmation' || state === 'ready_to_reply') {
    return 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100';
  }
  if (state && PROCESSING_STATES.has(state)) {
    return 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-100';
  }
  if (state === 'pending_operator_review' || state === 'needs_review' || (state && MANUAL_REVIEW_STATES.has(state))) {
    return 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100';
  }
  return 'bg-background';
};

const draftLineStatusLabel = (line: CrmOrderDraftLine) => {
  if (line.status === 'catalog_matched' || line.catalog_match || line.catalog_item_id) return 'Coincidencia confirmada';
  if (line.status === 'needs_catalog_resolution') return 'Sin coincidencia';
  if (line.status === 'needs_review') return 'Revisar linea';
  return line.status ? sentenceCase(line.status.replace(/_/g, ' ')) || 'Sin estado' : 'Sin coincidencia';
};

const draftLineStatusClassName = (line: CrmOrderDraftLine) => {
  if (line.status === 'catalog_matched' || line.catalog_match || line.catalog_item_id) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100';
};

const confidenceLabel = (value: unknown) => {
  const text = valueText(value)?.toLowerCase();
  if (!text) return null;
  if (text === 'high') return 'Alta';
  if (text === 'medium') return 'Media';
  if (text === 'low') return 'Baja';
  return sentenceCase(text.replace(/_/g, ' '));
};

const formatStructuredValue = (value: unknown): string | null => {
  const primitive = valueText(value);
  if (primitive) return primitive;
  if (Array.isArray(value)) return value.map(formatStructuredValue).filter(Boolean).join(', ') || null;
  if (!isRecord(value)) return null;

  const parts = Object.entries(value)
    .map(([key, item]) => {
      const formatted = formatStructuredValue(item);
      return formatted ? `${humanizeKey(key) || key}: ${formatted}` : null;
    })
    .filter(Boolean);
  return parts.join(' / ') || null;
};

const fieldEntriesFrom = (value: unknown): StructuredFieldEntry[] =>
  isRecord(value)
    ? Object.entries(value)
        .map(([key, item]) => {
          const formatted = formatStructuredValue(item);
          return formatted ? { key, label: humanizeKey(key) || key, value: formatted } : null;
        })
        .filter((entry): entry is StructuredFieldEntry => Boolean(entry))
    : [];

const formatSlaHint = (value: unknown) => {
  const primitive = valueText(value);
  if (primitive) return primitive;
  if (!isRecord(value)) return null;
  const label = firstText(value.label, value.display, value.text);
  if (label) return label;
  const minutes = Number(value.minutes);
  if (Number.isFinite(minutes) && minutes > 0) {
    if (minutes % 60 === 0) return `${minutes / 60} h`;
    return `${minutes} min`;
  }
  return null;
};

const formatFileSize = (value: unknown) => {
  const bytes = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const rowLabel = (row: unknown) => {
  if (!isRecord(row)) return valueText(row);
  return firstText(
    row.source_name,
    row.item,
    row.item_label,
    row.requested_item,
    row.producto,
    row.product,
    row.nombre,
    row.name,
    row.descripcion,
    row.detalle,
    row.sku,
  );
};

const candidateName = (candidate: AssistedCatalogCandidate) =>
  firstText(candidate.name, candidate.nombre, candidate.title, candidate.label, candidate.product_name, candidate.nombre_producto, candidate.sku) ||
  'Producto candidato';

const candidateSku = (candidate: AssistedCatalogCandidate) => firstText(candidate.sku, candidate.codigo, candidate.code);

const candidatePrice = (candidate: AssistedCatalogCandidate) => {
  const value = candidate.price ?? candidate.precio ?? candidate.precio_unitario ?? candidate.unit_price ?? candidate.price_label ?? candidate.precio_str;
  const currency = firstText(candidate.currency, candidate.moneda);
  const prefix = currency && currency.toUpperCase() !== 'ARS' ? `${currency} ` : '$';

  if (typeof value === 'number' && Number.isFinite(value)) return `${prefix}${value.toLocaleString('es-AR')}`;
  if (typeof value !== 'string') return valueText(value);

  const trimmed = value.trim();
  const numeric = Number(trimmed.replace(',', '.'));
  if (/^\d+(?:[.,]\d+)?$/.test(trimmed) && Number.isFinite(numeric)) {
    return `${prefix}${numeric.toLocaleString('es-AR')}`;
  }
  return trimmed || null;
};

const candidateScore = (candidate: AssistedCatalogCandidate) => {
  const raw = candidate.score ?? candidate.similarity ?? candidate.match_score;
  const numeric = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;
  if (!Number.isFinite(numeric)) return valueText(raw);
  return `${Math.round(numeric <= 1 ? numeric * 100 : numeric)}%`;
};

const candidateReason = (candidate: AssistedCatalogCandidate) =>
  firstText(candidate.reason, candidate.match_reason, candidate.motivo, candidate.description);

const candidateReferenceUrl = (candidate: AssistedCatalogCandidate) =>
  firstText(candidate.href, candidate.url, candidate.product_url, candidate.reference_url, candidate.admin_url, candidate.public_url, candidate.permalink);

const candidateReference = (candidate: AssistedCatalogCandidate) =>
  firstText(candidate.reference, candidate.catalog_item_id, candidate.catalogo_item_id, candidate.product_id, candidate.id);

const candidateCatalogItemId = (candidate: AssistedCatalogCandidate) =>
  firstText(candidate.catalog_item_id, candidate.catalogo_item_id, candidate.product_id, candidate.id);

const candidateRecordsFrom = (value: unknown): AssistedCatalogCandidate[] =>
  Array.isArray(value) ? (value.filter(isRecord) as AssistedCatalogCandidate[]) : [];

const candidatesFromRecord = (record: Record<string, unknown>) => {
  for (const key of ['candidates', 'catalog_candidates', 'suggested_candidates', 'alternatives', 'alternativas']) {
    const candidates = candidateRecordsFrom(record[key]);
    if (candidates.length) return candidates;
  }
  return [];
};

const normalizeCandidateGroups = (assistedRequest: AssistedOrderRequest): CandidateGroupView[] => {
  const groups: CandidateGroupView[] = [];
  const seen = new Set<string>();

  const appendGroup = (entry: unknown, fallbackLabel?: string | null) => {
    if (!isRecord(entry)) return;
    const candidates = candidatesFromRecord(entry);
    if (!candidates.length) return;
    const itemLabel = firstText(entry.item, entry.item_label, entry.requested_item, entry.query, entry.text) || rowLabel(entry.row) || rowLabel(entry) || fallbackLabel || 'Item no encontrado';
    const identity = `${itemLabel}|${candidates.map(candidateCatalogItemId).join(',')}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    groups.push({ itemLabel, candidates });
  };

  const appendGroups = (value: unknown, fallbackLabels: string[] = []) => {
    if (!Array.isArray(value)) return;
    const records = value.filter(isRecord);
    if (records.some((entry) => candidatesFromRecord(entry).length)) {
      records.forEach((entry, index) => appendGroup(entry, fallbackLabels[index]));
      return;
    }
    const candidates = candidateRecordsFrom(value);
    if (candidates.length) appendGroup({ item: fallbackLabels[0] || 'Item no encontrado', candidates });
  };

  appendGroups(assistedRequest.catalog_candidates, assistedRequest.unmatched_items || []);
  appendGroups(assistedRequest.candidate_groups, assistedRequest.unmatched_items || []);
  appendGroups(assistedRequest.product_candidates, assistedRequest.unmatched_items || []);
  appendGroups(assistedRequest.suggested_candidates, assistedRequest.unmatched_items || []);

  if (isRecord(assistedRequest.operator_pack)) {
    appendGroups(assistedRequest.operator_pack.catalog_candidates, assistedRequest.unmatched_items || []);
    appendGroups(assistedRequest.operator_pack.suggested_candidates, assistedRequest.unmatched_items || []);
    appendGroups(assistedRequest.operator_pack.candidate_groups, assistedRequest.unmatched_items || []);
  }

  (assistedRequest.raw_unmatched_rows || []).forEach((row, index) => {
    appendGroup(row, assistedRequest.unmatched_items?.[index]);
  });

  return groups;
};

const isCrmOrderDraft = (value: unknown): value is CrmOrderDraft =>
  isRecord(value) && (value.contract_version === 'marketplace.crm_order_draft.v1' || Array.isArray(value.lines));

const resolveCrmOrderDraft = (assistedRequest: AssistedOrderRequest) => {
  if (isCrmOrderDraft(assistedRequest.crm_order_draft)) return assistedRequest.crm_order_draft;
  if (isCrmOrderDraft(assistedRequest.crm_handoff?.draft_order)) return assistedRequest.crm_handoff?.draft_order as CrmOrderDraft;
  return null;
};

const normalizeDetectedLine = (value: unknown, index: number): CrmOrderDraftLine | null => {
  if (!isRecord(value)) return null;
  const catalogMatch = isRecord(value.catalog_match) ? (value.catalog_match as AssistedCatalogCandidate) : null;
  const sourceName = rowLabel(value) || `Linea ${index + 1}`;
  return {
    ...value,
    line_id: firstText(value.line_id, value.id) || `detected-${index}`,
    source_name: sourceName,
    quantity: firstIdentifier(value.quantity, value.cantidad, value.qty),
    unit: firstText(value.unit, value.unidad),
    sku: firstText(value.sku, value.codigo),
    status: firstText(value.status, value.match_status) || (catalogMatch ? 'catalog_matched' : 'needs_review'),
    catalog_item_id: firstIdentifier(value.catalog_item_id, value.catalogo_item_id),
    catalog_match: catalogMatch,
    candidate_count: firstNumber(value.candidate_count),
  };
};

const draftLineName = (line: CrmOrderDraftLine) =>
  firstText(line.source_name, line.catalog_match?.name, line.catalog_match?.nombre, line.catalog_match?.sku) || 'Item detectado';

const draftLineQuantity = (line: CrmOrderDraftLine) => {
  const quantity = firstText(line.quantity) || '1';
  const unit = firstText(line.unit, line.catalog_match?.unidad);
  return unit ? `${quantity} ${unit}` : quantity;
};

const draftLineSku = (line: CrmOrderDraftLine) => firstText(line.sku, line.catalog_match?.sku, line.catalog_match?.codigo);

const draftLineCatalogName = (line: CrmOrderDraftLine) =>
  line.catalog_match ? candidateName(line.catalog_match) : null;

const normalizeBlockingReasons = (...values: unknown[]): CustomerBlockerView[] => {
  for (const value of values) {
    if (!Array.isArray(value) || !value.length) continue;
    const reasons = value.filter(isRecord) as CustomerBlockerView[];
    if (reasons.length) return reasons;
  }
  return [];
};

const blockerLabel = (reason: CustomerBlockerView) =>
  firstText(reason.label, reason.message, reason.description, humanizeKey(reason.code), humanizeKey(reason.id)) || 'Pendiente de revision';

const issueLabel = (value: unknown) => {
  if (typeof value === 'string') {
    const labels: Record<string, string> = {
      provider_unavailable: 'El proveedor de IA no estuvo disponible.',
      extraction_failed: 'No se pudo extraer informacion del documento.',
    };
    return labels[value] || sentenceCase(value.replace(/_/g, ' '));
  }
  if (!isRecord(value)) return null;
  return firstText(value.reason, value.error, value.message, value.description, value.code);
};

const issueMessagesFrom = (...values: unknown[]) => {
  const messages: string[] = [];
  const append = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(append);
      return;
    }
    const label = issueLabel(value);
    if (label) messages.push(label);
  };
  values.forEach(append);
  return uniqueStrings(messages);
};

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

const normalizeAttachmentRecord = (
  attachment: Record<string, unknown>,
  source?: Record<string, unknown> | null,
): SourceAttachmentView | null => {
  const url = firstText(
    attachment.url,
    attachment.href,
    attachment.archivo_url,
    attachment.file_url,
    attachment.fileUrl,
    attachment.download_url,
    attachment.downloadUrl,
    attachment.public_url,
    attachment.publicUrl,
    attachment.secure_url,
    attachment.secureUrl,
    source?.archivo_url,
  );
  const name = firstText(
    attachment.name,
    attachment.filename,
    attachment.fileName,
    attachment.original_filename,
    attachment.originalFilename,
    attachment.archivo_nombre,
    attachment.title,
    attachment.label,
    source?.archivo_nombre,
    source?.original_filename,
  );
  const id = firstText(
    attachment.id,
    attachment.attachment_id,
    attachment.attachmentId,
    attachment.source_attachment_id,
    attachment.sourceAttachmentId,
    attachment.upload_id,
    attachment.uploadId,
    attachment.file_id,
    attachment.fileId,
    source?.attachment_id,
    source?.source_attachment_id,
  );
  const mimeType = firstText(
    attachment.mimeType,
    attachment.mime_type,
    attachment.content_type,
    attachment.contentType,
    attachment.type,
    source?.mime_type,
    source?.mimeType,
  );
  const thumbnailUrl = firstText(
    attachment.thumbnailUrl,
    attachment.thumbnail_url,
    attachment.thumbUrl,
    attachment.thumb_url,
    attachment.preview_url,
    attachment.previewUrl,
    source?.thumbnail_url,
    source?.thumbnailUrl,
  );
  return url || name || id || mimeType || thumbnailUrl ? { url, name, id, mimeType, thumbnailUrl } : null;
};

const normalizeSourceAttachment = (...payloads: unknown[]): SourceAttachmentView | null => {
  const records = payloads.filter(isRecord);
  const attachmentKeys = ['source_attachment', 'sourceAttachment', 'attachmentInfo', 'attachment_info'];

  for (const record of records) {
    const source = isRecord(record.source) ? record.source : null;
    for (const key of attachmentKeys) {
      if (!isRecord(record[key])) continue;
      const attachment = normalizeAttachmentRecord(record[key] as Record<string, unknown>, source);
      if (attachment) return attachment;
    }
  }

  for (const record of records) {
    const source = isRecord(record.source) ? record.source : null;
    if (!source) continue;
    for (const key of attachmentKeys) {
      if (!isRecord(source[key])) continue;
      const attachment = normalizeAttachmentRecord(source[key] as Record<string, unknown>, source);
      if (attachment) return attachment;
    }
    const fallback = normalizeAttachmentRecord({}, source);
    if (fallback) return fallback;
  }

  return null;
};

const candidateCopyText = (group: CandidateGroupView, candidate: AssistedCatalogCandidate) =>
  [
    `Item: ${group.itemLabel}`,
    `Candidato: ${candidateName(candidate)}`,
    candidateSku(candidate) ? `SKU: ${candidateSku(candidate)}` : null,
    candidatePrice(candidate) ? `Precio: ${candidatePrice(candidate)}` : null,
    candidateScore(candidate) ? `Score: ${candidateScore(candidate)}` : null,
    confidenceLabel(candidate.confidence) ? `Confianza: ${confidenceLabel(candidate.confidence)}` : null,
    candidateReason(candidate) ? `Motivo: ${candidateReason(candidate)}` : null,
    candidateReference(candidate) ? `Ref: ${candidateReference(candidate)}` : null,
    candidateReferenceUrl(candidate) ? `URL: ${candidateReferenceUrl(candidate)}` : null,
  ]
    .filter(Boolean)
    .join('\n');

const actionLabel = (action: Record<string, unknown>) =>
  firstText(action.label, action.title, humanizeKey(action.id)) || 'Accion recomendada';

function SectionHeading({
  id,
  icon: Icon,
  title,
  description,
  aside,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description?: string | null;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h4 id={id} className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {title}
        </h4>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

export function AssistedRequestPanel({
  order,
  className,
  dense = false,
  onResolveCatalogCandidate,
  resolvingCatalogCandidateKey,
}: AssistedRequestPanelProps) {
  const titleId = useId();
  const nextActionId = useId();
  const sourceId = useId();
  const summaryId = useId();
  const linesId = useId();
  const catalogId = useId();
  const missingId = useId();
  const contactId = useId();
  const contextId = useId();

  const crmReviewCard = order.crm_review_card || null;
  const derivedAssistedRequest: AssistedOrderRequest | null = crmReviewCard
    ? {
        contract_version: 'marketplace.assisted_request.derived_from_crm_review_card',
        mode: 'crm_review_card',
        crm_state: crmReviewCard.status,
        request_kind: crmReviewCard.request_kind,
        request_kind_label: crmReviewCard.request_kind_label,
        contact: crmReviewCard.contact as AssistedOrderRequest['contact'],
        source: crmReviewCard.source as AssistedOrderRequest['source'],
        match_summary: crmReviewCard.summary,
        review_context: { primary_intent: crmReviewCard.primary_intent },
        next_actions: crmReviewCard.next_actions,
        customer_next_steps: crmReviewCard.customer_next_steps,
        detected_items: crmReviewCard.lines,
        catalog_candidates: crmReviewCard.catalog_candidates,
        unmatched_items: crmReviewCard.unmatched_items,
        operator_pack: {
          priority: crmReviewCard.priority,
          needs_human_review: crmReviewCard.needs_operator_review,
          suggested_reply: crmReviewCard.suggested_reply,
          suggested_tasks: crmReviewCard.suggested_tasks,
          contact_links: crmReviewCard.contact_links,
        },
      }
    : null;
  const assistedRequest = order.assisted_request || derivedAssistedRequest;
  if (!assistedRequest) return null;

  const assistedRecord = assistedRequest as unknown as Record<string, unknown>;
  const cardRecord = isRecord(crmReviewCard) ? (crmReviewCard as unknown as Record<string, unknown>) : {};
  const operatorPack = assistedRequest.operator_pack || null;
  const operatorIntakeSummary = assistedRequest.operator_intake_summary || null;
  const structuredExtraction = assistedRequest.structured_extraction || null;
  const documentProfile = assistedRequest.document_profile || null;
  const reviewContext = assistedRequest.review_context || null;
  const crmHandoff = assistedRequest.crm_handoff || null;
  const crmOrderDraft = resolveCrmOrderDraft(assistedRequest);
  const intakeExperience = assistedRequest.intake_experience || null;
  const publicFollowUp = assistedRequest.public_follow_up || null;
  const followUpTracking = publicFollowUp?.tracking || null;
  const followUpCode = firstText(followUpTracking?.code);
  const followUpHref = makeAbsoluteHref(firstText(followUpTracking?.path));
  const followUpChannels = (publicFollowUp?.channels || []).filter((channel) => channel?.href);

  const sourceAttachment = normalizeSourceAttachment(crmReviewCard, assistedRequest);
  const sourceFileUrl = sourceAttachment?.url || null;
  const sourceAttachmentName = sourceAttachment?.name || assistedRequest.source?.original_filename || assistedRequest.source?.archivo_nombre || null;
  const sourceAttachmentId = sourceAttachment?.id || null;
  const sourceMimeType = sourceAttachment?.mimeType || assistedRequest.source?.mime_type || crmReviewCard?.source?.input_type || null;
  const sourceFileSize = formatFileSize(assistedRequest.source?.file_size_bytes);
  const textPreview = firstText(crmReviewCard?.source?.text_preview, assistedRequest.source?.text_preview);
  const sourceChannel = firstText(crmReviewCard?.source?.channel, assistedRequest.source?.channel, order.channel) || 'marketplace';
  const documentLabel =
    firstText(crmReviewCard?.request_kind_label, assistedRequest.request_kind_label, assistedRequest.source?.request_kind_label) ||
    (assistedRequest.mode === 'order_note_upload' ? 'Archivo de pedido' : 'Archivo recibido');

  const contact = crmReviewCard?.contact || assistedRequest.contact || order.contact || order.customer_profile || null;
  const contactRecord = isRecord(contact) ? contact : null;
  const extractedContact = isRecord(structuredExtraction?.fields?.contacto) ? structuredExtraction.fields.contacto : null;
  const contactName = firstText(contactRecord?.name, extractedContact?.name, extractedContact?.nombre);
  const contactPhone = firstText(
    contactRecord?.phone,
    contactRecord?.whatsapp,
    extractedContact?.phone,
    extractedContact?.telefono,
    extractedContact?.whatsapp,
  );
  const contactEmail = firstText(contactRecord?.email, extractedContact?.email, extractedContact?.correo);
  const contactNotes = firstText(contactRecord?.notes, assistedRequest.contact?.notes);
  const contactSummary = firstText(contactName, contactPhone, contactEmail, formatStructuredValue(structuredExtraction?.fields?.contacto)) || 'Sin contacto';
  const contactLinks = (operatorPack?.contact_links || crmReviewCard?.contact_links || []).filter((link) => link.href);

  const structuredFields = fieldEntriesFrom(structuredExtraction?.fields);
  const summaryField = structuredFields.find((field) => field.key === 'resumen' || field.key === 'summary');
  const detailFields = structuredFields.filter((field) => field !== summaryField);
  const extractionRecord = isRecord(structuredExtraction) ? (structuredExtraction as unknown as Record<string, unknown>) : {};
  const aiSummary = firstText(
    summaryField?.value,
    extractionRecord.summary_text,
    extractionRecord.ai_summary,
    cardRecord.summary_text,
    cardRecord.ai_summary,
    assistedRecord.summary_text,
    assistedRecord.ai_summary,
  );
  const missingFields = uniqueStrings(
    structuredExtraction?.missing_fields,
    reviewContext?.missing_fields,
    operatorPack?.missing_fields,
    operatorIntakeSummary?.missing_fields,
    operatorPack?.primary_missing_field,
    operatorIntakeSummary?.primary_missing_field,
    reviewContext?.primary_missing_field,
  );

  const crmDraftLines = crmOrderDraft?.lines || [];
  const reviewCardLines = crmReviewCard?.lines || [];
  const detectedItemLines = (assistedRequest.detected_items || [])
    .map(normalizeDetectedLine)
    .filter((line): line is CrmOrderDraftLine => Boolean(line));
  const lines = crmDraftLines.length ? crmDraftLines : reviewCardLines.length ? reviewCardLines : detectedItemLines;
  const unmatchedItems = uniqueStrings(crmReviewCard?.unmatched_items, assistedRequest.unmatched_items);
  const catalogCandidateGroups = normalizeCandidateGroups(assistedRequest);

  const intakeMatchSummary = isRecord(operatorIntakeSummary?.match_summary) ? operatorIntakeSummary.match_summary : {};
  const detectedCount =
    firstNumber(crmOrderDraft?.summary?.detected, crmReviewCard?.summary?.detected, assistedRequest.match_summary?.detected, intakeMatchSummary.detected) ??
    lines.length;
  const matchedCount =
    firstNumber(crmOrderDraft?.summary?.matched, crmReviewCard?.summary?.matched, assistedRequest.match_summary?.matched, intakeMatchSummary.matched) ??
    lines.filter((line) => line.status === 'catalog_matched' || Boolean(line.catalog_match || line.catalog_item_id)).length;
  const unmatchedCount =
    firstNumber(crmOrderDraft?.summary?.unmatched, crmReviewCard?.summary?.unmatched, assistedRequest.match_summary?.unmatched, intakeMatchSummary.unmatched) ??
    Math.max(unmatchedItems.length, lines.filter((line) => line.status !== 'catalog_matched' && !line.catalog_match && !line.catalog_item_id).length);

  const nextActions = (crmReviewCard?.next_actions || assistedRequest.next_actions || []).filter(
    (action) => action && action.enabled !== false,
  );
  const suggestedTasks = operatorPack?.suggested_tasks || crmReviewCard?.suggested_tasks || [];
  const suggestedReply = firstText(operatorPack?.suggested_reply, crmReviewCard?.suggested_reply);
  const rawPrimaryAction =
    firstText(
      nextActions[0]?.label,
      nextActions[0]?.title,
      crmReviewCard?.recommended_next_step,
      operatorIntakeSummary?.recommended_next_step,
      crmOrderDraft?.recommended_next_step,
      suggestedTasks[0]?.label,
    ) || (missingFields.length ? `Completar ${humanizeKey(missingFields[0]) || missingFields[0]}` : 'Revisar solicitud');
  const primaryAction = sentenceCase(humanizeKey(rawPrimaryAction) || rawPrimaryAction) || 'Revisar solicitud';
  const operatorObjective = firstText(operatorIntakeSummary?.objective, documentProfile?.operator_goal, crmHandoff?.operator_goal);
  const operatorQueue = firstText(
    operatorPack?.operator_queue_label,
    operatorIntakeSummary?.operator_queue_label,
    reviewContext?.operator_queue_label,
    targetModuleLabel(operatorIntakeSummary?.target_module || crmHandoff?.target_module),
  );
  const slaHint = firstText(
    formatSlaHint(operatorPack?.sla_hint),
    formatSlaHint(operatorIntakeSummary?.sla_hint),
    formatSlaHint(reviewContext?.sla_hint),
  );
  const reviewReasons = uniqueStrings(reviewContext?.review_reasons);

  const customerConfirmation = isRecord(crmOrderDraft?.customer_confirmation) ? crmOrderDraft.customer_confirmation : {};
  const customerBlockingReasons = normalizeBlockingReasons(
    customerConfirmation.blocking_reasons,
    cardRecord.blocking_reasons,
    assistedRecord.blocking_reasons,
  );
  const errorMessages = issueMessagesFrom(
    assistedRequest.extraction_error,
    assistedRequest.source?.extraction_error,
    crmReviewCard?.source?.extraction_error,
    assistedRecord.row_errors,
    cardRecord.row_errors,
    structuredExtraction?.row_errors,
    crmOrderDraft?.row_errors,
  );

  const state = firstText(crmReviewCard?.status, assistedRequest.crm_state);
  const isProcessing = Boolean(state && PROCESSING_STATES.has(state));
  const manualExtractionIssue = Boolean(
    (state && MANUAL_REVIEW_STATES.has(state)) ||
      errorMessages.length ||
      firstText(assistedRecord.provider_status, cardRecord.provider_status, assistedRequest.source?.provider_status, crmReviewCard?.source?.provider_status) === 'failed',
  );
  const panelTitle = manualExtractionIssue ? 'Lectura manual / IA no disponible' : 'Solicitud asistida por IA';
  const catalogEnabled = Boolean(
    documentProfile?.catalog_matching ||
      structuredExtraction?.catalog_matching ||
      intakeExperience?.catalog_matching ||
      catalogCandidateGroups.length ||
      matchedCount ||
      unmatchedCount,
  );
  const isResolvingCatalog = Boolean(resolvingCatalogCandidateKey);

  const findDraftLineForCandidateGroup = (group: CandidateGroupView) => {
    const groupLabel = group.itemLabel.trim().toLowerCase();
    if (!groupLabel) return null;
    return (
      lines.find((line) => {
        const lineLabel = draftLineName(line).trim().toLowerCase();
        return Boolean(lineLabel && (lineLabel === groupLabel || lineLabel.includes(groupLabel) || groupLabel.includes(lineLabel)));
      }) || null
    );
  };

  const operatorSummaryText = () =>
    [
      'Resumen operativo Chatboc',
      `Pedido/Solicitud: ${order.id}`,
      `Tipo: ${documentLabel}`,
      `Canal: ${sourceChannel}`,
      `Estado CRM: ${crmStateLabel(state)}`,
      `Proximo paso: ${primaryAction}`,
      `Contacto: ${contactSummary}`,
      sourceAttachmentName ? `Documento original: ${sourceAttachmentName}` : null,
      aiSummary ? `Resumen IA: ${aiSummary}` : null,
      missingFields.length ? `Datos faltantes: ${missingFields.map((field) => humanizeKey(field) || field).join(', ')}` : null,
      lines.length
        ? `Lineas detectadas:\n${lines
            .map((line) => {
              const match = draftLineCatalogName(line);
              return `- ${draftLineQuantity(line)} | ${draftLineName(line)} | ${match || 'Sin coincidencia'} | ${draftLineStatusLabel(line)}`;
            })
            .join('\n')}`
        : 'Lineas detectadas: ninguna',
      catalogCandidateGroups.length
        ? `Alternativas de catalogo:\n${catalogCandidateGroups
            .map((group) => `- ${group.itemLabel}: ${group.candidates.map(candidateName).join(' / ')}`)
            .join('\n')}`
        : null,
      followUpCode || followUpHref ? `Seguimiento: ${followUpCode || followUpHref}` : null,
      suggestedReply ? `Respuesta sugerida:\n${suggestedReply}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

  const orderDraftCopyText = () =>
    [
      'Pedido armado por Chatboc',
      crmOrderDraft?.reference ? `Referencia: ${crmOrderDraft.reference}` : null,
      `Proximo paso: ${primaryAction}`,
      lines.length
        ? lines
            .map((line) => {
              const match = draftLineCatalogName(line);
              return `- ${draftLineQuantity(line)} | ${draftLineName(line)} | ${match || 'Sin coincidencia'}`;
            })
            .join('\n')
        : 'Sin lineas detectadas',
    ]
      .filter(Boolean)
      .join('\n');

  const copyText = async (value: string, successMessage: string, errorMessage: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error(errorMessage);
    }
  };

  const paddingClassName = dense ? 'p-3' : 'p-4';

  return (
    <section
      className={cn('overflow-hidden rounded-lg border bg-background shadow-sm', className)}
      aria-labelledby={titleId}
      aria-busy={isProcessing || isResolvingCatalog}
    >
      <header className={cn('border-b bg-muted/20', paddingClassName)}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white',
                  manualExtractionIssue ? 'bg-amber-600' : 'bg-blue-600',
                )}
              >
                {manualExtractionIssue ? (
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id={titleId} className="text-base font-semibold text-foreground">
                    {panelTitle}
                  </h3>
                  <Badge variant="outline" className={crmStateClassName(state)}>
                    {crmStateLabel(state)}
                  </Badge>
                  {operatorPack?.priority === 'high' || crmReviewCard?.priority === 'high' ? (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
                      Prioridad alta
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {documentLabel} desde {sourceChannel}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {crmReviewCard ? (
                    <Badge variant="outline" className="bg-background">
                      Ficha CRM operativa
                    </Badge>
                  ) : null}
                  {intentLabel(documentProfile?.primary_intent || reviewContext?.primary_intent || crmReviewCard?.primary_intent) ? (
                    <Badge variant="outline" className="bg-background">
                      {intentLabel(documentProfile?.primary_intent || reviewContext?.primary_intent || crmReviewCard?.primary_intent)}
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className="bg-background">
                    {catalogEnabled ? 'Cruce con catalogo' : 'Documento operativo'}
                  </Badge>
                  {operatorQueue ? (
                    <Badge variant="outline" className="bg-background">
                      Cola: {operatorQueue}
                    </Badge>
                  ) : null}
                  {slaHint ? (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
                      SLA {slaHint}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => copyText(operatorSummaryText(), 'Resumen operativo copiado', 'No se pudo copiar el resumen')}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copiar resumen
            </Button>
            {sourceFileUrl ? (
              <Button asChild size="sm">
                <a href={sourceFileUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir documento original">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Abrir original
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {isProcessing ? (
        <div
          className="flex items-start gap-3 border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-100"
          role="status"
          aria-label="Analizando documento"
          aria-live="polite"
        >
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <div>
            <p className="font-semibold">Analizando documento</p>
            <p className="mt-0.5 text-xs opacity-80">Las lineas, coincidencias y faltantes se actualizaran cuando termine la extraccion.</p>
          </div>
        </div>
      ) : null}

      {manualExtractionIssue ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-semibold">No se pudo completar una lectura automatica confiable</p>
              <p className="mt-0.5 text-xs opacity-80">El caso requiere revisar el documento original antes de confirmar datos o catalogo.</p>
              {errorMessages.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                  {errorMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <section className="border-b bg-blue-50/60 px-4 py-3 dark:bg-blue-950/15" aria-labelledby={nextActionId}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h4 id={nextActionId} className="text-xs font-semibold text-blue-800 dark:text-blue-200">
              PROXIMA ACCION
            </h4>
            <p className="mt-1 text-base font-semibold text-foreground">
              {primaryAction}
            </p>
            {operatorObjective ? <p className="mt-1 text-xs text-muted-foreground">Objetivo operativo: {operatorObjective}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {missingFields.length ? (
              <Badge variant="outline" className="border-amber-300 bg-background text-amber-800 dark:text-amber-100">
                {missingFields.length} dato{missingFields.length === 1 ? '' : 's'} faltante{missingFields.length === 1 ? '' : 's'}
              </Badge>
            ) : null}
            {followUpCode ? (
              <Badge variant="outline" className="bg-background font-mono">
                {followUpCode}
              </Badge>
            ) : null}
          </div>
        </div>
      </section>

      <dl className="grid grid-cols-2 divide-x divide-y border-b sm:grid-cols-4 sm:divide-y-0">
        <div className="px-4 py-3">
          <dt className="text-xs font-medium text-muted-foreground">Lineas detectadas</dt>
          <dd
            className="mt-1 text-xl font-bold"
            aria-label={`${detectedCount} ${detectedCount === 1 ? 'linea detectada' : 'lineas detectadas'}`}
          >
            {detectedCount}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs font-medium text-muted-foreground">Coincidencias</dt>
          <dd
            className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300"
            aria-label={`${matchedCount} ${matchedCount === 1 ? 'coincidencia' : 'coincidencias'} de catalogo`}
          >
            {matchedCount}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs font-medium text-muted-foreground">Sin coincidencia</dt>
          <dd
            className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300"
            aria-label={`${unmatchedCount} ${unmatchedCount === 1 ? 'linea' : 'lineas'} sin coincidencia`}
          >
            {unmatchedCount}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs font-medium text-muted-foreground">Datos faltantes</dt>
          <dd
            className="mt-1 text-xl font-bold"
            aria-label={`${missingFields.length} ${missingFields.length === 1 ? 'dato faltante' : 'datos faltantes'}`}
          >
            {missingFields.length}
          </dd>
        </div>
      </dl>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <div className="grid border-b lg:grid-cols-2 lg:divide-x">
            <article className={paddingClassName} aria-labelledby={sourceId}>
              <SectionHeading
                id={sourceId}
                icon={FileText}
                title="Documento original"
                description="Archivo, texto o vista previa recibida por el canal de origen."
              />

              {sourceAttachmentName || sourceAttachmentId || sourceMimeType || sourceFileSize ? (
                <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                  {sourceAttachmentName ? (
                    <div className="min-w-0 sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Archivo</dt>
                      <dd className="mt-0.5 break-all font-medium">{sourceAttachmentName}</dd>
                    </div>
                  ) : null}
                  {sourceMimeType ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">Formato</dt>
                      <dd className="mt-0.5 font-medium">{sourceMimeType}</dd>
                    </div>
                  ) : null}
                  {sourceFileSize ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">Tamano</dt>
                      <dd className="mt-0.5 font-medium">{sourceFileSize}</dd>
                    </div>
                  ) : null}
                  {sourceAttachmentId ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">ID de adjunto</dt>
                      <dd className="mt-0.5 break-all font-mono text-xs">{sourceAttachmentId}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {textPreview ? (
                <blockquote className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap border-l-2 pl-3 text-sm text-muted-foreground">
                  {textPreview}
                </blockquote>
              ) : sourceAttachmentName || sourceFileUrl ? (
                <p className="mt-3 text-xs text-muted-foreground">El contrato no incluye una vista previa de texto.</p>
              ) : (
                <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground" role="status">
                  <FileQuestion className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Sin adjunto ni texto original disponible en el contrato.
                </div>
              )}
            </article>

            <article className={paddingClassName} aria-labelledby={summaryId}>
              <SectionHeading
                id={summaryId}
                icon={Sparkles}
                title="Resumen IA"
                description={manualExtractionIssue ? 'Resultado disponible con revision manual obligatoria.' : 'Sintesis y campos normalizados recibidos del backend.'}
                aside={
                  structuredExtraction?.confidence ? (
                    <Badge variant="outline" className="bg-background">
                      Confianza {confidenceLabel(structuredExtraction.confidence) || structuredExtraction.confidence}
                    </Badge>
                  ) : null
                }
              />

              {aiSummary ? (
                <p className="mt-3 whitespace-pre-wrap text-sm font-medium text-foreground">{aiSummary}</p>
              ) : (
                <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground" role="status">
                  <FileQuestion className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {manualExtractionIssue ? 'Sin resumen IA confiable.' : isProcessing ? 'El resumen IA todavia se esta generando.' : 'Sin resumen IA disponible.'}
                </div>
              )}

              {detailFields.length ? (
                <dl className="mt-3 grid gap-x-4 gap-y-2 border-t pt-3 sm:grid-cols-2">
                  {detailFields.map((field) => (
                    <div key={field.key} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{field.label}</dt>
                      <dd className="mt-0.5 break-words text-sm font-medium">{field.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </article>
          </div>

          <section className={cn('border-b', paddingClassName)} aria-labelledby={linesId}>
            {crmOrderDraft ? (
              <p className="mb-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Borrador de pedido armado
              </p>
            ) : null}
            <SectionHeading
              id={linesId}
              icon={ClipboardList}
              title="Lineas detectadas"
              description="Texto original, cantidad y resultado del cruce de catalogo por renglon."
              aside={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="bg-background">
                    {lines.length} visible{lines.length === 1 ? '' : 's'}
                  </Badge>
                  {crmOrderDraft ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => copyText(orderDraftCopyText(), 'Pedido copiado', 'No se pudo copiar el pedido')}
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      Copiar pedido
                    </Button>
                  ) : null}
                </div>
              }
            />

            {lines.length ? (
              <div className="mt-3 max-h-[30rem] overflow-auto border">
                <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                  <caption className="sr-only">Lineas detectadas y coincidencias de catalogo</caption>
                  <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Texto detectado</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Cantidad</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Estado de catalogo</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Coincidencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lines.map((line, index) => {
                      const catalogName = draftLineCatalogName(line);
                      const sku = draftLineSku(line);
                      const price = line.catalog_match ? candidatePrice(line.catalog_match) : null;
                      const matched = Boolean(line.status === 'catalog_matched' || line.catalog_match || line.catalog_item_id);
                      return (
                        <tr key={line.line_id || `${draftLineName(line)}-${index}`} className="align-top">
                          <th scope="row" className="px-3 py-3 font-medium text-foreground">
                            {draftLineName(line)}
                          </th>
                          <td className="whitespace-nowrap px-3 py-3">{draftLineQuantity(line)}</td>
                          <td className="px-3 py-3">
                            <Badge variant="outline" className={draftLineStatusClassName(line)}>
                              {matched ? <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" /> : <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />}
                              {draftLineStatusLabel(line)}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            {catalogName ? (
                              <div>
                                <p className="font-medium text-foreground">{catalogName}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {[sku ? `SKU ${sku}` : null, price].filter(Boolean).join(' / ')}
                                </p>
                              </div>
                            ) : (
                              <span className="text-amber-700 dark:text-amber-300">Sin producto confirmado</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-3 border border-dashed p-4 text-sm text-muted-foreground" role="status">
                <FileQuestion className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-foreground">No hay lineas detectadas</p>
                  <p className="mt-1 text-xs">
                    {isProcessing
                      ? 'La lectura sigue en curso.'
                      : manualExtractionIssue
                        ? 'Revisar el documento original y cargar las lineas manualmente.'
                        : 'El contrato recibido no incluyo lineas estructuradas.'}
                  </p>
                </div>
              </div>
            )}
          </section>

          {catalogEnabled ? (
            <section className={paddingClassName} aria-labelledby={catalogId}>
              <SectionHeading
                id={catalogId}
                icon={ClipboardCheck}
                title="Alternativas de catalogo"
                description="Candidatos reales enviados por el backend para resolver las lineas sin coincidencia."
                aside={
                  catalogCandidateGroups.length ? (
                    <Badge variant="outline" className="bg-background">
                      {catalogCandidateGroups.length} grupo{catalogCandidateGroups.length === 1 ? '' : 's'}
                    </Badge>
                  ) : null
                }
              />

              {catalogCandidateGroups.length ? (
                <div className="mt-3 divide-y border">
                  {catalogCandidateGroups.map((group, groupIndex) => {
                    const draftLine = findDraftLineForCandidateGroup(group);
                    return (
                      <div key={`${group.itemLabel}-${groupIndex}`} className="p-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-medium text-foreground">
                            Sin coincidencia: <span className="text-amber-700 dark:text-amber-300">{group.itemLabel}</span>
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {group.candidates.length} candidato{group.candidates.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        <div className="mt-2 divide-y border-t">
                          {group.candidates.map((candidate, candidateIndex) => {
                            const name = candidateName(candidate);
                            const sku = candidateSku(candidate);
                            const price = candidatePrice(candidate);
                            const score = candidateScore(candidate);
                            const confidence = confidenceLabel(candidate.confidence);
                            const reason = candidateReason(candidate);
                            const referenceUrl = candidateReferenceUrl(candidate);
                            const catalogItemId = candidateCatalogItemId(candidate);
                            const resolutionKey = `${draftLine?.line_id || group.itemLabel}:${catalogItemId || candidateIndex}`;
                            const isCurrentResolution = resolvingCatalogCandidateKey === resolutionKey;
                            const canResolve = Boolean(onResolveCatalogCandidate && catalogItemId !== null);

                            return (
                              <div key={`${name}-${catalogItemId || candidateIndex}`} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium text-foreground">{name}</p>
                                    {score ? <Badge variant="outline">Score {score}</Badge> : null}
                                    {confidence ? <Badge variant="outline">Confianza {confidence}</Badge> : null}
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {[sku ? `SKU ${sku}` : null, price ? `Precio ${price}` : null].filter(Boolean).join(' / ') || 'Sin SKU ni precio informado'}
                                  </p>
                                  {reason ? <p className="mt-1 text-xs text-muted-foreground">Motivo: {reason}</p> : null}
                                </div>

                                <div className="flex shrink-0 flex-wrap gap-2">
                                  {onResolveCatalogCandidate ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={!canResolve || isResolvingCatalog}
                                      aria-label={`Vincular ${group.itemLabel} con ${name}`}
                                      aria-busy={isCurrentResolution}
                                      onClick={() => {
                                        if (catalogItemId === null) return;
                                        onResolveCatalogCandidate({
                                          lineId: draftLine?.line_id || null,
                                          sourceName: group.itemLabel,
                                          catalogItemId,
                                          candidateName: name,
                                        });
                                      }}
                                    >
                                      {isCurrentResolution ? (
                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                      ) : (
                                        <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                                      )}
                                      {isCurrentResolution ? 'Vinculando' : 'Vincular'}
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    aria-label={`Copiar candidato ${name}`}
                                    onClick={() => copyText(candidateCopyText(group, candidate), 'Candidato copiado', 'No se pudo copiar el candidato')}
                                  >
                                    <Copy className="h-4 w-4" aria-hidden="true" />
                                    Copiar
                                  </Button>
                                  {referenceUrl ? (
                                    <Button asChild size="sm" variant="outline">
                                      <a href={referenceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Abrir referencia ${name}`}>
                                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                        Abrir
                                      </a>
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : unmatchedItems.length || unmatchedCount ? (
                <div className="mt-3 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100" role="status">
                  <p className="font-semibold">Sin alternativas de catalogo</p>
                  <p className="mt-1 text-xs opacity-80">El backend marco lineas pendientes, pero no envio candidatos para vincular.</p>
                  {unmatchedItems.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                      {unmatchedItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" role="status">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  No hay lineas pendientes de catalogo.
                </div>
              )}
            </section>
          ) : null}
        </div>

        <aside className="border-t bg-muted/10 xl:border-l xl:border-t-0" aria-label="Contexto y acciones del operador">
          <section className={cn('border-b', paddingClassName)} aria-labelledby={missingId}>
            <SectionHeading
              id={missingId}
              icon={AlertTriangle}
              title="Datos faltantes y bloqueos"
              description="Informacion que debe resolverse antes de confirmar o responder."
            />

            {missingFields.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {missingFields.map((field, index) => (
                  <li key={field} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      {index + 1}
                    </span>
                    <span>{humanizeKey(field) || field}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground" role="status">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                El contrato no informa campos faltantes.
              </div>
            )}

            {customerBlockingReasons.length ? (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground">BLOQUEOS DE CONFIRMACION</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {customerBlockingReasons.map((reason, index) => (
                    <li key={`${reason.code || reason.id || index}-${reason.line_id || reason.source_name || index}`}>
                      <p className="font-medium">{blockerLabel(reason)}</p>
                      {reason.source_name ? <p className="mt-0.5 text-xs text-muted-foreground">Linea: {reason.source_name}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className={cn('border-b', paddingClassName)} aria-labelledby={contactId}>
            <SectionHeading id={contactId} icon={User} title="Contacto" description="Datos y canales disponibles para responder." />
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="sr-only">Nombre</dt>
                  <dd className="break-words">{contactName || 'Sin nombre'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="sr-only">Telefono</dt>
                  <dd className="break-all">{contactPhone || 'Sin telefono'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="sr-only">Email</dt>
                  <dd className="break-all">{contactEmail || 'Sin email'}</dd>
                </div>
              </div>
            </dl>
            {contactNotes ? <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">Nota: {contactNotes}</p> : null}
            {contactLinks.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {contactLinks.map((link) => {
                  const Icon = link.type === 'whatsapp' ? MessageCircle : link.type === 'email' ? Mail : ExternalLink;
                  return (
                    <Button key={`${link.type || link.label}-${link.href}`} asChild size="sm" variant="outline">
                      <a href={link.href || '#'} target={link.type === 'email' ? undefined : '_blank'} rel="noopener noreferrer">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {link.label || 'Contactar'}
                      </a>
                    </Button>
                  );
                })}
              </div>
            ) : null}
          </section>

          {suggestedReply ? (
            <section className={cn('border-b', paddingClassName)} aria-labelledby={`${contactId}-reply`}>
              <SectionHeading
                id={`${contactId}-reply`}
                icon={MessageCircle}
                title="Respuesta sugerida"
                aside={
                  <Button type="button" size="sm" variant="outline" onClick={() => copyText(suggestedReply, 'Respuesta copiada', 'No se pudo copiar la respuesta')}>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copiar
                  </Button>
                }
              />
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{suggestedReply}</p>
            </section>
          ) : null}

          {followUpCode || followUpHref || followUpChannels.length ? (
            <section className={cn('border-b', paddingClassName)} aria-labelledby={`${contactId}-follow-up`}>
              <SectionHeading id={`${contactId}-follow-up`} icon={ClipboardCheck} title="Seguimiento" description="Continuidad publica recibida en el contrato." />
              {followUpCode ? <p className="mt-3 break-all font-mono text-sm font-semibold">{followUpCode}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {followUpHref ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={followUpHref} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Abrir
                    </a>
                  </Button>
                ) : null}
                {followUpHref || followUpCode ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => copyText(followUpHref || followUpCode || '', 'Seguimiento copiado', 'No se pudo copiar el seguimiento')}>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copiar
                  </Button>
                ) : null}
                {followUpChannels.map((channel) => (
                  <Button key={`${channel.id || channel.label}-${channel.href}`} asChild size="sm" variant="outline">
                    <a href={channel.href || '#'} target="_blank" rel="noopener noreferrer">
                      {channel.id === 'whatsapp_handoff' || channel.type === 'whatsapp' ? (
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      )}
                      {channel.label || 'Continuar'}
                    </a>
                  </Button>
                ))}
              </div>
            </section>
          ) : null}

          <details className={paddingClassName}>
            <summary id={contextId} className="cursor-pointer text-sm font-semibold text-foreground">
              Contexto operativo adicional
            </summary>
            <div className="mt-3 space-y-4 text-sm" aria-labelledby={contextId}>
              {reviewReasons.length ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">MOTIVOS DE REVISION</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {reviewReasons.map((reason) => (
                      <li key={reason}>{reviewReasonLabel(reason)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {crmHandoff ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">DERIVACION OPERATIVA</p>
                  <dl className="mt-2 space-y-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">Modulo</dt>
                      <dd>{targetModuleLabel(crmHandoff.target_module) || 'Panel operativo'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Registro</dt>
                      <dd>{recordLabel(crmHandoff.recommended_record) || 'Revision del operador'}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              {suggestedTasks.length ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">CHECKLIST</p>
                  <ul className="mt-2 space-y-2">
                    {suggestedTasks.map((task, index) => (
                      <li key={task.id || index}>
                        <p className="font-medium">{task.label || 'Tarea operativa'}</p>
                        {task.description ? <p className="mt-0.5 text-xs text-muted-foreground">{task.description}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {nextActions.length ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">PROXIMAS ACCIONES</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4">
                    {nextActions.map((action, index) => (
                      <li key={firstText(action.id, action.reference) || index}>{actionLabel(action)}</li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {assistedRequest.customer_next_steps?.length ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">PLAN PARA EL CLIENTE</p>
                  <ul className="mt-2 space-y-2">
                    {assistedRequest.customer_next_steps.map((step, index) => (
                      <li key={step.id || index}>
                        <p className="font-medium">{step.label || 'Paso pendiente'}</p>
                        {step.description ? <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {intakeExperience?.pipeline?.length ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">FLUJO DE INGRESO</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4">
                    {intakeExperience.pipeline.map((step, index) => (
                      <li key={step.id || index}>{step.label || 'Etapa operativa'}</li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          </details>
        </aside>
      </div>
    </section>
  );
}
