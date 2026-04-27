import React, { useMemo, useState } from 'react';
import LegacyChatPanel from '@/components/chat/ChatPanel';
import ChatMessageList from './ChatMessageList';
import ChatComposer from './ChatComposer';
import QuickReplies from './QuickReplies';
import HandoffBanner from './HandoffBanner';
import ConversationRating from './ConversationRating';
import ChatEmptyState from './ChatEmptyState';
import type { ChatPanelContext, ChatUiMessage, HandoffState, QuickReplyItem } from './chatTypes';

const quickRepliesForContext = (ctx: ChatPanelContext): QuickReplyItem[] => {
  if (ctx.tipoChat === 'municipio' || ctx.sector === 'gobierno') {
    return [
      { id: 'm-reclamo', label: 'Quiero hacer un reclamo' },
      { id: 'm-tramite', label: 'Consultar estado de un trámite' },
      { id: 'm-encuestas', label: 'Ver encuestas disponibles' },
      { id: 'm-humano', label: 'Hablar con una persona' },
    ];
  }

  return [
    { id: 'p-precios', label: 'Consultar precios' },
    { id: 'p-productos', label: 'Ver productos' },
    { id: 'p-presupuesto', label: 'Pedir presupuesto' },
    { id: 'p-ventas', label: 'Hablar con ventas' },
  ];
};

const initialAssistantMessage = (ctx: ChatPanelContext) => {
  if (ctx.tipoChat === 'municipio' || ctx.sector === 'gobierno') {
    return 'Te ayudo con atención ciudadana, reclamos, encuestas y trámites.';
  }
  return 'Te ayudo con ventas, catálogo, presupuestos y soporte para tu negocio.';
};

interface FeatureChatPanelProps {
  variant?: 'legacy-widget' | 'standalone';
  context?: ChatPanelContext;
  conversationId?: string | null;
  handoffState?: HandoffState;
  onCreateTicket?: () => void;
  onOpenWhatsApp?: () => void;
  onWaitOperator?: () => void;
}

export default function ChatPanel(props: FeatureChatPanelProps & Record<string, unknown>) {
  const { variant = 'standalone', context, conversationId, handoffState = 'none', onCreateTicket, onOpenWhatsApp, onWaitOperator, ...legacyProps } = props;

  if (variant === 'legacy-widget') {
    return <LegacyChatPanel {...(legacyProps as any)} />;
  }

  const resolvedContext: ChatPanelContext = context ?? { tipoChat: 'pyme' };
  const [messages, setMessages] = useState<ChatUiMessage[]>([
    {
      id: 'assistant-welcome',
      role: 'assistant',
      text: initialAssistantMessage(resolvedContext),
      timestamp: new Date().toISOString(),
    },
  ]);

  const replies = useMemo(() => quickRepliesForContext(resolvedContext), [resolvedContext]);

  const appendUserMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text, timestamp: new Date().toISOString() },
    ]);
  };

  return (
    <section className="space-y-3" aria-label="Panel de chat">
      <HandoffBanner
        state={handoffState}
        onCreateTicket={onCreateTicket}
        onOpenWhatsApp={onOpenWhatsApp}
        onWaitOperator={onWaitOperator}
      />
      {messages.length === 0 ? (
        <ChatEmptyState title="Todavía no hay mensajes" subtitle="Escribí o elegí una sugerencia para comenzar." />
      ) : (
        <ChatMessageList messages={messages} />
      )}
      <QuickReplies items={replies} onSelect={(item) => appendUserMessage(item.payload || item.label)} />
      <ChatComposer onSend={appendUserMessage} />
      <ConversationRating conversationId={conversationId} />
    </section>
  );
}
