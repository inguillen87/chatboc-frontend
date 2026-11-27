import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';

import './institutionalResponseAudio.css';

type DictationCopy = {
  listening: string;
  permissionDenied: string;
  recognitionError: string;
  startError: string;
};

const DEFAULT_DICTATION_COPY: DictationCopy = {
  listening: 'Te escucho. Decí tu consulta.',
  permissionDenied: 'Para dictar, permití el uso del micrófono en el navegador.',
  recognitionError: 'No pudimos escucharte. Probá de nuevo o escribí tu consulta.',
  startError: 'No pudimos iniciar el dictado. Escribí tu consulta.',
};

type DictationControlProps = {
  disabled: boolean;
  onText: (text: string) => void;
  copy?: Partial<DictationCopy>;
  statusId?: string;
  fullLabel?: boolean;
};

/**
 * Dictation with the browser's own speech recognition. It only places words in
 * the caller's field: voice recognition never submits or records the form.
 */
export function DictationControl({
  disabled,
  onText,
  copy,
  statusId,
  fullLabel = false,
}: DictationControlProps) {
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState('');
  const recognition = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const active = useRef(true);
  const messages = { ...DEFAULT_DICTATION_COPY, ...copy };
  const Recognition = typeof window === 'undefined'
    ? null
    : ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      try {
        recognition.current?.abort();
      } catch {
        // The browser may have already stopped the recognition session.
      }
    };
  }, []);

  if (!Recognition) {
    return statusId
      ? <span id={statusId} role="status" className="institutional-assistant__dictate-note" />
      : null;
  }

  const toggle = () => {
    if (listening) {
      try {
        recognition.current?.stop();
      } catch {
        // The browser may have already stopped the recognition session.
      }
      return;
    }

    try {
      const session = new Recognition();
      session.lang = 'es-AR';
      session.interimResults = false;
      session.maxAlternatives = 1;
      session.onresult = (event: any) => {
        const text = Array.from(event.results as ArrayLike<any>)
          .map((result) => String(result?.[0]?.transcript ?? ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (active.current && text) onText(text);
      };
      session.onerror = (event: any) => {
        if (!active.current) return;
        setNote(
          event?.error === 'not-allowed' || event?.error === 'service-not-allowed'
            ? messages.permissionDenied
            : messages.recognitionError,
        );
      };
      session.onend = () => {
        if (active.current) setListening(false);
      };
      recognition.current = session;
      setNote('');
      session.start();
      setListening(true);
    } catch {
      setNote(messages.startError);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`institutional-assistant__dictate${fullLabel ? ' institutional-assistant__dictate--full-label' : ''}`}
        aria-pressed={listening}
        disabled={disabled}
        onClick={toggle}
      >
        <Mic size={19} aria-hidden="true" />
        <span>{listening ? 'Terminar' : 'Dictar'}</span>
      </button>
      <span id={statusId} role="status" className="institutional-assistant__dictate-note">
        {listening ? messages.listening : note}
      </span>
    </>
  );
}
