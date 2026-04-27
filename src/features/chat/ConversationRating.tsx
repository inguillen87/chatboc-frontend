import React, { useState } from 'react';
import { sendConversationFeedback } from './chatApi';
import type { ChatRatingValue } from './chatTypes';

const OPTIONS: { value: ChatRatingValue; label: string }[] = [
  { value: 'satisfecho', label: 'Satisfecho' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'insatisfecho', label: 'Insatisfecho' },
];

export default function ConversationRating({ conversationId }: { conversationId?: string | null }) {
  const [selected, setSelected] = useState<ChatRatingValue | null>(null);
  const [status, setStatus] = useState<string>('');

  const handleRate = async (value: ChatRatingValue) => {
    setSelected(value);
    try {
      const result = await sendConversationFeedback(conversationId || '', value);
      setStatus(result === 'sent' ? '¡Gracias por tu feedback!' : 'Feedback guardado localmente.');
    } catch {
      setStatus('No se pudo enviar ahora. Intentalo más tarde.');
    }
  };

  return (
    <div className="space-y-2 rounded-lg border p-3" aria-label="Calificación de conversación">
      <p className="text-xs text-muted-foreground">¿Cómo fue tu experiencia?</p>
      <div className="flex gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => void handleRate(option.value)}
            className={`rounded border px-2 py-1 text-xs ${selected === option.value ? 'border-primary text-primary' : ''}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}
