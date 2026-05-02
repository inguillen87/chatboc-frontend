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
import { submitLeadCapture } from './chatApi';
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
  block?.description?.trim() || block?.subtitle?.trim() || '';

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
    .filter((item): item is QuickReplyItem => Boolean(item));
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
  const [leadValues, setLeadValues] = useState<Record<string, string>>({});
  const [leadStatus, setLeadStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [leadError, setLeadError] = useState<string | null>(null);
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
    try {
      await submitLeadCapture(
        config,
        {
          tenant_slug: resolvedContext.tenantSlug ?? undefined,
          tipo_chat: resolvedContext.tipoChat,
          conversation_id: conversationId ?? undefined,
          fields: values,
          ...meta,
        },
        resolvedContext.tenantSlug,
      );
      setLeadStatus('sent');
      setActiveLead(null);
      setLeadValues({});
      const success = config.success_message?.trim();
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
      void submitLead(config, {}, meta);
      return;
    }
    setActiveLead(config);
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
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          {trustSignals.map((item, index) => {
            const label = readBlockTitle(item);
            const description = readBlockDescription(item);
            if (!label && !description) return null;
            return (
              <div key={item.id || `${label}-${index}`} className="rounded-md border bg-background/60 px-3 py-2">
                {label ? <p className="font-medium text-foreground">{label}</p> : null}
                {description ? <p className="text-muted-foreground">{description}</p> : null}
              </div>
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
            void submitLead(activeLead, values);
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
              onClick={() => setActiveLead(null)}
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
      <ChatComposer
        onSend={appendUserMessage}
        placeholder={resolvedContext.composerPlaceholder || undefined}
        sendLabel={resolvedContext.sendLabel || undefined}
        mediaCapabilities={resolvedMediaCapabilities}
        draftText={composerDraft}
        intent={composerIntent}
        payload={composerPayload}
      />
      <ConversationRating conversationId={conversationId} />
    </section>
  );
}
