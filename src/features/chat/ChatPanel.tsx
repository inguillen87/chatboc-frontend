import React, { useMemo, useState } from 'react';
import LegacyChatPanel from '@/components/chat/ChatPanel';
import ChatMessageList from './ChatMessageList';
import ChatComposer, { type ChatComposerPayload } from './ChatComposer';
import QuickReplies from './QuickReplies';
import HandoffBanner from './HandoffBanner';
import ConversationRating from './ConversationRating';
import ChatEmptyState from './ChatEmptyState';
import { Button } from '@/components/ui/button';
import { ApiError, getErrorMessage } from '@/utils/api';
import { getOrCreateAnonId } from '@/utils/anonId';
import getOrCreateChatSessionId from '@/utils/chatSessionId';
import { ExternalLink, FileText, Image as ImageIcon, MapPin, Mic, PackageCheck, Paperclip, TicketCheck, Video } from 'lucide-react';
import {
  createLeadCaptureIdempotencyKey,
  extractChatBootstrapReplyText,
  normalizeLeadCaptureResponse,
  sendChatBootstrapMessage,
  submitLeadCapture,
  type LeadCaptureNextAction,
  type LeadCaptureResponse,
  type OperationalAttachment,
  type OperationalOrderDetail,
  type OperationalOrderResult,
  type OperationalTicketResult,
} from './chatApi';
import type { ChatBootstrapConfig, ChatPanelContext, ChatUiMessage, HandoffLabels, HandoffState, QuickReplyItem } from './chatTypes';
import type {
  ChatAnimationTokens,
  ChatConversionCtaAction,
  ChatConversionCtasConfig,
  ChatExperienceBlock,
  ChatExperienceBlueprint,
  ChatLeadCaptureConfig,
  ChatLeadCaptureField,
  ChatMediaCapabilities,
} from '@/types/chat';

interface FeatureChatPanelProps {
  variant?: 'legacy-widget' | 'standalone';
  context?: ChatPanelContext;
  conversationId?: string | null;
  handoffState?: HandoffState;
  handoffLabels?: HandoffLabels;
  quickReplies?: QuickReplyItem[];
  quickMenu?: unknown;
  leadCapture?: ChatLeadCaptureConfig | null;
  mediaCapabilities?: ChatMediaCapabilities | null;
  conversionCtas?: ChatConversionCtasConfig | null;
  animationTokens?: ChatAnimationTokens | null;
  emptyStates?: Record<string, ChatExperienceBlock>;
  experienceBlueprint?: ChatExperienceBlueprint | null;
  initialMessages?: ChatUiMessage[];
  onCreateTicket?: () => void;
  onOpenWhatsApp?: () => void;
  onWaitOperator?: () => void;
  onRuntimeResult?: (response: unknown, result: LeadCaptureResponse | null) => void;
}

type LegacyChatPanelProps = React.ComponentProps<typeof LegacyChatPanel> & {
  quickMenu?: unknown;
};

type StandaloneChatPanelProps = Omit<FeatureChatPanelProps, 'variant'>;

const isHumanRequest = (text: string) => /human|persona|operador|agente/i.test(text);
const HIGH_INTENT_TERMS = ['checkout', 'pedido', 'derivar_humano', 'humano', 'reclamo', 'estado'];

type LeadFieldErrors = Record<string, string>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeLeadValue = (value: unknown) =>
  typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value).trim();

const readShortChatSessionId = (value: unknown): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return null;
  return trimmed.length <= 64 && !trimmed.includes('.') ? trimmed : null;
};

const readRecordString = (source: Record<string, unknown> | undefined | null, keys: string[]) => {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
};

const readBootstrapSession = (bootstrap?: ChatBootstrapConfig | null) =>
  bootstrap && isRecord(bootstrap.session) ? bootstrap.session : undefined;

const readBootstrapRuntimeEndpoint = (bootstrap?: ChatBootstrapConfig | null) =>
  bootstrap?.same_origin_endpoint?.trim() || bootstrap?.endpoint?.trim() || '';

const readBootstrapChatSessionId = (bootstrap?: ChatBootstrapConfig | null) => {
  const session = readBootstrapSession(bootstrap);
  return (
    readShortChatSessionId(session?.chat_session_id) ??
    readShortChatSessionId(session?.session_id) ??
    readShortChatSessionId(bootstrap?.headers?.['X-Chat-Session-Id']) ??
    readShortChatSessionId(bootstrap?.payload?.chat_session_id) ??
    readShortChatSessionId(bootstrap?.payload?.session_id) ??
    readShortChatSessionId(bootstrap?.query?.chat_session_id) ??
    readShortChatSessionId(bootstrap?.query?.session_id)
  );
};

const readBootstrapDemoSessionId = (bootstrap?: ChatBootstrapConfig | null) => {
  const session = readBootstrapSession(bootstrap);
  return (
    readRecordString(session, ['demo_session_id', 'demoSessionId']) ??
    readRecordString(bootstrap?.payload, ['demo_session_id', 'demoSessionId']) ??
    readRecordString(bootstrap?.query, ['demo_session_id', 'demoSessionId']) ??
    readRecordString(bootstrap?.headers, ['X-Demo-Session-Id', 'X-Demo-Session'])
  );
};

