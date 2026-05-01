import React, { useMemo, useState } from 'react';
import LegacyChatPanel from '@/components/chat/ChatPanel';
import ChatMessageList from './ChatMessageList';
import ChatComposer from './ChatComposer';
import QuickReplies from './QuickReplies';
import HandoffBanner from './HandoffBanner';
import ConversationRating from './ConversationRating';
import ChatEmptyState from './ChatEmptyState';
import type { ChatPanelContext, ChatUiMessage, HandoffLabels, HandoffState, QuickReplyItem } from './chatTypes';

interface FeatureChatPanelProps {
  variant?: 'legacy-widget' | 'standalone';
  context?: ChatPanelContext;
  conversationId?: string | null;
  handoffState?: HandoffState;
  handoffLabels?: HandoffLabels;
  quickReplies?: QuickReplyItem[];
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
  initialMessages,
  onCreateTicket,
  onOpenWhatsApp,
  onWaitOperator,
}: StandaloneChatPanelProps) {
  const resolvedContext: ChatPanelContext = context ?? { tipoChat: 'pyme' };
  const [runtimeHandoffState, setRuntimeHandoffState] = useState<HandoffState>(handoffState);
  const [messages, setMessages] = useState<ChatUiMessage[]>(() => buildInitialMessages(resolvedContext, initialMessages));
  const replies = useMemo(
    () => quickReplies ?? resolvedContext.quickReplies ?? [],
    [quickReplies, resolvedContext.quickReplies],
  );

  const appendUserMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text, timestamp: new Date().toISOString() },
    ]);

    if (isHumanRequest(text)) {
      setRuntimeHandoffState('requested_by_user');
    }
  };

  return (
    <section className="space-y-3" aria-label="Panel de chat">
      <HandoffBanner
        state={runtimeHandoffState}
        labels={handoffLabels}
        onCreateTicket={onCreateTicket}
        onOpenWhatsApp={onOpenWhatsApp}
        onWaitOperator={onWaitOperator}
      />
      {messages.length === 0 ? (
        <ChatEmptyState
          title={resolvedContext.emptyTitle || 'Sin mensajes'}
          subtitle={resolvedContext.emptySubtitle || 'Selecciona una accion disponible o escribi para comenzar.'}
        />
      ) : (
        <ChatMessageList messages={messages} />
      )}
      <QuickReplies items={replies} onSelect={(item) => appendUserMessage(item.payload || item.label)} />
      <ChatComposer
        onSend={appendUserMessage}
        placeholder={resolvedContext.composerPlaceholder || undefined}
        sendLabel={resolvedContext.sendLabel || undefined}
      />
      <ConversationRating conversationId={conversationId} />
    </section>
  );
}
