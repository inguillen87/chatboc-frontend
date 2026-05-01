import React, { useState } from 'react';

export default function ChatComposer({
  onSend,
  placeholder = 'Escribi tu mensaje',
  sendLabel = 'Enviar',
}: {
  onSend: (text: string) => void;
  placeholder?: string;
  sendLabel?: string;
}) {
  const [text, setText] = useState('');

  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = text.trim();
        if (!trimmed) return;
        onSend(trimmed);
        setText('');
      }}
    >
      <input
        className="flex-1 rounded border px-2 py-1"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        aria-label="Mensaje"
      />
      <button type="submit" className="rounded bg-primary px-3 py-1 text-primary-foreground" aria-label={sendLabel}>
        {sendLabel}
      </button>
    </form>
  );
}