const normalizeFieldErrorValue = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const joined = value.map((item) => normalizeLeadValue(item)).filter(Boolean).join(' ');
    return joined || 'Campo requerido.';
  }
  if (isRecord(value)) {
    return readRecordString(value, ['message', 'detail', 'error']) ?? 'Campo requerido.';
  }
  return 'Campo requerido.';
};

const extractLeadFieldErrors = (error: unknown): LeadFieldErrors => {
  const body = error instanceof ApiError && isRecord(error.body) ? error.body : null;
  const nestedError = isRecord(body?.error) ? body.error : null;
  const source =
    (isRecord(body?.field_errors) && body?.field_errors) ||
    (isRecord(body?.errors) && body?.errors) ||
    (isRecord(nestedError?.field_errors) ? nestedError.field_errors : null);
  const errors: LeadFieldErrors = {};

  if (isRecord(source)) {
    Object.entries(source).forEach(([key, value]) => {
      if (!key.trim()) return;
      errors[key] = normalizeFieldErrorValue(value);
    });
  }

  const requiredFields = Array.isArray(body?.required_fields) ? body?.required_fields : [];
  requiredFields.forEach((field) => {
    if (typeof field === 'string' && field.trim() && !errors[field]) {
      errors[field] = 'Campo requerido.';
    }
  });

  return errors;
};

const validateLeadValues = (
  config: ChatLeadCaptureConfig,
  fields: ChatLeadCaptureField[],
  values: Record<string, unknown>,
): LeadFieldErrors => {
  const errors: LeadFieldErrors = {};
  const fieldNames = new Set(fields.map((field, index) => getLeadFieldName(field, index)));
  const requiredFields = new Set<string>(
    [
      ...(config.required_fields ?? []),
      ...fields
        .map((field, index) => (field.required ? getLeadFieldName(field, index) : null))
        .filter((name): name is string => Boolean(name)),
    ].filter((name) => fieldNames.has(name)),
  );

  requiredFields.forEach((field) => {
    if (!normalizeLeadValue(values[field])) {
      errors[field] = 'Campo requerido.';
    }
  });

  (config.required_any_of ?? []).forEach((group) => {
    const availableGroup = group.filter((field) => fieldNames.has(field));
    if (!availableGroup.length) return;
    const hasAny = availableGroup.some((field) => Boolean(normalizeLeadValue(values[field])));
    if (hasAny) return;
    availableGroup.forEach((field) => {
      errors[field] ||= 'Completa al menos una forma de contacto.';
    });
  });

  return errors;
};

const normalizeRuntimeNextAction = (value: unknown): LeadCaptureNextAction | null => {
  if (!isRecord(value)) return null;
  const label = readRecordString(value, ['label', 'title', 'text']);
  const endpoint = readRecordString(value, ['endpoint', 'href', 'url']);
  const id = readRecordString(value, ['id', 'key']);
  const method = readRecordString(value, ['method']);
  const uiHint = readRecordString(value, ['ui_hint', 'uiHint']);
  const payload = isRecord(value.payload) ? value.payload : null;
  if (!label && !endpoint && !id) return null;
  return {
    id,
    label: label ?? id ?? endpoint,
    endpoint,
    method,
    payload,
    ui_hint: uiHint,
  };
};

const extractRuntimeLeadResult = (response: unknown): LeadCaptureResponse | null => {
  if (!isRecord(response)) return null;
  const normalized = normalizeLeadCaptureResponse(response);
  const lead: Record<string, unknown> = isRecord(response.lead) ? response.lead : {};
  const nextActions = Array.isArray(response.next_actions)
    ? response.next_actions.map(normalizeRuntimeNextAction).filter((item): item is LeadCaptureNextAction => Boolean(item))
    : Array.isArray(lead.next_actions)
      ? lead.next_actions.map(normalizeRuntimeNextAction).filter((item): item is LeadCaptureNextAction => Boolean(item))
      : [];
  const leadId =
    readRecordString(lead, ['lead_id', 'id']) ??
    readRecordString(response, ['lead_id']);
  const ticketId =
    readRecordString(lead, ['ticket_id', 'case_id']) ??
    readRecordString(response, ['ticket_id', 'case_id']);
  const status =
    readRecordString(lead, ['status']) ??
    readRecordString(response, ['status']);
  const requestId = readRecordString(response, ['request_id']);

  if (
    !leadId &&
    !ticketId &&
    !status &&
    !nextActions.length &&
    !requestId &&
    !normalized.ticket &&
    !normalized.order
  ) return null;

  return {
    ok: response.ok === true || lead.created === true || Boolean(leadId || ticketId),
    contract_version: readRecordString(response, ['contract_version']),
    request_id: requestId,
    lead_id: leadId ?? normalized.lead_id,
    ticket_id: ticketId ?? normalized.ticket_id,
    status: status ?? normalized.status,
    next_actions: nextActions.length ? nextActions : normalized.next_actions,
    ticket: normalized.ticket,
    order: normalized.order,
    media_understanding: normalized.media_understanding,
    raw: response,
  };
};

const readBlockTitle = (block?: ChatExperienceBlock | null) =>
  block?.title?.trim() || block?.label?.trim() || block?.text?.trim() || '';

const readBlockDescription = (block?: ChatExperienceBlock | null) =>
  block?.detail?.trim() || block?.description?.trim() || block?.subtitle?.trim() || '';

