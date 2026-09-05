import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, PanelLeft, MessageSquare, PanelLeftClose, MessageCircle, Mic, MicOff, X, FileText, ChevronDown, Info, Loader2, Sparkles, CheckCircle2, AlertTriangle, MoreHorizontal, MapPin, ClipboardList, Headphones } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Ticket,
  TicketStatus,
  Message as TicketMessage,
  TicketRealtimeState,
  TicketRealtimeViewer,
  UnifiedConversationStreamItem,
} from '@/types/tickets';
import { Message as ChatMessageData, SendPayload, AttachmentInfo } from '@/types/chat';
import ChatMessage from './ChatMessage';
import DetailsPanel from './DetailsPanel';
import CaseStrip from './CaseStrip';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import ResponseTemplatePicker from './ResponseTemplatePicker';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';
import { useSocket } from '@/context/SocketContext';
import { safeOn } from '@/utils/safeOn';
import {
  getTicketMessages,
  getTicketTimeline,
  isLegacyHtmlGatewayError,
  sendMessage,
  summarizeTicketFetchError,
  updateTicketStatus,
  updateTicketReadState,
  normalizeTicketReplyDelivery,
  type TicketReplyDeliveryStatus,
} from '@/services/ticketService';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';
import { useTickets } from '@/context/TicketContext';
import { IdentityAvatar } from '@/components/identity/IdentityAvatar';
import ScrollToBottomButton from '../ui/ScrollToBottomButton';
import AdjuntarArchivo from '../ui/AdjuntarArchivo';
import { ApiError, apiFetch, getErrorMessage } from '@/utils/api';
import { cn } from '@/lib/utils';
import { CHATBOC_ORBIT_AVATAR } from '@/utils/brandAssets';
import {
  coalesceNumber,
  coalesceString,
  normalizeUploadResponse,
  UploadResponsePayload,
  UploadResponseLike,
} from '@/utils/uploadResponse';
import { ensureAbsoluteUrl } from '@/utils/chatButtons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatTicketStatusLabel, getPublishedTicketTransitions } from '@/utils/ticketStatus';
import { buildOperationalReplyDraft, deriveTicketOperationalGuidance } from './ticketOperationalGuidance';
import { resolveConsentedAvatar } from '@/utils/avatarConsent';
import {
  buildConversationDraftStorageKey,
  persistConversationDraft,
  readConversationDraft,
  removeConversationDraft,
} from './conversationDraftStorage';
import { isTicketAiDraftEvent, TICKET_AI_DRAFT_EVENT_NAME } from './aiDraftEvents';
import {
  deriveAttachmentInfoFromPayload,
  getAttachmentDeliveryUrl,
  getAttachmentPreviewUrl,
} from '@/utils/attachment';
import { isTenantTicketCollectionInvalidation } from '@/utils/tenantTicketInvalidation';
import { buildTenantPath } from '@/utils/tenantPaths';
import type { ResponseTemplateTicketSourceModel } from '@/features/tickets/responseTemplatesApi';
import TicketClaimButton from './TicketClaimButton';
import useTicketPresentationCategory from '@/hooks/useTicketPresentationCategory';
import {
  buildSaasActionPayload,
  createOmnichannelActionClientMessageId,
  getOmnichannelInboxDetailV2,
  postOmnichannelInboxActionV2,
  type OmnichannelInboxActionV2,
  type OmnichannelInboxDetailV2,
  type OmnichannelReplyContract,
  type SaasAction,
} from '@/api/v2/saas';
import { getHandoffActionBlockReason, isAiHandoffAction } from './TicketAiHandoffControl';
import TicketShareActionDialog, {
  getTicketShareActionBlockReason,
  type TicketShareActionKind,
  type TicketShareActionPayload,
} from './TicketShareActionDialog';
import { TicketSlaClocks } from './TicketSlaClocks';
import { resolveTicketSlaSource } from '@/utils/ticketSla';

type UploadResponse = UploadResponseLike;

type ComposerActionResult = {
  scopeKey: string;
  result: OmnichannelInboxActionV2;
};

type ComposerActionMutationVariables = {
  action: SaasAction;
  actionKind: 'reply' | 'handoff' | TicketShareActionKind;
  actionPayload: Record<string, unknown>;
  attemptKey?: string;
  scopeKey: string;
  ticketId: string;
  tenantSlug?: string | null;
  tenantId?: string | number | null;
  expectedSourceModel?: 'TenantTicket' | 'MunicipioTicket';
  expectedTicketId?: string | number;
  detailEndpoint: string;
};

type ComposerActionAttempt = {
  key: string;
  clientMessageId: string;
};

export type ApprovedWhatsAppTemplate = {
  registryId: number;
  name: string;
  language: string | null;
  category: string | null;
  bodyPreview: string;
  variableKeys: string[];
};

const LOCATION_COMPOSER_ACTION_IDS = new Set(['share_location', 'send_location']);
const FORM_COMPOSER_ACTION_IDS = new Set(['share_form', 'send_form']);
const ATTACHMENT_COMPOSER_ACTION_IDS = new Set(['attach_file', 'send_attachment', 'share_attachment']);
const REPLY_COMPOSER_ACTION_IDS = new Set(['reply']);
const REPLY_CONTRACT_VERSION = 'inbox.reply_contract.v1';
const NEW_ATTACHMENT_UPLOAD_UNAVAILABLE_REASON =
  'El backend no publicó un contrato de carga CRM para archivos nuevos. Podés vincular un adjunto existente desde Herramientas si está disponible.';

const normalizeComposerTicketId = (value: unknown): string | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/^(?:municipio|tenant):(.+)$/i);
  return (match?.[1] || raw).trim() || null;
};

const exactComposerSourceModel = (value: unknown): 'TenantTicket' | 'MunicipioTicket' | null => {
  if (value === 'TenantTicket' || value === 'tenant_ticket') return 'TenantTicket';
  if (value === 'MunicipioTicket' || value === 'municipio_ticket') return 'MunicipioTicket';
  return null;
};

const getComposerDetailIdentityBlockReason = (
  selected: Ticket | null | undefined,
  item: OmnichannelInboxDetailV2['item'] | null | undefined,
): string | null => {
  if (!selected || !item) return 'No se pudo verificar la identidad exacta del ticket.';
  const selectedSource = exactComposerSourceModel(selected.source_model);
  const detailSource = exactComposerSourceModel(item.source_model);
  const selectedId = normalizeComposerTicketId(selected.id);
  const detailIds = [item.ticket_id, item.legacy_id, item.id]
    .map(normalizeComposerTicketId)
    .filter((value): value is string => Boolean(value));
  if (!selectedSource || detailSource !== selectedSource || !selectedId || !detailIds.length || detailIds.some((id) => id !== selectedId)) {
    return 'El detalle recibido no coincide con el ticket seleccionado. Las acciones permanecen bloqueadas.';
  }
  const detailTenantSlug = readTrimmedString(item.tenant_slug)?.toLowerCase() || null;
  const selectedTenantSlug = readTrimmedString(selected.tenant_slug)?.toLowerCase() || null;
  if (detailTenantSlug && (!selectedTenantSlug || detailTenantSlug !== selectedTenantSlug)) {
    return 'El detalle recibido pertenece a otro tenant. Las acciones permanecen bloqueadas.';
  }
  const detailTenantId = item.tenant_id == null ? null : String(item.tenant_id).trim();
  const selectedTenantId = selected.tenant_id == null ? null : String(selected.tenant_id).trim();
  if (detailTenantId && (!selectedTenantId || detailTenantId !== selectedTenantId)) {
    return 'El detalle recibido pertenece a otro tenant. Las acciones permanecen bloqueadas.';
  }
  return null;
};

const normalizeComposerActionToken = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase();

const readRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const readTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*(\d{1,3})\s*\}\}/g;

const extractApprovedTemplateVariableKeys = (bodyPreview: string): string[] => {
  const keys = new Set<string>();
  for (const match of bodyPreview.matchAll(TEMPLATE_VARIABLE_PATTERN)) {
    const index = Number(match[1]);
    if (Number.isInteger(index) && index > 0 && index <= 100) keys.add(String(index));
  }
  return [...keys].sort((left, right) => Number(left) - Number(right));
};

export const getApprovedWhatsAppTemplates = (
  replyContract?: Record<string, unknown> | null,
): ApprovedWhatsAppTemplate[] => {
  const whatsapp = readRecord(replyContract?.whatsapp);
  const serviceWindow = readRecord(whatsapp.service_window);
  const candidate = whatsapp.approved_templates ?? serviceWindow.approved_templates;
  if (!Array.isArray(candidate)) return [];

  return candidate.flatMap((entry) => {
    const template = readRecord(entry);
    const registryId = Number(template.id ?? template.registry_id ?? template.template_registry_id);
    const name = readTrimmedString(template.name ?? template.label);
    const bodyPreview = readTrimmedString(
      template.body_preview ?? template.body ?? template.text ?? template.preview,
    );
    if (!Number.isInteger(registryId) || registryId <= 0 || !name || !bodyPreview) return [];
    return [{
      registryId,
      name,
      language: readTrimmedString(template.language),
      category: readTrimmedString(template.category),
      bodyPreview,
      variableKeys: extractApprovedTemplateVariableKeys(bodyPreview),
    }];
  });
};

export const renderApprovedWhatsAppTemplate = (
  template: ApprovedWhatsAppTemplate,
  variables: Record<string, string>,
): string => template.bodyPreview.replace(
  TEMPLATE_VARIABLE_PATTERN,
  (placeholder, key: string) => variables[key]?.trim() || placeholder,
);

const normalizeReplySourceModel = (value: unknown): string => {
  const normalized = normalizeComposerActionToken(value);
  if (['municipioticket', 'municipio_ticket', 'municipio', 'legacy_claim'].includes(normalized)) {
    return 'municipioticket';
  }
  if (['tenantticket', 'tenant_ticket'].includes(normalized)) return 'tenantticket';
  return normalized;
};

const normalizeReplyChannel = (value: unknown): string => {
  const normalized = normalizeComposerActionToken(value);
  if (['wa', 'twilio', 'whatsapp_business'].includes(normalized)) return 'whatsapp';
  if (['mail', 'correo'].includes(normalized)) return 'email';
  return normalized;
};

const findComposerAction = (actions: SaasAction[], ids: Set<string>): SaasAction | null =>
  actions.find((action) => (
    ids.has(normalizeComposerActionToken(action.id)) ||
    ids.has(normalizeComposerActionToken(action.type))
  )) ?? null;

const isTenantTicketSourceModel = (value: unknown): boolean =>
  ['tenantticket', 'tenant_ticket'].includes(normalizeComposerActionToken(value));

const isMunicipioTicketSourceModel = (value: unknown): boolean =>
  ['municipioticket', 'municipio_ticket'].includes(normalizeComposerActionToken(value));

const isAuthoritativeReplySourceModel = (value: unknown): boolean =>
  [
    'tenantticket',
    'tenant_ticket',
    'municipioticket',
    'municipio_ticket',
    'municipio',
    'legacy_claim',
  ].includes(normalizeComposerActionToken(value));

const REPLY_REASON_COPY: Record<string, string> = {
  attachment_reply_not_supported: 'El backend todavía no habilitó el envío durable de archivos para este ticket.',
  location_reply_not_supported: 'El backend todavía no habilitó compartir ubicaciones de forma auditable para este ticket.',
  form_reply_not_supported: 'El backend todavía no habilitó enviar formularios desde este ticket.',
  handoff_not_supported: 'El backend no habilitó la derivación humana para este canal.',
  ticket_assignment_required: 'Tomá o asigná el ticket para responder.',
  ticket_ownership_required: 'Tomá o asigná el ticket para responder.',
  reply_requires_assignment: 'Tomá o asigná el ticket para responder.',
  ticket_channel_not_whatsapp: 'Este ticket no se originó en WhatsApp; la respuesta quedará registrada en el CRM.',
  contact_phone_missing: 'Falta un teléfono verificable para intentar el envío por WhatsApp; la respuesta quedará registrada en el CRM.',
  tenant_whatsapp_sender_missing: 'El municipio no tiene un remitente de WhatsApp habilitado; la respuesta quedará registrada en el CRM.',
  ticket_channel_not_email: 'Este ticket no se originó por email; la respuesta quedará registrada en el CRM.',
  contact_email_missing: 'Falta un email verificable; la respuesta quedará registrada en el CRM.',
};

const getHumanReplyReason = (
  reasonCode?: unknown,
  disabledReason?: unknown,
  fallback = 'El backend publicó esta capacidad como no disponible.',
): string => {
  if (typeof disabledReason === 'string' && disabledReason.trim()) return disabledReason.trim();
  const code = typeof reasonCode === 'string' ? reasonCode.trim().toLowerCase() : '';
  return REPLY_REASON_COPY[code] || fallback;
};

const getActionDisabledReason = (action: SaasAction, fallback: string): string | null => {
  if (action.disabled !== true && action.enabled !== false) return null;
  return getHumanReplyReason(action.reason_code, action.disabled_reason, fallback);
};

const getReplyActionBlockReason = (
  action: SaasAction | null,
  contractBlockReason: string | null,
  publishedBlockReason: string | null = null,
): string | null => {
  if (contractBlockReason) return contractBlockReason;
  if (publishedBlockReason) return publishedBlockReason;
  if (!action) {
    return 'El backend no publicó una acción segura de respuesta para este ticket. Revisá su asignación, estado y canal.';
  }
  const actionDisabledReason = getActionDisabledReason(
    action,
    'El backend publicó la respuesta como no disponible.',
  );
  if (actionDisabledReason) return actionDisabledReason;
  if (!action.endpoint?.startsWith('/')) {
    return 'El backend no publicó un endpoint seguro para responder este ticket.';
  }
  if ((action.method || 'POST').trim().toUpperCase() !== 'POST') {
    return 'El contrato de respuesta publicado no usa el método POST requerido.';
  }
  const idempotency = action.idempotency && typeof action.idempotency === 'object' && !Array.isArray(action.idempotency)
    ? action.idempotency
    : {};
  if (
    idempotency.contract_version !== 'inbox.reply_idempotency.v1' ||
    idempotency.preferred_header !== 'Idempotency-Key' ||
    idempotency.body_field !== 'client_message_id' ||
    idempotency.retry_rule !== 'reuse_same_value'
  ) {
    return 'El backend no publicó el contrato idempotente requerido para responder sin duplicados.';
  }
  return null;
};

export const getPublishedReplyBlockReason = (
  replyContract?: OmnichannelReplyContract,
  sourceModel?: unknown,
  ticketId?: unknown,
  tenantSlug?: unknown,
  tenantId?: unknown,
): string | null => {
  if (!replyContract) return null;
  if (replyContract.contract_version !== REPLY_CONTRACT_VERSION) {
    return 'El backend publicó una versión de contrato de respuesta que esta consola todavía no reconoce.';
  }
  if (replyContract.enabled !== true) {
    return getHumanReplyReason(
      replyContract.reason_code,
      replyContract.disabled_reason,
      'El backend no habilitó la respuesta para este ticket.',
    );
  }
  const publishedSourceModel = exactComposerSourceModel(replyContract.source_model);
  const selectedSourceModel = exactComposerSourceModel(sourceModel);
  if (!publishedSourceModel || !selectedSourceModel || publishedSourceModel !== selectedSourceModel) {
    return 'El contrato de respuesta no coincide con el expediente seleccionado.';
  }
  const publishedTicketId = normalizeComposerTicketId(replyContract.ticket_id);
  const selectedTicketId = normalizeComposerTicketId(ticketId);
  if (!publishedTicketId || !selectedTicketId || publishedTicketId !== selectedTicketId) {
    return 'El contrato de respuesta no coincide con el expediente seleccionado.';
  }
  const publishedTenantSlug = readTrimmedString(replyContract.tenant_slug)?.toLowerCase() || null;
  const selectedTenantSlug = readTrimmedString(tenantSlug)?.toLowerCase() || null;
  if (publishedTenantSlug && (!selectedTenantSlug || publishedTenantSlug !== selectedTenantSlug)) {
    return 'El contrato de respuesta no coincide con el tenant seleccionado.';
  }
  const publishedTenantId = replyContract.tenant_id == null ? null : String(replyContract.tenant_id).trim();
  const selectedTenantId = tenantId == null ? null : String(tenantId).trim();
  if (publishedTenantId && (!selectedTenantId || publishedTenantId !== selectedTenantId)) {
    return 'El contrato de respuesta no coincide con el tenant seleccionado.';
  }
  const textCapability = replyContract.supported_message_types?.text;
  if (textCapability?.enabled !== true) {
    return getHumanReplyReason(
      textCapability?.reason_code,
      textCapability?.disabled_reason,
      'El contrato backend no confirmó soporte para respuestas de texto.',
    );
  }
  if (!replyContract.endpoint?.startsWith('/')) {
    return 'El contrato backend no publicó un endpoint seguro para responder este ticket.';
  }
  if ((replyContract.method || '').trim().toUpperCase() !== 'POST') {
    return 'El contrato backend no publicó el método POST requerido para responder.';
  }
  return null;
};

type ReplyCapabilityKind = 'attachment' | 'location' | 'form' | 'handoff';

const getReplyCapabilityBlockReason = (
  kind: ReplyCapabilityKind,
  replyContract?: OmnichannelReplyContract,
): string | null => {
  if (!replyContract) return null;
  if (replyContract.contract_version !== REPLY_CONTRACT_VERSION) {
    return 'El backend publicó una versión de contrato de respuesta que esta consola todavía no reconoce.';
  }
  const capability = kind === 'handoff'
    ? replyContract.handoff
    : replyContract.supported_message_types?.[kind];
  if (capability?.enabled === true) return null;
  return getHumanReplyReason(
    capability?.reason_code,
    capability?.disabled_reason,
    `El contrato backend no confirmó soporte para ${kind === 'attachment' ? 'archivos' : kind === 'location' ? 'ubicaciones' : kind === 'form' ? 'formularios' : 'derivación humana'}.`,
  );
};

const resolveComposerOmnichannelDetailEndpoint = (ticket: Ticket): string | null => {
  const explicitEndpoint = typeof ticket.detail_endpoint === 'string'
    ? ticket.detail_endpoint.trim()
    : '';
  if (explicitEndpoint.startsWith('/')) return explicitEndpoint;

  const baseEndpoint = `/api/v2/inbox/omnichannel/${encodeURIComponent(String(ticket.id))}`;
  const sourceModel = normalizeComposerActionToken(ticket.source_model);
  if (['municipioticket', 'municipio_ticket', 'municipio', 'legacy_claim'].includes(sourceModel)) {
    return `${baseEndpoint}?source_model=MunicipioTicket`;
  }
  if (['tenantticket', 'tenant_ticket'].includes(sourceModel)) return baseEndpoint;
  return null;
};

