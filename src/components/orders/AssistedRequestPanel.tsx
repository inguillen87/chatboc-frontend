import { AlertTriangle, ClipboardCheck, ClipboardList, Copy, ExternalLink, FileText, Mail, MessageCircle, Phone, Sparkles, User } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  AssistedCatalogCandidate,
  AssistedCatalogCandidateGroup,
  AssistedOrderRequest,
  CrmOrderDraft,
  CrmOrderDraftLine,
  Order,
} from '@/types/unified';

type AssistedRequestPanelProps = {
  order: Order;
  className?: string;
  dense?: boolean;
};

const summaryNumber = (assistedRequest: AssistedOrderRequest, key: 'matched' | 'unmatched' | 'detected') => {
  const value = assistedRequest.match_summary?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

const crmStateLabel = (state?: string | null) => {
  if (state === 'ready_for_confirmation') return 'Listo para confirmar';
  if (state === 'pending_operator_review') return 'Revision requerida';
  return 'Solicitud asistida';
};

const crmStateClassName = (state?: string | null) => {
  if (state === 'ready_for_confirmation') return 'border-emerald-300 bg-emerald-50 text-emerald-800';
  if (state === 'pending_operator_review') return 'border-amber-300 bg-amber-50 text-amber-800';
  return 'border-blue-300 bg-blue-50 text-blue-800';
};

const actionLabel = (action: Record<string, unknown>) =>
  String(action.label || action.title || action.id || 'Accion recomendada');

const valueText = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = valueText(value)?.trim();
    if (text) return text;
  }
  return null;
};

const candidateListKeys = ['candidates', 'catalog_candidates', 'suggested_candidates', 'alternatives', 'alternativas'];

const candidateRecordsFrom = (value: unknown): AssistedCatalogCandidate[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord) as AssistedCatalogCandidate[];
};

const candidatesFromRecord = (record: Record<string, unknown>) => {
  for (const key of candidateListKeys) {
    const candidates = candidateRecordsFrom(record[key]);
    if (candidates.length) return candidates;
  }
  return [];
};

const rowLabel = (row: unknown) => {
  if (!isRecord(row)) return valueText(row);
  const label = firstText(
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
  const quantity = firstText(row.cantidad, row.quantity, row.qty, row.unidades);
  if (label && quantity && !label.startsWith(quantity)) return `${quantity} ${label}`;
  return label;
};

type CandidateGroupView = {
  itemLabel: string;
  candidates: AssistedCatalogCandidate[];
};

const normalizeCandidateGroups = (assistedRequest: AssistedOrderRequest): CandidateGroupView[] => {
  const groups: CandidateGroupView[] = [];
  const seen = new Set<string>();

  const appendGroup = (entry: unknown, fallbackLabel?: string | null) => {
    if (!isRecord(entry)) return;
    const candidates = candidatesFromRecord(entry);
    if (!candidates.length) return;

    const itemLabel =
      firstText(entry.item, entry.item_label, entry.requested_item, entry.query, entry.text) ||
      rowLabel(entry.row) ||
      rowLabel(entry) ||
      fallbackLabel ||
      'Item no encontrado';
    const identity = `${itemLabel}|${candidates
      .map((candidate) => firstText(candidate.catalogo_item_id, candidate.product_id, candidate.id, candidate.sku, candidate.name, candidate.nombre))
      .join(',')}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    groups.push({ itemLabel, candidates });
  };

  const appendGroupsFromArray = (value: unknown, fallbackLabels?: string[]) => {
    if (!Array.isArray(value)) return;
    const records = value.filter(isRecord);
    const hasGroupedShape = records.some((entry) => candidatesFromRecord(entry).length > 0);
    if (hasGroupedShape) {
      records.forEach((entry, index) => appendGroup(entry, fallbackLabels?.[index]));
      return;
    }

    const candidates = candidateRecordsFrom(value);
    if (candidates.length) {
      appendGroup({ item: fallbackLabels?.[0] || 'Item no encontrado', candidates });
    }
  };

  appendGroupsFromArray(assistedRequest.catalog_candidates, assistedRequest.unmatched_items);
  appendGroupsFromArray(assistedRequest.candidate_groups, assistedRequest.unmatched_items);
  appendGroupsFromArray(assistedRequest.product_candidates, assistedRequest.unmatched_items);
  appendGroupsFromArray(assistedRequest.suggested_candidates, assistedRequest.unmatched_items);

  if (isRecord(assistedRequest.operator_pack)) {
    appendGroupsFromArray(assistedRequest.operator_pack.catalog_candidates, assistedRequest.unmatched_items);
    appendGroupsFromArray(assistedRequest.operator_pack.suggested_candidates, assistedRequest.unmatched_items);
    appendGroupsFromArray(assistedRequest.operator_pack.candidate_groups, assistedRequest.unmatched_items);
  }

  (assistedRequest.raw_unmatched_rows || []).forEach((row, index) => {
    appendGroup(row, assistedRequest.unmatched_items?.[index] || null);
  });

  return groups;
};

const candidateName = (candidate: AssistedCatalogCandidate) =>
  firstText(candidate.name, candidate.nombre, candidate.title, candidate.label, candidate.product_name, candidate.nombre_producto, candidate.sku) ||
  'Producto candidato';

const candidateSku = (candidate: AssistedCatalogCandidate) => firstText(candidate.sku, candidate.codigo, candidate.code);

const candidatePrice = (candidate: AssistedCatalogCandidate) => {
  const value = candidate.price ?? candidate.precio ?? candidate.precio_unitario ?? candidate.unit_price ?? candidate.price_label ?? candidate.precio_str;
  const currency = firstText(candidate.currency, candidate.moneda);
  const prefix = currency && currency.toUpperCase() !== 'ARS' ? `${currency} ` : '$';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${prefix}${value.toLocaleString('es-AR')}`;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const numeric = Number(trimmed.replace(',', '.'));
    if (/^\d+(?:[\.,]\d+)?$/.test(trimmed) && Number.isFinite(numeric)) {
      return `${prefix}${numeric.toLocaleString('es-AR')}`;
    }
    return trimmed || null;
  }
  return valueText(value);
};

const candidateReason = (candidate: AssistedCatalogCandidate) =>
  firstText(candidate.reason, candidate.match_reason, candidate.motivo, candidate.description);

const candidateScore = (candidate: AssistedCatalogCandidate) => {
  const raw = candidate.score ?? candidate.similarity ?? candidate.match_score;
  const numeric = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;
  if (Number.isFinite(numeric)) {
    const percent = numeric <= 1 ? numeric * 100 : numeric;
    return `${Math.round(percent)}%`;
  }
  return valueText(raw);
};

const isCrmOrderDraft = (value: unknown): value is CrmOrderDraft =>
  isRecord(value) &&
  (value.contract_version === 'marketplace.crm_order_draft.v1' || Array.isArray(value.lines));

const resolveCrmOrderDraft = (assistedRequest: AssistedOrderRequest): CrmOrderDraft | null => {
  if (isCrmOrderDraft(assistedRequest.crm_order_draft)) return assistedRequest.crm_order_draft;
  if (isCrmOrderDraft(assistedRequest.crm_handoff?.draft_order)) {
    return assistedRequest.crm_handoff?.draft_order as CrmOrderDraft;
  }
  return null;
};

const draftLineStatusLabel = (status?: string | null) => {
  if (status === 'catalog_matched') return 'Catalogo confirmado';
  if (status === 'needs_catalog_resolution') return 'Resolver catalogo';
  if (status === 'needs_review') return 'Revision';
  return status ? status.replace(/_/g, ' ') : 'Sin estado';
};

const draftLineStatusClassName = (status?: string | null) => {
  if (status === 'catalog_matched') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100';
  }
  if (status === 'needs_catalog_resolution' || status === 'needs_review') {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100';
  }
  return 'bg-background/80';
};