const normalizeQuickMenu = (quickMenu: unknown): QuickReplyItem[] => {
  if (!Array.isArray(quickMenu)) return [];
  return quickMenu
    .map((item, index) => {
      if (!item) return null;
      if (typeof item === 'string') {
        const label = item.trim();
        return label ? { id: `quick-menu-${index}`, label, payload: label } : null;
      }
      if (typeof item !== 'object') return null;
      const source = item as Record<string, unknown>;
      const label =
        typeof source.label === 'string'
          ? source.label.trim()
          : typeof source.title === 'string'
            ? source.title.trim()
            : typeof source.text === 'string'
              ? source.text.trim()
              : '';
      if (!label) return null;
      const payload =
        typeof source.payload === 'string'
          ? source.payload
          : typeof source.action === 'string'
            ? source.action
            : typeof source.intent === 'string'
              ? source.intent
              : label;
      return {
        id: String(source.id || source.key || `quick-menu-${index}`),
        label,
        payload,
      };
    })
    .filter(Boolean) as QuickReplyItem[];
};

const normalizeExperienceBlocks = (items: unknown): ChatExperienceBlock[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      if (!item) return null;
      if (typeof item === 'string') return { id: `item-${index}`, label: item };
      if (typeof item !== 'object') return null;
      return item as ChatExperienceBlock;
    })
    .filter((item): item is ChatExperienceBlock => Boolean(item));
};

const getLeadFieldName = (field: ChatLeadCaptureField, index: number) =>
  field.name?.trim() || field.id?.trim() || `field_${index + 1}`;

const leadFieldLabel = (field: ChatLeadCaptureField, index: number) =>
  field.label?.trim() || field.name?.trim() || field.id?.trim() || `Campo ${index + 1}`;

const isLeadEndpoint = (endpoint?: string | null) =>
  typeof endpoint === 'string' && endpoint.toLowerCase().includes('lead-capture');

const isTechnicalAssistantReply = (response: unknown, replyText?: string | null) => {
  if (response && typeof response === 'object' && !Array.isArray(response)) {
    const record = response as Record<string, unknown>;
    const status = Number(record.status ?? record.status_code ?? record.code);
    if (Number.isFinite(status) && status >= 400) return true;
    if (record.error && typeof record.error === 'object') return true;
  }

  const normalized = String(replyText ?? '').trim().toLowerCase();
  return [
    'not found',
    'method not allowed',
    'internal server error',
    'server error',
    'failed to fetch',
  ].includes(normalized);
};

const buildInitialMessages = (context?: ChatPanelContext, initialMessages?: ChatUiMessage[]) => {
  if (initialMessages?.length) return initialMessages;
  if (!context?.welcomeMessage?.trim()) return [];
  return [
    {
      id: 'assistant-welcome',
      role: 'assistant' as const,
      text: context.welcomeMessage.trim(),
      timestamp: new Date().toISOString(),
    },
  ];
};

const readRuntimeUnavailableBlock = (emptyStates?: Record<string, ChatExperienceBlock>) =>
  emptyStates?.runtime_unavailable ??
  emptyStates?.api_unavailable ??
  emptyStates?.offline ??
  null;

const hasFiniteCoordinates = (ticket?: OperationalTicketResult | null) =>
  typeof ticket?.latitud === 'number' &&
  Number.isFinite(ticket.latitud) &&
  typeof ticket.longitud === 'number' &&
  Number.isFinite(ticket.longitud);

const getAttachmentLabel = (attachment: OperationalAttachment, index: number) =>
  attachment.name?.trim() ||
  attachment.filename?.trim() ||
  attachment.type?.trim() ||
  (attachment.archivo_adjunto_id ? `Archivo ${attachment.archivo_adjunto_id}` : `Archivo ${index + 1}`);

const getAttachmentUrl = (attachment: OperationalAttachment) =>
  typeof attachment.url === 'string' && attachment.url.trim() ? attachment.url.trim() : null;

const formatOperationalCurrency = (value?: number | null, currency = 'ARS') => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency || 'ARS',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  }
};