const composerActionContractQueryKey = (scopeKey: string, detailEndpoint: string) => [
  'ticket-composer-action-contract',
  scopeKey,
  detailEndpoint,
] as const;

const isDefinitiveComposerActionError = (error: unknown): boolean => {
  if (!(error instanceof ApiError)) return false;
  const status = Number(error.status || 0);
  return status >= 400 && status < 500 && ![408, 425, 429].includes(status);
};

const isMissingComposerActionValue = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && !value.trim());

const canonicalizeComposerActionPayload = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalizeComposerActionPayload);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalizeComposerActionPayload(entry)]),
  );
};

export const createComposerActionAttemptKey = (
  scopeKey: string,
  action: SaasAction,
  payload: Record<string, unknown>,
): string => {
  const idempotency = action.idempotency && typeof action.idempotency === 'object' && !Array.isArray(action.idempotency)
    ? action.idempotency
    : {};
  return JSON.stringify([
    scopeKey,
    normalizeComposerActionToken(action.id),
    action.endpoint || '',
    (action.method || 'POST').trim().toUpperCase(),
    String(idempotency.contract_version || ''),
    canonicalizeComposerActionPayload(payload),
  ]);
};

export const TENANT_TICKET_INVALIDATION_DEBOUNCE_MS = 180;

export const isReplyDeliveryInvalidation = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Record<string, unknown>;
  const payload = envelope.payload && typeof envelope.payload === 'object'
    ? envelope.payload as Record<string, unknown>
    : envelope;
  return payload.contract_version === 'tenant_ticket.reply_delivery.realtime.v1' &&
    payload.resource === 'reply_deliveries' &&
    payload.reason === 'delivery_status_changed' &&
    payload.refetch === true;
};

const formatRelativeTime = (input?: Date | null) => {
  if (!input) {
    return 'Sin actividad reciente';
  }

  const timestamp = input instanceof Date ? input : new Date(input);

  if (Number.isNaN(timestamp.getTime())) {
    return 'Sin actividad reciente';
  }

  const now = Date.now();
  const diffInSeconds = Math.round((timestamp.getTime() - now) / 1000);
  const absSeconds = Math.abs(diffInSeconds);

  if (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat !== 'undefined') {
    const rtf = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });

    if (absSeconds < 60) {
      return rtf.format(diffInSeconds, 'second');
    }

    const diffInMinutes = Math.round(diffInSeconds / 60);
    if (Math.abs(diffInMinutes) < 60) {
      return rtf.format(diffInMinutes, 'minute');
    }

    const diffInHours = Math.round(diffInMinutes / 60);
    if (Math.abs(diffInHours) < 24) {
      return rtf.format(diffInHours, 'hour');
    }

    const diffInDays = Math.round(diffInHours / 24);
    if (Math.abs(diffInDays) < 7) {
      return rtf.format(diffInDays, 'day');
    }

    const diffInWeeks = Math.round(diffInDays / 7);
    if (Math.abs(diffInWeeks) < 4) {
      return rtf.format(diffInWeeks, 'week');
    }
  }

  try {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(timestamp);
  } catch {
    return timestamp.toLocaleString('es-AR');
  }
};

const normalizeIdentityTenantSlug = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9_-]{0,126}[a-z0-9])?$/.test(normalized)
    ? normalized
    : null;
};

const normalizeResponseTemplateSourceModel = (
  value: unknown,
): ResponseTemplateTicketSourceModel | null => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (
    normalized === 'TenantTicket' ||
    normalized === 'MunicipioTicket' ||
    normalized === 'PymeTicket'
  ) {
    return normalized;
  }
  return null;
};

export const getComposerReplyResponseIdentityBlockReason = (
  item: OmnichannelInboxDetailV2['item'] | null | undefined,
  expected: {
    sourceModel?: 'TenantTicket' | 'MunicipioTicket';
    ticketId?: string | number;
    tenantSlug?: string | null;
    tenantId?: string | number | null;
  },
): string | null => {
  if (!item || !expected.sourceModel || !expected.ticketId) {
    return 'La respuesta no confirmó la identidad exacta del ticket.';
  }
  const responseSource = exactComposerSourceModel(item.source_model);
  const responseIds = [item.ticket_id, item.legacy_id, item.id]
    .map(normalizeComposerTicketId)
    .filter((value): value is string => Boolean(value));
  const expectedId = normalizeComposerTicketId(expected.ticketId);
  if (!responseSource || responseSource !== expected.sourceModel || !expectedId || !responseIds.length || responseIds.some((id) => id !== expectedId)) {
    return 'La respuesta no coincide con la identidad source_model + ticket_id enviada.';
  }
  const responseTenantSlug = readTrimmedString(item.tenant_slug)?.toLowerCase() || null;
  const expectedTenantSlug = readTrimmedString(expected.tenantSlug)?.toLowerCase() || null;
  if (responseTenantSlug && (!expectedTenantSlug || responseTenantSlug !== expectedTenantSlug)) {
    return 'La respuesta pertenece a otro tenant.';
  }
  const responseTenantId = item.tenant_id == null ? null : String(item.tenant_id).trim();
  const expectedTenantId = expected.tenantId == null ? null : String(expected.tenantId).trim();
  if (responseTenantId && (!expectedTenantId || responseTenantId !== expectedTenantId)) {
    return 'La respuesta pertenece a otro tenant.';
  }
  return null;
};

type WhatsAppServiceWindowStatus = 'open' | 'expired' | 'unknown';

const readOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const token = normalizeComposerActionToken(value);
  if (['1', 'true', 'yes', 'si'].includes(token)) return true;
  if (['0', 'false', 'no'].includes(token)) return false;
  return undefined;
};

export const getWhatsAppServiceWindowView = (
  replyContract?: Record<string, unknown> | null,
) => {
  const whatsapp = readRecord(replyContract?.whatsapp);
  const serviceWindow = readRecord(whatsapp.service_window);
  const rawStatus = normalizeComposerActionToken(serviceWindow.status);
  const status: WhatsAppServiceWindowStatus =
    rawStatus === 'open' || rawStatus === 'expired' ? rawStatus : 'unknown';
  const recipientAvailable = readOptionalBoolean(whatsapp.recipient_available);
  const freeFormAllowed =
    readOptionalBoolean(whatsapp.free_form_allowed) ??
    readOptionalBoolean(serviceWindow.free_form_allowed) ??
    status === 'open';
  const templateRequired =
    readOptionalBoolean(whatsapp.template_required) ??
    readOptionalBoolean(serviceWindow.template_required) ??
    status !== 'open';
  const approvedTemplateCount = getApprovedWhatsAppTemplates(replyContract).length;
  const expiresAtValue = serviceWindow.expires_at ?? whatsapp.expires_at;
  const expiresAt = expiresAtValue == null ? null : String(expiresAtValue);
  const blocksFreeForm = recipientAvailable === false || !freeFormAllowed || templateRequired;

  if (recipientAvailable === false) {
    return {
      status, expiresAt, recipientAvailable, freeFormAllowed: false, templateRequired,
      approvedTemplateCount, blocksFreeForm: true, tone: 'warning' as const,
      title: 'Sin número de WhatsApp',
      detail: 'Este ticket no tiene un número válido. No se habilita ninguna respuesta externa.',
    };
  }
  if (status === 'open' && !blocksFreeForm) {
    return {
      status, expiresAt, recipientAvailable, freeFormAllowed, templateRequired,
      approvedTemplateCount, blocksFreeForm, tone: 'success' as const,
      title: 'Ventana de atención abierta',
      detail: expiresAt
        ? `Podés responder libremente por WhatsApp hasta ${new Date(expiresAt).toLocaleString()}.`
        : 'Podés responder libremente dentro de la ventana de atención de 24 horas.',
    };
  }
  return {
    status, expiresAt, recipientAvailable, freeFormAllowed, templateRequired,
    approvedTemplateCount, blocksFreeForm, tone: 'warning' as const,
    title: 'Se requiere una plantilla aprobada',
    detail: approvedTemplateCount
      ? 'La ventana de 24 horas está cerrada. Elegí una plantilla aprobada para responder.'
      : 'La ventana de 24 horas está cerrada y el backend no publicó plantillas aprobadas.',
  };
};

export const formatReplyDeliveryChannel = (channel: string) => {
  const normalized = channel.trim().toLowerCase();
  if (normalized === 'whatsapp') return 'WhatsApp';
  if (normalized === 'sms') return 'SMS';
  if (normalized === 'email') return 'Email';
  if (normalized === 'live_socket' || normalized === 'socket') return 'Chat en vivo';
  return 'CRM';
};

const BACKOFFICE_VIEWER_ROLES = new Set([
  'admin',
  'agent',
  'empleado',
  'employee',
  'manager',
  'operator',
  'operador',
  'platform_admin',
  'super_admin',
  'superadmin',
  'supervisor',
  'tenant_admin',
]);
const PUBLIC_RECIPIENT_VIEWER_ROLES = new Set([
  'anonymous',
  'citizen',
  'ciudadano',
  'cliente',
  'customer',
  'lead',
  'neighbor',
  'public_pin',
  'user',
  'usuario',
]);

export const isPublicTicketRecipientViewer = (viewer?: TicketRealtimeViewer | null) => {
  if (!viewer) return false;

  const role = String(viewer.viewer_role || '').trim().toLowerCase().replaceAll('-', '_');
  if (BACKOFFICE_VIEWER_ROLES.has(role) || role.startsWith('admin_')) return false;
  if (PUBLIC_RECIPIENT_VIEWER_ROLES.has(role)) return true;

  const viewerKey = String(viewer.viewer_key || viewer.viewer_id || '').trim().toLowerCase();
  return Boolean(viewer.viewer_anon_id) || viewerKey.startsWith('anon:') || viewerKey.startsWith('pin:');
};

export const hasPublicRecipientPresence = (state?: TicketRealtimeState | null) =>
  Boolean(
    state?.active_viewers?.some((viewer) => {
      const effectiveStatus = String(
        viewer.effective_presence_status || viewer.presence_status || 'active',
      ).toLowerCase();
      return effectiveStatus === 'active' && isPublicTicketRecipientViewer(viewer);
    }),
  );

export const applyPublicRecipientReadConfirmation = (
  delivery: TicketReplyDeliveryStatus | null,
  viewer: TicketRealtimeViewer | null | undefined,
  lastReadCommentIdInput: unknown,
): TicketReplyDeliveryStatus | null => {
  if (!delivery || !isPublicTicketRecipientViewer(viewer)) return delivery;

  const lastReadCommentId = Number(lastReadCommentIdInput || 0);
  const latestReplyCommentId = delivery.latest_reply_comment_id ?? delivery.reply_comment_ids.at(-1);
  if (
    !Number.isInteger(lastReadCommentId) ||
    lastReadCommentId <= 0 ||
    !latestReplyCommentId ||
    lastReadCommentId < latestReplyCommentId
  ) {
    return delivery;
  }

  return {
    ...delivery,
    recipient_presence_confirmed: true,
    recipient_read_confirmed: true,
    ...(delivery.external_dispatch
      ? {}
      : {
          mode: 'real_message',
          channel: 'live_socket',
          status: 'sent',
          reason: 'recipient_read_confirmed',
          reply_status: 'sent_to_live_chat',
        }),
    operator_message: 'Lectura del ciudadano confirmada para el ultimo mensaje.',
  };
};

export type ReplyDeliveryStage =
  | 'saved'
  | 'queued'
  | 'provider_accepted'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'uncertain';

const normalizeDeliveryToken = (value: unknown) => String(value ?? '').trim().toLowerCase();

export const getReplyDeliveryStage = (delivery: TicketReplyDeliveryStatus): ReplyDeliveryStage => {
  const channel = normalizeDeliveryToken(delivery.channel);
  const finalStatus = normalizeDeliveryToken(delivery.final_delivery?.status);
  const finalSource = normalizeDeliveryToken(delivery.final_delivery?.authoritative_source);
  const status = normalizeDeliveryToken(delivery.status);
  const evidenceStage = normalizeDeliveryToken(delivery.evidence_stage);
  const mode = normalizeDeliveryToken(delivery.mode);
  const reason = normalizeDeliveryToken(delivery.reason);
  const isWhatsApp = channel === 'whatsapp';
  const providerCallbackIsAuthoritative = finalSource === 'provider_status_callback';

  if (!isWhatsApp && delivery.recipient_read_confirmed) return 'read';
  if (!isWhatsApp && delivery.recipient_room_emitted && delivery.recipient_presence_confirmed && delivery.reply_status === 'sent_to_live_chat') {
    return 'delivered';
  }
  if (providerCallbackIsAuthoritative && finalStatus === 'read') return 'read';
  if (providerCallbackIsAuthoritative && finalStatus === 'delivered') return 'delivered';
  if (providerCallbackIsAuthoritative && ['failed', 'undelivered'].includes(finalStatus)) return 'failed';
  if ((reason.includes('failed') || reason.includes('uncertain')) && !providerCallbackIsAuthoritative) return 'uncertain';
  if (!delivery.external_dispatch && (channel === 'crm' || ['timeline_only', 'internal_event'].includes(mode))) return 'saved';
  if (finalStatus === 'provider_accepted' || status === 'provider_accepted' || evidenceStage === 'provider_accepted') return 'provider_accepted';
  if (
    ['queued', 'queued_for_delivery'].includes(finalStatus) ||
    ['queued', 'queued_for_delivery', 'durably_staged'].includes(status) ||
    evidenceStage === 'durably_staged' || mode === 'durable_queue'
  ) return 'queued';
  if (
    ['saved', 'local_saved', 'saved_to_crm', 'saved_to_timeline'].includes(finalStatus) ||
    ['saved', 'local_saved', 'saved_to_crm', 'saved_to_timeline'].includes(status) ||
    ['timeline_only', 'internal_event'].includes(mode)
  ) return 'saved';
  if (finalStatus || delivery.external_dispatch || ['accepted', 'sent', 'send_uncertain'].includes(status) || reason.includes('failed') || reason.includes('uncertain')) {
    return 'uncertain';
  }
  return 'saved';
};

const REPLY_DELIVERY_PROGRESS: Record<Exclude<ReplyDeliveryStage, 'failed' | 'uncertain'>, number> = {
  saved: 0, queued: 1, provider_accepted: 2, delivered: 3, read: 4,
};

export const preserveReplyDeliveryProgress = (
  current: TicketReplyDeliveryStatus | null,
  incoming: TicketReplyDeliveryStatus | null,
): TicketReplyDeliveryStatus | null => {
  if (!current) return incoming;
  if (!incoming) return current;
  const currentEventId = current.event_id == null ? null : String(current.event_id);
  const incomingEventId = incoming.event_id == null ? null : String(incoming.event_id);
  if (currentEventId && incomingEventId && currentEventId !== incomingEventId) return incoming;
  const currentStage = getReplyDeliveryStage(current);
  const incomingStage = getReplyDeliveryStage(incoming);
  if (incomingStage === 'failed') return incoming;
  if (currentStage === 'failed') return current;
  if (incomingStage === 'uncertain') {
    return ['queued', 'provider_accepted', 'delivered', 'read'].includes(currentStage) ? current : incoming;
  }
  if (currentStage === 'uncertain') return incoming;
  return REPLY_DELIVERY_PROGRESS[incomingStage] < REPLY_DELIVERY_PROGRESS[currentStage] ? current : incoming;
};

export const getReplyDeliveryView = (delivery: TicketReplyDeliveryStatus) => {
  const channel = formatReplyDeliveryChannel(delivery.channel);
  const stage = getReplyDeliveryStage(delivery);
  if (delivery.recipient_available === false) return {
    tone: 'warning' as const, stage: 'saved' as const, title: 'Sin número de WhatsApp',
    detail: 'La actividad puede quedar auditada en el CRM, pero no existe un número válido para una entrega externa.', retryable: false,
  };
  if (stage === 'read') return { tone: 'success' as const, stage, title: 'Leído', detail: 'El proveedor confirmó que la persona leyó la respuesta.', retryable: false };
  if (stage === 'delivered') return { tone: 'success' as const, stage, title: delivery.channel === 'live_socket' ? 'Entregado en chat en vivo' : 'Entregado', detail: `La entrega en ${channel} fue confirmada y quedó auditada en el CRM.`, retryable: false };
  if (stage === 'provider_accepted') return { tone: 'muted' as const, stage, title: 'Aceptado por el proveedor', detail: 'WhatsApp aceptó el mensaje. La entrega final todavía depende del callback del proveedor.', retryable: false };
  if (stage === 'queued') return { tone: 'muted' as const, stage, title: 'En cola para entregar', detail: delivery.operator_message || 'La respuesta quedó guardada y encolada. Aún no hay aceptación ni entrega confirmada.', retryable: false };
  if (stage === 'failed') return { tone: 'warning' as const, stage, title: 'Entrega fallida', detail: delivery.final_delivery?.error_code ? `El proveedor confirmó el fallo (código ${delivery.final_delivery.error_code}).` : 'El proveedor confirmó que la entrega no se completó.', retryable: true };
  if (stage === 'uncertain') return { tone: 'warning' as const, stage, title: 'Estado de entrega por confirmar', detail: delivery.operator_message || 'La respuesta está auditada en el CRM, pero no hay callback autoritativo de WhatsApp.', retryable: true };
  return { tone: 'muted' as const, stage, title: 'Guardado en CRM', detail: delivery.operator_message || 'La respuesta quedó registrada. Todavía no fue aceptada por el proveedor.', retryable: false };
};

export const shouldShowTicketClaimAction = (isDetailsVisible: boolean): boolean =>
  !isDetailsVisible;

