import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ChatMessageList from './ChatMessageList';
import ConversationRating from './ConversationRating';

describe('chat accessibility semantics', () => {
  it('exposes incoming messages as a polite live log', () => {
    render(
      <ChatMessageList
        messages={[{ id: 'welcome', role: 'assistant', text: 'Hola, ¿cómo puedo ayudarte?' }]}
      />,
    );

    expect(screen.getByRole('log', { name: 'Lista de mensajes' })).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('groups the conversation rating controls under their accessible label', () => {
    render(<ConversationRating conversationId="demo-conversation" />);

    expect(
      screen.getByRole('group', { name: 'Calificación de conversación' }),
    ).toBeInTheDocument();
  });
});