function SafeEvidenceImage({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const cleanSrc = src?.trim();
  if (!cleanSrc || failed) return null;
  return (
    <img
      src={cleanSrc}
      alt={alt}
      loading="lazy"
      className="h-24 w-full rounded-md border object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export default function ChatPanel(props: FeatureChatPanelProps & Partial<LegacyChatPanelProps>) {
  const {
    variant = 'standalone',
    ...legacyProps
  } = props;

  if (variant === 'legacy-widget') {
    return <LegacyChatPanel {...(legacyProps as LegacyChatPanelProps)} />;
  }

  return <StandaloneChatPanel {...props} />;
}

function StandaloneChatPanel({
  context,
  conversationId,
  handoffState = 'none',
  handoffLabels,
  quickReplies,
  quickMenu,
  leadCapture,
  mediaCapabilities,
  conversionCtas,
  animationTokens,
  emptyStates,
  experienceBlueprint,
  initialMessages,
  onCreateTicket,
  onOpenWhatsApp,
  onWaitOperator,
  onRuntimeResult,
}: StandaloneChatPanelProps) {
  const resolvedContext: ChatPanelContext = context ?? { tipoChat: 'pyme' };
  const [runtimeHandoffState, setRuntimeHandoffState] = useState<HandoffState>(handoffState);
  const [messages, setMessages] = useState<ChatUiMessage[]>(() => buildInitialMessages(resolvedContext, initialMessages));
  const [composerDraft, setComposerDraft] = useState<string | null>(null);
  const [composerIntent, setComposerIntent] = useState<string | null>(null);
  const [composerPayload, setComposerPayload] = useState<Record<string, unknown> | null>(null);
  const [activeLead, setActiveLead] = useState<ChatLeadCaptureConfig | null>(null);
  const [activeLeadMeta, setActiveLeadMeta] = useState<Record<string, unknown>>({});
  const [leadValues, setLeadValues] = useState<Record<string, string>>({});
  const [leadStatus, setLeadStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadFieldErrors, setLeadFieldErrors] = useState<LeadFieldErrors>({});
  const [leadResult, setLeadResult] = useState<LeadCaptureResponse | null>(null);
  const resolvedBlueprint =
    experienceBlueprint ?? resolvedContext.experienceBlueprint ?? null;
  const resolvedLeadCapture =
    leadCapture ?? resolvedContext.leadCapture ?? resolvedBlueprint?.lead_capture ?? null;
  const resolvedMediaCapabilities =
    mediaCapabilities ?? resolvedContext.mediaCapabilities ?? resolvedBlueprint?.media_capabilities ?? null;
  const resolvedConversionCtas =
    conversionCtas ?? resolvedContext.conversionCtas ?? resolvedBlueprint?.conversion_ctas ?? null;
  const resolvedAnimationTokens =
    animationTokens ?? resolvedContext.animationTokens ?? resolvedBlueprint?.animation_tokens ?? null;
  const resolvedChatBootstrap = resolvedContext.chatBootstrap ?? null;
  const resolvedEmptyStates = {
    ...(resolvedBlueprint?.empty_states ?? {}),
    ...(resolvedContext.emptyStates ?? {}),
    ...(emptyStates ?? {}),
    ...(resolvedChatBootstrap?.empty_states ?? {}),
  };
  const hasRuntimeChat = Boolean(readBootstrapRuntimeEndpoint(resolvedChatBootstrap));
  const firstVisit =
    resolvedContext.firstVisit ??
    resolvedBlueprint?.first_visit ??
    resolvedEmptyStates.first_visit ??
    null;
  const noMessagesState =
    resolvedEmptyStates.no_messages ??
    resolvedEmptyStates.empty ??
    resolvedEmptyStates.offline ??
    null;
  const runtimeUnavailableState = readRuntimeUnavailableBlock(resolvedEmptyStates);
  const runtimeUnavailableTitle = readBlockTitle(runtimeUnavailableState);
  const runtimeUnavailableDescription = readBlockDescription(runtimeUnavailableState);
  const sampleConversations = useMemo(
    () =>
      normalizeExperienceBlocks(
        resolvedContext.sampleConversations?.length
          ? resolvedContext.sampleConversations
          : resolvedBlueprint?.sample_conversations,
      ),
    [resolvedBlueprint?.sample_conversations, resolvedContext.sampleConversations],
  );
  const trustSignals = useMemo(
    () =>
      normalizeExperienceBlocks(
        resolvedContext.trustSignals?.length
          ? resolvedContext.trustSignals
          : resolvedBlueprint?.trust_signals,
      ),
    [resolvedBlueprint?.trust_signals, resolvedContext.trustSignals],
  );
  const replies = useMemo(
    () => {
      const resolvedQuickReplies = quickReplies ?? resolvedContext.quickReplies ?? [];
      return resolvedQuickReplies.length ? resolvedQuickReplies : normalizeQuickMenu(quickMenu);
    },
    [quickMenu, quickReplies, resolvedContext.quickReplies],
  );

  const leadEnabled = resolvedLeadCapture?.enabled !== false;
  const leadTriggers = useMemo(
    () =>
      (resolvedLeadCapture?.trigger_intents ?? [])
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim().toLowerCase()),
    [resolvedLeadCapture?.trigger_intents],
  );
  const visibleCtas = useMemo(() => {
    const actions = resolvedConversionCtas?.actions ?? [];
    const maxVisible = Number(resolvedConversionCtas?.rules?.max_visible ?? 3);
    return actions.slice(0, Number.isFinite(maxVisible) && maxVisible > 0 ? maxVisible : 3);
  }, [resolvedConversionCtas?.actions, resolvedConversionCtas?.rules?.max_visible]);

  const shouldTriggerLead = (candidate: {
    text?: string;
    intent?: string | null;
    endpoint?: string | null;
  }) => {
    if (!leadEnabled || !resolvedLeadCapture) return false;
    if (isLeadEndpoint(candidate.endpoint)) return true;
    const intent = candidate.intent?.trim().toLowerCase();
    if (intent && leadTriggers.includes(intent)) return true;
    const text = candidate.text?.trim().toLowerCase() || '';
    if (!text) return false;
    return HIGH_INTENT_TERMS.some((term) => text.includes(term));
  };

  const submitLead = async (
    config: ChatLeadCaptureConfig,
    values: Record<string, unknown>,
    meta: Record<string, unknown> = {},
  ) => {
    const fields = config.fields ?? [];
    const normalizedValues = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, normalizeLeadValue(value)]),
    );
    const validationErrors = validateLeadValues(config, fields, normalizedValues);
    if (Object.keys(validationErrors).length) {
      setLeadFieldErrors(validationErrors);
      setLeadError(null);
      setLeadStatus('idle');
      return;
    }

    setLeadStatus('sending');
    setLeadError(null);
    setLeadFieldErrors({});
    setLeadResult(null);
    try {
      const chatSessionId = readBootstrapChatSessionId(resolvedChatBootstrap) ?? getOrCreateChatSessionId();
      const demoSessionId = readBootstrapDemoSessionId(resolvedChatBootstrap);
      const anonId = getOrCreateAnonId();
      const cleanMeta = Object.fromEntries(
        Object.entries(meta).filter(([, value]) => value !== undefined),
      );
      const trigger = String(cleanMeta.trigger || cleanMeta.intent || cleanMeta.cta_id || 'lead_capture');
      const idempotencyKey = createLeadCaptureIdempotencyKey(
        resolvedContext.tenantSlug,
        chatSessionId,
        trigger,
      );
      const response = await submitLeadCapture(
        config,
        {
          ...cleanMeta,
          ...normalizedValues,
          tenant_slug: resolvedContext.tenantSlug ?? undefined,
          sector: resolvedContext.sector ?? undefined,
          tipo_chat: resolvedContext.tipoChat,
          demo_session_id: demoSessionId ?? undefined,
          chat_session_id: chatSessionId,
          anon_id: anonId || undefined,
          channel: typeof cleanMeta.channel === 'string' ? cleanMeta.channel : 'web',
          source: typeof cleanMeta.source === 'string' ? cleanMeta.source : 'chat_panel',
          trigger,
          intent: typeof cleanMeta.intent === 'string' ? cleanMeta.intent : trigger,
          conversation_id: conversationId ?? undefined,
          idempotency_key: idempotencyKey,
          fields: normalizedValues,
        },
        resolvedContext.tenantSlug,
        { idempotencyKey },
      );
      setLeadStatus('sent');
      setLeadResult(response);
      setActiveLead(null);
      setActiveLeadMeta({});
      setLeadValues({});
      setLeadFieldErrors({});
      const success = response.message_body?.trim() || config.success_message?.trim();
      if (success) {
        setMessages((prev) => [
          ...prev,
          {
            id: `lead-${Date.now()}`,
            role: 'system',
            text: success,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      const fieldErrors = extractLeadFieldErrors(err);
      if (Object.keys(fieldErrors).length) {
        setLeadFieldErrors(fieldErrors);
      }
      setLeadError(getErrorMessage(err, 'No se pudo guardar el seguimiento.'));
      setLeadStatus('idle');
    }
  };

  const openOrSubmitLead = (
    config: ChatLeadCaptureConfig,
    meta: Record<string, unknown> = {},
  ) => {
    const fields = config.fields ?? [];
    if (!fields.length) {
      return;
    }
    setActiveLead(config);
    setActiveLeadMeta(meta);
    setLeadResult(null);
    setLeadValues({});
    setLeadFieldErrors({});
    setLeadStatus('idle');
    setLeadError(null);
  };

  const appendUserMessage = (input: ChatComposerPayload | string) => {
    const payload: ChatComposerPayload =
      typeof input === 'string'
        ? { text: input }
        : input;
    const text = payload.text?.trim() || '';
    const hasAttachment = Boolean(payload.attachmentInfo);
    const hasLocation = Boolean(payload.location);
    const hasAudio = Boolean(payload.audioBlob);
    if (!text && !hasAttachment && !hasLocation && !hasAudio) return;
    const userText =
      text ||
      (hasAttachment ? 'Adjunto' : hasLocation ? 'Ubicacion compartida' : 'Audio');

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: userText, timestamp: new Date().toISOString() },
    ]);

    if (isHumanRequest(text) || payload.intent === 'derivar_humano') {
      setRuntimeHandoffState('requested_by_user');
    }

    if (resolvedLeadCapture && shouldTriggerLead({ text, intent: payload.intent })) {
      openOrSubmitLead(resolvedLeadCapture, {
        intent: payload.intent ?? undefined,
        message: text || undefined,
        payload: payload.payload ?? undefined,
      });
    }
    if (hasRuntimeChat && resolvedChatBootstrap) {
      void (async () => {
        try {
          const response = await sendChatBootstrapMessage(
            resolvedChatBootstrap,
            payload,
            resolvedContext.tenantSlug,
          );
          const replyText = extractChatBootstrapReplyText(response);
          if (isTechnicalAssistantReply(response, replyText)) {
            throw new Error('Respuesta tecnica del runtime de chat demo.');
          }
          const runtimeLeadResult = extractRuntimeLeadResult(response);
          if (runtimeLeadResult) {
            setLeadResult(runtimeLeadResult);
          }
          onRuntimeResult?.(response, runtimeLeadResult);
          if (!replyText) return;
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              text: replyText,
              timestamp: new Date().toISOString(),
            },
          ]);
        } catch {
          const errorText = runtimeUnavailableDescription || runtimeUnavailableTitle;
          if (!errorText) return;
          setMessages((prev) => [
            ...prev,
            {
              id: `e-${Date.now()}`,
              role: 'system',
              text: errorText,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      })();
    }
    setComposerDraft(null);
    setComposerIntent(null);
    setComposerPayload(null);
  };

  const handleSampleSelect = (item: ChatExperienceBlock) => {
    const draft = item.text?.trim() || item.label?.trim() || item.title?.trim() || '';
    setComposerDraft(draft);
    setComposerIntent(item.intent ?? null);
    setComposerPayload(item.payload ?? null);
  };

  const handleCtaClick = (action: ChatConversionCtaAction) => {
    if (resolvedLeadCapture && shouldTriggerLead({ text: action.label, intent: action.intent, endpoint: action.endpoint })) {
      openOrSubmitLead(resolvedLeadCapture, {
        intent: action.intent ?? undefined,
        cta_id: action.id,
        payload: action.payload ?? undefined,
      });
      return;
    }
    setComposerDraft(action.label);
    setComposerIntent(action.intent ?? null);
    setComposerPayload(action.payload ?? null);
  };

  const emptyTitle =
    readBlockTitle(firstVisit) ||
    readBlockTitle(noMessagesState) ||
    resolvedContext.emptyTitle ||
    'Sin mensajes';
  const emptySubtitle =
    readBlockDescription(firstVisit) ||
    readBlockDescription(noMessagesState) ||
    resolvedContext.emptySubtitle ||
    'Selecciona una accion disponible o escribi para comenzar.';
  const motionLevel =
    resolvedAnimationTokens?.motion_level?.trim() ||
    undefined;

  return (
    <section className="space-y-3" aria-label="Panel de chat" data-motion-level={motionLevel}>
      <HandoffBanner
        state={runtimeHandoffState}
        labels={handoffLabels}
        onCreateTicket={onCreateTicket}
        onOpenWhatsApp={onOpenWhatsApp}
        onWaitOperator={onWaitOperator}
      />
      {messages.length === 0 ? (
        <ChatEmptyState
          title={emptyTitle}
          subtitle={emptySubtitle}
        />
      ) : (
        <ChatMessageList messages={messages} />
      )}
      {messages.length === 0 && sampleConversations.length ? (
        <div className="flex flex-wrap gap-2" aria-label="Conversaciones de ejemplo">
          {sampleConversations.map((item, index) => {
            const label = readBlockTitle(item);
            if (!label) return null;
            return (
              <Button
                key={item.id || `${label}-${index}`}
                type="button"
                size="sm"
                variant="outline"
                className="h-auto max-w-full justify-start whitespace-normal text-left text-xs"
                onClick={() => handleSampleSelect(item)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      ) : null}
      {messages.length === 0 && trustSignals.length ? (
        <div className="flex flex-wrap gap-2 text-xs" aria-label="Senales de confianza">
          {trustSignals.map((item, index) => {
            const label = readBlockTitle(item);
            const description = readBlockDescription(item);
            if (!label && !description) return null;
            return (
              <span
                key={item.id || `${label}-${index}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background/70 px-2.5 py-1 text-left"
              >
                {label ? <span className="shrink-0 font-medium text-foreground">{label}</span> : null}
                {description ? <span className="min-w-0 truncate text-muted-foreground">{description}</span> : null}
              </span>
            );
          })}
        </div>
      ) : null}
      <QuickReplies items={replies} onSelect={(item) => appendUserMessage(item.payload || item.label)} />
      {visibleCtas.length ? (
        <div className="flex flex-wrap gap-2" aria-label="Acciones sugeridas">
          {visibleCtas.map((action) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={action.style === 'primary' || action.style === 'accent' ? 'default' : 'outline'}
              className="h-auto whitespace-normal text-xs"
              onClick={() => handleCtaClick(action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
      {!hasRuntimeChat && (runtimeUnavailableTitle || runtimeUnavailableDescription) ? (
        <div className="rounded-lg border border-border/70 bg-muted/25 p-3 text-sm" role="status">
          {runtimeUnavailableTitle ? (
            <p className="font-medium text-foreground">{runtimeUnavailableTitle}</p>
          ) : null}
          {runtimeUnavailableDescription ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{runtimeUnavailableDescription}</p>
          ) : null}
        </div>
      ) : null}
      {activeLead ? (
        <form
          className="space-y-2 rounded-lg border bg-background/70 p-3 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            const fields = activeLead.fields ?? [];
            const values = fields.reduce<Record<string, string>>((acc, field, index) => {
              const name = getLeadFieldName(field, index);
              acc[name] = leadValues[name] || '';
              return acc;
            }, {});
            void submitLead(activeLead, values, activeLeadMeta);
          }}
        >
          {activeLead.title ? <p className="font-medium">{activeLead.title}</p> : null}
          {(activeLead.fields ?? []).map((field, index) => {
            const name = getLeadFieldName(field, index);
            const label = leadFieldLabel(field, index);
            const inputType = field.type === 'email' || field.type === 'tel' ? field.type : 'text';
            const requiredByContract = field.required || (activeLead.required_fields ?? []).includes(name);
            const fieldError = leadFieldErrors[name];
            return (
              <label key={name} className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                {field.options?.length ? (
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    value={leadValues[name] || ''}
                    required={requiredByContract}
                    aria-invalid={Boolean(fieldError)}
                    onChange={(event) => {
                      setLeadValues((prev) => ({ ...prev, [name]: event.target.value }));
                      setLeadFieldErrors((prev) => {
                        if (!prev[name]) return prev;
                        const next = { ...prev };
                        delete next[name];
                        return next;
                      });
                    }}
                  >
                    <option value="" />
                    {field.options.map((option, optionIndex) => {
                      const value = option.value ?? option.label ?? String(optionIndex);
                      return (
                        <option key={`${name}-${value}`} value={value}>
                          {option.label ?? value}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    type={inputType}
                    value={leadValues[name] || ''}
                    required={requiredByContract}
                    aria-invalid={Boolean(fieldError)}
                    placeholder={field.placeholder ?? undefined}
                    onChange={(event) => {
                      setLeadValues((prev) => ({ ...prev, [name]: event.target.value }));
                      setLeadFieldErrors((prev) => {
                        if (!prev[name]) return prev;
                        const next = { ...prev };
                        delete next[name];
                        return next;
                      });
                    }}
                  />
                )}
                {fieldError ? <span className="block text-xs text-destructive">{fieldError}</span> : null}
              </label>
            );
          })}
          {leadError ? <p className="text-xs text-destructive">{leadError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setActiveLead(null);
                setActiveLeadMeta({});
                setLeadFieldErrors({});
              }}
              disabled={leadStatus === 'sending'}
            >
              Cerrar
            </Button>
            <Button type="submit" size="sm" disabled={leadStatus === 'sending'}>
              {activeLead.title || 'Enviar'}
            </Button>
          </div>
        </form>
      ) : null}
      {leadResult ? (
        <LeadCaptureResult result={leadResult} />
      ) : null}
      <ChatComposer
        onSend={appendUserMessage}
        placeholder={resolvedContext.composerPlaceholder || undefined}
        sendLabel={resolvedContext.sendLabel || undefined}
        mediaCapabilities={resolvedMediaCapabilities}
        draftText={composerDraft}
        intent={composerIntent}
        payload={composerPayload}
        disabled={!hasRuntimeChat}
      />
      <ConversationRating conversationId={conversationId} />
    </section>
  );
}

function LeadCaptureResult({ result }: { result: LeadCaptureResponse }) {
  const traceItems = [
    result.lead_id ? { label: 'Seguimiento', value: String(result.lead_id) } : null,
    result.ticket_id ? { label: 'Caso', value: String(result.ticket_id) } : null,
    result.status ? { label: 'Estado', value: result.status } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const visibleActions = (result.next_actions ?? []).filter((action) => {
    if (!result.ticket) return true;
    const normalized = `${action.id ?? ''} ${action.label ?? ''}`.toLowerCase();
    return !(
      normalized.includes('crear ticket') ||
      normalized.includes('create ticket') ||
      normalized.includes('crear reclamo') ||
      normalized.includes('create claim')
    );
  });
  const hasActions = Boolean(visibleActions.length);

  if (!traceItems.length && !hasActions && !result.request_id && !result.ticket && !result.order) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3 text-xs" aria-label="Resultado operativo">
      {result.ticket ? <OperationalTicketCard ticket={result.ticket} /> : null}
      {result.order ? <OperationalOrderCard order={result.order} /> : null}
      {result.media_understanding ? (
        <MediaUnderstandingChips media={result.media_understanding} />
      ) : null}
      {traceItems.length ? (
        <div className="flex flex-wrap gap-2">
          {traceItems.map((item) => (
            <span key={`${item.label}-${item.value}`} className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background px-2 py-1">
              <span className="font-medium text-muted-foreground">{item.label}</span>
              <span className="min-w-0 truncate">{item.value}</span>
            </span>
          ))}
        </div>
      ) : null}
      {hasActions ? <LeadCaptureNextActions actions={visibleActions} /> : null}
      {result.request_id ? (
        <p className="break-all text-[11px] text-muted-foreground">request_id: {result.request_id}</p>
      ) : null}
    </div>
  );
}

function MediaUnderstandingChips({
  media,
}: {
  media: NonNullable<LeadCaptureResponse['media_understanding']>;
}) {
  const received = media.received ?? [];
  if (!received.length) return null;

  const iconFor = (kind: string) => {
    const normalized = kind.toLowerCase();
    if (normalized.includes('image') || normalized.includes('foto')) return ImageIcon;
    if (normalized.includes('audio') || normalized.includes('voice')) return Mic;
    if (normalized.includes('video')) return Video;
    if (normalized.includes('location') || normalized.includes('ubic')) return MapPin;
    return FileText;
  };

  return (
    <div className="flex flex-wrap gap-2" aria-label="Medios recibidos">
      {received.map((kind) => {
        const Icon = iconFor(kind);
        return (
          <span
            key={kind}
            className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background px-2 py-1 text-muted-foreground"
          >
            <Icon className="h-3 w-3 text-primary" />
            <span className="truncate">{kind}</span>
          </span>
        );
      })}
    </div>
  );
}

function OperationalTicketCard({ ticket }: { ticket: OperationalTicketResult }) {
  const rows = [
    ticket.nro_ticket ? { label: 'Ticket', value: String(ticket.nro_ticket) } : null,
    ticket.categoria ? { label: 'Categoria', value: ticket.categoria } : null,
    ticket.direccion ? { label: 'Direccion', value: ticket.direccion } : null,
    ticket.nombre_vecino ? { label: 'Vecino', value: ticket.nombre_vecino } : null,
    ticket.telefono_vecino ? { label: 'Telefono', value: ticket.telefono_vecino } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const hasLocation = hasFiniteCoordinates(ticket);
  const whatsappCase = ticket.canal_ingreso?.trim().toLowerCase() === 'whatsapp';
  const attachments = ticket.archivos ?? [];
  const attachmentCount = ticket.archivos_count ?? attachments.length;

  return (
    <div className="rounded-[8px] border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <TicketCheck className="h-3.5 w-3.5 text-primary" />
          Reclamo creado
        </span>
        {whatsappCase ? (
          <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
            Ingresado por WhatsApp
          </span>
        ) : ticket.canal_ingreso ? (
          <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
            {ticket.canal_ingreso}
          </span>
        ) : null}
        {ticket.detail_endpoint ? (
          <a
            href={ticket.detail_endpoint}
            className="inline-flex items-center gap-1 rounded-full border bg-muted/20 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Ver seguimiento <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      {rows.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="min-w-0 rounded-md border bg-muted/20 px-2.5 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{row.label}</p>
              <p className="mt-1 truncate font-semibold text-foreground">{row.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {hasLocation ? (
        <div className="mt-3 rounded-md border bg-muted/20 p-2.5">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 text-primary" />
            <div className="min-w-0">
              <p className="font-medium text-foreground">Ubicacion recibida</p>
              <p className="mt-0.5 text-muted-foreground">
                {ticket.latitud!.toFixed(5)}, {ticket.longitud!.toFixed(5)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {ticket.foto_url_directa || attachments.length || attachmentCount ? (
        <div className="mt-3 space-y-2">
          {ticket.foto_url_directa ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <ImageIcon className="h-3.5 w-3.5 text-primary" />
                Evidencia
              </div>
              <SafeEvidenceImage src={ticket.foto_url_directa} alt="Foto enviada en el reclamo" />
            </div>
          ) : null}
          {attachments.length ? (
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment, index) => {
                const label = getAttachmentLabel(attachment, index);
                const url = getAttachmentUrl(attachment);
                return url ? (
                  <a
                    key={`${label}-${url}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/20 px-2 py-1 text-muted-foreground hover:text-foreground"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="truncate">{label}</span>
                  </a>
                ) : (
                  <span
                    key={`${label}-${index}`}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/20 px-2 py-1 text-muted-foreground"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="truncate">{label}</span>
                  </span>
                );
              })}
            </div>
          ) : attachmentCount ? (
            <span className="inline-flex items-center gap-1 rounded-full border bg-muted/20 px-2 py-1 text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              {attachmentCount} archivo{attachmentCount === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function OperationalOrderCard({ order }: { order: OperationalOrderResult }) {
  const rows = [
    order.nro_pedido ? { label: 'Pedido', value: String(order.nro_pedido) } : null,
    order.nombre_cliente ? { label: 'Cliente', value: order.nombre_cliente } : null,
    order.telefono_cliente ? { label: 'Telefono', value: order.telefono_cliente } : null,
    order.monto_total !== null && order.monto_total !== undefined
      ? { label: 'Total', value: formatOperationalCurrency(order.monto_total) ?? String(order.monto_total) }
      : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const details = order.detalles ?? [];
  const trackingUrl = order.nro_pedido ? (order.tracking_url || `/tracking/order/${encodeURIComponent(String(order.nro_pedido))}`) : null;

  return (
    <div className="rounded-[8px] border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <PackageCheck className="h-3.5 w-3.5 text-primary" />
          Pedido creado
        </span>
        {trackingUrl ? (
          <a
            href={trackingUrl}
            className="inline-flex items-center gap-1 rounded-full border bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Tracking <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      {rows.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="min-w-0 rounded-md border bg-muted/20 px-2.5 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{row.label}</p>
              <p className="mt-1 truncate font-semibold text-foreground">{row.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {details.length ? (
        <div className="mt-3 divide-y rounded-md border">
          {details.map((detail, index) => (
            <OrderDetailRow key={`${detail.sku ?? detail.nombre_producto ?? 'item'}-${index}`} detail={detail} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OrderDetailRow({ detail }: { detail: OperationalOrderDetail }) {
  const currency = detail.moneda || 'ARS';
  const subtotal = formatOperationalCurrency(detail.subtotal_con_descuento, currency);
  const unit = formatOperationalCurrency(detail.precio_unitario_original, currency);
  return (
    <div className="flex items-start justify-between gap-3 px-2.5 py-2">
      <div className="min-w-0">
        {detail.nombre_producto ? (
          <p className="truncate font-medium text-foreground">{detail.nombre_producto}</p>
        ) : null}
        <p className="mt-0.5 text-muted-foreground">
          {detail.cantidad !== null && detail.cantidad !== undefined ? `${detail.cantidad} x ` : ''}
          {unit ?? ''}
          {detail.sku ? <span className="ml-2 font-mono text-[10px]">{detail.sku}</span> : null}
        </p>
      </div>
      {subtotal ? <span className="shrink-0 font-semibold text-foreground">{subtotal}</span> : null}
    </div>
  );
}

function LeadCaptureNextActions({ actions }: { actions: LeadCaptureNextAction[] }) {
  const visibleActions = actions.filter((action) => action.label?.trim());
  if (!visibleActions.length) return null;

  return (
    <div className="flex flex-wrap gap-2" aria-label="Acciones de seguimiento">
      {visibleActions.map((action, index) => {
        const label = action.label?.trim() || '';
        const endpoint = action.endpoint?.trim();
        const key = action.id?.trim() || `${label}-${index}`;

        if (endpoint) {
          return (
            <Button key={key} type="button" size="sm" variant="outline" className="h-auto text-xs" asChild>
              <a href={endpoint}>{label}</a>
            </Button>
          );
        }

        return (
          <Button key={key} type="button" size="sm" variant="outline" className="h-auto text-xs" disabled>
            {label}
          </Button>
        );
      })}
    </div>
  );
}
