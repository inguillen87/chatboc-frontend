import React, { useState } from 'react';

export default function ChatComposer({ onSend }: { onSend: (text: string) => void }) {
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
        placeholder="Escribí tu mensaje"
        aria-label="Mensaje"
      />
      <button type="submit" className="rounded bg-primary px-3 py-1 text-primary-foreground" aria-label="Enviar mensaje">
        Enviar
      </button>
    </form>
  );
}