export const getComposerActionDeliveryView = (
  delivery?: OmnichannelInboxActionV2['delivery'],
) => {
  const finalStatus = delivery?.final_delivery?.status?.trim().toLowerCase();
  const finalAuthority = delivery?.final_delivery?.authoritative_source?.trim().toLowerCase();
  const mode = delivery?.mode?.trim().toLowerCase();
  const evidenceStage = delivery?.evidence_stage?.trim().toLowerCase();
  const status = delivery?.status?.trim().toLowerCase();
  const callbackAuthoritative = finalAuthority === 'provider_status_callback';
  const evidence = delivery?.evidence?.contract_version === 'inbox.reply_delivery_evidence.v1'
    ? delivery.evidence
    : undefined;

  if (delivery?.saved_in_crm === true && delivery.receipt_persisted === true && delivery.external_dispatch === false) {
    const inconsistentExternalState = delivery.dispatch_attempted === true || delivery.provider_accepted === true || delivery.delivered === true;
    if (inconsistentExternalState || delivery.failed === true) {
      return {
        tone: 'warning' as const,
        title: 'Evidencia CRM-only inconsistente',
        detail: 'El backend publicó estados externos incompatibles con una acción CRM-only. No se confirma envío ni entrega.',
      };
    }
    if (delivery.idempotent_replay === true || status === 'already_recorded') {
      return {
        tone: 'replay' as const,
        title: 'Reintento reconocido',
        detail: 'Guardado en CRM, no enviado externamente. El backend reconoció la misma operación y no duplicó el artefacto.',
      };
    }
    return {
      tone: 'internal' as const,
      title: 'Guardado sólo en CRM',
      detail: 'Guardado en CRM, no enviado externamente.',
    };
  }

  if (evidence) {
    if (evidence.delivered === true && evidence.failed === true) {
      return {
        tone: 'warning' as const,
        title: 'Evidencia de entrega inconsistente',
        detail: 'El backend publicó estados finales incompatibles. La consola no confirma entrega hasta que se corrija la evidencia.',
      };
    }
    if (evidence.failed === true) {
      return {
        tone: 'warning' as const,
        title: 'Entrega no realizada',
        detail: delivery?.operator_message || 'La evidencia autoritativa indica que la entrega no se completó.',
      };
    }
    if (evidence.delivered === true) {
      if (evidence.delivered_requires !== 'provider_status_callback') {
        return {
          tone: 'warning' as const,
          title: 'Entrega declarada sin autoridad compatible',
          detail: 'El contrato no identifica el callback del proveedor como autoridad final; la consola no confirma entrega.',
        };
      }
      return {
        tone: 'success' as const,
        title: 'Entrega confirmada',
        detail: delivery?.operator_message || 'El callback del proveedor confirmó la entrega final.',
      };
    }
    if (evidence.provider_accepted === true) {
      return {
        tone: 'pending' as const,
        title: 'Aceptado por el proveedor',
        detail: delivery?.operator_message || 'El proveedor aceptó el mensaje; esto todavía no prueba la entrega al destinatario.',
      };
    }
    if (evidence.dispatch_attempted === true) {
      return {
        tone: 'pending' as const,
        title: 'Despacho intentado',
        detail: delivery?.operator_message || 'El backend intentó el despacho; todavía no existe aceptación ni entrega confirmada.',
      };
    }
    if (evidence.saved_in_crm === true) {
      return {
        tone: 'internal' as const,
        title: 'Guardado sólo en CRM',
        detail: delivery?.operator_message || 'La respuesta quedó auditada sin evidencia de despacho externo.',
      };
    }
    return {
      tone: 'pending' as const,
      title: 'Evidencia de entrega incompleta',
      detail: 'El backend publicó el contrato de evidencia sin confirmar registro, despacho ni resultado final.',
    };
  }

  if (callbackAuthoritative && ['delivered', 'read'].includes(finalStatus || '')) {
    return {
      tone: 'success' as const,
      title: finalStatus === 'read' ? 'Leído por el destinatario' : 'Entrega confirmada',
      detail: delivery?.operator_message || 'El callback del proveedor confirmó la entrega final.',
    };
  }

  if (callbackAuthoritative && ['failed', 'undelivered'].includes(finalStatus || '')) {
    return {
      tone: 'warning' as const,
      title: 'Entrega no realizada',
      detail: delivery?.operator_message || 'El callback del proveedor confirmó que la entrega no se completó.',
    };
  }

  if (mode === 'idempotent_replay' || delivery?.idempotency?.replayed === true) {
    return {
      tone: 'replay' as const,
      title: 'Reintento reconocido',
      detail: delivery?.operator_message || 'El backend reconoció la misma operación y no duplicó el mensaje.',
    };
  }

  const durableQueue = (
    delivery?.delivery_mode === 'durable_queue' ||
    mode === 'durable_queue' ||
    evidenceStage === 'durably_staged' ||
    status === 'durably_staged' ||
    delivery?.outbox?.durably_staged === true
  );

  if (durableQueue) {
    return {
      tone: 'queued' as const,
      title: 'En cola para WhatsApp',
      detail: delivery?.operator_message || 'La acción quedó en cola durable. La entrega final se confirma con el callback del proveedor.',
    };
  }

  if (evidenceStage === 'provider_accepted' || status === 'provider_accepted') {
    return {
      tone: 'pending' as const,
      title: 'Aceptado por el proveedor',
      detail: delivery?.operator_message || 'El proveedor aceptó el mensaje; la entrega final sigue pendiente de callback.',
    };
  }

  if (mode === 'timeline_only' || evidenceStage === 'crm_only') {
    return {
      tone: 'internal' as const,
      title: 'Guardado sólo en CRM',
      detail: delivery?.operator_message || 'La respuesta quedó auditada sin evidencia de despacho externo.',
    };
  }

  return {
    tone: 'pending' as const,
    title: 'Respuesta registrada',
    detail: delivery?.operator_message || 'El backend registró la respuesta; la entrega final todavía no está confirmada.',
  };
};

export const getComposerChannelView = ({
  channel,
  recipientPresenceConfirmed,
  lastReplyDelivery,
  replyContract,
}: {
  channel?: string | null;
  recipientPresenceConfirmed: boolean;
  lastReplyDelivery?: TicketReplyDeliveryStatus | null;
  replyContract?: OmnichannelReplyContract;
}) => {
  const normalized = normalizeReplyChannel(channel);
  const lastDeliveryStage = lastReplyDelivery ? getReplyDeliveryStage(lastReplyDelivery) : null;
  const lastDeliveryFailed = lastDeliveryStage === 'failed' || lastDeliveryStage === 'uncertain';

  if (lastDeliveryFailed) {
    return {
      tone: 'warning' as const,
      label: 'Entrega externa a revisar',
      detail: 'El ultimo mensaje quedo guardado, pero el canal externo no confirmo entrega.',
    };
  }

  if (replyContract?.contract_version === REPLY_CONTRACT_VERSION) {
    const deliveryChannels = replyContract.delivery_channels || [];
    const externalChannel = deliveryChannels.find(
      (candidate) => normalizeReplyChannel(candidate.id) === normalized,
    );
    const crmChannel = deliveryChannels.find(
      (candidate) => normalizeComposerActionToken(candidate.id) === 'crm',
    );

    if (externalChannel?.enabled === true && ['whatsapp', 'email'].includes(normalized)) {
      return {
        tone: 'success' as const,
        label: normalized === 'whatsapp' ? 'Salida por WhatsApp disponible' : 'Salida por email disponible',
        detail: 'El backend permite intentar el despacho. La entrega final sólo se confirma con evidencia del proveedor.',
      };
    }

    if (externalChannel?.enabled === false || crmChannel?.enabled === true) {
      return {
        tone: externalChannel?.enabled === false ? 'warning' as const : 'muted' as const,
        label: 'Sólo registro en CRM',
        detail: getHumanReplyReason(
          externalChannel?.reason_code,
          externalChannel?.disabled_reason,
          'El backend confirmó registro auditable, pero no publicó despacho externo para este canal.',
        ),
      };
    }

    return {
      tone: 'warning' as const,
      label: 'Capacidad de salida no verificada',
      detail: 'El contrato no confirmó un canal de entrega para este expediente.',
    };
  }

  if (normalized === 'whatsapp') {
    return {
      tone: 'muted' as const,
      label: 'Canal de origen: WhatsApp',
      detail: 'El canal de origen no prueba que exista una salida WhatsApp habilitada para responder.',
    };
  }

  if (['web', 'widget', 'web_demo_widget', 'live_socket', 'socket'].includes(normalized)) {
    if (recipientPresenceConfirmed) {
      return {
        tone: 'success' as const,
        label: 'Presencia ciudadana confirmada',
        detail: 'La sala reporta presencia pública; esto no confirma por sí solo entrega ni lectura.',
      };
    }

    return {
      tone: 'muted' as const,
      label: 'Canal web sin presencia confirmada',
      detail: 'La conectividad técnica no prueba que el ciudadano esté viendo el ticket.',
    };
  }

  if (normalized === 'email') {
    return {
      tone: 'muted' as const,
      label: 'Canal de origen: email',
      detail: 'El origen por email no prueba que el envío de respuestas esté habilitado.',
    };
  }

  if (normalized === 'phone') {
    return {
      tone: 'muted' as const,
      label: 'Registro de llamada',
      detail: 'Deja constancia operativa para que el equipo no pierda contexto.',
    };
  }

  return {
    tone: 'muted' as const,
    label: 'Registro CRM',
    detail: 'No hay canal externo confirmado; la respuesta queda como actividad del ticket.',
  };
};

// Helper to adapt ticket messages to the format ChatMessageBase expects
const adaptTicketMessageToChatMessage = (msg: TicketMessage, ticket: Ticket): ChatMessageData => {
  const attachments = (msg.attachments || [])
    .map((attachment, index) => deriveAttachmentInfoFromPayload(attachment, attachment.filename || `archivo_${index + 1}`))
    .filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment));
  const primaryAttachment = attachments[0];

  return {
    id: msg.id,
    text: msg.content,
    isBot: msg.author === 'agent',
    timestamp: new Date(msg.timestamp),
    // Adapt other fields as needed
    attachmentInfo: primaryAttachment,
    attachments,
    // Add other fields if they exist in your new TicketMessage type
  };
};

const normalizeMessageFingerprint = (msg: ChatMessageData): string => {
  const text =
    typeof msg.text === 'string'
      ? msg.text.replace(/\s+/g, ' ').trim().toLowerCase()
      : '';
  return `${msg.isBot ? 'agent' : 'user'}:${text}`;
};

const normalizeMessageTimestamp = (msg: ChatMessageData): number => {
  const timestamp =
    msg.timestamp instanceof Date
      ? msg.timestamp
      : new Date(msg.timestamp || Date.now());
  return Number.isNaN(timestamp.getTime()) ? Date.now() : timestamp.getTime();
};

const dedupeChatMessages = (items: ChatMessageData[]): ChatMessageData[] => {
  const seenIds = new Set<string>();
  const accepted: ChatMessageData[] = [];

  for (const item of items) {
    const id = item.id !== undefined && item.id !== null ? String(item.id) : '';
    if (id && seenIds.has(id)) {
      continue;
    }

    const fingerprint = normalizeMessageFingerprint(item);
    const isNearDuplicate = Boolean(fingerprint) && accepted.some((candidate) => {
      if (normalizeMessageFingerprint(candidate) !== fingerprint) {
        return false;
      }
      return Math.abs(normalizeMessageTimestamp(candidate) - normalizeMessageTimestamp(item)) <= 90_000;
    });

    if (isNearDuplicate) {
      continue;
    }

    if (id) seenIds.add(id);
    accepted.push(item);
  }

  return accepted;
};

const stableChatMessageKey = (message: ChatMessageData): string => [
  message.id === undefined || message.id === null ? '' : String(message.id),
  normalizeMessageFingerprint(message),
  String(normalizeMessageTimestamp(message)),
  message.attachmentInfo?.name || '',
  message.attachmentInfo?.url || '',
  message.attachmentInfo?.mimeType || '',
].join('|');

const preserveChatMessagesWhenUnchanged = (
  current: ChatMessageData[],
  incoming: ChatMessageData[],
  append = false,
): ChatMessageData[] => {
  const next = dedupeChatMessages(append ? [...current, ...incoming] : incoming).sort((left, right) => {
    const timestampDelta = normalizeMessageTimestamp(left) - normalizeMessageTimestamp(right);
    if (timestampDelta !== 0) return timestampDelta;
    return String(left.id ?? '').localeCompare(String(right.id ?? ''), undefined, { numeric: true });
  });
  if (current.length !== next.length) return next;
  return current.every((message, index) => stableChatMessageKey(message) === stableChatMessageKey(next[index]))
    ? current
    : next;
};

const mergeUnifiedConversationItems = (
  current: UnifiedConversationStreamItem[],
  incoming: UnifiedConversationStreamItem[],
): UnifiedConversationStreamItem[] => {
  const itemsByKey = new Map<string, UnifiedConversationStreamItem>();
  [...current, ...incoming].forEach((item) => {
    const key = item.id
      ? `id:${item.id}`
      : `fp:${item.timestamp}:${item.actor_type}:${item.preview_text}`;
    itemsByKey.set(key, item);
  });
  return [...itemsByKey.values()].sort((left, right) => {
    const timestampDelta = new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
    if (Number.isFinite(timestampDelta) && timestampDelta !== 0) return timestampDelta;
    return String(left.id || '').localeCompare(String(right.id || ''), undefined, { numeric: true });
  });
};

type ConversationHistoryPage = {
  hasMore: boolean;
  nextCursor: string | null;
};

const EMPTY_CONVERSATION_HISTORY_PAGE: ConversationHistoryPage = {
  hasMore: false,
  nextCursor: null,
};

const hasUnreadConversationState = (ticket: Ticket | null): boolean => Boolean(
  ticket?.hasUnreadMessages ||
  ticket?.collaboration_state?.has_unread ||
  Number(ticket?.collaboration_state?.unread_count || 0) > 0 ||
  Number(ticket?.collaboration_state?.unread_viewer_count || 0) > 0
);

export const shouldShowOperationalTimelineInChat = ({
  eventCount,
  isMobile,
  isDetailsVisible,
}: {
  eventCount: number;
  isMobile: boolean;
  isDetailsVisible: boolean;
}) => eventCount > 0 && (isMobile || !isDetailsVisible);

export const getConversationScrollBehavior = (
  shouldReduceMotion: boolean | null,
): ScrollBehavior => (shouldReduceMotion ? 'auto' : 'smooth');

type TicketAttachment = NonNullable<TicketMessage['attachments']>[number];

const normalizeAttachmentFromPayload = (raw: any): TicketAttachment | null => {
  if (!raw || typeof raw !== 'object') return null;

  const deliveryUrl =
    getAttachmentDeliveryUrl(raw) ||
    raw.archivo_url ||
    raw.public_url ||
    raw.thumbnail_url;
  const previewUrl = getAttachmentPreviewUrl(raw);
  const filename =
    raw.filename ||
    raw.name ||
    raw.nombre ||
    raw.original_filename ||
    raw.file_name ||
    'archivo';

  if (!deliveryUrl && !filename) return null;

  return {
    id: raw.id ?? raw.archivo_id ?? raw.attachment_id ?? deliveryUrl ?? filename,
    filename,
    url: deliveryUrl ? ensureAbsoluteUrl(String(deliveryUrl)) : '',
    downloadUrl: raw.downloadUrl,
    download_url: raw.download_url,
    storage_url: raw.storage_url,
    storage_provider: raw.storage_provider,
    storage_access: raw.storage_access,
    is_private: raw.is_private,
    mime_type: raw.mime_type || raw.mimeType || raw.content_type || raw.type,
    mimeType: raw.mimeType || raw.mime_type || raw.content_type || raw.type,
    size: raw.size,
    thumbUrl: previewUrl ? ensureAbsoluteUrl(String(previewUrl)) : undefined,
    thumb_url: previewUrl ? ensureAbsoluteUrl(String(previewUrl)) : undefined,
    thumbnail_url: previewUrl ? ensureAbsoluteUrl(String(previewUrl)) : undefined,
    thumbnailUrl: previewUrl ? ensureAbsoluteUrl(String(previewUrl)) : undefined,
  };
};

const collectAttachmentsFromPayload = (raw: any): TicketMessage['attachments'] => {
  if (!raw || typeof raw !== 'object') return [];
  const sources = [
    raw.attachments,
    raw.archivos_adjuntos,
    raw.adjuntos,
    raw.archivo_adjunto,
    raw.attachment,
  ];

  return sources.flatMap((source) => {
    if (!source) return [];
    const values = Array.isArray(source) ? source : [source];
    return values
      .map(normalizeAttachmentFromPayload)
      .filter((attachment): attachment is TicketAttachment => Boolean(attachment));
  });
};

const normalizeTicketMessageFromPayload = (raw: any): TicketMessage | null => {
  if (!raw || typeof raw !== 'object') return null;

  const source =
    raw.comment ||
    raw.comentario_obj ||
    raw.mensaje_obj ||
    raw.message ||
    raw.mensaje ||
    raw.payload ||
    raw;
  const content =
    source.comentario ??
    source.mensaje ??
    source.text ??
    source.content ??
    source.body ??
    '';
  const attachments = collectAttachmentsFromPayload(source);

  if (!String(content || '').trim() && attachments.length === 0) {
    return null;
  }

  const id =
    source.id ??
    source.comment_id ??
    source.comentario_id ??
    source.message_id ??
    source.sid ??
    `${source.fecha || source.timestamp || source.created_at || Date.now()}:${content}`;
  const isAdmin =
    source.es_admin === true ||
    source.esAdmin === true ||
    source.is_admin === true ||
    source.isAdmin === true ||
    source.actor === 'agent' ||
    source.author === 'agent' ||
    source.author_type === 'agent';

  return {
    id,
    content: String(content || ''),
    timestamp: source.fecha || source.timestamp || source.created_at || new Date().toISOString(),
    author: isAdmin ? 'agent' : 'user',
    attachments,
  };
};

const extractResponseTicketMessages = (response: any): TicketMessage[] => {
  if (!response || typeof response !== 'object') return [];

  const candidates: any[] = [
    response.comment,
    response.comentario,
    response.message,
    response.mensaje,
  ];

  for (const key of ['comments', 'comentarios', 'messages', 'mensajes']) {
    const value = response[key];
    if (Array.isArray(value)) {
      candidates.push(...value);
    }
  }

  const ticketPayload = response.ticket && typeof response.ticket === 'object' ? response.ticket : null;
  if (ticketPayload) {
    for (const key of ['comments', 'comentarios', 'messages', 'mensajes']) {
      const value = ticketPayload[key];
      if (Array.isArray(value)) {
        candidates.push(...value);
      }
    }
  }

  return candidates
    .map(normalizeTicketMessageFromPayload)
    .filter((msg): msg is TicketMessage => Boolean(msg));
};


interface ConversationPanelProps {
  isMobile: boolean;
  isSidebarVisible: boolean;
  isDetailsVisible: boolean;
  onToggleSidebar: () => void;
  onToggleDetails: () => void;
  canToggleSidebar?: boolean;
  showDetailsToggle?: boolean;
  desktopView?: 'chat' | 'details';
  setDesktopView?: (view: 'chat' | 'details') => void;
  operationalWorkspace?: boolean;
}

