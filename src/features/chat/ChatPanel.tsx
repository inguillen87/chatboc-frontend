import React, { useMemo, useState } from 'react';
import LegacyChatPanel from '@/components/chat/ChatPanel';
import ChatMessageList from './ChatMessageList';
import ChatComposer, { type ChatComposerPayload } from './ChatComposer';
import QuickReplies from './QuickReplies';
import HandoffBanner from './HandoffBanner';
import ConversationRating from './ConversationRating';
import ChatEmptyState from './ChatEmptyState';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/utils/api';
import { getOrCreateAnonId } from '@/utils/anonId';
import getOrCreateChatSessionId from '@/utils/chatSessionId';
import {
  createLeadCaptureIdempotencyKey,
  extractChatBootstrapReplyText,
  sendChatBootstrapMessage,
  submitLeadCapture,
  type LeadCaptureNextAction,
  type LeadCaptureResponse,
} from './chatApi';
import type { ChatPanelContext, ChatUiMessage, HandoffLabels, HandoffState, QuickReplyItem } from './chatTypes';
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
}

type LegacyChatPanelProps = React.ComponentProps<typeof LegacyChatPanel> & {
  quickMenu?: unknown;
};

type StandaloneChatPanelProps = Omit<FeatureChatPanelProps, 'variant'>;

const isHumanRequest = (text: string) => /human|persona|operador|agente/i.test(text);
const HIGH_INTENT_TERMS = ['checkout', 'pedido', 'derivar_humano', 'humano', 'reclamo', 'estado'];

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
  const [leadResult, setLeadResult] = useState<LeadCaptureResponse | null>(null);
  const resolvedBlueprint =
    experienceBlueprint ?? resolvedContext.experienceBlueprint ?? null;
  const resolvedLeadCapture =
    leadCapture ?? resolvedContext.leadCapture ?? resolvedBlueprint?.lead_capture ?? null;
  const resolvedMediaCapabilities =
    mediaCapabilities ?? resolvedContext.mediaCapabilities ?? resolvedBlueprint?.media_capabilities ?? null;
  const resolvedConversionCtas =
    conversionCtas ?? resolvedContext.conversionCtas ?? resolvedBlueprint?.conversion_ctas ?? null;
  const resolvedEmptyStates =
    emptyStates ?? resolvedContext.emptyStates ?? resolvedBlueprint?.empty_states ?? {};
  const resolvedAnimationTokens =
    animationTokens ?? resolvedContext.animationTokens ?? resolvedBlueprint?.animation_tokens ?? null;
  const resolvedChatBootstrap = resolvedContext.chatBootstrap ?? null;
  const hasRuntimeChat = Boolean(
    resolvedChatBootstrap?.endpoint?.trim() || resolvedChatBootstrap?.fallback_endpoint?.trim(),
  );
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
    setLeadStatus('sending');
    setLeadError(null);
    setLeadResult(null);
    try {
      const chatSessionId = getOrCreateChatSessionId();
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
          tenant_slug: resolvedContext.tenantSlug ?? undefined,
          tipo_chat: resolvedContext.tipoChat,
          chat_session_id: chatSessionId,
          anon_id: anonId || undefined,
          channel: typeof cleanMeta.channel === 'string' ? cleanMeta.channel : 'web',
          source: typeof cleanMeta.source === 'string' ? cleanMeta.source : 'chat_panel',
          trigger,
          intent: typeof cleanMeta.intent === 'string' ? cleanMeta.intent : trigger,
          conversation_id: conversationId ?? undefined,
          idempotency_key: idempotencyKey,
          fields: values,
        },
        resolvedContext.tenantSlug,
        { idempotencyKey },
      );
      setLeadStatus('sent');
      setLeadResult(response);
      setActiveLead(null);
      setActiveLeadMeta({});
      setLeadValues({});
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
            return (
              <label key={name} className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                {field.options?.length ? (
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    value={leadValues[name] || ''}
                    required={field.required}
                    onChange={(event) =>
                      setLeadValues((prev) => ({ ...prev, [name]: event.target.value }))
                    }
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
                    required={field.required}
                    placeholder={field.placeholder ?? undefined}
                    onChange={(event) =>
                      setLeadValues((prev) => ({ ...prev, [name]: event.target.value }))
                    }
                  />
                )}
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
    result.contract_version ? { label: 'Contrato', value: result.contract_version } : null,
    result.lead_id ? { label: 'Lead', value: String(result.lead_id) } : null,
    result.ticket_id ? { label: 'Ticket', value: String(result.ticket_id) } : null,
    result.status ? { label: 'Estado', value: result.status } : null,
    result.deduplicated ? { label: 'Deduplicado', value: 'true' } : null,
    result.request_id ? { label: 'Req', value: result.request_id } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const hasActions = Boolean(result.next_actions?.length);

  if (!traceItems.length && !hasActions) return null;

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-xs" aria-label="Lead capturado">
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
      {hasActions ? <LeadCaptureNextActions actions={result.next_actions ?? []} /> : null}
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