const draftLineName = (line: CrmOrderDraftLine) =>
  firstText(line.source_name, line.catalog_match?.name, line.catalog_match?.nombre, line.catalog_match?.sku) || 'Item detectado';

const draftLineQuantity = (line: CrmOrderDraftLine) => {
  const quantity = firstText(line.quantity);
  const unit = firstText(line.unit, line.catalog_match?.unidad);
  if (quantity && unit) return `${quantity} ${unit}`;
  return quantity || '1';
};

const draftLineSku = (line: CrmOrderDraftLine) => firstText(line.sku, line.catalog_match?.sku, line.catalog_match?.codigo);

const draftLineCatalogName = (line: CrmOrderDraftLine) =>
  line.catalog_match ? candidateName(line.catalog_match) : null;

const draftSummaryNumber = (draft: CrmOrderDraft | null, key: 'detected' | 'matched' | 'unmatched') => {
  const value = draft?.summary?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const lines = draft?.lines || [];
  if (key === 'detected') return lines.length;
  if (key === 'matched') return lines.filter((line) => line.status === 'catalog_matched').length;
  return lines.filter((line) => line.status !== 'catalog_matched').length;
};

const confidenceLabel = (value: unknown) => {
  const text = valueText(value)?.toLowerCase();
  if (!text) return null;
  if (text === 'high') return 'Alta';
  if (text === 'medium') return 'Media';
  if (text === 'low') return 'Baja';
  return valueText(value);
};

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
  return labels[text] || text.replace(/_/g, ' ');
};

