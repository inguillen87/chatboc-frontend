import React from 'react';
import type { HandoffState } from './chatTypes';

const HANDOFF_COPY: Record<Exclude<HandoffState, 'none'>, string> = {
  requested_by_user: 'Entendido. Podemos escalar esta conversación a una persona del equipo.',
  required_by_backend: 'El backend indicó que este caso requiere intervención humana.',
  api_unavailable: 'Ahora mismo no pudimos responder automáticamente. Podés continuar por canales humanos.',
};

export default function HandoffBanner({
  state,
  onCreateTicket,
  onOpenWhatsApp,
  onWaitOperator,
}: {
  state: HandoffState;
  onCreateTicket?: () => void;
  onOpenWhatsApp?: () => void;
  onWaitOperator?: () => void;
}) {
  if (state === 'none') return null;

  return (
    <div className="rounded-lg border border-amber-300/50 bg-amber-50/70 p-3 text-sm" role="status" aria-live="polite">
      <p className="mb-2 text-amber-900">{HANDOFF_COPY[state]}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded border px-2 py-1" onClick={onCreateTicket}>Crear ticket</button>
        <button type="button" className="rounded border px-2 py-1" onClick={onOpenWhatsApp}>Enviar WhatsApp</button>
        <button type="button" className="rounded border px-2 py-1" onClick={onWaitOperator}>Esperar operador</button>
      </div>
    </div>
  );
}