const EmptyState: React.FC<{ icon: React.ElementType; title: string; description: string }> = ({
  icon: Icon,
  title,
  description,
}) => (
  <div className="flex h-full flex-col items-center justify-center text-center">
    <Icon className="mb-4 h-12 w-12 text-muted-foreground" />
    <h3 className="font-semibold">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

const ConversationPanel: React.FC<ConversationPanelProps> = ({
  isMobile,
  isSidebarVisible,
  isDetailsVisible,
  onToggleSidebar,
  onToggleDetails,
  canToggleSidebar = false,
  showDetailsToggle = false,
  desktopView,
  setDesktopView,
  operationalWorkspace = false,
}) => {
  const { selectedTicket, updateTicket, refreshTickets } = useTickets();
  const presentationCategory = useTicketPresentationCategory(selectedTicket);
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [timelineItems, setTimelineItems] = useState<UnifiedConversationStreamItem[]>([]);
  const [historyPage, setHistoryPage] = useState<ConversationHistoryPage>(EMPTY_CONVERSATION_HISTORY_PAGE);
  const [isLoadingOlderHistory, setIsLoadingOlderHistory] = useState(false);
  const [timelinePartial, setTimelinePartial] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [lastReplyDelivery, setLastReplyDelivery] = useState<TicketReplyDeliveryStatus | null>(null);
  const [recipientPresenceActive, setRecipientPresenceActive] = useState(
    hasPublicRecipientPresence(selectedTicket?.realtime_state),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [conversationInvalidationVersion, setConversationInvalidationVersion] = useState(0);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{ file: File; previewUrl: string } | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [selectedApprovedTemplateId, setSelectedApprovedTemplateId] = useState('');
  const [approvedTemplateVariables, setApprovedTemplateVariables] = useState<Record<string, string>>({});
  const [composerToolsOpen, setComposerToolsOpen] = useState(false);
  const [lastComposerActionResult, setLastComposerActionResult] = useState<ComposerActionResult | null>(null);
  const [shareActionDialogKind, setShareActionDialogKind] = useState<TicketShareActionKind | null>(null);
  const { user } = useUser();
  const shouldReduceMotion = useReducedMotion();
  const { supported, listening, transcript, start, stop } = useSpeechRecognition();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const olderHistoryRequestRef = useRef<string | null>(null);
  const loadedConversationKeyRef = useRef<string | null>(null);
  const invalidationRefreshTimerRef = useRef<number | null>(null);
  const composerActionInFlightRef = useRef(false);
  const composerActionAttemptRef = useRef<ComposerActionAttempt | null>(null);
  const replyActionAttemptRef = useRef<ComposerActionAttempt | null>(null);
  const selectedTicketRef = useRef<Ticket | null>(selectedTicket);
  const operatorDraftScope = user?.id != null
    ? `id-${user.id}`
    : user?.email?.trim().toLowerCase() || null;
  const tenantDraftScope = selectedTicket
    ? selectedTicket.tenant_slug?.trim().toLowerCase() ||
      (selectedTicket.tenant_id != null ? `tenant-id-${selectedTicket.tenant_id}` : null) ||
      user?.tenant_slug?.trim().toLowerCase() ||
      user?.tenantSlug?.trim().toLowerCase() ||
      null
    : null;
  const selectedConversationKey = selectedTicket
    ? `${tenantDraftScope || 'tenant-ephemeral'}:${selectedTicket.source_model || selectedTicket.tipo}:${selectedTicket.id}`
    : null;
  const activeConversationScopeKey = selectedConversationKey
    ? `${selectedConversationKey}:operator:${operatorDraftScope || 'operator-ephemeral'}`
    : null;
  const conversationDraftStorageKey = selectedTicket && tenantDraftScope && operatorDraftScope
    ? buildConversationDraftStorageKey({
      tenant: tenantDraftScope,
      sourceModel: selectedTicket.source_model || selectedTicket.tipo,
      ticketId: selectedTicket.id,
      operator: operatorDraftScope,
    })
    : null;
  const activeConversationScopeRef = useRef<string | null>(activeConversationScopeKey);
  activeConversationScopeRef.current = activeConversationScopeKey;
  const draftStorageKeyRef = useRef<string | null>(conversationDraftStorageKey);
  const previousConversationScopeRef = useRef<string | null>(null);
  const attachmentPreviewRef = useRef<{ file: File; previewUrl: string } | null>(null);
  const attachmentUrlsByScopeRef = useRef(new Map<string, Set<string>>());
  const pendingDraftsByScopeRef = useRef(new Map<string, string>());
  const conversationScopeEpochRef = useRef(0);
  const messageRef = useRef(message);
  const updateActiveDraft = useCallback((next: string) => {
    messageRef.current = next;
    setMessage(next);
    persistConversationDraft(draftStorageKeyRef.current, next);
  }, []);
  const revokeAttachmentUrlsForScope = useCallback((scopeKey: string | null) => {
    if (!scopeKey) return;
    const urls = attachmentUrlsByScopeRef.current.get(scopeKey);
    urls?.forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    attachmentUrlsByScopeRef.current.delete(scopeKey);
  }, []);
  const revokeAttachmentUrlForScope = useCallback((scopeKey: string | null, previewUrl: string) => {
    if (!scopeKey || !previewUrl) return;
    const urls = attachmentUrlsByScopeRef.current.get(scopeKey);
    if (!urls?.delete(previewUrl)) return;
    URL.revokeObjectURL(previewUrl);
    if (urls.size === 0) attachmentUrlsByScopeRef.current.delete(scopeKey);
  }, []);
  const statusOptions = getPublishedTicketTransitions(selectedTicket);
  const lastMessage = useMemo(() => (messages.length > 0 ? messages[messages.length - 1] : null), [messages]);
  const latestReadableMessageId = useMemo(
    () => messages
      .map((item) => item.id)
      .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
      .filter((id) => {
        const value = String(id);
        if (!value || value.startsWith('sent-') || value.startsWith('temp-')) return false;
        if (typeof id === 'number' && id > 1_000_000_000_000) return false;
        return true;
      })
      .at(-1),
    [messages],
  );
  const selectedTicketHasUnread = hasUnreadConversationState(selectedTicket);
  const { incomingMessagesCount, attachmentsCount } = useMemo(() => {
    let incoming = 0;
    let attachments = 0;

    for (const msg of messages) {
      if (!msg.isBot) {
        incoming += 1;
      }

      if (msg.attachmentInfo) {
        attachments += 1;
      }
    }

    return { incomingMessagesCount: incoming, attachmentsCount: attachments };
  }, [messages]);
  const outgoingMessagesCount = messages.length - incomingMessagesCount;
  const lastMessageSnippet = useMemo(() => {
    if (!lastMessage) {
      return '';
    }

    if (typeof lastMessage.text === 'string' && lastMessage.text.trim()) {
      const plain = lastMessage.text
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (plain) {
        return plain.length > 120 ? `${plain.slice(0, 117)}…` : plain;
      }
    }

    if (lastMessage.attachmentInfo?.name) {
      return `Archivo: ${lastMessage.attachmentInfo.name}`;
    }

    return '';
  }, [lastMessage]);
  const lastActivityLabel = useMemo(() => {
    if (!lastMessage?.timestamp) {
      return 'Sin actividad reciente';
    }

    const value = lastMessage.timestamp instanceof Date
      ? lastMessage.timestamp
      : new Date(lastMessage.timestamp);

    if (Number.isNaN(value.getTime())) {
      return 'Sin actividad reciente';
    }

    return formatRelativeTime(value);
  }, [lastMessage]);
  const operationalTimelineItems = useMemo(
    () =>
      timelineItems.filter((item) => {
        const streamType = String(item.stream_type || '').toLowerCase();
        const source = String(item.source || '').toLowerCase();
        return (
          streamType !== 'message' &&
          streamType !== 'comentario' &&
          source !== 'chat_history' &&
          source !== 'timeline_comment'
        );
      }),
    [timelineItems],
  );
  const showOperationalTimelineInChat = shouldShowOperationalTimelineInChat({
    eventCount: operationalTimelineItems.length,
    isMobile,
    isDetailsVisible,
  });
  const isResponsePending = lastMessage ? !lastMessage.isBot : false;
  const operationalGuidance = useMemo(
    () => (selectedTicket ? deriveTicketOperationalGuidance(selectedTicket) : null),
    [selectedTicket],
  );
  const replyDraft = useMemo(
    () => (selectedTicket && operationalGuidance ? buildOperationalReplyDraft(selectedTicket, operationalGuidance) : ''),
    [operationalGuidance, selectedTicket],
  );
  const canApplyReplyDraft = Boolean(replyDraft && !message.trim() && !listening && !isSending);
  const applyReplyDraft = useCallback(() => {
    if (!replyDraft || isSending || listening) return;
    if (!messageRef.current.trim()) updateActiveDraft(replyDraft);
  }, [isSending, listening, replyDraft, updateActiveDraft]);
  const activeChannel = selectedTicket?.channel || 'other';
  const responseTemplateTenantSlug =
    normalizeIdentityTenantSlug(selectedTicket?.tenant_slug) ||
    normalizeIdentityTenantSlug(user?.tenant_slug || user?.tenantSlug);
  const responseTemplateSourceModel = normalizeResponseTemplateSourceModel(selectedTicket?.source_model);
  const responseTemplateManagementHref = buildTenantPath(
    '/perfil/plantillas-respuesta',
    responseTemplateTenantSlug,
  );
  const responseTemplateMetadata = useMemo(
    () => ({
      category: selectedTicket?.categoria || null,
      status: selectedTicket?.estado || null,
      channel: activeChannel,
    }),
    [activeChannel, selectedTicket?.categoria, selectedTicket?.estado],
  );
  const composerActionDetailEndpoint = useMemo(
    () => (selectedTicket ? resolveComposerOmnichannelDetailEndpoint(selectedTicket) || '' : ''),
    [selectedTicket?.detail_endpoint, selectedTicket?.id, selectedTicket?.source_model],
  );
  const composerActionSelectedTicketId = String(selectedTicket?.id ?? '');
  const composerActionScopeKey = `${selectedConversationKey || 'no-ticket'}|${composerActionDetailEndpoint || 'no-detail'}`;
  const composerActionQueryKey = useMemo(
    () => composerActionContractQueryKey(composerActionScopeKey, composerActionDetailEndpoint),
    [composerActionDetailEndpoint, composerActionScopeKey],
  );
  const activeComposerActionScopeRef = useRef(composerActionScopeKey);
  activeComposerActionScopeRef.current = composerActionScopeKey;
  const composerActionContractQuery = useQuery<OmnichannelInboxDetailV2>({
    queryKey: composerActionQueryKey,
    queryFn: () => getOmnichannelInboxDetailV2(
      composerActionSelectedTicketId,
      responseTemplateTenantSlug,
      composerActionDetailEndpoint,
    ),
    enabled: Boolean(selectedTicket && composerActionDetailEndpoint),
    retry: 0,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
  const publishedComposerActions = useMemo(() => {
    if (!composerActionContractQuery.isSuccess || composerActionContractQuery.isError) return [];
    const item = composerActionContractQuery.data?.item;
    if (!item) return [];
    return item.allowed_actions?.length ? item.allowed_actions : item.actions || [];
  }, [
    composerActionContractQuery.data?.item,
    composerActionContractQuery.isError,
    composerActionContractQuery.isSuccess,
  ]);
  const composerActionItem = composerActionContractQuery.data?.item;
  const selectedComposerSourceModel = exactComposerSourceModel(selectedTicket?.source_model);
  const selectedComposerTicketId = normalizeComposerTicketId(selectedTicket?.id);
  const composerActionTicketId = selectedComposerSourceModel && selectedComposerTicketId
    ? selectedComposerSourceModel === 'MunicipioTicket' ? `municipio:${selectedComposerTicketId}` : selectedComposerTicketId
    : '';
  const composerActionSourceModel = selectedComposerSourceModel || undefined;
  const composerActionAttachments = composerActionItem?.attachments || [];
  const composerSlaSource =
    composerActionContractQuery.data?.item?.sla ||
    resolveTicketSlaSource(selectedTicket || {});
  const handoffAction = useMemo(
    () => publishedComposerActions.find(isAiHandoffAction) ?? null,
    [publishedComposerActions],
  );
  const locationAction = useMemo(
    () => findComposerAction(publishedComposerActions, LOCATION_COMPOSER_ACTION_IDS),
    [publishedComposerActions],
  );
  const formAction = useMemo(
    () => findComposerAction(publishedComposerActions, FORM_COMPOSER_ACTION_IDS),
    [publishedComposerActions],
  );
  const attachmentAction = useMemo(
    () => findComposerAction(publishedComposerActions, ATTACHMENT_COMPOSER_ACTION_IDS),
    [publishedComposerActions],
  );
  const replyAction = useMemo(
    () => findComposerAction(publishedComposerActions, REPLY_COMPOSER_ACTION_IDS),
    [publishedComposerActions],
  );
  const composerReplyContract = composerActionContractQuery.data?.item.reply_contract;
  const isTenantTicketWhatsApp = isTenantTicketSourceModel(selectedTicket?.source_model) &&
    normalizeReplyChannel(activeChannel) === 'whatsapp';
  const whatsappServiceWindow = getWhatsAppServiceWindowView(composerReplyContract);
  const approvedWhatsAppTemplates = useMemo(
    () => getApprovedWhatsAppTemplates(composerReplyContract),
    [composerReplyContract],
  );
  const selectedApprovedTemplate = approvedWhatsAppTemplates.find(
    (template) => String(template.registryId) === selectedApprovedTemplateId,
  ) ?? null;
  const authoritativeReplyRequired = isAuthoritativeReplySourceModel(selectedTicket?.source_model);
  const authoritativeAttachmentMustFailClosed =
    isTenantTicketSourceModel(selectedTicket?.source_model) ||
    isMunicipioTicketSourceModel(selectedTicket?.source_model);
  const detailIdentityBlockReason = composerActionContractQuery.isSuccess
    ? getComposerDetailIdentityBlockReason(selectedTicket, composerActionItem)
    : null;
  const actionContractBlockReason = !composerActionDetailEndpoint
    ? 'No se pudo identificar de forma segura el detalle omnicanal de este ticket.'
    : composerActionContractQuery.isPending
      ? 'Verificando las acciones habilitadas por el backend.'
      : composerActionContractQuery.isError
        ? 'No se pudo verificar el contrato backend. La acción permanece bloqueada.'
        : detailIdentityBlockReason;
  const baseReplyBlockReason = authoritativeReplyRequired
    ? getReplyActionBlockReason(
        replyAction,
        actionContractBlockReason,
        getPublishedReplyBlockReason(
          composerReplyContract,
          selectedTicket?.source_model,
          selectedTicket?.id,
          responseTemplateTenantSlug,
          selectedTicket?.tenant_id,
        ),
      )
    : null;
  const replyBlockReason = baseReplyBlockReason || (
    isTenantTicketWhatsApp && whatsappServiceWindow.recipientAvailable === false
      ? 'Sin número de WhatsApp: el backend no publicó un destinatario disponible.'
      : null
  );
  const freeFormReplyBlockReason = replyBlockReason || (
    isTenantTicketWhatsApp && whatsappServiceWindow.blocksFreeForm
      ? 'La ventana de 24 horas está cerrada. Usá una plantilla aprobada.'
      : null
  );
  const templateReplyBlockReason = !isTenantTicketWhatsApp
    ? 'Las plantillas aprobadas sólo están disponibles para TenantTicket en WhatsApp.'
    : replyBlockReason || (approvedWhatsAppTemplates.length ? null : 'No hay plantillas aprobadas disponibles para este tenant.');
  const existingAttachmentBlockReason = authoritativeAttachmentMustFailClosed
    ? actionContractBlockReason ||
      (attachmentAction
        ? getTicketShareActionBlockReason('attachment', attachmentAction, composerReplyContract, composerActionAttachments)
        : 'El backend no publicó una acción segura para vincular adjuntos existentes a este ticket.')
    : null;
  const newAttachmentUploadBlockReason = authoritativeAttachmentMustFailClosed
    ? NEW_ATTACHMENT_UPLOAD_UNAVAILABLE_REASON
    : null;
  const handoffBlockReason = actionContractBlockReason ||
    getReplyCapabilityBlockReason('handoff', composerReplyContract) || (
    handoffAction
      ? getHandoffActionBlockReason(handoffAction, composerActionTicketId)
      : 'Este ticket no publicó una transición backend para derivar la conversación a una persona.'
  );
  const locationBlockReason = actionContractBlockReason ||
    getReplyCapabilityBlockReason('location', composerReplyContract) || (
    locationAction
      ? getTicketShareActionBlockReason('location', locationAction, composerReplyContract)
      : 'Este ticket no publicó una acción backend compatible para compartir ubicación.'
  );
  const formBlockReason = actionContractBlockReason ||
    getReplyCapabilityBlockReason('form', composerReplyContract) || (
    formAction
      ? getTicketShareActionBlockReason('form', formAction, composerReplyContract)
      : 'Este ticket no publicó una acción backend compatible para compartir formularios.'
  );
  const latestAuthoritativeReplyDelivery = composerActionItem?.reply_deliveries?.at(-1);

  useEffect(() => {
    const record = latestAuthoritativeReplyDelivery;
    if (!record?.delivery) return;
    const normalized = normalizeTicketReplyDelivery({
      contract_version: record.delivery.contract_version,
      event_id: record.event_id,
      channel: record.channel || activeChannel,
      status: record.delivery.status || 'saved',
      reason: 'detail_reply_delivery',
      mode: 'real_message',
      external_dispatch: true,
      final_delivery: record.delivery,
      timeline_updated: true,
      reply_status: 'saved_to_timeline',
    });
    if (normalized) setLastReplyDelivery((current) => preserveReplyDeliveryProgress(current, normalized));
  }, [activeChannel, latestAuthoritativeReplyDelivery]);
  const composerActionMutation = useMutation<
    OmnichannelInboxActionV2,
    unknown,
    ComposerActionMutationVariables
  >({
    mutationFn: async (variables: ComposerActionMutationVariables) => {
      const actionRequest = {
          action: variables.actionKind === 'reply' ? 'reply' : variables.action.id,
          endpoint: variables.action.endpoint,
          payload: {
            ...buildSaasActionPayload(variables.action),
            ...variables.actionPayload,
            source_model: variables.expectedSourceModel,
            ...(variables.actionKind === 'handoff'
              ? {}
              : { ticket_id: variables.expectedTicketId }),
          },
        };
      const result = variables.tenantId == null
        ? await postOmnichannelInboxActionV2(
            variables.ticketId,
            actionRequest,
            variables.tenantSlug,
          )
        : await postOmnichannelInboxActionV2(
            variables.ticketId,
            actionRequest,
            variables.tenantSlug,
            variables.tenantId,
          );
      if (variables.actionKind === 'reply') {
        const identityBlockReason = getComposerReplyResponseIdentityBlockReason(result.ticket, {
          sourceModel: variables.expectedSourceModel,
          ticketId: variables.expectedTicketId,
          tenantSlug: variables.tenantSlug,
          tenantId: variables.tenantId,
        });
        if (identityBlockReason) {
          throw new ApiError(identityBlockReason, 502, { code: 'reply_response_identity_mismatch' });
        }
      }
      return result;
    },
    onSuccess: (result, variables) => {
      if (activeComposerActionScopeRef.current !== variables.scopeKey) return;
      queryClient.setQueryData<OmnichannelInboxDetailV2>(
        composerActionContractQueryKey(variables.scopeKey, variables.detailEndpoint),
        (previous) => ({
          ...(previous || {}),
          item: result.ticket,
          raw: result.raw,
        }),
      );
      setLastComposerActionResult({ scopeKey: variables.scopeKey, result });
      if (variables.actionKind === 'reply') {
        const normalizedDelivery = normalizeTicketReplyDelivery(result.delivery);
        if (normalizedDelivery) {
          setLastReplyDelivery((current) => preserveReplyDeliveryProgress(current, normalizedDelivery));
        }
      }
      setConversationInvalidationVersion((version) => version + 1);
      if (variables.actionKind !== 'handoff') setShareActionDialogKind(null);
      const replyDeliveryStage = variables.actionKind === 'reply'
        ? (() => {
            const normalized = normalizeTicketReplyDelivery(result.delivery);
            return normalized ? getReplyDeliveryStage(normalized) : 'uncertain';
          })()
        : null;
      if (variables.attemptKey && replyDeliveryStage !== 'uncertain') {
        const attemptRef = variables.actionKind === 'reply'
          ? replyActionAttemptRef
          : composerActionAttemptRef;
        if (attemptRef.current?.key === variables.attemptKey) attemptRef.current = null;
      }
    },
    onError: (error, variables) => {
      if (
        variables.attemptKey &&
        isDefinitiveComposerActionError(error)
      ) {
        const attemptRef = variables.actionKind === 'reply'
          ? replyActionAttemptRef
          : composerActionAttemptRef;
        if (attemptRef.current?.key === variables.attemptKey) attemptRef.current = null;
      }
    },
    onSettled: () => {
      composerActionInFlightRef.current = false;
    },
  });
  const executeComposerAction = useCallback((
    action: SaasAction,
    blockReason: string | null,
    actionKind: 'handoff' | TicketShareActionKind,
    inputPayload: Record<string, unknown> = {},
  ) => {
    if (
      blockReason ||
      composerActionInFlightRef.current ||
      composerActionMutation.isPending ||
      !selectedConversationKey ||
      !composerActionDetailEndpoint ||
      !composerActionTicketId
    ) return;

    const completePayload = {
      ...buildSaasActionPayload(action),
      ...inputPayload,
      ticket_id: composerActionTicketId,
    };
    const missingRequiredFields = (action.requires || []).filter(
      (field) => field !== 'Idempotency-Key' && isMissingComposerActionValue(completePayload[field]),
    );
    if (missingRequiredFields.length) {
      toast.error(`Falta completar: ${missingRequiredFields.join(', ')}.`);
      return;
    }

    let attemptKey: string | undefined;
    let actionPayload = { ...inputPayload };
    if (actionKind !== 'handoff') {
      attemptKey = createComposerActionAttemptKey(composerActionScopeKey, action, completePayload);
      let attempt = composerActionAttemptRef.current;
      if (!attempt || attempt.key !== attemptKey) {
        try {
          attempt = {
            key: attemptKey,
            clientMessageId: createOmnichannelActionClientMessageId(action.id),
          };
        } catch (error) {
          toast.error(getErrorMessage(error, 'No se pudo generar una identidad segura para la acción.'));
          return;
        }
        composerActionAttemptRef.current = attempt;
      }
      actionPayload = {
        ...actionPayload,
        client_message_id: attempt.clientMessageId,
      };
    }

    composerActionMutation.reset();
    setLastComposerActionResult(null);
    composerActionInFlightRef.current = true;
    composerActionMutation.mutate({
      action,
      actionKind,
      actionPayload,
      attemptKey,
      scopeKey: composerActionScopeKey,
      ticketId: composerActionTicketId,
      tenantSlug: responseTemplateTenantSlug,
      tenantId: selectedTicket?.tenant_id,
      expectedSourceModel: composerActionSourceModel,
      expectedTicketId: selectedTicket?.id,
      detailEndpoint: composerActionDetailEndpoint,
    });
  }, [
    composerActionDetailEndpoint,
    composerActionMutation,
    composerActionScopeKey,
    composerActionTicketId,
    responseTemplateTenantSlug,
    selectedConversationKey,
  ]);
  const activeComposerActionResult = lastComposerActionResult?.scopeKey === composerActionScopeKey
    ? lastComposerActionResult.result
    : null;
  const activeComposerActionDeliveryView = activeComposerActionResult
    ? getComposerActionDeliveryView(activeComposerActionResult.delivery)
    : null;
  const activeComposerActionError = composerActionMutation.isError &&
    composerActionMutation.variables?.scopeKey === composerActionScopeKey
    ? composerActionMutation.error
    : null;
  const composerPlaceholder = listening
    ? 'Escuchando...'
    : attachmentPreview
      ? 'Añadí contexto para el adjunto...'
      : activeChannel === 'whatsapp'
        ? 'Responder conversación de WhatsApp...'
        : activeChannel === 'email'
          ? 'Responder por email...'
          : activeChannel === 'phone'
            ? 'Registrar respuesta de llamada...'
            : 'Escribí tu respuesta...';

  useEffect(() => {
    selectedTicketRef.current = selectedTicket;
  }, [selectedTicket]);

  useEffect(() => {
    if (transcript) {
      updateActiveDraft(messageRef.current ? `${messageRef.current} ${transcript}` : transcript);
    }
  }, [transcript, updateActiveDraft]);

  useEffect(() => {
    let cancelled = false;
    let loadingFallbackTimer: number | null = null;
    const activeTicket = selectedTicketRef.current;
    const conversationKey = selectedConversationKey;
    const isBackgroundRefresh = Boolean(
      conversationKey && loadedConversationKeyRef.current === conversationKey,
    );

    const finishLoading = () => {
      if (loadingFallbackTimer) {
        window.clearTimeout(loadingFallbackTimer);
        loadingFallbackTimer = null;
      }
      if (!cancelled) {
        loadedConversationKeyRef.current = conversationKey;
        setIsLoading(false);
      }
    };

    const fetchMessages = async () => {
      if (!activeTicket) {
        if (!cancelled) {
          loadedConversationKeyRef.current = null;
          setMessages([]);
          setTimelineItems([]);
          setHistoryPage(EMPTY_CONVERSATION_HISTORY_PAGE);
          setIsLoadingOlderHistory(false);
          olderHistoryRequestRef.current = null;
          scrollAnchorRef.current = null;
          setTimelinePartial(false);
          setIsLoading(false);
        }
        return;
      }

      if (!isBackgroundRefresh) {
        loadedConversationKeyRef.current = null;
        setIsLoading(true);
        setMessages([]);
        setLastReplyDelivery(null);
        setTimelineItems([]);
        setHistoryPage(EMPTY_CONVERSATION_HISTORY_PAGE);
        setIsLoadingOlderHistory(false);
        olderHistoryRequestRef.current = null;
        scrollAnchorRef.current = null;
        setTimelinePartial(false);
        loadingFallbackTimer = window.setTimeout(() => {
          if (cancelled) return;
          setTimelinePartial(true);
          setIsLoading(false);
        }, 12000);
      }

      try {
        const timeline = await getTicketTimeline(activeTicket.id, activeTicket.tipo, {
          quiet: true,
          ticket: activeTicket,
          tenantSlug: activeTicket.tenant_slug,
          limit: 50,
        });
        if (cancelled) return;
        if (!isBackgroundRefresh) {
          const nextCursor = timeline.pagination?.next_cursor ?? timeline.next_cursor ?? null;
          setHistoryPage({
            hasMore: Boolean(timeline.pagination?.has_more ?? timeline.has_more) && Boolean(nextCursor),
            nextCursor,
          });
        }
        if (
          Array.isArray(timeline.unified_conversation_stream) &&
          (!isBackgroundRefresh || timeline.unified_conversation_stream.length > 0)
        ) {
          setTimelineItems((current) => isBackgroundRefresh
            ? mergeUnifiedConversationItems(current, timeline.unified_conversation_stream)
            : mergeUnifiedConversationItems([], timeline.unified_conversation_stream));
        }
        if (timeline.realtime_state) {
          setRecipientPresenceActive(hasPublicRecipientPresence(timeline.realtime_state));
        }
        setTimelinePartial(false);
        if (Array.isArray(timeline.messages) && timeline.messages.length > 0) {
          const incomingMessages = timeline.messages.map((msg) => adaptTicketMessageToChatMessage(msg, activeTicket));
          setMessages((current) => preserveChatMessagesWhenUnchanged(
            current,
            incomingMessages,
            isBackgroundRefresh,
          ));
          finishLoading();
          return;
        }
      } catch (timelineError) {
        if (cancelled) return;
        if (!isLegacyHtmlGatewayError(timelineError)) {
          console.warn('Timeline unificado no disponible; usando fallback de mensajes.', {
            ticketId: activeTicket.id,
            ...summarizeTicketFetchError(timelineError),
          });
        }
        if (!isBackgroundRefresh) {
          setTimelineItems([]);
          setHistoryPage(EMPTY_CONVERSATION_HISTORY_PAGE);
          setTimelinePartial(true);
        }
      }

      if (!isBackgroundRefresh && activeTicket.messages) {
        if (cancelled) return;
        const incomingMessages = activeTicket.messages.map(msg => adaptTicketMessageToChatMessage(msg, activeTicket));
        setMessages((current) => preserveChatMessagesWhenUnchanged(current, incomingMessages));
        finishLoading();
        return;
      }

      try {
        const fetchedMessages = await getTicketMessages(activeTicket.id, activeTicket.tipo, {
          quiet: true,
          ticket: activeTicket,
          tenantSlug: activeTicket.tenant_slug,
        });
        if (cancelled) return;
        if (!isBackgroundRefresh || fetchedMessages.length > 0) {
          const incomingMessages = fetchedMessages.map(msg => adaptTicketMessageToChatMessage(msg, activeTicket));
          setMessages((current) => preserveChatMessagesWhenUnchanged(
            current,
            incomingMessages,
            isBackgroundRefresh,
          ));
        }
      } catch (error) {
        if (cancelled) return;
        if (!isLegacyHtmlGatewayError(error)) {
          if (!isBackgroundRefresh) {
            toast.error('No se pudo cargar el historial de mensajes.');
          }
          console.warn('Historial de mensajes no disponible.', {
            ticketId: activeTicket.id,
            ...summarizeTicketFetchError(error),
          });
        }
        if (!isBackgroundRefresh) {
          setTimelinePartial(true);
          setMessages([]);
        }
      } finally {
        finishLoading();
      }
    };
    fetchMessages();
    return () => {
      cancelled = true;
      if (loadingFallbackTimer) {
        window.clearTimeout(loadingFallbackTimer);
      }
    };
  }, [conversationInvalidationVersion, selectedConversationKey]);

  const loadOlderHistory = useCallback(async () => {
    const activeTicket = selectedTicketRef.current;
    const conversationKey = selectedConversationKey;
    const cursor = historyPage.nextCursor;
    if (!activeTicket || !conversationKey || !historyPage.hasMore || !cursor || isLoadingOlderHistory) return;

    const requestKey = `${conversationKey}:${cursor}`;
    if (olderHistoryRequestRef.current === requestKey) return;
    olderHistoryRequestRef.current = requestKey;
    const scrollNode = scrollAreaRef.current;
    scrollAnchorRef.current = scrollNode
      ? { scrollHeight: scrollNode.scrollHeight, scrollTop: scrollNode.scrollTop }
      : null;
    setIsLoadingOlderHistory(true);

    try {
      const olderTimeline = await getTicketTimeline(activeTicket.id, activeTicket.tipo, {
        quiet: true,
        ticket: activeTicket,
        tenantSlug: activeTicket.tenant_slug,
        cursor,
        limit: 50,
      });
      if (loadedConversationKeyRef.current !== conversationKey) return;

      const incomingTimeline = Array.isArray(olderTimeline.unified_conversation_stream)
        ? olderTimeline.unified_conversation_stream
        : [];
      const incomingMessages = Array.isArray(olderTimeline.messages)
        ? olderTimeline.messages.map((item) => adaptTicketMessageToChatMessage(item, activeTicket))
        : [];
      if (incomingTimeline.length > 0) {
        setTimelineItems((current) => mergeUnifiedConversationItems(current, incomingTimeline));
      }
      if (incomingMessages.length > 0) {
        setMessages((current) => preserveChatMessagesWhenUnchanged(current, incomingMessages, true));
      }
      if (incomingTimeline.length === 0 && incomingMessages.length === 0) {
        scrollAnchorRef.current = null;
      }

      const nextCursor = olderTimeline.pagination?.next_cursor ?? olderTimeline.next_cursor ?? null;
      setHistoryPage({
        hasMore: Boolean(olderTimeline.pagination?.has_more ?? olderTimeline.has_more) && Boolean(nextCursor),
        nextCursor,
      });
    } catch (error) {
      scrollAnchorRef.current = null;
      toast.error('No se pudieron cargar los mensajes anteriores.');
      console.warn('No se pudo paginar el historial de la conversación.', {
        ticketId: activeTicket.id,
        ...summarizeTicketFetchError(error),
      });
    } finally {
      if (olderHistoryRequestRef.current === requestKey) {
        olderHistoryRequestRef.current = null;
      }
      if (loadedConversationKeyRef.current === conversationKey) {
        setIsLoadingOlderHistory(false);
      }
    }
  }, [historyPage.hasMore, historyPage.nextCursor, isLoadingOlderHistory, selectedConversationKey]);

  const { socket } = useSocket();
  const realtimeOnline = Boolean(socket?.connected);
  const selectedTicketId = selectedTicket?.id ?? null;
  const selectedTicketType = selectedTicket?.tipo ?? null;
  const selectedTicketSocketRoom =
    typeof selectedTicket?.socket_room === 'string' ? selectedTicket.socket_room.trim() : '';
  const pollingFailureCountRef = useRef(0);
  const pollingPausedUntilRef = useRef(0);
  const lastReadStateSyncRef = useRef<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const composerSelectionRef = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  useEffect(() => {
    conversationScopeEpochRef.current += 1;
    const previousScope = previousConversationScopeRef.current;
    if (previousScope && previousScope !== activeConversationScopeKey) {
      revokeAttachmentUrlsForScope(previousScope);
    }

    previousConversationScopeRef.current = activeConversationScopeKey;
    draftStorageKeyRef.current = conversationDraftStorageKey;
    attachmentPreviewRef.current = null;
    setAttachmentPreview(null);

    const storedDraft = readConversationDraft(conversationDraftStorageKey);
    const pendingDraft = activeConversationScopeKey
      ? pendingDraftsByScopeRef.current.get(activeConversationScopeKey)
      : null;
    const nextDraft = pendingDraft === storedDraft ? '' : storedDraft;
    messageRef.current = nextDraft;
    setMessage(nextDraft);
    setIsSending(false);
    setIsUpdatingStatus(false);
  }, [activeConversationScopeKey, conversationDraftStorageKey, revokeAttachmentUrlsForScope]);

  useEffect(() => () => {
    attachmentUrlsByScopeRef.current.forEach((urls) => {
      urls.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    });
    attachmentUrlsByScopeRef.current.clear();
  }, []);

  useEffect(() => {
    if (!selectedTicket) return;

    const handleAiDraft = (event: Event) => {
      if (!isTicketAiDraftEvent(event)) return;
      if (String(event.detail.ticketId) !== String(selectedTicket.id)) return;

      if (messageRef.current.trim()) {
        toast.info('El composer ya tiene texto. No sobreescribi el borrador actual.');
        return;
      }

      const draft = event.detail.draft.trim();
      updateActiveDraft(draft);
      window.requestAnimationFrame(() => composerRef.current?.focus());
      toast.success('Borrador IA cargado en la conversacion.');
    };

    window.addEventListener(TICKET_AI_DRAFT_EVENT_NAME, handleAiDraft);
    return () => window.removeEventListener(TICKET_AI_DRAFT_EVENT_NAME, handleAiDraft);
  }, [activeConversationScopeKey, selectedTicket, updateActiveDraft]);

  useEffect(() => {
    pollingFailureCountRef.current = 0;
    pollingPausedUntilRef.current = 0;
    lastReadStateSyncRef.current = null;
    composerSelectionRef.current = null;
    composerActionAttemptRef.current = null;
    replyActionAttemptRef.current = null;
    setTemplatePickerOpen(false);
    setSelectedApprovedTemplateId('');
    setApprovedTemplateVariables({});
    setComposerToolsOpen(false);
    setShareActionDialogKind(null);
    setLastComposerActionResult(null);
    setRecipientPresenceActive(hasPublicRecipientPresence(selectedTicket?.realtime_state));
    composerActionMutation.reset();
  }, [composerActionScopeKey]);

  useEffect(() => {
    if (
      selectedTicketId === null ||
      !selectedTicketType ||
      !selectedConversationKey ||
      loadedConversationKeyRef.current !== selectedConversationKey ||
      latestReadableMessageId === undefined
    ) return;

    const syncKey = `${selectedConversationKey}:${latestReadableMessageId}`;
    if (lastReadStateSyncRef.current === syncKey) return;

    // Opening a conversation may produce one read acknowledgement. Afterwards
    // only a new unread message (and therefore a new durable message id) can
    // advance it. Object refreshes and identical polls are deliberately inert.
    if (lastReadStateSyncRef.current !== null && !selectedTicketHasUnread) return;
    lastReadStateSyncRef.current = syncKey;

    updateTicketReadState(selectedTicketId, selectedTicketType, latestReadableMessageId)
      .then((state) => {
        const activeTicket = selectedTicketRef.current;
        if (!activeTicket || selectedConversationKey !== `${
          activeTicket.tenant_slug?.trim().toLowerCase() ||
          (activeTicket.tenant_id != null ? `tenant-id-${activeTicket.tenant_id}` : 'tenant-unknown')
        }:${activeTicket.source_model || activeTicket.tipo}:${activeTicket.id}`) return;
        if (state) {
          setRecipientPresenceActive(hasPublicRecipientPresence(state));
        }
        updateTicket(selectedTicketId, {
          hasUnreadMessages: false,
          realtime_state: state || activeTicket.realtime_state,
          collaboration_state: {
            ...(activeTicket.collaboration_state || {}),
            has_unread: false,
            unread_count: 0,
            unread_viewer_count: 0,
          },
        } as Partial<Ticket>);
      })
      .catch((error) => {
        if (lastReadStateSyncRef.current === syncKey) {
          lastReadStateSyncRef.current = null;
        }
        if (!isLegacyHtmlGatewayError(error)) {
          console.warn('No se pudo sincronizar lectura del ticket.', {
            ticketId: selectedTicketId,
            ...summarizeTicketFetchError(error),
          });
        }
      });
  }, [
    latestReadableMessageId,
    selectedConversationKey,
    selectedTicketHasUnread,
    selectedTicketId,
    selectedTicketType,
    updateTicket,
  ]);

  useEffect(() => {
    if (!socket || selectedTicketId === null || !selectedTicketType) return;

    const ticketRoom =
      selectedTicketSocketRoom
        ? selectedTicketSocketRoom
        : `ticket-${selectedTicketType}-${selectedTicketId}`;

    // Join the ticket-specific room if the backend requires it
    // Based on user feedback: "Socket join por tenant/ticket"
    // We emit an event to join the room. The event name is hypothetical or generic 'join'.
    // If the backend handles 'subscribe_ticket_updates' globally for the tenant, this might be redundant but safe.
    socket.emit('join', { room: ticketRoom });

    const unwrapSocketPayload = (data: any) =>
      data?.payload && typeof data.payload === 'object' ? data.payload : data;
    const eventMatchesSelectedTicket = (payload: any) => {
      const incomingTicketId =
        payload?.ticket_id ??
        payload?.ticketId ??
        payload?.ticket?.id ??
        payload?.comment?.ticket_id ??
        payload?.message?.ticket_id;
      return Number(incomingTicketId) === Number(selectedTicketId);
    };

    const handleNewComment = (data: any) => {
       const payload = unwrapSocketPayload(data);
       const incomingTicketId =
         payload?.ticket_id ??
         payload?.ticketId ??
         payload?.ticket?.id ??
         payload?.comment?.ticket_id ??
         payload?.message?.ticket_id;
       if (Number(incomingTicketId) === Number(selectedTicketId)) {

           const ticketMessage = normalizeTicketMessageFromPayload(payload);
           if (!ticketMessage) return;

           const activeTicket = selectedTicketRef.current;
           if (!activeTicket || Number(activeTicket.id) !== Number(selectedTicketId)) return;

           setMessages(prevMessages => {
               // Evitar duplicados si el mensaje ya existe (por optimismo o retransmisión)
               if (prevMessages.some(m => m.id === ticketMessage.id)) {
                   return prevMessages;
               }
               // Si hay un mensaje optimista pendiente (id temporal grande), podríamos reemplazarlo aquí
               // pero simple deduplicación es un buen comienzo.
               return dedupeChatMessages([...prevMessages, adaptTicketMessageToChatMessage(ticketMessage, activeTicket)]);
           });
       }
    };

    const handlePresenceChanged = (data: any) => {
      const payload = unwrapSocketPayload(data);
      if (!eventMatchesSelectedTicket(payload)) return;

      const activeViewers = Array.isArray(payload?.summary?.active_viewers)
        ? payload.summary.active_viewers
        : [];
      setRecipientPresenceActive(
        hasPublicRecipientPresence({
          viewers: [],
          active_viewers: activeViewers,
          read_states: [],
        }),
      );
    };

    const handleMessageRead = (data: any) => {
      const payload = unwrapSocketPayload(data);
      if (!eventMatchesSelectedTicket(payload) || !isPublicTicketRecipientViewer(payload?.viewer)) return;

      const lastReadCommentId = Number(
        payload?.last_read_comment_id ?? payload?.viewer?.last_read_comment_id ?? 0,
      );
      if (!Number.isInteger(lastReadCommentId) || lastReadCommentId <= 0) return;

      setRecipientPresenceActive(true);
      setLastReplyDelivery((current) =>
        applyPublicRecipientReadConfirmation(current, payload.viewer, lastReadCommentId),
      );
    };

    const handleTenantTicketInvalidation = (data: unknown) => {
      if (!isTenantTicketCollectionInvalidation(data)) return;
      if (invalidationRefreshTimerRef.current !== null) {
        window.clearTimeout(invalidationRefreshTimerRef.current);
      }
      invalidationRefreshTimerRef.current = window.setTimeout(() => {
        invalidationRefreshTimerRef.current = null;
        setConversationInvalidationVersion((version) => version + 1);
      }, TENANT_TICKET_INVALIDATION_DEBOUNCE_MS);
    };

    const handleReplyDeliveryInvalidation = (data: unknown) => {
      if (!isReplyDeliveryInvalidation(data)) return;
      void queryClient.invalidateQueries({ queryKey: composerActionQueryKey });
    };

    safeOn(socket, 'new_comment', handleNewComment);
    safeOn(socket, 'new_chat_message', handleNewComment);
    safeOn(socket, 'conversation.message.created', handleNewComment);
    safeOn(socket, 'legacy.new_chat_message', handleNewComment);
    safeOn(socket, 'ticket_update', handleTenantTicketInvalidation);
    safeOn(socket, 'ticket.reply.delivery.updated', handleReplyDeliveryInvalidation);
    safeOn(socket, 'ticket.presence.changed', handlePresenceChanged);
    safeOn(socket, 'conversation.message.read', handleMessageRead);

    return () => {
        socket.off('new_comment', handleNewComment);
        socket.off('new_chat_message', handleNewComment);
        socket.off('conversation.message.created', handleNewComment);
        socket.off('legacy.new_chat_message', handleNewComment);
        socket.off('ticket_update', handleTenantTicketInvalidation);
        socket.off('ticket.reply.delivery.updated', handleReplyDeliveryInvalidation);
        socket.off('ticket.presence.changed', handlePresenceChanged);
        socket.off('conversation.message.read', handleMessageRead);
        if (invalidationRefreshTimerRef.current !== null) {
          window.clearTimeout(invalidationRefreshTimerRef.current);
          invalidationRefreshTimerRef.current = null;
        }
        socket.emit('leave', { room: ticketRoom });
    };
  }, [composerActionQueryKey, queryClient, selectedConversationKey, selectedTicketId, selectedTicketSocketRoom, selectedTicketType, socket]);

  useEffect(() => {
    if (!selectedConversationKey || selectedTicketId === null || !selectedTicketType) return;
    if (socket?.connected) return;

    const interval = window.setInterval(async () => {
      if (Date.now() < pollingPausedUntilRef.current) return;

      const activeTicket = selectedTicketRef.current;
      if (!activeTicket || Number(activeTicket.id) !== Number(selectedTicketId)) return;

      try {
        const polledMessages = await getTicketMessages(selectedTicketId, selectedTicketType, {
          quiet: true,
          ticket: activeTicket,
          tenantSlug: activeTicket.tenant_slug,
        });
        pollingFailureCountRef.current = 0;
        pollingPausedUntilRef.current = 0;
        setMessages((prev) => {
          const incoming = polledMessages.map((item) => adaptTicketMessageToChatMessage(item, activeTicket));
          return preserveChatMessagesWhenUnchanged(prev, incoming, true);
        });
      } catch (pollError) {
        pollingFailureCountRef.current += 1;
        const backoffMs = Math.min(120000, 15000 * Math.max(1, pollingFailureCountRef.current));
        pollingPausedUntilRef.current = Date.now() + backoffMs;

        if (
          !isLegacyHtmlGatewayError(pollError) &&
          (pollingFailureCountRef.current === 1 || pollingFailureCountRef.current % 4 === 0)
        ) {
          console.warn('Fallback polling de conversacion pausado temporalmente', {
            ticketId: selectedTicketId,
            pausedMs: backoffMs,
            ...summarizeTicketFetchError(pollError),
          });
        }
      }
    }, 15000);

    return () => window.clearInterval(interval);
  }, [selectedConversationKey, selectedTicketId, selectedTicketType, socket?.connected]);

  const scrollToBottom = useCallback(() => {
    const node = scrollAreaRef.current;
    if (node) {
      if (typeof node.scrollTo === 'function') {
        node.scrollTo({
          top: node.scrollHeight,
          behavior: getConversationScrollBehavior(shouldReduceMotion),
        });
      } else {
        node.scrollTop = node.scrollHeight;
      }
    }
  }, [shouldReduceMotion]);

  useLayoutEffect(() => {
    const node = scrollAreaRef.current;
    const anchor = scrollAnchorRef.current;
    if (node && anchor) {
      node.scrollTop = Math.max(0, anchor.scrollTop + (node.scrollHeight - anchor.scrollHeight));
      scrollAnchorRef.current = null;
      return;
    }
    scrollToBottom();
  }, [messages, scrollToBottom, timelineItems.length]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 10;
    setShowScrollToBottom(!isAtBottom);
  };

  const handleFileSelected = (file: File) => {
    if (newAttachmentUploadBlockReason) {
      toast.error(newAttachmentUploadBlockReason);
      return;
    }
    const previousPreview = attachmentPreviewRef.current;
    if (previousPreview?.previewUrl) {
      revokeAttachmentUrlForScope(activeConversationScopeKey, previousPreview.previewUrl);
    }
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
    const nextPreview = { file, previewUrl };
    attachmentPreviewRef.current = nextPreview;
    setAttachmentPreview(nextPreview);
    if (previewUrl && activeConversationScopeKey) {
      const urls = attachmentUrlsByScopeRef.current.get(activeConversationScopeKey) ?? new Set<string>();
      urls.add(previewUrl);
      attachmentUrlsByScopeRef.current.set(activeConversationScopeKey, urls);
    }
  };

  const handleDiscardAttachment = () => {
    const current = attachmentPreviewRef.current;
    if (current?.previewUrl) {
      revokeAttachmentUrlForScope(activeConversationScopeKey, current.previewUrl);
    }
    attachmentPreviewRef.current = null;
    setAttachmentPreview(null);
  };

  const handleSendMessage = async (payload?: Partial<SendPayload> & {
    approvedTemplate?: ApprovedWhatsAppTemplate;
    templateVariables?: Record<string, string>;
  }) => {
    const approvedTemplate = payload?.approvedTemplate;
    const templateVariables = payload?.templateVariables || {};
    const text = approvedTemplate
      ? renderApprovedWhatsAppTemplate(approvedTemplate, templateVariables)
      : payload?.text ?? messageRef.current;
    if (!text.trim() && !payload?.attachmentInfo && !attachmentPreview) return;
    if (!selectedTicket || !user) return;
    const sendScopeKey = activeConversationScopeKey;
    const sendDraftStorageKey = conversationDraftStorageKey;
    if (!sendScopeKey || !sendDraftStorageKey) return;
    const sendScopeEpoch = conversationScopeEpochRef.current;
    const ticketSnapshot = selectedTicket;
    const usesComposerDraft = payload?.text == null && !approvedTemplate;
    const isSendScopeCurrent = () => (
      activeConversationScopeRef.current === sendScopeKey &&
      conversationScopeEpochRef.current === sendScopeEpoch
    );

    const hasAttachment = Boolean(payload?.attachmentInfo || attachmentPreview);
    if (authoritativeAttachmentMustFailClosed && hasAttachment) {
      toast.error(newAttachmentUploadBlockReason || 'El adjunto permanece bloqueado hasta que el backend publique soporte seguro.');
      return;
    }
    if (approvedTemplate) {
      if (templateReplyBlockReason) {
        toast.error(templateReplyBlockReason);
        return;
      }
      const missingVariables = approvedTemplate.variableKeys.filter((key) => !templateVariables[key]?.trim());
      if (missingVariables.length) {
        toast.error(`Completá ${missingVariables.map((key) => `la variable ${key}`).join(', ')}.`);
        return;
      }
    } else if (freeFormReplyBlockReason) {
      toast.error(freeFormReplyBlockReason);
      return;
    }

    let replyAttemptKey: string | undefined;
    let replyActionPayload: Record<string, unknown> | undefined;
    if (authoritativeReplyRequired) {
      if (replyBlockReason || !replyAction || !composerActionDetailEndpoint || !composerActionTicketId) {
        toast.error(replyBlockReason || 'El backend no habilitó una respuesta segura para este ticket.');
        return;
      }
      const normalizedText = text.trim();
      if (!normalizedText) return;
      const safeDefaults = { ...buildSaasActionPayload(replyAction) };
      delete safeDefaults.client_message_id;
      delete safeDefaults.idempotency_key;
      const completeReplyPayload = {
        ...safeDefaults,
        body: normalizedText,
        message: normalizedText,
        visibility: 'public',
        ...(approvedTemplate ? {
          template_registry_id: approvedTemplate.registryId,
          template_variables: templateVariables,
        } : {}),
        ticket_id: composerActionTicketId,
      };
      replyAttemptKey = createComposerActionAttemptKey(
        composerActionScopeKey,
        replyAction,
        completeReplyPayload,
      );
      let attempt = replyActionAttemptRef.current;
      if (!attempt || attempt.key !== replyAttemptKey) {
        try {
          attempt = {
            key: replyAttemptKey,
            clientMessageId: createOmnichannelActionClientMessageId('reply'),
          };
        } catch (error) {
          toast.error(getErrorMessage(error, 'No se pudo generar una identidad segura para la respuesta.'));
          return;
        }
        replyActionAttemptRef.current = attempt;
      }
      replyActionPayload = {
        body: normalizedText,
        message: normalizedText,
        visibility: 'public',
        ...(approvedTemplate ? {
          template_registry_id: approvedTemplate.registryId,
          template_variables: templateVariables,
        } : {}),
        client_message_id: attempt.clientMessageId,
      };
    }

    setIsSending(true);
    setLastReplyDelivery(null);

    const draftMessage = messageRef.current;
    const draftAttachmentPreview = attachmentPreview;
    let attachmentData: AttachmentInfo | undefined = payload?.attachmentInfo;

    if (draftAttachmentPreview) {
      // Create local preview attachment data for optimistic update
      // We don't have the real URL yet, but we have the blob URL from the preview
      attachmentData = {
        name: draftAttachmentPreview.file.name,
        url: draftAttachmentPreview.previewUrl, // Use blob URL for immediate display
        mimeType: draftAttachmentPreview.file.type,
        size: draftAttachmentPreview.file.size,
        isUploading: true, // Optional: UI could show a spinner on the image
      };
    }

    // Optimistic update
    const optimisticMessage: ChatMessageData = {
        id: Date.now(), // Temporary ID
        text: text,
        isBot: true, // Messages from agents are treated as "bot" messages in this context
        timestamp: new Date(),
        attachmentInfo: attachmentData,
    };
    setMessages(prev => [...prev, optimisticMessage]);
    if (usesComposerDraft) {
      pendingDraftsByScopeRef.current.set(sendScopeKey, draftMessage);
      messageRef.current = '';
      setMessage('');
    }
    attachmentPreviewRef.current = null;
    setAttachmentPreview(null); // Clear input immediately without persisting a File/blob URL.

    try {
      const response = authoritativeReplyRequired && replyAction && replyActionPayload
        ? await (() => {
          composerActionMutation.reset();
          setLastComposerActionResult(null);
          composerActionInFlightRef.current = true;
          return composerActionMutation.mutateAsync({
            action: replyAction,
            actionKind: 'reply',
            actionPayload: replyActionPayload,
            attemptKey: replyAttemptKey,
            scopeKey: composerActionScopeKey,
            ticketId: composerActionTicketId,
            tenantSlug: responseTemplateTenantSlug,
            tenantId: ticketSnapshot.tenant_id,
            expectedSourceModel: composerActionSourceModel,
            expectedTicketId: ticketSnapshot.id,
            detailEndpoint: composerActionDetailEndpoint,
          });
        })()
        : await sendMessage(
          ticketSnapshot.id,
          ticketSnapshot.tipo,
          text,
          draftAttachmentPreview ? [draftAttachmentPreview.file] : undefined,
          payload?.action
            ? [{ type: 'reply', reply: { id: payload.action, title: payload.action } }]
            : undefined,
          {
            ticket: ticketSnapshot,
            tenantSlug: ticketSnapshot.tenant_slug,
          },
        );
      const authoritativeDelivery = authoritativeReplyRequired
        ? normalizeTicketReplyDelivery((response as OmnichannelInboxActionV2)?.delivery)
        : null;
      if (authoritativeReplyRequired && (!authoritativeDelivery || getReplyDeliveryStage(authoritativeDelivery) === 'uncertain')) {
        pendingDraftsByScopeRef.current.delete(sendScopeKey);
        if (usesComposerDraft) persistConversationDraft(sendDraftStorageKey, draftMessage);
        if (isSendScopeCurrent()) {
          if (!authoritativeDelivery) {
            setLastReplyDelivery(normalizeTicketReplyDelivery({
              contract_version: 'tenant_ticket.reply_delivery.v1',
              mode: 'real_message',
              channel: activeChannel,
              status: 'send_uncertain',
              reason: 'http_2xx_without_delivery_evidence',
              external_dispatch: false,
              timeline_updated: false,
              reply_status: 'unknown',
              operator_message: 'El backend respondió sin evidencia de entrega. Se conserva la misma identidad para reconciliar o reintentar.',
            }));
          }
          setMessages((previous) => previous.filter((item) => item.id !== optimisticMessage.id));
          if (usesComposerDraft) {
            messageRef.current = draftMessage;
            setMessage(draftMessage);
          }
          toast.warning('El backend respondió, pero el resultado sigue incierto. Revisá y reintentá con la misma identidad.');
        }
        return;
      }
      if (usesComposerDraft) {
        pendingDraftsByScopeRef.current.delete(sendScopeKey);
        removeConversationDraft(sendDraftStorageKey, draftMessage);
      }
      if (draftAttachmentPreview?.previewUrl) {
        revokeAttachmentUrlForScope(sendScopeKey, draftAttachmentPreview.previewUrl);
      }
      if (!isSendScopeCurrent()) return;
      if (!authoritativeReplyRequired) {
        const replyDelivery = normalizeTicketReplyDelivery((response as any)?.delivery);
        setLastReplyDelivery(replyDelivery);
        if (replyDelivery) {
          setRecipientPresenceActive(replyDelivery.recipient_presence_confirmed);
        }
      }
      const responseMessages = extractResponseTicketMessages(response)
        .map((msg) => adaptTicketMessageToChatMessage(msg, ticketSnapshot));
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((item) => item.id !== optimisticMessage.id);
        if (responseMessages.length > 0) {
          return dedupeChatMessages([...withoutOptimistic, ...responseMessages]);
        }
        return dedupeChatMessages([
          ...withoutOptimistic,
          {
            ...optimisticMessage,
            id: `sent-${ticketSnapshot.tipo}-${ticketSnapshot.id}-${Date.now()}`,
            attachmentInfo: optimisticMessage.attachmentInfo
              ? { ...optimisticMessage.attachmentInfo, isUploading: false }
              : undefined,
          },
        ]);
      });
    } catch (error) {
      pendingDraftsByScopeRef.current.delete(sendScopeKey);
      if (usesComposerDraft && !readConversationDraft(sendDraftStorageKey)) {
        persistConversationDraft(sendDraftStorageKey, draftMessage);
      }
      if (!isSendScopeCurrent()) return;
      if (authoritativeReplyRequired && !isDefinitiveComposerActionError(error)) {
        setLastReplyDelivery(normalizeTicketReplyDelivery({
          contract_version: 'tenant_ticket.reply_delivery.v1',
          mode: 'real_message',
          channel: activeChannel,
          status: 'send_uncertain',
          reason: 'request_result_unknown',
          external_dispatch: false,
          timeline_updated: false,
          reply_status: 'unknown',
          operator_message: 'No se pudo confirmar el resultado. Revisá el estado antes de reintentar; se conservará la misma identidad idempotente.',
        }));
        toast.warning('No se pudo confirmar el resultado. Podés reintentar de forma segura con la misma identidad.');
      } else {
        toast.error(getErrorMessage(error, 'No se pudo enviar el mensaje.'));
      }
      if (approvedTemplate) {
        setSelectedApprovedTemplateId('');
        setApprovedTemplateVariables({});
      }
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id)); // Rollback on error
      if (usesComposerDraft && !messageRef.current) {
        const restoredDraft = readConversationDraft(sendDraftStorageKey);
        messageRef.current = restoredDraft;
        setMessage(restoredDraft);
      }
      if (!payload?.attachmentInfo && draftAttachmentPreview) {
        attachmentPreviewRef.current = draftAttachmentPreview;
        setAttachmentPreview(draftAttachmentPreview);
      }
    } finally {
      if (isSendScopeCurrent()) setIsSending(false);
    }
  };

  const handleButtonClick = (payload: SendPayload) => {
    handleSendMessage(payload);
  };

  useEffect(() => {
    if (isDetailsVisible && desktopView === 'details' && setDesktopView) {
      setDesktopView('chat');
    }
  }, [desktopView, isDetailsVisible, setDesktopView]);

  if (!selectedTicket) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-muted/20 p-4 text-center">
        <img src={CHATBOC_ORBIT_AVATAR} alt="Chatboc Logo" className="w-24 h-24 mb-4" />
        <h2 className="text-2xl font-bold text-foreground">Bienvenido al Panel de Tickets</h2>
        <p className="text-lg text-muted-foreground">Seleccioná un ticket de la lista para comenzar a trabajar.</p>
      </div>
    );
  }

  const captureComposerSelection = () => {
    const composer = composerRef.current;
    const draftLength = messageRef.current.length;
    composerSelectionRef.current = composer
      ? {
          start: composer.selectionStart ?? draftLength,
          end: composer.selectionEnd ?? draftLength,
        }
      : { start: draftLength, end: draftLength };
  };

  const handleTemplatePickerOpenChange = (nextOpen: boolean) => {
    setTemplatePickerOpen(nextOpen);
    if (!nextOpen) {
      window.requestAnimationFrame(() => composerRef.current?.focus());
    }
  };

  const handleSelectResponseTemplate = (renderedText: string) => {
    const currentDraft = messageRef.current;
    const selection = composerSelectionRef.current || {
      start: currentDraft.length,
      end: currentDraft.length,
    };
    const start = Math.max(0, Math.min(selection.start, currentDraft.length));
    const end = Math.max(start, Math.min(selection.end, currentDraft.length));
    const before = currentDraft.slice(0, start);
    const after = currentDraft.slice(end);
    const leadingSeparator = before && !/\s$/.test(before) ? '\n' : '';
    const trailingSeparator = after && !/^\s/.test(after) ? '\n' : '';
    const insertedText = `${leadingSeparator}${renderedText}${trailingSeparator}`;
    const nextDraft = `${before}${insertedText}${after}`;
    const nextCaret = before.length + insertedText.length;

    updateActiveDraft(nextDraft);
    composerSelectionRef.current = { start: nextCaret, end: nextCaret };
    window.requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (
      event.key === '/' &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      const start = event.currentTarget.selectionStart ?? 0;
      const end = event.currentTarget.selectionEnd ?? start;
      const before = event.currentTarget.value.slice(0, start);
      const after = event.currentTarget.value.slice(end);
      if (!before.trim() && !after.trim()) {
        event.preventDefault();
        composerSelectionRef.current = { start, end };
        setTemplatePickerOpen(true);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!selectedTicket || isUpdatingStatus) return;
    const ticketSnapshot = selectedTicket;
    const statusScopeKey = activeConversationScopeKey;
    const statusScopeEpoch = conversationScopeEpochRef.current;
    const isStatusScopeCurrent = () => (
      activeConversationScopeRef.current === statusScopeKey &&
      conversationScopeEpochRef.current === statusScopeEpoch
    );
    setIsUpdatingStatus(true);
    try {
      const updatedTicket = await updateTicketStatus(
        ticketSnapshot.id,
        ticketSnapshot.tipo,
        newStatus,
        {
          ticket: ticketSnapshot,
          expectedStatus: ticketSnapshot.estado,
        },
      );
      if (!isStatusScopeCurrent()) return;
      const confirmedStatus = (updatedTicket.estado || newStatus) as TicketStatus;
      updateTicket(ticketSnapshot.id, {
        estado: confirmedStatus,
        next_states: updatedTicket.next_states,
        workflow: updatedTicket.workflow,
      });
      toast.success(`Estado actualizado a ${formatTicketStatusLabel(confirmedStatus)}`);
    } catch (error) {
      if (!isStatusScopeCurrent()) return;
      console.error('Error updating ticket status:', error);
      const status = error instanceof ApiError ? error.status : (error as { status?: number })?.status;
      if (status === 409) {
        try {
          await refreshTickets();
        } catch (refreshError) {
          console.error('Error refreshing ticket after status conflict:', refreshError);
        }
        toast.error('El caso cambió. Actualizamos sus datos para que elijas una transición vigente.');
      } else if (status === 422) {
        toast.error('Ese estado no pertenece al flujo publicado para este caso.');
      } else {
        toast.error('No se pudo actualizar el estado.');
      }
    } finally {
      if (isStatusScopeCurrent()) setIsUpdatingStatus(false);
    }
  };
  const conversationTitle = presentationCategory?.label || 'Categoría no informada';
  const conversationSubtitle = operationalWorkspace
    ? selectedTicket.display_name || selectedTicket.name || 'Conversación ciudadana'
    : [
        selectedTicket.nro_ticket || `#${selectedTicket.id}`,
        selectedTicket.name,
      ].filter(Boolean).join(' - ');
  const conversationAvatar = resolveConsentedAvatar(
    selectedTicket as unknown as Record<string, unknown>,
    selectedTicket.user as unknown as Record<string, unknown> | null | undefined,
  );
  const conversationAvatarUrl = conversationAvatar.avatarUrl;
  const conversationAvatarSource =
    conversationAvatar.source || selectedTicket.avatar_source || (conversationAvatarUrl ? 'imagen consentida' : 'iniciales');
  const replyDeliveryView = lastReplyDelivery ? getReplyDeliveryView(lastReplyDelivery) : null;
  const composerChannelView = getComposerChannelView({
    channel: activeChannel,
    recipientPresenceConfirmed: recipientPresenceActive,
    lastReplyDelivery,
    replyContract: composerReplyContract,
  });

  return (
    <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
        className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
        data-testid="ticket-conversation-panel"
    >
      <header className="shrink-0 border-b border-border px-3 py-2">
        <div className="flex min-h-12 flex-col gap-2 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {canToggleSidebar && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={onToggleSidebar}
                aria-label={isSidebarVisible ? 'Ocultar lista de tickets' : 'Mostrar lista de tickets'}
              >
                {isSidebarVisible ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
              </Button>
            )}
            <IdentityAvatar
              name={selectedTicket.display_name || selectedTicket.name || conversationTitle}
              avatarUrl={conversationAvatarUrl}
              source={conversationAvatarSource}
              consented={conversationAvatar.consented}
              size="md"
            />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground sm:text-base" title={conversationTitle}>
                {conversationTitle}
              </h2>
              <p className="mt-0.5 truncate text-xs text-muted-foreground" title={conversationSubtitle}>
                {conversationSubtitle}
              </p>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="capitalize text-xs">
                  {formatTicketStatusLabel(selectedTicket.estado)}
                </Badge>
                <Badge
                  variant={presentationCategory?.state === 'conflict' ? 'destructive' : 'secondary'}
                  className="max-w-[14rem] truncate text-xs"
                  title={presentationCategory?.detail}
                  aria-label={`${presentationCategory?.label || 'Categoría no informada'}. ${presentationCategory?.detail || 'Sin evidencia de categoría.'}`}
                  data-category-state={presentationCategory?.state}
                >
                  {presentationCategory?.label || 'Categoría no informada'}
                </Badge>
                <TicketSlaClocks sla={composerSlaSource} compact className="h-6" />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 min-[760px]:justify-end">
            {shouldShowTicketClaimAction(isDetailsVisible) ? (
              <TicketClaimButton onClaimConfirmed={async () => {
                await composerActionContractQuery.refetch();
              }} />
            ) : null}
            {!operationalWorkspace ? (
              <>
                <Badge variant={realtimeOnline ? 'secondary' : 'outline'} className="hidden lg:inline-flex">
                  {realtimeOnline ? 'Socket conectado' : 'Actualización por sondeo'}
                </Badge>
                <Badge variant="outline" className="hidden lg:inline-flex capitalize">
                  {activeChannel}
                </Badge>
                <Button asChild variant="ghost" size="sm" className="hidden xl:inline-flex">
                  <Link to={responseTemplateManagementHref}>Respuestas rápidas</Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="hidden xl:inline-flex">
                  <Link to="/notificaciones">Notificaciones</Link>
                </Button>
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Más acciones del caso">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to={responseTemplateManagementHref}>Respuestas rápidas</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/notificaciones">Notificaciones</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {showDetailsToggle && (
              <Button
                variant={isDetailsVisible ? 'secondary' : 'outline'}
                size="sm"
                onClick={onToggleDetails}
                aria-label={isDetailsVisible ? 'Ocultar detalles del ticket' : 'Ver detalles del ticket'}
                aria-pressed={isDetailsVisible}
                className="h-9 gap-2 px-2.5"
              >
                <Info className="h-4 w-4" />
                <span className="hidden text-sm font-medium sm:inline">Detalles</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 max-w-[10rem] justify-between capitalize"
                  aria-label={statusOptions.length > 0 ? 'Cambiar estado' : 'Sin transiciones de estado disponibles'}
                  disabled={isUpdatingStatus || statusOptions.length === 0}
                >
                  <span className="truncate">{formatTicketStatusLabel(selectedTicket.estado)}</span>
                  {isUpdatingStatus
                    ? <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    : <ChevronDown className="ml-2 h-4 w-4" aria-hidden="true" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {statusOptions.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    className="capitalize"
                    onClick={() => handleStatusChange(status as TicketStatus)}
                  >
                    {formatTicketStatusLabel(status)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {!operationalWorkspace ? (
        <CaseStrip
          ticket={selectedTicket}
          presentationCategory={presentationCategory}
          isDetailsVisible={isDetailsVisible}
          onOpenDetails={showDetailsToggle ? onToggleDetails : undefined}
        />
      ) : null}

      {!isMobile && !isDetailsVisible && setDesktopView && (
        <div className="p-2 border-b border-border">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={desktopView === 'chat' ? 'secondary' : 'ghost'}
              onClick={() => setDesktopView('chat')}
            >
              Conversación
            </Button>
            <Button
              variant={desktopView === 'details' ? 'secondary' : 'ghost'}
              onClick={() => setDesktopView('details')}
            >
              Información
            </Button>
          </div>
        </div>
      )}

      {!operationalWorkspace && !isMobile && isDetailsVisible && (
        <div className="border-b border-border bg-muted/25 px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2.5 py-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Actividad reciente</p>
              <p className="text-sm font-semibold text-foreground">
                {isLoading ? 'Sincronizando conversacion' : lastActivityLabel}
              </p>
              {!isLoading && lastMessageSnippet && (
                <p className="hidden max-w-[16rem] truncate text-xs text-muted-foreground xl:block">{lastMessageSnippet}</p>
              )}
            </div>
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2.5 py-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Volumen</p>
              <p className="text-sm font-semibold text-foreground">
                {isLoading
                  ? 'Cargando...'
                  : `${messages.length} ${messages.length === 1 ? 'mensaje' : 'mensajes'}`}
              </p>
              <p className="hidden text-xs text-muted-foreground xl:block">
                {incomingMessagesCount} del vecino · {outgoingMessagesCount} del agente
              </p>
            </div>
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2.5 py-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Seguimiento</p>
              <Badge variant={isResponsePending ? 'destructive' : 'secondary'} className="w-fit">
                {isResponsePending ? 'Respuesta pendiente' : 'Al día'}
              </Badge>
              <p className="hidden text-xs text-muted-foreground xl:block">
                {attachmentsCount > 0
                  ? `${attachmentsCount} ${attachmentsCount === 1 ? 'adjunto' : 'adjuntos'} compartidos`
                  : 'Sin adjuntos'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/20">
        {desktopView === 'details' && !isMobile ? (
          <DetailsPanel operationalWorkspace={operationalWorkspace} />
        ) : (
          <>
            <div
              className="h-full min-h-0 overflow-y-auto overscroll-contain p-3 pb-4 [scrollbar-gutter:stable] sm:p-4 sm:pb-8"
              ref={scrollAreaRef}
              onScroll={handleScroll}
              data-testid="ticket-message-scroll"
            >
              {historyPage.hasMore && (
                <div className="mb-3 flex flex-col items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadOlderHistory}
                    disabled={isLoadingOlderHistory}
                    aria-label="Cargar mensajes anteriores"
                    aria-busy={isLoadingOlderHistory}
                    className="rounded-full bg-background/90 shadow-sm"
                  >
                    {isLoadingOlderHistory ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="mr-2 h-4 w-4 rotate-180" aria-hidden="true" />
                    )}
                    {isLoadingOlderHistory ? 'Cargando historial...' : 'Cargar mensajes anteriores'}
                  </Button>
                  <span className="sr-only" role="status" aria-live="polite">
                    {isLoadingOlderHistory ? 'Cargando mensajes anteriores' : 'Hay mensajes anteriores disponibles'}
                  </span>
                </div>
              )}
              {timelinePartial && (
                <div className="mb-3 rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                  Timeline parcial: se cargó conversación base y se reintentará actualizar eventos omnicanal.
                </div>
              )}
              {showOperationalTimelineInChat && (
                <div
                  className="mb-4 space-y-2 rounded-lg border border-border/60 bg-background/80 p-3"
                  data-testid="ticket-operational-timeline"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actividad del reclamo</p>
                    <Badge variant="outline" className="text-[11px]">
                      {operationalTimelineItems.length} eventos
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {operationalTimelineItems.slice(-5).map((item) => (
                      <div key={item.id} className="rounded-md border border-border/50 bg-muted/30 px-2 py-1.5">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.source || item.stream_type || 'evento'}</p>
                        <p className="text-sm text-foreground">{item.preview_text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title={timelinePartial ? 'Historial en sincronizacion' : 'No hay mensajes'}
                  description={
                    timelinePartial
                      ? 'El historial completo todavia no respondio. Podes contestar igual; la conversacion se actualiza cuando vuelva el timeline.'
                      : 'Esta conversacion aun no tiene mensajes. Envia el primero.'
                  }
                />
              ) : (
                <AnimatePresence initial={!shouldReduceMotion}>
                    <motion.div className="space-y-4 pb-4">
                    {messages.map((msg, index) => (
                      <motion.div
                        key={msg.id || index}
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: shouldReduceMotion ? 0 : 0.2,
                          delay: shouldReduceMotion ? 0 : 0.05,
                        }}
                      >
                        <ChatMessage
                          message={msg}
                          isTyping={false}
                          onButtonClick={handleButtonClick}
                          tipoChat={selectedTicket.tipo}
                        />
                      </motion.div>
                    ))}
                    </motion.div>
                </AnimatePresence>
              )}
            </div>
            {showScrollToBottom && <ScrollToBottomButton onClick={scrollToBottom} />}
          </>
        )}
      </div>

      <footer
        className={cn(
          'z-20 shrink-0 overflow-hidden border-t border-border/80 bg-card/95 shadow-[0_-10px_28px_rgba(15,23,42,0.08)] backdrop-blur',
          isMobile ? 'relative px-2.5 py-2' : 'sticky bottom-0 p-3',
        )}
        data-testid="ticket-reply-footer"
      >
        <div
          data-testid="ticket-composer-channel-status"
          className={cn(
            'mb-2 flex min-w-0 items-center justify-between gap-2 rounded-[8px] border px-2 py-1.5 text-xs',
            composerChannelView.tone === 'success'
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : composerChannelView.tone === 'warning'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                : 'border-border/70 bg-muted/40 text-muted-foreground',
          )}
          role="status"
          aria-live="polite"
        >
          <div className="flex min-w-0 items-center gap-2">
            {composerChannelView.tone === 'warning' ? (
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide sm:text-xs">
                {composerChannelView.label}
              </p>
              <p className="hidden truncate text-[11px] leading-4 sm:block" title={composerChannelView.detail}>
                {composerChannelView.detail}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px] sm:text-[11px]">
              {formatReplyDeliveryChannel(activeChannel)}
            </Badge>
            <Badge
              variant={realtimeOnline ? 'secondary' : 'outline'}
              className="h-5 rounded-full px-2 text-[10px] sm:text-[11px]"
              data-testid="ticket-composer-sync-status"
            >
              {realtimeOnline ? 'Socket conectado' : 'Sondeo activo'}
            </Badge>
          </div>
        </div>

        {activeComposerActionResult && activeComposerActionDeliveryView ? (
          <div
            className={cn(
              'mb-2 rounded-[8px] border px-2.5 py-2 text-xs',
              activeComposerActionDeliveryView.tone === 'queued'
                ? 'border-blue-500/25 bg-blue-500/10 text-blue-800 dark:text-blue-200'
                : activeComposerActionDeliveryView.tone === 'pending'
                  ? 'border-blue-500/25 bg-blue-500/10 text-blue-800 dark:text-blue-200'
                  : activeComposerActionDeliveryView.tone === 'success'
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                    : activeComposerActionDeliveryView.tone === 'warning'
                      ? 'border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100'
                      : 'border-border/70 bg-muted/40 text-muted-foreground',
            )}
            data-testid="ticket-composer-action-result"
          >
            <p className="font-semibold">{activeComposerActionDeliveryView.title}</p>
            <p>{activeComposerActionDeliveryView.detail}</p>
          </div>
        ) : null}

        {activeComposerActionError ? (
          <div
            className="mb-2 rounded-[8px] border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive"
            role="alert"
          >
            {getErrorMessage(activeComposerActionError, 'No se pudo registrar la acción interna.')}
          </div>
        ) : null}

        {replyBlockReason ? (
          <div
            id="ticket-reply-block-reason"
            data-testid="ticket-reply-block-reason"
            role="status"
            aria-live="polite"
            className="mb-2 rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-900 dark:text-amber-100"
          >
            <span className="font-semibold">Respuesta bloqueada. </span>
            {replyBlockReason}
          </div>
        ) : null}

        <div
          className={cn(
            'min-h-0',
            isMobile && 'max-h-14 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-gutter:stable]',
          )}
          data-testid="ticket-composer-context"
        >
          {isTenantTicketWhatsApp ? (
            <div className="mb-2 space-y-2" data-testid="whatsapp-service-window">
              <div className={cn(
                'rounded-[8px] border px-2.5 py-2 text-xs',
                whatsappServiceWindow.tone === 'success'
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100',
              )}>
                <p className="font-semibold">{whatsappServiceWindow.title}</p>
                <p>{whatsappServiceWindow.detail}</p>
              </div>
              {whatsappServiceWindow.recipientAvailable !== false && approvedWhatsAppTemplates.length ? (
                <div className="rounded-[8px] border border-border/70 bg-muted/30 p-2.5">
                  <label className="block text-xs font-semibold" htmlFor="approved-whatsapp-template">
                    Plantilla aprobada de WhatsApp
                  </label>
                  <select
                    id="approved-whatsapp-template"
                    aria-label="Plantilla aprobada de WhatsApp"
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                    value={selectedApprovedTemplateId}
                    onChange={(event) => {
                      setSelectedApprovedTemplateId(event.target.value);
                      setApprovedTemplateVariables({});
                    }}
                    disabled={Boolean(templateReplyBlockReason) || isSending}
                  >
                    <option value="">Elegir plantilla aprobada</option>
                    {approvedWhatsAppTemplates.map((template) => (
                      <option key={template.registryId} value={template.registryId}>{template.name}</option>
                    ))}
                  </select>
                  {selectedApprovedTemplate ? (
                    <div className="mt-2 space-y-2">
                      {selectedApprovedTemplate.variableKeys.map((key) => (
                        <label className="block text-xs" key={key}>
                          Variable {key} de la plantilla
                          <input
                            aria-label={`Variable ${key} de la plantilla`}
                            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                            value={approvedTemplateVariables[key] || ''}
                            onChange={(event) => setApprovedTemplateVariables((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))}
                            disabled={isSending}
                          />
                        </label>
                      ))}
                      <p className="rounded-md bg-background/70 p-2 text-xs">
                        {renderApprovedWhatsAppTemplate(selectedApprovedTemplate, approvedTemplateVariables)}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleSendMessage({
                          approvedTemplate: selectedApprovedTemplate,
                          templateVariables: approvedTemplateVariables,
                        })}
                        disabled={isSending || Boolean(templateReplyBlockReason) || selectedApprovedTemplate.variableKeys.some((key) => !approvedTemplateVariables[key]?.trim())}
                        aria-label="Enviar plantilla"
                      >
                        Enviar plantilla
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : whatsappServiceWindow.recipientAvailable !== false && whatsappServiceWindow.blocksFreeForm ? (
                <div data-testid="whatsapp-approved-templates-unavailable" className="rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-900 dark:text-amber-100">
                  <p className="font-semibold">Plantillas no disponibles</p>
                  <p>El backend no publicó una plantilla aprobada para responder fuera de la ventana de 24 horas.</p>
                </div>
              ) : null}
            </div>
          ) : null}
          {attachmentPreview && (
            <div className="relative mb-1.5 flex w-full items-center gap-2 rounded-[8px] bg-muted p-1.5 sm:mb-2 sm:gap-3 sm:p-2">
              {attachmentPreview.previewUrl ? (
                <img src={attachmentPreview.previewUrl} alt="Preview" className="h-10 w-10 rounded-md object-cover sm:h-14 sm:w-14" />
              ) : (
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-secondary sm:h-14 sm:w-14">
                  <FileText className="h-6 w-6 text-secondary-foreground sm:h-7 sm:w-7" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{attachmentPreview.file.name}</p>
                <p className="text-xs text-muted-foreground">{(attachmentPreview.file.size / 1024).toFixed(1)} KB</p>
              </div>
              <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-6 w-6" onClick={handleDiscardAttachment}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {operationalGuidance && replyDraft ? (
            <div className="mb-1.5 rounded-[8px] border border-primary/20 bg-primary/5 p-2 sm:mb-2 sm:p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 space-y-0.5 sm:space-y-1">
                  <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" />
                    <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-primary sm:text-xs">Borrador asistido</p>
                    <Badge variant={operationalGuidance.source === 'backend' ? 'secondary' : 'outline'} className="h-5 shrink-0 rounded-full px-1.5 text-[10px] sm:px-2 sm:text-[11px]">
                      {operationalGuidance.source === 'backend' ? 'backend' : 'operativo'}
                    </Badge>
                  </div>
                  <p className="line-clamp-1 text-[11px] leading-4 text-muted-foreground sm:line-clamp-2 sm:text-xs sm:leading-5">{replyDraft}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 rounded-[8px] px-2 text-[11px] font-semibold sm:h-8 sm:px-3 sm:text-xs"
                  onClick={applyReplyDraft}
                  disabled={!canApplyReplyDraft}
                >
                  Usar
                  <span className="sr-only sm:not-sr-only"> sugerencia</span>
                </Button>
              </div>
            </div>
          ) : null}
          {lastReplyDelivery && replyDeliveryView ? (
            <div
              data-testid="ticket-reply-delivery-status"
              role="status"
              aria-live="polite"
              className={cn(
                'mb-1.5 rounded-[8px] border p-2 sm:mb-2 sm:p-2.5',
                replyDeliveryView.tone === 'success'
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                  : replyDeliveryView.tone === 'warning'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                    : 'border-border/70 bg-muted/40 text-muted-foreground',
              )}
            >
              <div className="flex min-w-0 items-start gap-2">
                {replyDeliveryView.tone === 'success' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : replyDeliveryView.tone === 'warning' ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide">{replyDeliveryView.title}</p>
                    <Badge variant="outline" className="h-5 rounded-full px-2 text-[11px]">
                      {formatReplyDeliveryChannel(lastReplyDelivery.channel)}
                    </Badge>
                    {lastReplyDelivery.recipient_read_confirmed ? (
                      <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px]">
                        leido
                      </Badge>
                    ) : lastReplyDelivery.recipient_presence_confirmed ? (
                      <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px]">
                        presencia activa
                      </Badge>
                    ) : lastReplyDelivery.socket_emitted ? (
                      <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px]">
                        socket emitido
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-5">{replyDeliveryView.detail}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        
        <div
          className="flex min-w-0 items-end gap-1.5 rounded-[10px] border border-border/80 bg-background p-1.5 shadow-sm"
          data-testid="ticket-composer"
          role="group"
          aria-label="Respuesta desde el ticket"
        >
          <Textarea
            ref={composerRef}
            placeholder={composerPlaceholder}
            className={cn(
              'min-w-0 flex-1 resize-none rounded-[8px] border-0 bg-transparent px-2 py-2 text-sm leading-5 shadow-none focus-visible:ring-1 focus-visible:ring-primary/40',
              isMobile ? 'min-h-10 max-h-24' : 'min-h-10 max-h-36',
            )}
            rows={1}
            value={message}
            onChange={(e) => updateActiveDraft(e.target.value)}
            disabled={listening || isSending || Boolean(freeFormReplyBlockReason)}
            onKeyDown={handleComposerKeyDown}
            maxLength={1000}
            aria-label="Responder ticket"
            aria-describedby={replyBlockReason ? 'ticket-reply-block-reason' : isTenantTicketWhatsApp ? 'whatsapp-service-window' : undefined}
          />
          <div className="flex shrink-0 items-center gap-0.5 rounded-[8px] bg-muted/30 p-0.5 [&_button]:!h-9 [&_button]:!rounded-[7px]">
            {!newAttachmentUploadBlockReason ? (
              <div className="[&_button]:!w-9 [&_button]:!border-0 [&_button]:!bg-transparent" data-testid="ticket-composer-attachment-action">
                <AdjuntarArchivo
                  onFileSelected={handleFileSelected}
                  disabled={!!attachmentPreview || isSending}
                />
              </div>
            ) : null}
            <div className="flex items-center gap-0.5">
              {selectedTicket && (
                <ResponseTemplatePicker
                  open={templatePickerOpen}
                  onOpenChange={handleTemplatePickerOpenChange}
                  onSelectTemplate={handleSelectResponseTemplate}
                  tenantSlug={responseTemplateTenantSlug}
                  ticketId={selectedTicket.id}
                  ticketKey={selectedConversationKey}
                  sourceModel={responseTemplateSourceModel}
                  metadata={responseTemplateMetadata}
                  managementHref={responseTemplateManagementHref}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    disabled={isSending}
                    aria-label="Insertar respuesta guardada (atajo /)"
                    onClick={captureComposerSelection}
                  >
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                </ResponseTemplatePicker>
              )}
              {supported && (
                <Button variant="ghost" size="icon" className="h-10 w-10" onClick={listening ? stop : start} disabled={isSending} aria-label={listening ? 'Detener dictado' : 'Iniciar dictado'}>
                    {listening ? <MicOff className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5" />}
                </Button>
              )}
            </div>
            <DropdownMenu open={composerToolsOpen} onOpenChange={setComposerToolsOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 px-2"
                  aria-label="Herramientas de respuesta"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  <span className={cn(isMobile && 'sr-only')}>Herramientas</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="top"
                sideOffset={8}
                className="w-[min(23rem,calc(100vw-1rem))] p-1.5"
                aria-label="Herramientas de respuesta"
                data-testid="ticket-composer-action-bar"
              >
                <DropdownMenuLabel className="px-2 py-1.5">
                  <span className="block text-xs font-semibold">Herramientas de respuesta</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    Acciones publicadas para este expediente.
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {newAttachmentUploadBlockReason ? (
                  <DropdownMenuItem
                    aria-disabled="true"
                    aria-label={`Cargar archivo o imagen nuevo. No disponible: ${newAttachmentUploadBlockReason}`}
                    className="items-start gap-2 py-2 opacity-70 focus:bg-muted"
                    onSelect={(event) => event.preventDefault()}
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">Cargar archivo o imagen nuevo</span>
                      <span className="block whitespace-normal text-[11px] leading-4 text-muted-foreground" data-testid="tenant-attachment-block-reason">
                        {newAttachmentUploadBlockReason}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ) : null}
                {authoritativeAttachmentMustFailClosed && existingAttachmentBlockReason ? (
                  <DropdownMenuItem
                    aria-disabled="true"
                    aria-label={`Vincular adjunto existente. No disponible: ${existingAttachmentBlockReason}`}
                    className="items-start gap-2 py-2 opacity-70 focus:bg-muted"
                    onSelect={(event) => event.preventDefault()}
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">Vincular adjunto existente</span>
                      <span className="block whitespace-normal text-[11px] leading-4 text-muted-foreground" data-testid="ticket-existing-attachment-block-reason">
                        {existingAttachmentBlockReason}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ) : authoritativeAttachmentMustFailClosed ? (
                  <DropdownMenuItem
                    className="items-start gap-2 py-2"
                    disabled={composerActionMutation.isPending}
                    onSelect={() => {
                      composerActionMutation.reset();
                      setLastComposerActionResult(null);
                      setShareActionDialogKind('attachment');
                    }}
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">Vincular adjunto existente</span>
                      <span className="block whitespace-normal text-[11px] leading-4 text-muted-foreground">
                        {attachmentAction?.delivery_mode === 'crm_only'
                          ? 'Guardado en CRM, no enviado externamente. No carga archivos nuevos.'
                          : 'El backend hará un preflight; la entrega final requiere evidencia del proveedor.'}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ) : null}
                {replyBlockReason ? (
                  <DropdownMenuItem
                    aria-disabled="true"
                    aria-label={`Enviar respuesta. No disponible: ${replyBlockReason}`}
                    className="items-start gap-2 py-2 opacity-70 focus:bg-muted"
                    onSelect={(event) => event.preventDefault()}
                  >
                    <Send className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">Enviar respuesta</span>
                      <span className="block whitespace-normal text-[11px] leading-4 text-muted-foreground">{replyBlockReason}</span>
                    </span>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  aria-disabled={Boolean(locationBlockReason) || composerActionMutation.isPending}
                  aria-label={locationBlockReason
                    ? `${locationAction?.label || 'Ubicación'}. No disponible: ${locationBlockReason}`
                    : locationAction?.label || 'Ubicación'}
                  className={cn('items-start gap-2 py-2', locationBlockReason && 'opacity-70 focus:bg-muted')}
                  onSelect={(event) => {
                    if (locationBlockReason || composerActionMutation.isPending) {
                      event.preventDefault();
                      return;
                    }
                    composerActionMutation.reset();
                    setLastComposerActionResult(null);
                    setShareActionDialogKind('location');
                  }}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{locationAction?.label || 'Ubicación'}</span>
                    <span className="block whitespace-normal text-[11px] leading-4 text-muted-foreground">
                      {locationBlockReason || locationAction?.description || 'Compartir la ubicación publicada para el caso.'}
                    </span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  aria-disabled={Boolean(formBlockReason) || composerActionMutation.isPending}
                  aria-label={formBlockReason
                    ? `${formAction?.label || 'Formulario'}. No disponible: ${formBlockReason}`
                    : formAction?.label || 'Formulario'}
                  className={cn('items-start gap-2 py-2', formBlockReason && 'opacity-70 focus:bg-muted')}
                  onSelect={(event) => {
                    if (formBlockReason || composerActionMutation.isPending) {
                      event.preventDefault();
                      return;
                    }
                    composerActionMutation.reset();
                    setLastComposerActionResult(null);
                    setShareActionDialogKind('form');
                  }}
                >
                  <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{formAction?.label || 'Formulario'}</span>
                    <span className="block whitespace-normal text-[11px] leading-4 text-muted-foreground">
                      {formBlockReason || formAction?.description || 'Compartir un formulario publicado para el caso.'}
                    </span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  aria-disabled={Boolean(handoffBlockReason) || composerActionMutation.isPending}
                  aria-label={handoffBlockReason
                    ? `${handoffAction?.label || 'Derivar a humano'}. No disponible: ${handoffBlockReason}`
                    : handoffAction?.label || 'Derivar a humano'}
                  className={cn('items-start gap-2 py-2', handoffBlockReason && 'opacity-70 focus:bg-muted')}
                  onSelect={(event) => {
                    if (!handoffAction || handoffBlockReason || composerActionMutation.isPending) {
                      event.preventDefault();
                      return;
                    }
                    executeComposerAction(handoffAction, handoffBlockReason, 'handoff');
                  }}
                >
                  {composerActionMutation.isPending && composerActionMutation.variables?.actionKind === 'handoff' ? (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                  ) : (
                    <Headphones className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{handoffAction?.label || 'Derivar a humano'}</span>
                    <span className="block whitespace-normal text-[11px] leading-4 text-muted-foreground">
                      {handoffBlockReason || handoffAction?.description || 'Derivación interna disponible para este expediente.'}
                    </span>
                    {handoffAction && !handoffBlockReason && (
                      handoffAction.external_dispatch === false || handoffAction.delivery_mode === 'internal_event'
                    ) ? (
                      <span className="block whitespace-normal text-[11px] leading-4 text-muted-foreground" data-testid="ticket-handoff-internal-copy">
                        Derivación interna del CRM · no envía un mensaje por WhatsApp.
                      </span>
                    ) : null}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              className={cn('min-w-9 rounded-[8px]', isMobile ? 'px-2' : 'h-10 min-w-10 px-3')}
              onClick={() => void handleSendMessage()}
              disabled={
                isSending ||
                composerActionMutation.isPending ||
                Boolean(freeFormReplyBlockReason) ||
                (!message.trim() && !attachmentPreview)
              }
              title={freeFormReplyBlockReason || undefined}
              aria-describedby={replyBlockReason ? 'ticket-reply-block-reason' : isTenantTicketWhatsApp ? 'whatsapp-service-window' : undefined}
              aria-label="Enviar mensaje"
            >
              {isSending ? (
                isMobile ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="sr-only">Enviando</span>
                  </>
                ) : (
                  'Enviando...'
                )
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        <TicketShareActionDialog
          key={composerActionScopeKey}
          action={shareActionDialogKind === 'location' ? locationAction : shareActionDialogKind === 'attachment' ? attachmentAction : formAction}
          kind={shareActionDialogKind || 'location'}
          open={Boolean(shareActionDialogKind)}
          replyContract={composerReplyContract}
          attachments={composerActionAttachments}
          submitting={Boolean(
            composerActionMutation.isPending &&
            composerActionMutation.variables?.actionKind === shareActionDialogKind
          )}
          errorMessage={shareActionDialogKind && activeComposerActionError
            ? getErrorMessage(activeComposerActionError, 'No se pudo registrar la acción interna.')
            : null}
          onOpenChange={(open) => {
            if (!open) setShareActionDialogKind(null);
          }}
          onConfirm={(payload: TicketShareActionPayload) => {
            if (shareActionDialogKind === 'location' && locationAction) {
              executeComposerAction(locationAction, locationBlockReason, 'location', { ...payload });
            }
            if (shareActionDialogKind === 'form' && formAction) {
              executeComposerAction(formAction, formBlockReason, 'form', { ...payload });
            }
            if (shareActionDialogKind === 'attachment' && attachmentAction) {
              executeComposerAction(attachmentAction, existingAttachmentBlockReason, 'attachment', { ...payload });
            }
          }}
        />
      </footer>
    </motion.div>
  );
};

export default ConversationPanel;