const reviewReasonLabel = (value: unknown) => {
  const text = valueText(value);
  if (!text) return null;
  const labels: Record<string, string> = {
    lectura_ia_baja_confianza: 'Lectura IA baja confianza',
    items_sin_match_exacto: 'Items sin match exacto',
    catalogo_sin_match_automatico: 'Sin match automatico',
    contacto_incompleto: 'Contacto incompleto',
    listo_para_confirmar: 'Listo para confirmar',
  };
  return labels[text] || text.replace(/_/g, ' ');
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

const humanizeKey = (value: unknown) => {
  const text = valueText(value);
  if (!text) return null;
  return HUMAN_FIELD_LABELS[text] || text.replace(/_/g, ' ');
};

const targetModuleLabel = (value: unknown) => {
  const text = valueText(value);
  if (!text) return null;
  return TARGET_MODULE_LABELS[text] || text.replace(/_/g, ' ');
};

const recordLabel = (value: unknown) => {
  const text = valueText(value);
  if (!text) return null;
  return RECORD_LABELS[text] || text.replace(/_/g, ' ');
};

const formatStructuredValue = (value: unknown): string | null => {
  const primitive = valueText(value);
  if (primitive) return primitive;
  if (Array.isArray(value)) {
    return value.map(formatStructuredValue).filter(Boolean).join(', ') || null;
  }
  if (isRecord(value)) {
    const parts = Object.entries(value)
      .map(([key, item]) => {
        const formatted = formatStructuredValue(item);
        return formatted ? `${humanizeKey(key) || key}: ${formatted}` : null;
      })
      .filter(Boolean);
    return parts.join(' · ') || null;
  }
  return null;
};

const fieldEntriesFrom = (value: unknown) =>
  isRecord(value)
    ? Object.entries(value)
        .map(([key, item]) => ({ key, label: humanizeKey(key) || key, value: formatStructuredValue(item) }))
        .filter((entry) => Boolean(entry.value))
    : [];

const candidateReferenceUrl = (candidate: AssistedCatalogCandidate) =>
  firstText(candidate.href, candidate.url, candidate.product_url, candidate.reference_url, candidate.admin_url, candidate.public_url, candidate.permalink);

const candidateReference = (candidate: AssistedCatalogCandidate) =>
  firstText(candidate.reference, candidate.catalogo_item_id, candidate.product_id, candidate.id);

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

const operatorSummaryText = ({
  order,
  assistedRequest,
  documentLabel,
  sourceChannel,
  contactSummary,
  structuredFields,
  missingFields,
  unmatchedItems,
  catalogCandidateGroups,
  primaryAction,
  followUpCode,
  followUpHref,
  suggestedReply,
  crmOrderDraft,
}: {
  order: Order;
  assistedRequest: AssistedOrderRequest;
  documentLabel: string;
  sourceChannel: string;
  contactSummary: string;
  structuredFields: Array<{ key: string; label: string | null; value: string | null }>;
  missingFields: string[];
  unmatchedItems: string[];
  catalogCandidateGroups: CandidateGroupView[];
  primaryAction: string;
  followUpCode?: string | null;
  followUpHref?: string | null;
  suggestedReply?: string | null;
  crmOrderDraft?: CrmOrderDraft | null;
}) =>
  [
    'Resumen operativo Chatboc',
    `Pedido/Solicitud: ${order.id}`,
    `Tipo: ${documentLabel}`,
    `Canal: ${sourceChannel}`,
    `Estado CRM: ${crmStateLabel(assistedRequest.crm_state)}`,
    `Proximo paso: ${primaryAction}`,
    `Contacto: ${contactSummary}`,
    followUpCode || followUpHref ? `Seguimiento: ${followUpCode || followUpHref}` : null,
    structuredFields.length
      ? `Datos detectados:\n${structuredFields
          .slice(0, 8)
          .map((field) => `- ${field.label}: ${field.value}`)
          .join('\n')}`
      : null,
    missingFields.length ? `Faltantes: ${missingFields.map((field) => humanizeKey(field) || field).join(', ')}` : null,
    crmOrderDraft?.lines?.length
      ? `Pedido armado:\n${crmOrderDraft.lines
          .slice(0, 12)
          .map((line) => {
            const catalogName = draftLineCatalogName(line);
            return `- ${draftLineQuantity(line)} ${draftLineName(line)}${
              catalogName ? ` -> ${catalogName}` : ''
            } (${draftLineStatusLabel(line.status)})`;
          })
          .join('\n')}`
      : null,
    unmatchedItems.length ? `Para revisar: ${unmatchedItems.join(', ')}` : null,
    catalogCandidateGroups.length
      ? `Candidatos de catalogo:\n${catalogCandidateGroups
          .slice(0, 4)
          .map((group) => `- ${group.itemLabel}: ${group.candidates.slice(0, 3).map(candidateName).join(' / ')}`)
          .join('\n')}`
      : null,
    suggestedReply ? `Respuesta sugerida:\n${suggestedReply}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

const taskToneClassName = (tone?: string | null) => {
  if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100';
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100';
  if (tone === 'primary') return 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-100';
  return 'border-border bg-muted/30 text-foreground';
};

export function AssistedRequestPanel({ order, className, dense = false }: AssistedRequestPanelProps) {
  const assistedRequest = order.assisted_request;
  if (!assistedRequest) return null;

  const operatorPack = assistedRequest.operator_pack || null;
  const operatorIntakeSummary = assistedRequest.operator_intake_summary || null;
  const contact = assistedRequest.contact || order.contact || order.customer_profile || null;
  const contactNotes = assistedRequest.contact?.notes || null;
  const documentLabel =
    assistedRequest.request_kind_label ||
    assistedRequest.source?.request_kind_label ||
    (assistedRequest.mode === 'order_note_upload' ? 'archivo de pedido' : 'archivo recibido');
  const sourceChannel = assistedRequest.source?.channel || order.channel || 'marketplace';
  const rowErrors = assistedRequest.row_errors || [];
  const extractionError = assistedRequest.extraction_error || assistedRequest.source?.extraction_error || null;
  const textPreview = assistedRequest.source?.text_preview || null;
  const unmatchedItems = assistedRequest.unmatched_items || [];
  const catalogCandidateGroups = normalizeCandidateGroups(assistedRequest);
  const nextActions = (assistedRequest.next_actions || []).filter((action) => action && action.enabled !== false);
  const suggestedTasks = operatorPack?.suggested_tasks || [];
  const contactLinks = operatorPack?.contact_links?.filter((link) => link.href) || [];
  const suggestedReply = operatorPack?.suggested_reply || null;
  const documentProfile = assistedRequest.document_profile || null;
  const structuredExtraction = assistedRequest.structured_extraction || null;
  const crmHandoff = assistedRequest.crm_handoff || null;
  const crmOrderDraft = resolveCrmOrderDraft(assistedRequest);
  const reviewContext = assistedRequest.review_context || null;
  const reviewReasons = reviewContext?.review_reasons || [];
  const structuredFields = fieldEntriesFrom(structuredExtraction?.fields);
  const missingFields = structuredExtraction?.missing_fields || [];
  const draftRecord = crmOrderDraft
    ? null
    : crmHandoff?.draft_ticket ||
      crmHandoff?.draft_task ||
      crmHandoff?.draft_order ||
      crmHandoff?.draft_assisted_order ||
      null;
  const draftFields = fieldEntriesFrom(draftRecord);
  const customerNextSteps = assistedRequest.customer_next_steps || [];
  const intakeExperience = assistedRequest.intake_experience || null;
  const intakePipeline = intakeExperience?.pipeline?.slice(0, 4) || [];
  const intakeCapabilities = intakeExperience?.capabilities?.slice(0, 4) || [];
  const publicFollowUp = assistedRequest.public_follow_up || null;
  const followUpTracking = publicFollowUp?.tracking || null;
  const followUpCode = followUpTracking?.code || null;
  const followUpHref = makeAbsoluteHref(followUpTracking?.path || null);
  const followUpChannels = publicFollowUp?.channels?.filter((channel) => channel?.href) || [];
  const detectedCount = summaryNumber(assistedRequest, 'detected');
  const matchedCount = summaryNumber(assistedRequest, 'matched');
  const unmatchedCount = summaryNumber(assistedRequest, 'unmatched');
  const draftLines = crmOrderDraft?.lines || [];
  const draftDetectedCount = draftSummaryNumber(crmOrderDraft, 'detected');
  const draftMatchedCount = draftSummaryNumber(crmOrderDraft, 'matched');
  const draftUnmatchedCount = draftSummaryNumber(crmOrderDraft, 'unmatched');
  const operatorNextStep = humanizeKey(operatorIntakeSummary?.recommended_next_step);
  const primaryAction =
    firstText(nextActions[0]?.label, nextActions[0]?.title, suggestedTasks[0]?.label) ||
    (missingFields.length ? `Completar ${humanizeKey(missingFields[0]) || missingFields[0]}` : null) ||
    operatorNextStep ||
    (suggestedReply ? 'Enviar respuesta sugerida' : 'Revisar solicitud');
  const contactRecord = isRecord(contact) ? contact : null;
  const contactSummary = contactRecord
    ? firstText(contactRecord.name, contactRecord.phone, contactRecord.whatsapp, contactRecord.email) || 'Contacto sin dato principal'
    : firstText(
        formatStructuredValue(structuredExtraction?.fields?.contacto),
        structuredExtraction?.fields?.telefono,
        structuredExtraction?.fields?.email,
      ) || 'Sin contacto';
  const headerSummary = documentProfile?.catalog_matching
    ? 'Chatboc separo datos, cruzo catalogo y marco lo que requiere revision humana.'
    : 'Chatboc separo datos, clasifico la solicitud y marco lo que requiere revision humana.';
  const originalTextLabel = documentProfile?.catalog_matching ? 'Pedido escrito por el cliente' : 'Texto original del solicitante';

  const handleCopyOperatorSummary = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(
        operatorSummaryText({
          order,
          assistedRequest,
          documentLabel,
          sourceChannel,
          contactSummary,
          structuredFields,
          missingFields,
          unmatchedItems,
          catalogCandidateGroups,
          primaryAction,
          followUpCode,
          followUpHref,
          suggestedReply,
          crmOrderDraft,
        }),
      );
      toast.success('Resumen operativo copiado');
    } catch (error) {
      toast.error('No se pudo copiar el resumen');
    }
  };

  const handleCopySuggestedReply = async () => {
    if (!suggestedReply) return;
    try {
      await navigator.clipboard.writeText(suggestedReply);
      toast.success('Respuesta copiada');
    } catch (error) {
      toast.error('No se pudo copiar la respuesta');
    }
  };

  const handleCopyCrmOrderDraft = async () => {
    if (!crmOrderDraft) return;
    const text = [
      'Pedido armado por Chatboc',
      crmOrderDraft.reference ? `Referencia: ${crmOrderDraft.reference}` : null,
      crmOrderDraft.recommended_next_step
        ? `Proximo paso: ${humanizeKey(crmOrderDraft.recommended_next_step) || crmOrderDraft.recommended_next_step}`
        : null,
      draftLines.length
        ? draftLines
            .map((line) => {
              const catalogName = draftLineCatalogName(line);
              return `- ${draftLineQuantity(line)} ${draftLineName(line)}${
                catalogName ? ` -> ${catalogName}` : ''
              } (${draftLineStatusLabel(line.status)})`;
            })
            .join('\n')
        : 'Sin lineas detectadas',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      toast.success('Pedido armado copiado');
    } catch (error) {
      toast.error('No se pudo copiar el pedido armado');
    }
  };

  const handleCopyCandidate = async (group: CandidateGroupView, candidate: AssistedCatalogCandidate) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(candidateCopyText(group, candidate));
      toast.success('Candidato copiado');
    } catch (error) {
      toast.error('No se pudo copiar el candidato');
    }
  };

  const handleCopyFollowUp = async () => {
    const value = followUpHref || followUpCode;
    if (!value) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(value);
      toast.success('Seguimiento copiado');
    } catch (error) {
      toast.error('No se pudo copiar el seguimiento');
    }
  };

  return (
    <section
      className={cn(
        'rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-background to-emerald-50 p-4 shadow-sm dark:border-blue-900 dark:from-blue-950/40 dark:via-background dark:to-emerald-950/20',
        className,
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-blue-950 dark:text-blue-100">Solicitud asistida por IA</h3>
                <Badge variant="outline" className={crmStateClassName(assistedRequest.crm_state)}>
                  {crmStateLabel(assistedRequest.crm_state)}
                </Badge>
                {operatorPack?.priority === 'high' ? (
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                    Prioridad alta
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {documentLabel} desde {sourceChannel}. {headerSummary}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {intentLabel(documentProfile?.primary_intent || reviewContext?.primary_intent) ? (
                  <Badge variant="outline" className="bg-background/80">
                    {intentLabel(documentProfile?.primary_intent || reviewContext?.primary_intent)}
                  </Badge>
                ) : null}
                {documentProfile?.catalog_matching ? (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100">
                    Cruce con catalogo
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-background/80">
                    Documento operativo
                  </Badge>
                )}
                {documentProfile?.input_mode ? (
                  <Badge variant="outline" className="bg-background/80">
                    {documentProfile.input_mode === 'file' ? 'Archivo' : 'Texto'}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          {assistedRequest.customer_message ? (
            <p className="rounded-lg border bg-background/75 p-3 text-sm text-foreground">{assistedRequest.customer_message}</p>
          ) : null}
          {operatorIntakeSummary?.objective ? (
            <div className="rounded-lg border bg-background/75 p-3 text-sm text-foreground">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objetivo operativo</p>
              <p className="mt-1 font-medium">{operatorIntakeSummary.objective}</p>
              {operatorIntakeSummary.recommended_next_step ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Accion sugerida: {humanizeKey(operatorIntakeSummary.recommended_next_step) || operatorIntakeSummary.recommended_next_step}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {assistedRequest.source?.archivo_url ? (
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <a href={assistedRequest.source.archivo_url} target="_blank" rel="noopener noreferrer">
              <FileText className="h-4 w-4" />
              Ver archivo
            </a>
          </Button>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-blue-200 bg-background/85 p-3 shadow-sm dark:border-blue-900">
        <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr_0.85fr_0.85fr]">
          <div className="rounded-lg border bg-blue-50/70 p-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-100">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-75">Proximo paso</p>
            <p className="mt-1 font-semibold">{primaryAction}</p>
            <p className="mt-1 text-xs opacity-80">
              Prioriza la decision del operador antes de leer todo el documento.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lectura IA</p>
            <p className="mt-1 font-semibold">
              {detectedCount} detectados · {matchedCount} en catalogo · {unmatchedCount} a revisar
            </p>
            {missingFields.length ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Falta: {missingFields.slice(0, 3).map((field) => humanizeKey(field) || field).join(', ')}
              </p>
            ) : null}
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contacto</p>
            <p className="mt-1 truncate font-semibold">{contactSummary}</p>
            <p className="mt-1 text-xs text-muted-foreground">WhatsApp, email o dato capturado.</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seguimiento</p>
            <p className="mt-1 truncate font-semibold">{followUpCode || 'Sin link publico'}</p>
            <p className="mt-1 text-xs text-muted-foreground">Codigo para cliente o CRM.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={handleCopyOperatorSummary}>
            <Copy className="h-4 w-4" />
            Copiar resumen operativo
          </Button>
          {suggestedReply ? (
            <Button type="button" size="sm" variant="outline" onClick={handleCopySuggestedReply}>
              <ClipboardCheck className="h-4 w-4" />
              Copiar respuesta
            </Button>
          ) : null}
          {followUpHref || followUpCode ? (
            <Button type="button" size="sm" variant="outline" onClick={handleCopyFollowUp}>
              <Copy className="h-4 w-4" />
              Copiar seguimiento
            </Button>
          ) : null}
          {assistedRequest.source?.archivo_url ? (
            <Button asChild size="sm" variant="outline">
              <a href={assistedRequest.source.archivo_url} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4" />
                Ver archivo original
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {crmOrderDraft ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-background to-blue-50 shadow-sm dark:border-emerald-900 dark:from-emerald-950/25 dark:via-background dark:to-blue-950/20">
          <div className="flex flex-col gap-3 border-b border-emerald-200/70 p-3 md:flex-row md:items-start md:justify-between dark:border-emerald-900/60">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                <h4 className="font-semibold text-emerald-950 dark:text-emerald-100">Borrador de pedido armado</h4>
                {crmOrderDraft.reference ? (
                  <Badge variant="outline" className="bg-background/80 font-mono">
                    {crmOrderDraft.reference}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Lineas normalizadas desde foto, papel, PDF, WhatsApp o marketplace para confirmar stock, precio y respuesta comercial.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Badge variant="outline" className={crmOrderDraft.needs_operator_review ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}>
                {crmOrderDraft.needs_operator_review ? 'Revision humana' : 'Listo para confirmar'}
              </Badge>
              <Button type="button" size="sm" variant="outline" onClick={handleCopyCrmOrderDraft}>
                <Copy className="h-4 w-4" />
                Copiar pedido
              </Button>
            </div>
          </div>

          <div className="grid gap-2 p-3 md:grid-cols-4">
            <div className="rounded-lg border bg-background/80 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detectados</p>
              <p className="mt-1 text-xl font-bold">{draftDetectedCount}</p>
            </div>
            <div className="rounded-lg border bg-background/80 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En catalogo</p>
              <p className="mt-1 text-xl font-bold text-emerald-700">{draftMatchedCount}</p>
            </div>
            <div className="rounded-lg border bg-background/80 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">A resolver</p>
              <p className="mt-1 text-xl font-bold text-amber-700">{draftUnmatchedCount}</p>
            </div>
            <div className="rounded-lg border bg-background/80 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proximo paso</p>
              <p className="mt-1 line-clamp-2 font-semibold">
                {humanizeKey(crmOrderDraft.recommended_next_step) || crmOrderDraft.recommended_next_step || 'Revisar y responder'}
              </p>
            </div>
          </div>

          <div className="space-y-2 px-3 pb-3">
            {draftLines.length ? (
              draftLines.slice(0, 12).map((line, index) => {
                const catalogName = draftLineCatalogName(line);
                const sku = draftLineSku(line);
                const price = line.catalog_match ? candidatePrice(line.catalog_match) : null;
                const candidateCount = typeof line.candidate_count === 'number' ? line.candidate_count : null;
                return (
                  <div key={line.line_id || `${draftLineName(line)}-${index}`} className="rounded-lg border bg-background/90 p-3 text-sm">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="bg-muted/30 font-mono">
                            {draftLineQuantity(line)}
                          </Badge>
                          <p className="font-semibold text-foreground">{draftLineName(line)}</p>
                          <Badge variant="outline" className={draftLineStatusClassName(line.status)}>
                            {draftLineStatusLabel(line.status)}
                          </Badge>
                        </div>
                        {catalogName ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Match catalogo: <span className="font-medium text-foreground">{catalogName}</span>
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                            Sin producto confirmado. Resolver alternativa antes de confirmar.
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {sku ? (
                          <Badge variant="outline" className="bg-background/80 font-mono">
                            SKU {sku}
                          </Badge>
                        ) : null}
                        {price ? (
                          <Badge variant="outline" className="bg-background/80">
                            {price}
                          </Badge>
                        ) : null}
                        {candidateCount ? (
                          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-100">
                            {candidateCount} candidato{candidateCount === 1 ? '' : 's'}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
                Todavia no hay lineas confiables. Revisar el adjunto o pedir al cliente que reenvie la nota con mas claridad.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {publicFollowUp && (followUpCode || followUpHref || followUpChannels.length) ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                <ClipboardCheck className="h-4 w-4" />
                Seguimiento publico
                {followUpCode ? (
                  <Badge variant="outline" className="border-emerald-300 bg-background/80 font-mono text-emerald-800 dark:text-emerald-100">
                    {followUpCode}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs opacity-80">
                Link seguro para que el cliente consulte estado, deje datos y continue la conversacion sin crear cuenta.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {followUpHref ? (
                <Button asChild size="sm" variant="outline">
                  <a href={followUpHref} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Abrir
                  </a>
                </Button>
              ) : null}
              {followUpHref || followUpCode ? (
                <Button type="button" size="sm" variant="outline" onClick={handleCopyFollowUp}>
                  <Copy className="h-4 w-4" />
                  Copiar
                </Button>
              ) : null}
              {followUpChannels
                .filter((channel) => channel.id === 'whatsapp_handoff')
                .slice(0, 1)
                .map((channel) => (
                  <Button key={channel.href} asChild size="sm">
                    <a href={channel.href || '#'} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </a>
                  </Button>
                ))}
            </div>
          </div>
        </div>
      ) : null}

      {intakeExperience ? (
        <div className="mt-4 rounded-lg border bg-background/80 p-3 text-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 font-medium">
                <Sparkles className="h-4 w-4 text-blue-600" />
                {intakeExperience.title || 'Ingreso asistido por IA'}
              </div>
              {intakeExperience.summary ? (
                <p className="mt-1 text-xs text-muted-foreground">{intakeExperience.summary}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {intakeExperience.anonymous_intake ? <Badge variant="outline">Anonimo</Badge> : null}
              {intakeExperience.catalog_matching ? <Badge variant="outline">Catalogo</Badge> : null}
              {intakeExperience.needs_operator_review ? <Badge variant="outline">Revision humana</Badge> : null}
            </div>
          </div>
          {intakePipeline.length ? (
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              {intakePipeline.map((step, index) => (
                <div key={step.id || step.label || index} className="rounded-md border bg-muted/25 p-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paso {index + 1}</p>
                  <p className="mt-1 font-medium">{step.label || 'Etapa operativa'}</p>
                  {step.description ? <p className="mt-1 text-xs text-muted-foreground">{step.description}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
          {intakeCapabilities.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {intakeCapabilities.map((capability) => (
                <Badge key={capability.id || capability.label} variant="outline" className="bg-muted/30">
                  {capability.label || capability.id}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {structuredExtraction || crmHandoff ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-lg border bg-background/80 p-3 text-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                  Datos entendidos por IA
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Campos normalizados para que el operador no tenga que interpretar el papel, foto o texto original.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {structuredExtraction?.confidence ? (
                  <Badge variant="outline" className="bg-muted/30">
                    {String(structuredExtraction.confidence).replace(/_/g, ' ')}
                  </Badge>
                ) : null}
                {structuredExtraction?.source ? (
                  <Badge variant="outline" className="bg-muted/30">
                    {String(structuredExtraction.source).replace(/_/g, ' ')}
                  </Badge>
                ) : null}
              </div>
            </div>

            {structuredFields.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {structuredFields.slice(0, 10).map((field) => (
                  <div key={field.key} className="rounded-md border bg-muted/20 p-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{field.label}</p>
                    <p className="mt-1 break-words font-medium">{field.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                La solicitud quedo para lectura manual porque no hay campos estructurados confiables.
              </p>
            )}

            {missingFields.length ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/70 p-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
                <p className="font-semibold">Faltantes para completar</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {missingFields.slice(0, 8).map((field) => (
                    <Badge key={field} variant="outline" className="bg-background/80">
                      {humanizeKey(field) || field}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border bg-background/80 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <ClipboardCheck className="h-4 w-4 text-emerald-700" />
              Derivacion operativa
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Donde deberia continuar el caso y que registro conviene crear o revisar.
            </p>
            <div className="mt-3 grid gap-2">
              <div className="rounded-md border bg-muted/20 p-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Modulo destino</p>
                <p className="mt-1 font-medium">{targetModuleLabel(crmHandoff?.target_module) || 'Panel operativo'}</p>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registro sugerido</p>
                <p className="mt-1 font-medium">{recordLabel(crmHandoff?.recommended_record) || 'Revision del operador'}</p>
              </div>
              {crmHandoff?.operator_goal ? (
                <div className="rounded-md border bg-muted/20 p-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objetivo operativo</p>
                  <p className="mt-1 font-medium">{String(crmHandoff.operator_goal).replace(/_/g, ' ')}</p>
                </div>
              ) : null}
            </div>
            {draftFields.length ? (
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/60 p-2 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Borrador para cargar</p>
                <div className="mt-2 grid gap-1">
                  {draftFields.slice(0, 8).map((field) => (
                    <div key={field.key} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
                      <span className="text-xs opacity-75">{field.label}</span>
                      <span className="break-words font-medium sm:text-right">{field.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {suggestedReply ? (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 font-medium text-blue-950 dark:text-blue-100">
                <ClipboardCheck className="h-4 w-4" />
                Respuesta lista para enviar
              </div>
              <p className="whitespace-pre-wrap text-muted-foreground">{suggestedReply}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handleCopySuggestedReply}>
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
              {contactLinks.map((link) => {
                const Icon = link.type === 'whatsapp' ? MessageCircle : link.type === 'email' ? Mail : ExternalLink;
                return (
                  <Button key={`${link.type}-${link.href}`} asChild size="sm">
                    <a href={link.href || '#'} target={link.type === 'email' ? undefined : '_blank'} rel="noopener noreferrer">
                      <Icon className="h-4 w-4" />
                      {link.label || 'Responder'}
                    </a>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {textPreview ? (
        <div className="mt-4 rounded-lg border bg-background/75 p-3 text-sm">
          <div className="mb-2 flex items-center gap-2 font-medium">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {originalTextLabel}
          </div>
          <p className="whitespace-pre-wrap text-muted-foreground">{textPreview}</p>
        </div>
      ) : null}

      {reviewReasons.length || customerNextSteps.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {reviewReasons.length ? (
            <div className="rounded-lg border bg-background/75 p-3 text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                Motivo operativo
              </div>
              <div className="flex flex-wrap gap-2">
                {reviewReasons.slice(0, 6).map((reason) => (
                  <Badge key={reason} variant="outline" className="bg-muted/30">
                    {reviewReasonLabel(reason)}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {customerNextSteps.length ? (
            <div className="rounded-lg border bg-background/75 p-3 text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                Plan para el cliente
              </div>
              <div className="space-y-2">
                {customerNextSteps.slice(0, 4).map((step) => (
                  <div key={step.id || step.label || step.description} className="rounded-md bg-muted/35 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{step.label || 'Paso pendiente'}</span>
                      <Badge variant="outline" className="shrink-0 bg-background/80">
                        {step.status === 'done' ? 'Listo' : 'Pendiente'}
                      </Badge>
                    </div>
                    {step.description ? <p className="mt-1 text-xs text-muted-foreground">{step.description}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {contact ? (
        <div className="mt-4 grid gap-2 rounded-lg border bg-background/70 p-3 text-sm md:grid-cols-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{contact.name || 'Contacto sin nombre'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{contact.phone || contact.whatsapp || 'Sin telefono'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{contact.email || 'Sin email'}</span>
          </div>
          {contactNotes ? (
            <p className="md:col-span-3 text-muted-foreground">Nota: {contactNotes}</p>
          ) : null}
        </div>
      ) : null}

      <div className={cn('mt-4 grid gap-3', dense ? 'grid-cols-3' : 'md:grid-cols-3')}>
        <div className="rounded-lg border bg-background/75 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Detectados</p>
          <p className="mt-1 text-2xl font-bold">{detectedCount}</p>
        </div>
        <div className="rounded-lg border bg-background/75 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">En catalogo</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{matchedCount}</p>
        </div>
        <div className="rounded-lg border bg-background/75 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Para revisar</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{unmatchedCount}</p>
        </div>
      </div>

      {unmatchedItems.length ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
          <div className="mb-2 flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Articulos o datos a resolver
          </div>
          <div className="flex flex-wrap gap-2">
            {unmatchedItems.slice(0, 10).map((label, index) => (
              <Badge key={`${label}-${index}`} variant="outline" className="bg-background/70">
                {label}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {catalogCandidateGroups.length ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-background/80 p-3 text-sm dark:border-amber-900">
          <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 font-medium">
              <ClipboardList className="h-4 w-4 text-amber-700 dark:text-amber-300" />
              Alternativas de catalogo
            </div>
            <span className="text-xs text-muted-foreground">
              {catalogCandidateGroups.length} item{catalogCandidateGroups.length === 1 ? '' : 's'} con candidatos
            </span>
          </div>
          <div className="space-y-3">
            {catalogCandidateGroups.slice(0, 6).map((group, groupIndex) => (
              <div key={`${group.itemLabel}-${groupIndex}`} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-medium">
                    Item no encontrado: <span className="text-foreground">{group.itemLabel}</span>
                  </p>
                  <Badge variant="outline" className="w-fit bg-background/80">
                    {group.candidates.length} candidato{group.candidates.length === 1 ? '' : 's'}
                  </Badge>
                </div>

                <div className="mt-3 grid gap-2">
                  {group.candidates.slice(0, 3).map((candidate, candidateIndex) => {
                    const name = candidateName(candidate);
                    const sku = candidateSku(candidate);
                    const price = candidatePrice(candidate);
                    const score = candidateScore(candidate);
                    const confidence = confidenceLabel(candidate.confidence);
                    const reason = candidateReason(candidate);
                    const reference = candidateReference(candidate);
                    const referenceUrl = candidateReferenceUrl(candidate);

                    return (
                      <div
                        key={`${name}-${sku || reference || candidateIndex}`}
                        className="rounded-md border bg-background/85 p-3"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">{name}</p>
                              {score ? (
                                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-100">
                                  Score {score}
                                </Badge>
                              ) : null}
                              {confidence ? (
                                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100">
                                  Confianza {confidence}
                                </Badge>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {sku ? <span className="rounded border bg-muted/30 px-2 py-1 font-mono">SKU {sku}</span> : null}
                              {price ? <span className="rounded border bg-muted/30 px-2 py-1">Precio {price}</span> : null}
                              {reference ? <span className="rounded border bg-muted/30 px-2 py-1 font-mono">Ref {reference}</span> : null}
                            </div>

                            {reason ? <p className="text-xs text-muted-foreground">Motivo: {reason}</p> : null}
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              aria-label={`Copiar candidato ${name}`}
                              onClick={() => handleCopyCandidate(group, candidate)}
                            >
                              <Copy className="h-4 w-4" />
                              Copiar
                            </Button>
                            {referenceUrl ? (
                              <Button asChild size="sm" variant="outline">
                                <a href={referenceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Abrir referencia ${name}`}>
                                  <ExternalLink className="h-4 w-4" />
                                  Abrir
                                </a>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {rowErrors.length || extractionError ? (
        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950 dark:border-orange-900 dark:bg-orange-950/25 dark:text-orange-100">
          <div className="mb-2 flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Lectura con baja confianza
          </div>
          {extractionError ? <p>{extractionError}</p> : null}
          {rowErrors.length ? (
            <div className="mt-2 space-y-1">
              {rowErrors.slice(0, 4).map((row, index) => (
                <p key={index}>
                  {valueText(row.reason) || valueText(row.error) || 'Renglon para revisar'}
                  {valueText(row.index) ? ` (#${valueText(row.index)})` : ''}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {suggestedTasks.length ? (
        <div className="mt-4 rounded-lg border bg-background/75 p-3 text-sm">
          <div className="mb-2 flex items-center gap-2 font-medium">
            <ClipboardList className="h-4 w-4" />
            Checklist operativo
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {suggestedTasks.slice(0, 6).map((task, index) => (
              <div key={task.id || index} className={cn('rounded-md border p-2', taskToneClassName(task.tone))}>
                <p className="font-medium">{task.label || 'Tarea operativa'}</p>
                {task.description ? <p className="mt-1 text-xs opacity-80">{task.description}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {nextActions.length ? (
        <div className="mt-4 rounded-lg border bg-background/75 p-3 text-sm">
          <div className="mb-2 flex items-center gap-2 font-medium">
            <ClipboardList className="h-4 w-4" />
            Proximas acciones sugeridas
          </div>
          <div className="space-y-2">
            {nextActions.slice(0, 4).map((action, index) => (
              <div key={index} className="flex items-start justify-between gap-3 rounded-md bg-muted/40 p-2">
                <span>{actionLabel(action)}</span>
                {valueText(action.reference) ? <span className="font-mono text-xs text-muted-foreground">{valueText(action.reference)}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
